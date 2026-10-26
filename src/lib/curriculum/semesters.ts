import { z } from "zod";
import { GRADES, gradePoint, isPassingGrade } from "@/lib/curriculum/grades";
import { calculateGpa } from "@/lib/curriculum/transcript";
import { mergeTranscriptCourses } from "@/lib/curriculum/transcriptStore";
import type { TranscriptCourseRecord } from "@/lib/curriculum/types";
import type { Language } from "@/lib/i18n/translations";
import { courseLanguageVariants, normalizeCourseCode } from "@/lib/itu/courseCode.mjs";
import type { WeeklyProgram } from "@/types/calendar";

export const CURRENT_SEMESTER_STORAGE_KEY = "simplify-current-semester-v1";
export const CURRENT_SEMESTER_EVENT = "simplify:current-semester";

const currentCourseSchema = z.object({
  courseCode: z.string().trim().min(1),
  courseName: z.string().trim().min(1),
  credit: z.number().finite().nonnegative().nullable(),
  grade: z.enum(GRADES).nullable(),
});
export const currentSemesterSchema = z.object({ version: z.literal(1), courses: z.array(currentCourseSchema) });
export type CurrentSemesterCourse = z.infer<typeof currentCourseSchema>;

export function displayedGpaChange(current: number | null, projected: number | null) {
  if (current === null || projected === null) return null;
  // Match the GPA display's Intl rounding, then subtract integer hundredths.
  const display = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
  const hundredths = (value: number) => Math.round(Number(display.format(value)) * 100);
  return (hundredths(projected) - hundredths(current)) / 100;
}

export function resolveSemesterCourseCredits(
  courses: readonly CurrentSemesterCourse[],
  curriculum: ReadonlyMap<string, { title: string; creditOptions: number[] }>,
  database: Readonly<Record<string, number | null>>,
): CurrentSemesterCourse[] {
  return courses.map(course => {
    const code = normalizeCourseCode(course.courseCode);
    const options = curriculum.get(code)?.creditOptions;
    const credit = options?.length === 1 ? options[0] : database[code] ?? null;
    return { ...course, courseCode: code, credit };
  });
}

export function projectedOverallGpa(transcript: readonly TranscriptCourseRecord[], courses: readonly CurrentSemesterCourse[]) {
  const graded = courses.filter(course => course.grade !== null);
  if (!graded.length || graded.some(course => course.credit === null && gradePoint(course.grade!) !== null)) return null;
  const records = new Map(transcript.map(course => [normalizeCourseCode(course.courseCode), course]));
  graded.forEach(course => courseLanguageVariants(course.courseCode).forEach(code => records.delete(code)));
  for (const course of graded) {
    records.set(normalizeCourseCode(course.courseCode), {
      term: "", crn: "", courseCode: course.courseCode, courseName: course.courseName,
      grade: course.grade!, transcriptCredit: course.credit ?? 0, countedCredit: 0,
      calculated: true, completionStatus: isPassingGrade(course.grade!) ? "passed" : "failed", source: "transcript",
    });
  }
  return calculateGpa([...records.values()]);
}

export function semesterTermLabel(term: string, language: Language) {
  const match = /^(\d{4})(10|20|30)$/.exec(term);
  if (!match) return term;
  const year = Number(match[1]);
  const seasons = language === "tr"
    ? { "10": "Güz Dönemi", "20": "Bahar Dönemi", "30": "Yaz Dönemi" }
    : { "10": "Fall Semester", "20": "Spring Semester", "30": "Summer Semester" };
  return `${year - 1}-${match[1]} ${seasons[match[2] as keyof typeof seasons]}`;
}

export function importWeeklySemesterCourses(
  program: WeeklyProgram,
  metadata: ReadonlyMap<string, { title: string; creditOptions: number[] }>,
): CurrentSemesterCourse[] {
  const courses = new Map<string, CurrentSemesterCourse>();
  const add = (rawCode: string, title?: string) => {
    const code = normalizeCourseCode(rawCode);
    if (!code || courses.has(code)) return;
    const course = metadata.get(code);
    courses.set(code, { courseCode: code, courseName: course?.title ?? title ?? code,
      credit: course?.creditOptions.length === 1 ? course.creditOptions[0] : null, grade: null });
  };
  program.courseBlocks.forEach(block => add(block.code, block.title));
  // Published catalogue IDs use branch:course-code, including courses with no meetings.
  program.courseSelections.forEach(selection => {
    if (!selection.sectionId) return;
    const code = selection.courseId.replace(/^[^:]+:/, "");
    if (/^[A-ZÇĞİÖŞÜ]{2,8}\s*\d{2,5}[A-Z]{0,3}$/u.test(code)) add(code);
  });
  return [...courses.values()];
}

export function parseCurrentSemester(value: string | null): CurrentSemesterCourse[] {
  if (!value) return [];
  try {
    const parsed = currentSemesterSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data.courses : [];
  } catch { return []; }
}

export function serializeCurrentSemester(courses: readonly CurrentSemesterCourse[]) {
  return JSON.stringify({ version: 1, courses });
}

export function currentSemesterGpa(courses: readonly CurrentSemesterCourse[]) {
  if (courses.some(course => course.grade !== null && gradePoint(course.grade) !== null && course.credit === null)) return null;
  let weighted = 0;
  let credits = 0;
  for (const course of courses) {
    const point = course.grade === null ? null : gradePoint(course.grade);
    if (point === null || course.credit === null) continue;
    weighted += point * course.credit;
    credits += course.credit;
  }
  return credits > 0 ? weighted / credits : null;
}

export function groupTranscriptSemesters(courses: readonly TranscriptCourseRecord[]) {
  const groups = new Map<string, TranscriptCourseRecord[]>();
  for (const course of courses) groups.set(course.term, [...(groups.get(course.term) ?? []), course]);
  let cumulative: TranscriptCourseRecord[] = [];
  return [...groups].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([term, records]) => {
    // An old attempt can be excluded today but still count before its retake.
    const historicalRecords = records.map(record => ({ ...record, calculated: true }));
    cumulative = mergeTranscriptCourses(cumulative, historicalRecords);
    return {
      term,
      courses: [...records].sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
      gpa: calculateGpa(historicalRecords),
      overallGpa: calculateGpa(cumulative),
    };
  }).reverse();
}
