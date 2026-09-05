import { describe, expect, it } from "vitest";

import type { EquivalenceRule } from "@/lib/curriculum/equivalence";
import { applyTranscriptImport, calculateProgramGpa, curriculumTotals, reconcileImportedProgress } from "@/lib/curriculum/graduation";
import { getStoredEquivalenceRules } from "@/lib/curriculum/equivalenceStore";
import { emptyProgress, parseCurriculumProgress, resetImportedProgress, updateStoredCurriculumProgress } from "@/lib/curriculum/progress";
import { calculateGpa, parseTranscriptMarkdown } from "@/lib/curriculum/transcript";
import type { ItuCurriculum } from "@/lib/itu/curriculum/types";

const curriculum: ItuCurriculum = {
  planId: 10, programCode: "TEST_LS", title: "Test", planTitle: "2026", totalCredit: 7,
  semesters: [{ semester: 1, items: [
    { kind: "course", id: "required", semester: 1, code: "MAT 103E", title: "Math", language: "EN", requirementType: "compulsory", creditOptions: [4], ectsOptions: [6] },
    { kind: "elective-slot", id: "elective-a", semester: 1, title: "Elective A", creditOptions: [3], ectsOptions: [5], category: "TM", courses: [{ code: "BLG 478E", title: "Security", language: "EN", creditOptions: [3], ectsOptions: [5] }] },
  ] }], prerequisites: {}, equivalenceRules: [], prerequisiteBranchesLoaded: [], prerequisiteDataAvailable: true, warnings: [], fetchedAt: "2026-01-01T00:00:00.000Z",
};

function transcript(rows: string) {
  return parseTranscriptMarkdown(`| Completed English Courses | | | | | |\n| Term | CRN | Course Code | Course Name | Credit | Grade |\n${rows}`);
}

function rule(target: string, alternatives: string[][], overrides: Partial<EquivalenceRule> = {}): EquivalenceRule {
  return {
    id: `rule-${target}-${alternatives.flat().join("-")}`,
    curriculumId: "TEST_LS:10", programId: 1, programCode: "TEST_LS", planType: "Lisans", planTypeId: 2,
    planId: 10, branchCode: target.split(" ")[0], targetCourseCode: target, targetCourseCodeOfficial: target,
    alternatives: alternatives.map((allOf) => ({ allOf })), relationshipType: "directional",
    sourceUrl: "https://obs.itu.edu.tr/public/GenelTanimlamalar/DersPlanDenklikleri",
    sourceLabel: "İTÜ OBS Course Equivalence", retrievedAt: "2026-09-01T00:00:00.000Z", verified: true, active: true,
    ...overrides,
  };
}

function withRules(...rules: EquivalenceRule[]): ItuCurriculum {
  return { ...structuredClone(curriculum), equivalenceRules: rules };
}

describe("graduation progress", () => {
  it("matches exact and eligible elective requirements once and totals semesters", () => {
    const result = applyTranscriptImport(curriculum, emptyProgress(10), transcript("| 202520 | 1 | mat103e | Math | 4 | AA |\n| 202620 | 2 | BLG478E | Security | 2 / 3 | BB+ |"));
    expect(result.matched).toHaveLength(2);
    expect(result.unmatched).toEqual([]);
    expect(result.progress.courses["BLG 478E"].matchedRequirementId).toBe("elective-a");
    expect(curriculumTotals(curriculum, result.progress)).toMatchObject({ earnedCourses: 2, earnedCredit: 7, requiredCredit: 7 });
    expect(calculateProgramGpa(curriculum, result.progress)).toBeCloseTo((4 * 4 + 3 * 3.25) / 7, 4);
  });

  it("calculates GPA independently from only the courses matched to each program", () => {
    const shared = transcript("| 202520 | 1 | MAT 103E | Math | 4 | AA |\n| 202620 | 2 | BLG 478E | Security | 3 | BB |");
    const mainProgress = applyTranscriptImport(curriculum, emptyProgress(10), shared).progress;
    const minorCurriculum = structuredClone(curriculum);
    minorCurriculum.planId = 11;
    minorCurriculum.programCode = "TEST_YD";
    minorCurriculum.semesters[0].items = [minorCurriculum.semesters[0].items[1]];
    const minorProgress = applyTranscriptImport(minorCurriculum, emptyProgress(11), shared).progress;

    expect(calculateProgramGpa(curriculum, mainProgress)).toBeCloseTo((4 * 4 + 3 * 3) / 7, 4);
    expect(calculateProgramGpa(minorCurriculum, minorProgress)).toBe(3);
  });

  it("shows no program GPA when matched courses have no numeric grade", () => {
    const progress = applyTranscriptImport(curriculum, emptyProgress(10), transcript("| 202520 | 1 | MAT 103E | Math | 4 | BL |")).progress;
    expect(calculateProgramGpa(curriculum, progress)).toBeNull();
  });

  it("assigns a multi-slot elective to the earliest available curriculum slot", () => {
    const multiSlotCurriculum = structuredClone(curriculum);
    const slot = multiSlotCurriculum.semesters[0].items[1];
    if (slot.kind !== "elective-slot") throw new Error("fixture");
    multiSlotCurriculum.semesters.push({ semester: 2, items: [{ ...slot, semester: 2, id: "elective-b" }] });
    multiSlotCurriculum.semesters.push({ semester: 3, items: [{ ...slot, semester: 3, id: "elective-c" }] });
    const result = applyTranscriptImport(multiSlotCurriculum, emptyProgress(10), transcript("| 202620 | 2 | BLG 478E | Security | 2 / 3 | BB+ |\n| 202620 | 3 | XXX 100 | Other | 3 | AA |"));
    expect(result.ambiguous).toEqual([]);
    expect(result.unmatched[0].record.courseCode).toBe("XXX 100");
    expect(result.progress.courses["BLG 478E"].matchedRequirementId).toBe("elective-a");
    expect(result.progress.requirementSatisfactions?.["elective-a"]?.satisfactionType).toBe("elective");
  });

  it("deduplicates persisted imports and reset preserves manual progress", () => {
    const manual = emptyProgress(10);
    manual.courses["MAN 100"] = { state: "passed", source: "manual", grade: "BL" };
    const parsed = transcript("| 202520 | 1 | MAT 103E | Math | 4 | AA |");
    const first = applyTranscriptImport(curriculum, manual, parsed).progress;
    const second = applyTranscriptImport(curriculum, first, parsed).progress;
    expect(second.importedCourses).toHaveLength(1);
    const stored = updateStoredCurriculumProgress(null, second);
    expect(parseCurriculumProgress(stored, 10).courses["MAT 103E"].crn).toBe("1");
    expect(resetImportedProgress(second).courses).toEqual({ "MAN 100": manual.courses["MAN 100"] });
  });

  it("resolves a directional, plan-specific one-to-one equivalence", () => {
    const equivalent = withRules(rule("MAT 103E", [["BLG 111"]]));
    const result = applyTranscriptImport(equivalent, emptyProgress(10), transcript("| 202520 | 7 | BLG 111 | Intro | 2 / 3 | BB |"));
    expect(result.progress.requirementSatisfactions?.required).toMatchObject({ requirementCourseCode: "MAT 103E", satisfiedByCourseCodes: ["BLG 111"], satisfactionType: "equivalence" });
    expect(result.progress.courses["BLG 111"]).toMatchObject({ courseCode: "BLG 111", grade: "BB", equivalenceRuleId: equivalent.equivalenceRules[0].id });
    expect(curriculumTotals(equivalent, result.progress).earnedCredit).toBe(4);
    expect(calculateGpa(result.progress.importedCourses ?? [])).toBe(3);
  });

  it("does not reverse equivalence or apply it to another plan", () => {
    const reverse = structuredClone(curriculum);
    const required = reverse.semesters[0].items[0];
    if (required.kind !== "course") throw new Error("fixture");
    required.code = "BLG 111";
    reverse.equivalenceRules = [rule("MAT 103E", [["BLG 111"]])];
    expect(applyTranscriptImport(reverse, emptyProgress(10), transcript("| 202520 | 7 | MAT 103E | Math | 4 | AA |")).progress.requirementSatisfactions?.required).toBeUndefined();
    const wrongPlan = withRules(rule("MAT 103E", [["BLG 111"]], { planId: 99, curriculumId: "TEST_LS:99" }));
    expect(applyTranscriptImport(wrongPlan, emptyProgress(10), transcript("| 202520 | 7 | BLG 111 | Intro | 3 | AA |")).matched).toEqual([]);
  });

  it("supports OR and AND alternatives and reports partial combinations", () => {
    const either = withRules(rule("MAT 103E", [["BLG 111"], ["CEN 113"]]));
    expect(applyTranscriptImport(either, emptyProgress(10), transcript("| 202520 | 7 | CEN 113 | Intro | 3 | BL |")).progress.requirementSatisfactions?.required?.satisfactionType).toBe("equivalence");
    const together = withRules(rule("MAT 103E", [["BLG 111", "BLG 112"]]));
    const complete = applyTranscriptImport(together, emptyProgress(10), transcript("| 202520 | 7 | BLG 111 | Intro | 2 | BA |\n| 202520 | 8 | BLG 112 | Discrete | 2 | BB |"));
    expect(complete.progress.requirementSatisfactions?.required?.satisfiedByCourseCodes).toEqual(["BLG 111", "BLG 112"]);
    const partial = applyTranscriptImport(together, emptyProgress(10), transcript("| 202520 | 7 | BLG 111 | Intro | 2 | BA |"));
    expect(partial.ambiguous[0].reason).toContain("requires all of");
    expect(partial.progress.requirementSatisfactions?.required).toBeUndefined();
  });

  it("enforces minimum grades, passing status, and pass/fail completion", () => {
    const minimum = withRules(rule("MAT 103E", [["BLG 111"]], { minimumGrade: "BB" }));
    expect(applyTranscriptImport(minimum, emptyProgress(10), transcript("| 202520 | 7 | BLG 111 | Intro | 3 | BA |")).matched).toHaveLength(1);
    expect(applyTranscriptImport(minimum, emptyProgress(10), transcript("| 202520 | 7 | BLG 111 | Intro | 3 | DD |")).matched).toHaveLength(0);
    expect(applyTranscriptImport(minimum, emptyProgress(10), transcript("| 202520 | 7 | BLG 111 | Intro | 3 | FF |")).matched).toHaveLength(0);
    const noMinimum = withRules(rule("MAT 103E", [["BLG 111"]]));
    expect(applyTranscriptImport(noMinimum, emptyProgress(10), transcript("| 202520 | 7 | BLG 111 | Intro | 3 | BL |")).matched).toHaveLength(1);
  });

  it("gives exact matches priority and equivalence priority over electives", () => {
    const prioritized = withRules(rule("MAT 103E", [["BLG 478E"]]));
    const exact = applyTranscriptImport(prioritized, emptyProgress(10), transcript("| 202520 | 1 | MAT 103E | Math | 4 | AA |\n| 202520 | 2 | BLG 478E | Security | 3 | BB |"));
    expect(exact.progress.requirementSatisfactions?.required?.satisfactionType).toBe("direct");
    expect(exact.progress.requirementSatisfactions?.["elective-a"]?.satisfactionType).toBe("elective");
    const equivalenceFirst = applyTranscriptImport(prioritized, emptyProgress(10), transcript("| 202520 | 2 | BLG 478E | Security | 3 | BB |"));
    expect(equivalenceFirst.progress.requirementSatisfactions?.required?.satisfactionType).toBe("equivalence");
    expect(equivalenceFirst.progress.requirementSatisfactions?.["elective-a"]).toBeUndefined();
  });

  it("reports equal alternatives and one-course-to-many-requirement conflicts", () => {
    const multiple = withRules(rule("MAT 103E", [["BLG 111"], ["CEN 113"]]));
    const alternatives = applyTranscriptImport(multiple, emptyProgress(10), transcript("| 202520 | 1 | BLG 111 | Intro | 3 | AA |\n| 202520 | 2 | CEN 113 | Intro | 3 | AA |"));
    expect(alternatives.ambiguous).toHaveLength(2);
    expect(curriculumTotals(multiple, alternatives.progress).earnedCourses).toBe(0);
    const conflict = structuredClone(curriculum);
    conflict.semesters[0].items.push({ kind: "course", id: "second-required", semester: 1, code: "FIZ 101E", title: "Physics", language: "EN", requirementType: "compulsory", creditOptions: [4], ectsOptions: [6] });
    conflict.equivalenceRules = [rule("MAT 103E", [["BLG 111"]]), rule("FIZ 101E", [["BLG 111"]])];
    const result = applyTranscriptImport(conflict, emptyProgress(10), transcript("| 202520 | 1 | BLG 111 | Intro | 3 | AA |"));
    expect(result.ambiguous[0].reason).toContain("2 curriculum requirements");
    expect(result.progress.requirementSatisfactions).toEqual({});
  });

  it("excludes non-calculated equivalents and persists satisfaction metadata", () => {
    const equivalent = withRules(rule("MAT 103E", [["BLG 111"]]));
    const parsed = parseTranscriptMarkdown("| Non-Calculated Courses | | | | | | |\n| Term | CRN | Course Code | Course Name | Language | Credit | Grade |\n| 202520 | 7 | BLG 111 | Intro | EN | 3 | AA |");
    const excluded = applyTranscriptImport(equivalent, emptyProgress(10), parsed);
    expect(excluded.progress.requirementSatisfactions).toEqual({});
    expect(excluded.progress.importedCourses).toHaveLength(1);
    const included = applyTranscriptImport(equivalent, emptyProgress(10), transcript("| 202520 | 7 | BLG 111 | Intro | 3 | AA |")).progress;
    const restored = parseCurriculumProgress(updateStoredCurriculumProgress(null, included), 10);
    expect(restored.requirementSatisfactions?.required).toEqual(included.requirementSatisfactions?.required);
  });

  it("treats Turkish and English versions of a requirement as language equivalents", () => {
    const result = applyTranscriptImport(curriculum, emptyProgress(10), transcript("| 202520 | 7 | MAT 103 | Matematik | 2 / 3 | BB |"));
    expect(result.progress.requirementSatisfactions?.required).toMatchObject({
      requirementCourseCode: "MAT 103E", satisfiedByCourseCodes: ["MAT 103"], satisfactionType: "language-equivalence",
    });
    expect(curriculumTotals(curriculum, result.progress).earnedCredit).toBe(4);
    expect(calculateGpa(result.progress.importedCourses ?? [])).toBe(3);
  });

  it("keeps exact priority when both language versions were completed", () => {
    const result = applyTranscriptImport(curriculum, emptyProgress(10), transcript("| 202520 | 7 | MAT 103 | Matematik | 4 | BA |\n| 202520 | 8 | MAT 103E | Mathematics | 4 | AA |"));
    expect(result.progress.requirementSatisfactions?.required).toMatchObject({ satisfiedByCourseCodes: ["MAT 103E"], satisfactionType: "direct" });
    expect(result.progress.courses["MAT 103"]).toBeUndefined();
  });

  it("expands official targets and alternatives to their Turkish/English counterparts", () => {
    const englishRule = withRules(rule("MAT 103E", [["BBF 101"]]));
    const alternativeVariant = applyTranscriptImport(englishRule, emptyProgress(10), transcript("| 202520 | 7 | BBF 101E | Introduction | 3 | AA |"));
    expect(alternativeVariant.progress.requirementSatisfactions?.required).toMatchObject({ satisfiedByCourseCodes: ["BBF 101E"], satisfactionType: "equivalence" });

    const turkishTarget = structuredClone(englishRule);
    const required = turkishTarget.semesters[0].items[0];
    if (required.kind !== "course") throw new Error("fixture");
    required.code = "MAT 103";
    expect(applyTranscriptImport(turkishTarget, emptyProgress(10), transcript("| 202520 | 7 | BBF 101E | Introduction | 3 | AA |")).progress.requirementSatisfactions?.required?.satisfactionType).toBe("equivalence");
  });

  it("matches the English-plan BBF courses through imported official rules", () => {
    const targetCodes = ["BLG 101E", "MAT 281E", "BLG 112E", "BLG 311E", "BLG 210E", "EHB 211E"];
    const englishCurriculum: ItuCurriculum = {
      planId: 1562, programCode: "BLGE_LS", title: "Computer Engineering", planTitle: "2021 English",
      semesters: [{ semester: 1, items: targetCodes.map((code, index) => ({
        kind: "course" as const, id: `english-${index}`, semester: 1, code, title: code, language: "EN",
        requirementType: "compulsory" as const, creditOptions: [3], ectsOptions: [5],
      })) }],
      prerequisites: {}, equivalenceRules: getStoredEquivalenceRules("BLGE_LS", 1562),
      prerequisiteBranchesLoaded: [], prerequisiteDataAvailable: true, warnings: [], fetchedAt: "2026-09-01T00:00:00.000Z",
    };
    const result = applyTranscriptImport(englishCurriculum, emptyProgress(1562), transcript([
      "| 202520 | 1 | BBF 101E | Intro | 3 | AA |",
      "| 202520 | 2 | BBF 102E | Math | 3 | AA |",
      "| 202520 | 3 | BBF 103E | Discrete | 3 | AA |",
      "| 202520 | 4 | BBF 204E | Automata | 3 | AA |",
      "| 202520 | 5 | MAT 210E | Engineering Math | 3 | AA |",
      "| 202520 | 6 | EEF 211E | Circuits | 3 | AA |",
    ].join("\n")));
    expect(result.unmatched).toEqual([]);
    expect(result.ambiguous).toEqual([]);
    expect(result.matched).toHaveLength(6);
    expect(Object.values(result.progress.requirementSatisfactions ?? {}).every((satisfaction) => satisfaction.satisfactionType === "equivalence")).toBe(true);

    const beforeRules = applyTranscriptImport({ ...englishCurriculum, equivalenceRules: [] }, emptyProgress(1562), transcript("| 202520 | 1 | BBF 101E | Intro | 3 | AA |")).progress;
    expect(beforeRules.requirementSatisfactions).toEqual({});
    expect(reconcileImportedProgress(englishCurriculum, beforeRules).requirementSatisfactions?.["english-0"]?.satisfiedByCourseCodes).toEqual(["BBF 101E"]);
  });

  it("uses language counterparts for elective choices after higher-priority matches", () => {
    const result = applyTranscriptImport(curriculum, emptyProgress(10), transcript("| 202520 | 7 | BLG 478 | Güvenlik | 3 | AA |"));
    expect(result.progress.requirementSatisfactions?.["elective-a"]).toMatchObject({ satisfiedByCourseCodes: ["BLG 478"], satisfactionType: "language-equivalence" });
  });
});
