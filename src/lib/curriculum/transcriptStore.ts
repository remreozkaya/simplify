import { z } from "zod";

import { GRADES } from "@/lib/curriculum/grades";
import type { CourseProgress, CurriculumProgress, TranscriptCourseRecord } from "@/lib/curriculum/types";
import { normalizeCourseCode } from "@/lib/itu/courseCode.mjs";
import type { TranscriptParseResult } from "@/lib/curriculum/transcript";

export const SHARED_TRANSCRIPT_STORAGE_KEY = "simplify-transcript-v1";
export const SHARED_TRANSCRIPT_EVENT = "simplify:transcript";

const recordSchema = z.object({
  term: z.string(),
  crn: z.string(),
  courseCode: z.string(),
  courseName: z.string(),
  courseLanguage: z.string().optional(),
  grade: z.enum(GRADES),
  countedCredit: z.number().nonnegative(),
  transcriptCredit: z.number().nonnegative(),
  completionStatus: z.enum(["passed", "failed"]),
  source: z.literal("transcript"),
  calculated: z.boolean(),
});

const storeSchema = z.object({
  version: z.literal(1),
  courses: z.array(recordSchema),
  updatedAt: z.string().datetime(),
});

const legacyProgressStoreSchema = z.object({
  plans: z.record(z.string(), z.object({ importedCourses: z.array(recordSchema).optional() }).passthrough()),
}).passthrough();

export function parseSharedTranscript(value: string | null): TranscriptCourseRecord[] {
  if (!value) return [];
  try {
    const parsed = storeSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data.courses : [];
  } catch {
    return [];
  }
}

export function transcriptFromLegacyProgress(progresses: readonly CurriculumProgress[]) {
  return progresses.find((progress) => progress.importedCourses?.length)?.importedCourses ?? [];
}

export function transcriptFromLegacyProgressStore(value: string | null) {
  if (!value) return [];
  try {
    const parsed = legacyProgressStoreSchema.safeParse(JSON.parse(value));
    if (!parsed.success) return [];
    return Object.values(parsed.data.plans).find((plan) => plan.importedCourses?.length)?.importedCourses ?? [];
  } catch {
    return [];
  }
}

export function serializeSharedTranscript(courses: readonly TranscriptCourseRecord[], updatedAt = new Date().toISOString()) {
  return JSON.stringify({ version: 1, courses, updatedAt });
}

function termOrder(term: string) {
  const numeric = Number(term);
  return Number.isFinite(numeric) ? numeric : 0;
}

/**
 * Adds a partial/new-semester transcript export to the stored transcript.
 * Course code is the attempt identity used by the transcript parser as well:
 * the newest term wins, and an equal-term import refreshes corrected metadata.
 */
export function mergeTranscriptCourses(
  existing: readonly TranscriptCourseRecord[],
  incoming: readonly TranscriptCourseRecord[],
): TranscriptCourseRecord[] {
  const merged = new Map<string, TranscriptCourseRecord>();
  existing.forEach((course) => {
    const courseCode = normalizeCourseCode(course.courseCode);
    const current = merged.get(courseCode);
    if (!current || termOrder(course.term) >= termOrder(current.term)) {
      merged.set(courseCode, { ...course, courseCode });
    }
  });
  incoming.forEach((course) => {
    const courseCode = normalizeCourseCode(course.courseCode);
    const current = merged.get(courseCode);
    if (!current || termOrder(course.term) >= termOrder(current.term)) {
      merged.set(courseCode, { ...course, courseCode });
    }
  });
  return [...merged.values()].sort((first, second) =>
    termOrder(first.term) - termOrder(second.term) ||
    first.courseCode.localeCompare(second.courseCode, "tr"),
  );
}

export function persistSharedTranscript(courses: readonly TranscriptCourseRecord[]) {
  localStorage.setItem(SHARED_TRANSCRIPT_STORAGE_KEY, serializeSharedTranscript(courses));
  window.dispatchEvent(new CustomEvent(SHARED_TRANSCRIPT_EVENT));
}

export function transcriptParseResult(courses: readonly TranscriptCourseRecord[]): TranscriptParseResult {
  return {
    calculatedCourses: courses.filter((course) => course.calculated),
    nonCalculatedCourses: courses.filter((course) => !course.calculated),
    invalidRows: [],
    duplicateRows: [],
  };
}

export function sharedCourseProgress(courses: readonly TranscriptCourseRecord[]): Record<string, CourseProgress> {
  return Object.fromEntries(courses.map((course) => [normalizeCourseCode(course.courseCode), {
    state: course.completionStatus,
    grade: course.grade,
    term: course.term,
    crn: course.crn,
    courseCode: normalizeCourseCode(course.courseCode),
    courseName: course.courseName,
    source: "transcript" as const,
  }]));
}
