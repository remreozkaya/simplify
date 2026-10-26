import { expect, it } from "vitest";
import { applyTranscriptImport, curriculumTotals } from "@/lib/curriculum/graduation";
import { emptyProgress } from "@/lib/curriculum/progress";
import { buildSemesterPlan } from "@/lib/semester-planner/planner";
import type { SemesterPlannerProgram } from "@/lib/semester-planner/types";
import type { GeneratorCourse } from "@/lib/schedule/types";
import type { TranscriptCourseRecord } from "@/lib/curriculum/types";

// Synthetic requirements establish only software contracts, not university policy.
function scenario(branch: string, offset: number, label: string, language: string, types: Array<"main" | "double-major" | "minor">) {
  const codes = [`${branch} 101E`, `${branch} 202E`, `${branch} 303E`];
  const record: TranscriptCourseRecord = { term: "202610", crn: "1", courseCode: codes[0], courseName: label, courseLanguage: language, grade: "BA", countedCredit: 2.5, transcriptCredit: 2.5, completionStatus: "passed", calculated: true, source: "transcript" };
  const programs: SemesterPlannerProgram[] = types.map((type, index) => {
    const planId = offset + index;
    const planType = type === "main" ? "undergraduate" : type === "minor" ? "yandal" : "cap";
    const items = (index === 0 ? codes : [codes[2]]).map((code) => ({ kind: "course" as const, id: `${planId}:${code}`, semester: 1, code, title: label, language, requirementType: "compulsory" as const, creditOptions: [code === codes[0] ? 2.5 : code === codes[1] ? 0 : 4], ectsOptions: [code === codes[1] ? 1 : 6] }));
    const curriculum: SemesterPlannerProgram["curriculum"] = {
      planId, programCode: `${branch}_${type}`, title: label, planTitle: label, planType,
      semesters: [{ semester: 1, items }], prerequisites: {
        [codes[1]]: { courseCode: codes[1], expression: { kind: "course", courseCode: codes[0], minimumGrade: "BB" } },
        [codes[2]]: { courseCode: codes[2], minimumCredits: 2.5 },
      }, equivalenceRules: [], prerequisiteDataAvailable: true, prerequisiteBranchesLoaded: [branch], warnings: [], fetchedAt: "2026-10-01T00:00:00Z",
    };
    const progress = applyTranscriptImport(curriculum, emptyProgress(planId), { calculatedCourses: [record], nonCalculatedCourses: [], duplicateRows: [], invalidRows: [] }).progress;
    return { curriculum, progress, prerequisiteProgress: { [codes[0]]: { state: "passed", grade: "BA", courseCode: codes[0], countedCredit: 2.5 } }, enrollment: { id: `enrollment-${planId}`, type, facultyId: `${offset}`, facultyName: label, educationLevel: "undergraduate", planType, programCode: curriculum.programCode, programName: label, curriculumPlanId: planId, curriculumPlanName: label } };
  });
  const courseOfferings: GeneratorCourse[] = codes.slice(1).map((code, index) => ({ branchCode: branch, courseId: `course-${offset}-${index}`, courseCode: code, courseTitle: label, sections: [{ id: `section-${offset}-${index}`, crn: `${offset}${index}`, meetings: [{ id: `meeting-${offset}-${index}`, day: "Monday", startTime: index ? "10:00" : "09:00", endTime: index ? "11:00" : "10:00" }] }] }));
  const plan = buildSemesterPlan(programs, { desiredCredits: 4, maxCourses: 2, priority: "balanced", availabilityMode: "published", knownBranchCodes: new Set([branch]), offeredCourseCodes: new Set(codes.slice(1)), courseOfferings });
  return { plan, programs, codes };
}

it.each([
  { branch: "FIZ", types: ["main"] as Array<"main" | "double-major" | "minor"> },
  { branch: "KIM", types: ["main", "double-major"] as Array<"main" | "double-major" | "minor"> },
  { branch: "EKO", types: ["main", "minor"] as Array<"main" | "double-major" | "minor"> },
  { branch: "MAT", types: ["main", "double-major", "minor"] as Array<"main" | "double-major" | "minor"> },
])("plans diverse $branch enrollments from supplied rules and credits", ({ branch, types }) => {
  const { plan, programs, codes } = scenario(branch, 7300, "Program", "EN", types);
  expect(plan.recommendations.map(course => course.code).sort()).toEqual(codes.slice(1));
  expect(plan.selectedCredits).toBe(4);
  expect(plan.selectedEcts).toBe(7);
  expect(plan.combinedRemainingCredits).toBe(4);
  expect(plan.recommendations.find(course => course.code === codes[2])?.contributions).toHaveLength(types.length);
  expect(curriculumTotals(programs[0].curriculum, programs[0].progress)).toMatchObject({ earnedCourses: 1, earnedCredit: 2.5, requiredCredit: 6.5 });
  for (const program of programs.slice(1)) expect(curriculumTotals(program.curriculum, program.progress).earnedCourses).toBe(0);
});

it("keeps academic outcomes invariant under names, display languages and consistent identifiers", () => {
  const original = scenario("FIZ", 8100, "Physics", "EN", ["main", "minor"]);
  const renamed = scenario("KIM", 9200, "Kimya / Öğrenci", "TR", ["main", "minor"]);
  for (const result of [original, renamed]) {
    expect(result.plan.selectedCredits).toBe(4);
    expect(result.plan.selectedEcts).toBe(7);
    expect(result.plan.recommendations.map(course => course.code.split(" ")[1]).sort()).toEqual(["202E", "303E"]);
    expect(result.plan.recommendations.map(course => course.contributions.length).sort()).toEqual([1, 2]);
    expect(curriculumTotals(result.programs[0].curriculum, result.programs[0].progress)).toMatchObject({ earnedCredit: 2.5, requiredCredit: 6.5 });
  }
});
