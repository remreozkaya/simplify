import { describe, expect, it } from "vitest";

import { isPassingGrade, GRADES } from "@/lib/curriculum/grades";
import { curriculumTotals, applyTranscriptImport, progressForRequirement } from "@/lib/curriculum/graduation";
import { getEquivalenceStore } from "@/lib/curriculum/equivalenceStore";
import { emptyProgress } from "@/lib/curriculum/progress";
import type { TranscriptCourseRecord } from "@/lib/curriculum/types";
import type { TranscriptParseResult } from "@/lib/curriculum/transcript";
import type { ItuCurriculum, ItuCurriculumItem } from "@/lib/itu/curriculum/types";
import { courseLanguageVariants } from "@/lib/itu/courseCode.mjs";

const activeRules = getEquivalenceStore().rules.filter((rule) => rule.active && rule.verified);
const allCourseCodes = [...new Set(activeRules.flatMap((rule) => [
  rule.targetCourseCode,
  ...rule.alternatives.flatMap((alternative) => alternative.allOf),
]))].sort();

function record(courseCode: string, grade: TranscriptCourseRecord["grade"] = "AA", calculated = true): TranscriptCourseRecord {
  return {
    term: "202610", crn: "1", courseCode, courseName: courseCode, grade,
    countedCredit: 3, transcriptCredit: 3,
    completionStatus: isPassingGrade(grade) ? "passed" : "failed",
    source: "transcript", calculated,
  };
}

function parsed(calculatedCourses: TranscriptCourseRecord[] = [], nonCalculatedCourses: TranscriptCourseRecord[] = []): TranscriptParseResult {
  return { calculatedCourses, nonCalculatedCourses, invalidRows: [], duplicateRows: [] };
}

function courseItem(code: string, id = "requirement", semester = 1): Extract<ItuCurriculumItem, { kind: "course" }> {
  return {
    kind: "course", id, semester, code, title: code, language: code.endsWith("E") || code.endsWith("EL") ? "EN" : "TR",
    requirementType: "compulsory", creditOptions: [3], ectsOptions: [5],
  };
}

function curriculumFor(code: string, rules = activeRules.filter((rule) => rule.targetCourseCode === code)): ItuCurriculum {
  const scoped = rules[0];
  return {
    planId: scoped?.planId ?? 1,
    programCode: scoped?.programCode ?? "TEST_LS",
    title: "Outcome matrix", planTitle: "Test", totalCredit: 3,
    semesters: [{ semester: 1, items: [courseItem(code)] }],
    prerequisites: {}, equivalenceRules: rules,
    prerequisiteBranchesLoaded: [], prerequisiteDataAvailable: true, warnings: [], fetchedAt: "2026-09-02T00:00:00.000Z",
  };
}

describe("all stored undergraduate course outcomes", () => {
  it("covers every stored course code across every grade, failed, and not-taken outcome", () => {
    expect(allCourseCodes.length).toBeGreaterThan(100);
    allCourseCodes.forEach((code) => {
      const curriculum = curriculumFor(code, []);
      const item = curriculum.semesters[0].items[0];
      expect(progressForRequirement(item, emptyProgress(curriculum.planId)), `${code}: not-taken`).toBeNull();

      GRADES.forEach((grade) => {
        const result = applyTranscriptImport(curriculum, emptyProgress(curriculum.planId), parsed([record(code, grade)]));
        const completion = progressForRequirement(item, result.progress);
        expect(completion?.course.state, `${code}/${grade}: visible state`).toBe(isPassingGrade(grade) ? "passed" : "failed");
        expect(Boolean(result.progress.requirementSatisfactions?.requirement), `${code}/${grade}: satisfaction`).toBe(isPassingGrade(grade));
        expect(curriculumTotals(curriculum, result.progress).earnedCourses, `${code}/${grade}: earned count`).toBe(isPassingGrade(grade) ? 1 : 0);
      });

      const nonCalculated = applyTranscriptImport(curriculum, emptyProgress(curriculum.planId), parsed([], [record(code, "AA", false)]));
      expect(nonCalculated.progress.requirementSatisfactions, `${code}: non-calculated`).toEqual({});
    });
  });

  it("resolves the Turkish/English counterpart of every eligible stored code", () => {
    allCourseCodes.forEach((code) => {
      const counterpart = courseLanguageVariants(code)[1];
      if (!counterpart) return;
      const curriculum = curriculumFor(code, []);
      const result = applyTranscriptImport(curriculum, emptyProgress(curriculum.planId), parsed([record(counterpart)]));
      expect(result.progress.requirementSatisfactions?.requirement, `${code} <- ${counterpart}`).toMatchObject({
        satisfiedByCourseCodes: [counterpart], satisfactionType: "language-equivalence",
      });
    });
  });

  it("exercises every official rule alternative as passing, failed, non-calculated, and language-variant input", () => {
    activeRules.forEach((rule) => {
      rule.alternatives.forEach((alternative, alternativeIndex) => {
        const curriculum = curriculumFor(rule.targetCourseCode, [rule]);
        const context = `${rule.programCode}/${rule.planId} ${rule.targetCourseCode} alternative ${alternativeIndex + 1}`;
        const passing = alternative.allOf.map((code, index) => ({ ...record(code), crn: String(index + 1) }));
        const passed = applyTranscriptImport(curriculum, emptyProgress(rule.planId), parsed(passing));
        expect(passed.progress.requirementSatisfactions?.requirement, `${context}: passing`).toBeDefined();
        expect(curriculumTotals(curriculum, passed.progress).earnedCredit, `${context}: target credit`).toBe(3);

        const failed = passing.map((course, index) => index === 0 ? record(course.courseCode, "FF") : course);
        expect(applyTranscriptImport(curriculum, emptyProgress(rule.planId), parsed(failed)).progress.requirementSatisfactions?.requirement, `${context}: failed`).toBeUndefined();

        const nonCalculated = passing.map((course) => ({ ...course, calculated: false }));
        expect(applyTranscriptImport(curriculum, emptyProgress(rule.planId), parsed([], nonCalculated)).progress.requirementSatisfactions?.requirement, `${context}: non-calculated`).toBeUndefined();

        const languageVariants = alternative.allOf.map((code, index) => ({ ...record(courseLanguageVariants(code)[1] ?? code), crn: String(index + 1) }));
        expect(applyTranscriptImport(curriculum, emptyProgress(rule.planId), parsed(languageVariants)).progress.requirementSatisfactions?.requirement, `${context}: language variants`).toBeDefined();
      });
    });
  });

  it("places every passing elective and its language counterpart in the earliest eligible slot", () => {
    allCourseCodes.forEach((code) => {
      const choice = { code, title: code, creditOptions: [3], ectsOptions: [5] };
      const electiveCurriculum: ItuCurriculum = {
        ...curriculumFor("ZZZ 999", []),
        totalCredit: 9,
        semesters: [1, 2, 3].map((semester) => ({ semester, items: [{
          kind: "elective-slot" as const, id: `slot-${semester}`, semester, title: `Elective ${semester}`,
          creditOptions: [3], ectsOptions: [5], courses: [choice],
        }] })),
      };
      const exact = applyTranscriptImport(electiveCurriculum, emptyProgress(1), parsed([record(code)]));
      expect(exact.progress.requirementSatisfactions?.["slot-1"]?.satisfiedByCourseCodes, `${code}: earliest exact elective`).toEqual([code]);
      expect(exact.progress.requirementSatisfactions?.["slot-2"], `${code}: later exact elective`).toBeUndefined();

      const counterpart = courseLanguageVariants(code)[1];
      if (!counterpart) return;
      const language = applyTranscriptImport(electiveCurriculum, emptyProgress(1), parsed([record(counterpart)]));
      expect(language.progress.requirementSatisfactions?.["slot-1"], `${code}: earliest language elective`).toMatchObject({
        satisfiedByCourseCodes: [counterpart], satisfactionType: "language-equivalence",
      });
    });
  });
});
