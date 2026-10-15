import { describe, expect, it } from "vitest";
import { currentSemesterGpa, groupTranscriptSemesters, parseCurrentSemester, serializeCurrentSemester, semesterTermLabel, importWeeklySemesterCourses, resolveSemesterCourseCredits, projectedOverallGpa, displayedGpaChange } from "@/lib/curriculum/semesters";
import type { WeeklyProgram } from "@/types/calendar";
import type { TranscriptCourseRecord } from "@/lib/curriculum/types";

const record = (overrides: Partial<TranscriptCourseRecord> = {}): TranscriptCourseRecord => ({ term: "202510", crn: "1", courseCode: "MAT 103E", courseName: "Math", grade: "BA", countedCredit: 0, transcriptCredit: 4, completionStatus: "passed", source: "transcript", calculated: true, ...overrides });

it.each([
  [3.8351, 3.8649, 0.02],
  [3.8449, 3.8551, 0.02],
  [3.8649, 3.8351, -0.02],
  [3.841, 3.844, 0],
  [3.835, 3.865, 0.03],
  [null, 3.86, null],
  [3.84, null, null],
])("subtracts displayed GPAs for %s → %s", (current, projected, expected) => {
  expect(displayedGpaChange(current, projected)).toBe(expected);
});

it.each([
  ["202410", "en", "2023-2024 Fall Semester"],
  ["202420", "en", "2023-2024 Spring Semester"],
  ["202430", "en", "2023-2024 Summer Semester"],
  ["202410", "tr", "2023-2024 Güz Dönemi"],
  ["202420", "tr", "2023-2024 Bahar Dönemi"],
  ["202430", "tr", "2023-2024 Yaz Dönemi"],
] as const)("labels %s in %s", (term, language, label) => {
  expect(semesterTermLabel(term, language)).toBe(label);
});

it("imports weekly courses once, including selections without meetings, and preserves existing grades", () => {
  const program: WeeklyProgram = { id: "p", name: "Plan", updatedAt: "", courseBlocks: [
    { id: "a", code: "MAT104E", title: "Math II", day: "Monday", startTime: "09:00", endTime: "10:00" },
    { id: "b", code: "MAT 104E", title: "Math II", day: "Tuesday", startTime: "09:00", endTime: "10:00" },
  ], courseSelections: [{ id: "s", facultyCode: "FIZ", courseId: "FIZ:FIZ 102E", sectionId: "1", courseBlockIds: [] }] };
  const existing = [{ courseCode: "MAT 104E", courseName: "Math II", credit: 4, grade: "BA" as const }];
  const result = importWeeklySemesterCourses(existing, program, new Map([["FIZ 102E", { title: "Physics II", creditOptions: [3] }]]));
  expect(result).toHaveLength(2);
  expect(result[0]).toEqual(existing[0]);
  expect(result[1]).toEqual({ courseCode: "FIZ 102E", courseName: "Physics II", credit: 3, grade: null });
  expect(importWeeklySemesterCourses(result, program, new Map())).toEqual(result);
});

it("keeps unknown weekly credits unset and excludes them from GPA until entered", () => {
  const program: WeeklyProgram = { id: "p", name: "Plan", updatedAt: "", courseBlocks: [{ id: "a", code: "XYZ 101", title: "Unknown course", day: "Monday", startTime: "09:00", endTime: "10:00" }], courseSelections: [] };
  const courses = importWeeklySemesterCourses([], program, new Map());
  expect(courses[0].credit).toBeNull();
  expect(currentSemesterGpa([{ ...courses[0], grade: "AA" }])).toBeNull();
  expect(parseCurrentSemester(serializeCurrentSemester(courses))).toEqual(courses);
});

it("replaces saved manual and missing credits with database values", () => {
  const courses = [
    { courseCode: "MAT 104E", courseName: "Math II", credit: 99, grade: "AA" as const },
    { courseCode: "FIZ 102E", courseName: "Physics II", credit: null, grade: null },
  ];
  expect(resolveSemesterCourseCredits(courses, new Map([["MAT 104E", { title: "Math II", creditOptions: [4] }]]), { "FIZ 102E": 3 })).toEqual([
    { ...courses[0], credit: 4 }, { ...courses[1], credit: 3 },
  ]);
  expect(resolveSemesterCourseCredits(courses, new Map(), {})[0].credit).toBeNull();
});

it("projects overall GPA by credit weight and replaces retaken courses", () => {
  const transcript = [record({ courseCode: "MAT 103E", grade: "FF", transcriptCredit: 4 }), record({ courseCode: "FIZ 101", grade: "BB", transcriptCredit: 3 })];
  expect(projectedOverallGpa(transcript, [{ courseCode: "MAT 103E", courseName: "Math", credit: 4, grade: "AA" }])).toBeCloseTo(25 / 7);
  expect(projectedOverallGpa(transcript, [{ courseCode: "KIM 101", courseName: "Chemistry", credit: 2, grade: "AA" }])).toBeCloseTo(17 / 9);
  expect(projectedOverallGpa(transcript, [])).toBeNull();
});

it.each([["MAT 103", "MAT 103E"], ["FIZ 101L", "FIZ 101EL"]])("replaces a language-counterpart retake of %s with %s", (previous, planned) => {
  expect(projectedOverallGpa([record({ courseCode: previous, grade: "FF", transcriptCredit: 4 })], [{ courseCode: planned, courseName: "Retake", credit: 4, grade: "AA" }])).toBe(4);
});

it("does not show an incomplete projection when a graded course has unknown credits", () => {
  const courses = [{ courseCode: "MAT 103E", courseName: "Math", credit: null, grade: "AA" as const }, { courseCode: "FIZ 101", courseName: "Physics", credit: 3, grade: "BB" as const }];
  expect(projectedOverallGpa([record()], courses)).toBeNull();
  expect(currentSemesterGpa(courses)).toBeNull();
});

describe("semester history", () => {
  it("calculates credit-weighted overall GPA through each term without later grades", () => {
    const semesters = groupTranscriptSemesters([
      record({ term: "202610", courseCode: "FIZ 101", grade: "AA", transcriptCredit: 3 }),
      record({ term: "202510", grade: "BA", transcriptCredit: 4 }),
      record({ term: "202520", courseCode: "KIM 101", grade: "FF", transcriptCredit: 2 }),
    ]);
    expect(semesters.map(semester => semester.term)).toEqual(["202610", "202520", "202510"]);
    expect(semesters[2].overallGpa).toBe(3.5);
    expect(semesters[1].overallGpa).toBeCloseTo(14 / 6);
    expect(semesters[0].overallGpa).toBeCloseTo(26 / 9);
  });

  it("replaces a repeated course only from its retake term onward", () => {
    const semesters = groupTranscriptSemesters([
      record({ term: "202510", courseCode: "MAT103E", grade: "FF", calculated: false, transcriptCredit: 4 }),
      record({ term: "202510", courseCode: "FIZ 101", grade: "BB", transcriptCredit: 3 }),
      record({ term: "202520", courseCode: "MAT 103E", grade: "AA", transcriptCredit: 4 }),
    ]);
    expect(semesters[1].overallGpa).toBeCloseTo(9 / 7);
    expect(semesters[0].overallGpa).toBeCloseTo(25 / 7);
    expect(semesters[1].gpa).toBeCloseTo(9 / 7);
    expect(semesters[0].gpa).toBe(4);
  });

  it("excludes pass/fail grades and carries the prior overall GPA through ungraded terms", () => {
    const semesters = groupTranscriptSemesters([
      record({ term: "202510", grade: "BL" }),
      record({ term: "202520", courseCode: "FIZ 101", grade: "BB", transcriptCredit: 3 }),
      record({ term: "202610", courseCode: "BED 101", grade: "BL", transcriptCredit: 10 }),
    ]);
    expect(semesters.map(semester => semester.overallGpa)).toEqual([3, 3, null]);
    expect(groupTranscriptSemesters([])).toEqual([]);
  });

  it("groups actual terms newest first and uses transcript credits for GPA", () => {
    const semesters = groupTranscriptSemesters([record(), record({ term: "202610", courseCode: "FIZ 101", grade: "AA", transcriptCredit: 3 }), record({ courseCode: "KIM 101", grade: "FF", transcriptCredit: 2 })]);
    expect(semesters.map(item => item.term)).toEqual(["202610", "202510"]);
    expect(semesters[1].courses).toHaveLength(2);
    expect(semesters[1].gpa).toBeCloseTo(14 / 6);
  });
  it("counts historical numeric grades even when excluded from the graduation calculation", () => {
    const semesters = groupTranscriptSemesters([record(), record({ courseCode: "BED 101", grade: "FF", calculated: false })]);
    expect(semesters[0].courses).toHaveLength(2);
    expect(semesters[0].gpa).toBe(1.75);
    expect(groupTranscriptSemesters([record({ grade: "BL" })])[0].gpa).toBeNull();
  });
});

describe("current semester projections", () => {
  const courses = [
    { courseCode: "MAT 104E", courseName: "Math II", credit: 4, grade: "AA" as const },
    { courseCode: "FIZ 102E", courseName: "Physics II", credit: 2, grade: "FF" as const },
    { courseCode: "BED 101", courseName: "PE", credit: 1, grade: "BL" as const },
    { courseCode: "KIM 101", courseName: "Chemistry", credit: 3, grade: null },
  ];
  it("weights only graded numeric courses, including failing grades", () => {
    expect(currentSemesterGpa(courses)).toBeCloseTo(16 / 6);
    expect(currentSemesterGpa([])).toBeNull();
    expect(currentSemesterGpa([courses[2], courses[3]])).toBeNull();
  });
  it("round-trips projections without producing completed transcript records", () => {
    const saved = parseCurrentSemester(serializeCurrentSemester(courses));
    expect(saved).toEqual(courses);
    expect(saved[0]).not.toHaveProperty("completionStatus");
    expect(saved[0]).not.toHaveProperty("calculated");
  });
  it.each([null, "broken", '{"version":1,"courses":[{"courseCode":"X","credit":-1}]}'])("rejects invalid stored projections: %s", value => {
    expect(parseCurrentSemester(value)).toEqual([]);
  });
});
