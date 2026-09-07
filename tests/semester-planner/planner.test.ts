import { describe, expect, it } from "vitest";

import { emptyProgress } from "@/lib/curriculum/progress";
import { buildSemesterPlan } from "@/lib/semester-planner/planner";
import type { SemesterPlannerProgram } from "@/lib/semester-planner/types";
import type { ItuCurriculum, ItuCurriculumItem, PrerequisiteExpression } from "@/lib/itu/curriculum/types";
import type { EnrollmentType, ProfilePlanType } from "@/lib/profile/types";
import type { GeneratorCourse } from "@/lib/schedule/types";
import type { Day } from "@/types/calendar";

function course(id: string, code: string, semester = 1, credits = 3) {
  return {
    kind: "course" as const,
    id,
    semester,
    code,
    title: code,
    requirementType: "compulsory" as const,
    creditOptions: [credits],
    ectsOptions: [credits + 2],
  };
}

function makeProgram(
  id: string,
  type: EnrollmentType,
  planType: ProfilePlanType,
  items: ItuCurriculumItem[],
  prerequisites: ItuCurriculum["prerequisites"] = {},
): SemesterPlannerProgram {
  const curriculum: ItuCurriculum = {
    planId: Number(id.replace(/\D/gu, "")) || 1,
    programCode: id,
    title: id,
    planTitle: `${id} plan`,
    planType,
    semesters: [{ semester: planType === "undergraduate" ? 1 : 99, items }],
    prerequisites,
    equivalenceRules: [],
    prerequisiteBranchesLoaded: ["BLG", "MAT", "EKO"],
    prerequisiteDataAvailable: true,
    warnings: [],
    fetchedAt: "2026-09-04T00:00:00.000Z",
  };
  return {
    enrollment: {
      id,
      type,
      facultyId: "1",
      facultyName: "Faculty",
      educationLevel: "undergraduate",
      planType,
      programCode: id,
      programName: id,
      curriculumPlanId: curriculum.planId,
      curriculumPlanName: curriculum.planTitle,
    },
    curriculum,
    progress: emptyProgress(curriculum.planId),
  };
}

function elective(id: string, title: string, codes: string[], credits = 3): ItuCurriculumItem {
  return {
    kind: "elective-slot",
    id,
    semester: 1,
    title,
    category: title,
    creditOptions: [credits],
    ectsOptions: [credits + 2],
    courses: codes.map((code) => ({ code, title: code, creditOptions: [credits], ectsOptions: [credits + 2] })),
  };
}

function offering(code: string, day: Day = "Monday", startTime = "09:00", endTime = "10:00", alternate?: [Day, string, string]): GeneratorCourse {
  const branchCode = code.split(" ")[0];
  const meetings = (values: Array<[Day, string, string]>, crn: string) => values.map(([meetingDay, start, end], index) => ({
    id: `${code}:${crn}:${index}`,
    day: meetingDay,
    startTime: start,
    endTime: end,
  }));
  return {
    branchCode,
    courseId: code,
    courseCode: code,
    courseTitle: code,
    sections: [
      { id: `${code}:1`, crn: `${code}:1`, meetings: meetings([[day, startTime, endTime]], "1") },
      ...(alternate ? [{ id: `${code}:2`, crn: `${code}:2`, meetings: meetings([alternate], "2") }] : []),
    ],
  };
}

function options(overrides: Partial<Parameters<typeof buildSemesterPlan>[1]> = {}) {
  const courseOfferings = [
    offering("BLG 101", "Monday", "09:00", "10:00"),
    offering("BLG 202", "Tuesday", "09:00", "10:00"),
    offering("MAT 101", "Wednesday", "09:00", "10:00"),
    offering("EKO 201", "Thursday", "09:00", "10:00"),
  ];
  return {
    desiredCredits: 18,
    maxCourses: 6,
    priority: "balanced" as const,
    availabilityMode: "published" as const,
    knownBranchCodes: new Set(["BLG", "MAT", "EKO"]),
    offeredCourseCodes: new Set(["BLG 101", "BLG 202", "MAT 101", "EKO 201"]),
    courseOfferings,
    ...overrides,
  };
}

describe("smart semester planner", () => {
  it("counts one shared compulsory course once while crediting both programs", () => {
    const main = makeProgram("main1", "main", "undergraduate", [course("main-mat", "MAT 101", 1, 4)]);
    const cap = makeProgram("cap2", "double-major", "cap", [course("cap-mat", "MAT 101", 99, 4), course("cap-eko", "EKO 201")]);

    const plan = buildSemesterPlan([main, cap], options({ desiredCredits: 4, maxCourses: 1 }));

    expect(plan.recommendations.map((value) => value.code)).toEqual(["MAT 101"]);
    expect(plan.selectedCredits).toBe(4);
    expect(plan.combinedRemainingCredits).toBe(7);
    expect(plan.recommendations[0].contributions).toHaveLength(2);
    expect(plan.programSummaries.map((value) => value.selectedCredits)).toEqual([4, 4]);
  });

  it("uses prerequisite unlock value across programs", () => {
    const prerequisite: PrerequisiteExpression = { kind: "course", courseCode: "BLG 101" };
    const main = makeProgram("main3", "main", "undergraduate", [course("intro", "BLG 101"), course("advanced", "BLG 202", 2)], {
      "BLG 202": { courseCode: "BLG 202", expression: prerequisite },
    });
    const plan = buildSemesterPlan([main], options({ desiredCredits: 3, maxCourses: 1 }));

    expect(plan.recommendations[0].code).toBe("BLG 101");
    expect(plan.recommendations[0].immediateUnlocks).toEqual(["BLG 202"]);
  });

  it("excludes a course whose prerequisite has not been completed", () => {
    const main = makeProgram("main4", "main", "undergraduate", [course("advanced", "BLG 202")], {
      "BLG 202": { courseCode: "BLG 202", expression: { kind: "course", courseCode: "BLG 101" } },
    });
    expect(buildSemesterPlan([main], options({ desiredCredits: 3 })).recommendations).toHaveLength(0);
  });

  it("enforces minimum prerequisite grades", () => {
    const main = makeProgram("main5", "main", "undergraduate", [course("advanced", "BLG 202")], {
      "BLG 202": { courseCode: "BLG 202", expression: { kind: "course", courseCode: "BLG 101", minimumGrade: "BB" } },
    });
    main.progress.courses["BLG 101"] = { state: "passed", grade: "CC" };
    expect(buildSemesterPlan([main], options({ desiredCredits: 3 })).recommendations).toHaveLength(0);
    main.progress.courses["BLG 101"] = { state: "passed", grade: "BA" };
    expect(buildSemesterPlan([main], options({ desiredCredits: 3 })).recommendations[0].code).toBe("BLG 202");
  });

  it("excludes courses that are unavailable or cannot be verified for the target semester", () => {
    const minor = makeProgram("minor6", "minor", "yandal", [course("minor-eko", "EKO 201")]);
    const unavailable = buildSemesterPlan([minor], options({ desiredCredits: 3, offeredCourseCodes: new Set() }));
    const future = buildSemesterPlan([minor], options({ desiredCredits: 3, availabilityMode: "unknown" }));

    expect(unavailable.recommendations).toHaveLength(0);
    expect(future.recommendations).toHaveLength(0);
  });

  it("reports an unattainable credit target without filling it with unrelated courses", () => {
    const main = makeProgram("main7", "main", "undergraduate", [course("intro", "BLG 101")]);
    const plan = buildSemesterPlan([main], options({ desiredCredits: 18 }));

    expect(plan.selectedCredits).toBe(3);
    expect(plan.notices).toContainEqual({ kind: "target-shortfall", credits: 15 });
  });

  it("does not recommend a requirement already completed through a recognized equivalence", () => {
    const main = makeProgram("main8", "main", "undergraduate", [course("target", "BLG 113")]);
    main.progress.courses["BLG 111"] = {
      state: "passed",
      courseCode: "BLG 111",
      matchedRequirementId: "target",
      satisfactionType: "equivalence",
    };
    main.progress.requirementSatisfactions = {
      target: {
        requirementId: "target",
        requirementCourseCode: "BLG 113",
        satisfiedByCourseCodes: ["BLG 111"],
        satisfactionType: "equivalence",
      },
    };

    expect(buildSemesterPlan([main], options({ desiredCredits: 3 })).recommendations).toHaveLength(0);
  });

  it("balances a secondary-program requirement instead of repeatedly postponing it", () => {
    const main = makeProgram("main9", "main", "undergraduate", [course("main-a", "BLG 101"), course("main-b", "BLG 202")]);
    const minor = makeProgram("minor10", "minor", "yandal", [course("minor-a", "EKO 201")]);
    const balanced = buildSemesterPlan([main, minor], options({ desiredCredits: 6, maxCourses: 2, priority: "balanced" }));

    expect(balanced.recommendations.some((candidate) => candidate.contributions.some((value) => value.enrollmentType === "minor"))).toBe(true);
  });

  it("considers every eligible curriculum elective but excludes catalog-only electives", () => {
    const main = makeProgram("main11", "main", "undergraduate", [
      elective("technical", "Technical Elective", ["BLG 301", "BLG 303"]),
      elective("humanities", "Humanities Elective", ["EKO 301"]),
    ]);
    const courseOfferings = [
      offering("BLG 301", "Monday", "09:00", "10:00"),
      offering("BLG 303", "Tuesday", "09:00", "10:00"),
      offering("EKO 301", "Wednesday", "09:00", "10:00"),
      offering("BLG 999", "Thursday", "09:00", "10:00"),
    ];
    const plan = buildSemesterPlan([main], options({
      desiredCredits: 6,
      offeredCourseCodes: new Set(courseOfferings.map((value) => value.courseCode)),
      courseOfferings,
    }));

    expect(plan.recommendations).toHaveLength(2);
    expect(plan.recommendations.some((value) => value.code === "EKO 301")).toBe(true);
    expect([...plan.recommendations, ...plan.alternatives].some((value) => value.code === "BLG 999")).toBe(false);
  });

  it("never combines courses whose published sections all collide", () => {
    const main = makeProgram("main12", "main", "undergraduate", [course("a", "BLG 101"), course("b", "MAT 101")]);
    const courseOfferings = [
      offering("BLG 101", "Monday", "09:00", "11:00"),
      offering("MAT 101", "Monday", "10:00", "12:00"),
    ];
    const plan = buildSemesterPlan([main], options({ desiredCredits: 6, courseOfferings }));

    expect(plan.recommendations).toHaveLength(1);
    expect(plan.compatibleSectionConstraints).toHaveLength(1);
    expect(plan.notices).toContainEqual({ kind: "collision-shortfall" });
  });

  it("uses compatible alternative sections across the complete recommendation", () => {
    const main = makeProgram("main13", "main", "undergraduate", [course("a", "BLG 101"), course("b", "MAT 101")]);
    const courseOfferings = [
      offering("BLG 101", "Monday", "09:00", "11:00"),
      offering("MAT 101", "Monday", "10:00", "12:00", ["Tuesday", "10:00", "12:00"]),
    ];
    const plan = buildSemesterPlan([main], options({ desiredCredits: 6, courseOfferings }));

    expect(plan.recommendations).toHaveLength(2);
    expect(plan.compatibleSectionConstraints.map((value) => value.sectionId)).toContain("MAT 101:2");
  });

  it("finds an exact-credit combination instead of stopping at a greedy choice", () => {
    const main = makeProgram("main14", "main", "undergraduate", [
      course("five", "BLG 101", 1, 5),
      course("four-a", "MAT 101", 1, 4),
      course("four-b", "EKO 201", 1, 4),
    ]);
    const plan = buildSemesterPlan([main], options({ desiredCredits: 8, maxCourses: 2 }));

    expect(plan.selectedCredits).toBe(8);
    expect(plan.recommendations.map((value) => value.code).sort()).toEqual(["EKO 201", "MAT 101"]);
  });

  it("treats zero max courses as unlimited and rejects invalid limits", () => {
    const main = makeProgram("main15", "main", "undergraduate", [course("a", "BLG 101"), course("b", "MAT 101")]);
    expect(buildSemesterPlan([main], options({ desiredCredits: 6, maxCourses: 0 })).recommendations).toHaveLength(2);
    expect(() => buildSemesterPlan([main], options({ desiredCredits: -1 }))).toThrow(RangeError);
    expect(() => buildSemesterPlan([main], options({ maxCourses: -1 }))).toThrow(RangeError);
    expect(() => buildSemesterPlan([main], options({ maxCourses: 1.5 }))).toThrow(RangeError);
    expect(() => buildSemesterPlan([main], options({ desiredCredits: Number.NaN }))).toThrow(RangeError);
    expect(() => buildSemesterPlan([main], options({ desiredCredits: 61 }))).toThrow(RangeError);
  });

  it("chooses the closest credit total and avoids an unnecessary overage", () => {
    const main = makeProgram("main16", "main", "undergraduate", [course("three", "BLG 101", 1, 3), course("four", "MAT 101", 1, 4)]);
    const exact = buildSemesterPlan([main], options({ desiredCredits: 3, maxCourses: 1 }));
    const closest = buildSemesterPlan([main], options({ desiredCredits: 3.6, maxCourses: 1 }));

    expect(exact.recommendations.map((value) => value.code)).toEqual(["BLG 101"]);
    expect(closest.recommendations.map((value) => value.code)).toEqual(["MAT 101"]);
    const overage = closest.notices.find((notice) => notice.kind === "target-overage");
    expect(overage?.credits).toBeCloseTo(0.4);
  });

  it("applies main and minor priority without bypassing feasibility", () => {
    const main = makeProgram("main17", "main", "undergraduate", [course("main", "BLG 101")]);
    const minor = makeProgram("minor18", "minor", "yandal", [course("minor", "EKO 201")]);
    const mainFirst = buildSemesterPlan([main, minor], options({ desiredCredits: 3, maxCourses: 1, priority: "main" }));
    const minorFirst = buildSemesterPlan([main, minor], options({ desiredCredits: 3, maxCourses: 1, priority: "minor" }));

    expect(mainFirst.recommendations[0].code).toBe("BLG 101");
    expect(minorFirst.recommendations[0].code).toBe("EKO 201");
  });
});
