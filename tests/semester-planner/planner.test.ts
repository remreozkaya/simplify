import { describe, expect, it } from "vitest";

import { emptyProgress } from "@/lib/curriculum/progress";
import { buildSemesterPlan } from "@/lib/semester-planner/planner";
import type { SemesterPlannerProgram } from "@/lib/semester-planner/types";
import type { ItuCurriculum, PrerequisiteExpression } from "@/lib/itu/curriculum/types";
import type { EnrollmentType, ProfilePlanType } from "@/lib/profile/types";

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
  items: ReturnType<typeof course>[],
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

function options(overrides: Partial<Parameters<typeof buildSemesterPlan>[1]> = {}) {
  return {
    desiredCredits: 18,
    maxCourses: 6,
    priority: "balanced" as const,
    availabilityMode: "published" as const,
    knownBranchCodes: new Set(["BLG", "MAT", "EKO"]),
    offeredCourseCodes: new Set(["BLG 101", "BLG 202", "MAT 101", "EKO 201"]),
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

  it("does not treat an in-progress prerequisite as passed and labels the dependent course conditional", () => {
    const main = makeProgram("main4", "main", "undergraduate", [course("advanced", "BLG 202")], {
      "BLG 202": { courseCode: "BLG 202", expression: { kind: "course", courseCode: "BLG 101" } },
    });
    const withoutProjection = buildSemesterPlan([main], options({ desiredCredits: 3 }));
    const withProjection = buildSemesterPlan([main], options({ desiredCredits: 3, inProgressCourseCodes: ["BLG 101"] }));

    expect(withoutProjection.recommendations).toHaveLength(0);
    expect(withProjection.recommendations[0]).toMatchObject({ code: "BLG 202", eligibility: "conditional" });
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

  it("excludes confirmed unavailable courses but preserves future availability as unknown", () => {
    const minor = makeProgram("minor6", "minor", "yandal", [course("minor-eko", "EKO 201")]);
    const unavailable = buildSemesterPlan([minor], options({ desiredCredits: 3, offeredCourseCodes: new Set() }));
    const future = buildSemesterPlan([minor], options({ desiredCredits: 3, availabilityMode: "unknown" }));

    expect(unavailable.recommendations).toHaveLength(0);
    expect(future.recommendations[0]).toMatchObject({ code: "EKO 201", availability: "unknown" });
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
});
