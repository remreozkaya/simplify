import { describe, expect, it } from "vitest";

import { curriculumTotals, applyTranscriptImport } from "@/lib/curriculum/graduation";
import { parseTranscriptMarkdown } from "@/lib/curriculum/transcript";
import { emptyProgress } from "@/lib/curriculum/progress";
import { generateConflictFreeSchedules } from "@/lib/schedule/generator";
import { parseGeneratorSession } from "@/lib/schedule/session";
import { hasMeetingConflicts } from "@/lib/schedule/conflicts";
import { buildSemesterPlan, MAX_PLANNER_CANDIDATE_VISITS, MAX_PLANNER_SCHEDULE_NODES } from "@/lib/semester-planner/planner";
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
  it("bounds exploration of many incompatible candidates and keeps only proven compatible results", () => {
    const codes = Array.from({ length: 80 }, (_, index) => `BLG ${100 + index}`);
    const main = makeProgram("main24", "main", "undergraduate", codes.map(code => course(code, code)));
    const courseOfferings = codes.map(code => offering(code));
    const plan = buildSemesterPlan([main], options({ desiredCredits: 18, maxCourses: 6, courseOfferings, offeredCourseCodes: new Set(codes) }));
    expect(plan.searchLimited).toBe(true);
    expect(plan.notices).toContainEqual({ kind: "search-limited" });
    expect(plan.searchStats.candidateVisits).toBeLessThanOrEqual(MAX_PLANNER_CANDIDATE_VISITS);
    expect(plan.searchStats.scheduleVisitedNodes).toBeLessThanOrEqual(MAX_PLANNER_SCHEDULE_NODES);
    expect(plan.recommendations).toHaveLength(1);
    const regenerated = generateConflictFreeSchedules(plan.compatibleSectionConstraints.map(constraint => ({ ...courseOfferings.find(value => value.courseId === constraint.courseId)!, pinnedSectionId: constraint.sectionId })));
    expect(regenerated.schedules).toHaveLength(1);
    expect(hasMeetingConflicts(regenerated.schedules[0].meetings)).toBe(false);
  });

  it("reports an exhausted section search as partial instead of claiming a collision shortfall", () => {
    const main = makeProgram("main25", "main", "undergraduate", [course("a", "BLG 101"), course("b", "MAT 101")]);
    const courseOfferings = [offering("BLG 101"), offering("MAT 101")].map(value => ({
      ...value,
      sections: Array.from({ length: 501 }, (_, index) => ({ ...value.sections[0], id: `${value.courseId}:${index}`, crn: String(index) })),
    }));
    const plan = buildSemesterPlan([main], options({ desiredCredits: 6, courseOfferings }));
    expect(plan.searchLimited).toBe(true);
    expect(plan.notices).toContainEqual({ kind: "search-limited" });
    expect(plan.notices).not.toContainEqual({ kind: "collision-shortfall" });
    expect(plan.recommendations).toHaveLength(1);
  });

  it.each(["BLG 101", "BLG 101E"])("keeps shared transcript grades authoritative over manual %s across programs", (manualCode) => {
    const main = makeProgram("main21", "main", "undergraduate", [course("advanced", "BLG 202")], {
      "BLG 202": { courseCode: "BLG 202", expression: { kind: "course", courseCode: "BLG 101", minimumGrade: "BB" } },
    });
    main.prerequisiteProgress = { "BLG 101": { state: "passed", source: "transcript", grade: "CC", courseCode: "BLG 101", countedCredit: 3 } };
    const minor = makeProgram("minor22", "minor", "yandal", []);
    main.progress.courses[manualCode] = { state: "passed", source: "manual", grade: "AA", courseCode: manualCode, countedCredit: 6 };
    minor.progress.courses[manualCode] = { state: "passed", source: "manual", grade: "AA", courseCode: manualCode, countedCredit: 6 };
    for (const programs of [[main, minor], [minor, main]]) {
      expect(buildSemesterPlan(programs, options({ desiredCredits: 3 })).recommendations).toEqual([]);
    }
    main.prerequisiteProgress["BLG 101"] = { state: "failed", source: "transcript", grade: "FF", courseCode: "BLG 101", countedCredit: 3 };
    expect(buildSemesterPlan([main, minor], options({ desiredCredits: 3 })).recommendations).toEqual([]);
  });

  it("uses canonical transcript credits instead of inflated stale manual credits", () => {
    const main = makeProgram("main23", "main", "undergraduate", [course("advanced", "BLG 202")], {
      "BLG 202": { courseCode: "BLG 202", minimumCredits: 6 },
    });
    main.prerequisiteProgress = { "BLG 101": { state: "passed", source: "transcript", grade: "AA", courseCode: "BLG 101", countedCredit: 3, transcriptCredit: 3 } };
    main.progress.courses["BLG 101E"] = { state: "passed", source: "manual", grade: "AA", courseCode: "BLG 101E", countedCredit: 6 };
    const plan = buildSemesterPlan([main], options({ desiredCredits: 3 }));
    expect(plan.recommendations).toEqual([]);
    expect(plan.notices).toContainEqual({ kind: "eligibility-unknown" });
  });

  it("uses external passed grades and credits for prerequisites without degree completion", () => {
    const main = makeProgram("main20", "main", "undergraduate", [course("advanced", "BLG 202")], {
      "BLG 202": { courseCode: "BLG 202", minimumCredits: 6, expression: { kind: "course", courseCode: "BLG 101", minimumGrade: "BB" } },
    });
    main.prerequisiteProgress = {
      "BLG 101": { state: "passed", grade: "BA", courseCode: "BLG 101", countedCredit: 3, transcriptCredit: 4 },
      "MAT 101": { state: "passed", grade: "AA", courseCode: "MAT 101", countedCredit: 3, transcriptCredit: 3 },
    };
    expect(curriculumTotals(main.curriculum, main.progress).earnedCredit).toBe(0);
    expect(buildSemesterPlan([main], options({ desiredCredits: 3 })).recommendations.map(value => value.code)).toEqual(["BLG 202"]);
    main.prerequisiteProgress["BLG 101"].grade = "CC";
    expect(buildSemesterPlan([main], options({ desiredCredits: 3 })).recommendations).toEqual([]);
    main.prerequisiteProgress["BLG 101"].grade = "BA";
    main.prerequisiteProgress["MAT 101"].countedCredit = 2;
    const insufficient = buildSemesterPlan([main], options({ desiredCredits: 3 }));
    expect(insufficient.recommendations).toEqual([]);
    expect(insufficient.notices).toContainEqual({ kind: "eligibility-unknown" });
  });

  it("keeps a remaining elective slot after one shared choice is completed", () => {
    const main = makeProgram("main18", "main", "undergraduate", [
      elective("first", "Elective", ["BLG 301", "BLG 303"]),
      elective("second", "Elective", ["BLG 301", "BLG 303"]),
    ]);
    main.progress = applyTranscriptImport(main.curriculum, main.progress, parseTranscriptMarkdown(
      "| Completed English Courses | | | | | |\n| 202610 | 1 | BLG 301 | First | 3 | AA |"
    )).progress;
    const courseOfferings = [offering("BLG 303")];
    const plan = buildSemesterPlan([main], options({ desiredCredits: 3, courseOfferings, offeredCourseCodes: new Set(["BLG 303"]) }));
    expect(plan.recommendations.map(value => value.code)).toEqual(["BLG 303"]);
    expect(plan.programSummaries[0].remainingCredits).toBe(3);
    expect(plan.recommendations[0].contributions.map(value => value.requirementId)).toEqual(["second"]);
  });

  it("considers all language offerings regardless of order and retains the chosen section identity", () => {
    const main = makeProgram("main19", "main", "undergraduate", [course("math", "MAT 101"), course("intro", "BLG 101")]);
    const courseOfferings = [offering("MAT 101"), offering("MAT 101E", "Tuesday"), offering("BLG 101")];
    for (const offerings of [courseOfferings, [...courseOfferings].reverse()]) {
      const plan = buildSemesterPlan([main], options({ desiredCredits: 6, maxCourses: 2, courseOfferings: offerings, offeredCourseCodes: new Set(["MAT 101", "MAT 101E", "BLG 101"]) }));
      expect(plan.recommendations.map(value => value.code).sort()).toEqual(["BLG 101", "MAT 101"]);
      expect(plan.compatibleSectionConstraints.find(value => value.courseCode === "MAT 101")).toMatchObject({ courseId: "MAT 101E", sectionId: "MAT 101E:1", crn: "MAT 101E:1" });
      const handoff = parseGeneratorSession({ version: 2, courses: plan.compatibleSectionConstraints.map((constraint, index) => ({ id: String(index), branchCode: constraint.branchCode, courseId: constraint.courseId, courseCode: constraint.courseCode, pinnedSectionId: constraint.sectionId })), earliestStartTime: "", latestEndTime: "", excludedDays: [], source: "semester-planner" });
      const generated = generateConflictFreeSchedules(handoff!.courses.map(value => ({ ...offerings.find(offering => offering.courseId === value.courseId)!, pinnedSectionId: value.pinnedSectionId })));
      expect(generated.schedules).toHaveLength(1);
      expect(generated.schedules[0].selections.find(value => value.courseId === "MAT 101E")?.sectionId).toBe("MAT 101E:1");
    }
  });

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
