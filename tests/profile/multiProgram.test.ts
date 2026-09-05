import { describe, expect, it } from "vitest";

import { applyTranscriptImport, curriculumTotals } from "@/lib/curriculum/graduation";
import { emptyProgress } from "@/lib/curriculum/progress";
import { calculateGpa, parseTranscriptMarkdown } from "@/lib/curriculum/transcript";
import { mergeTranscriptCourses, parseSharedTranscript, serializeSharedTranscript, transcriptFromLegacyProgress, transcriptFromLegacyProgressStore, transcriptParseResult } from "@/lib/curriculum/transcriptStore";
import type { ItuCurriculum } from "@/lib/itu/curriculum/types";

function curriculum(planId: number, programCode: string, requirementCode: string): ItuCurriculum {
  return {
    planId,
    programCode,
    title: programCode,
    planTitle: `Plan ${planId}`,
    semesters: [{ semester: 1, items: [{ kind: "course", id: `${planId}-required`, semester: 1, code: requirementCode, title: requirementCode, requirementType: "compulsory", creditOptions: [4], ectsOptions: [6] }] }],
    totalCredit: 4,
    prerequisites: {},
    equivalenceRules: [],
    prerequisiteBranchesLoaded: [],
    prerequisiteDataAvailable: true,
    warnings: [],
    fetchedAt: "2026-09-02T00:00:00.000Z",
  };
}

const parsed = parseTranscriptMarkdown("| Completed English Courses | | | | | |\n| Term | CRN | Course Code | Course Name | Credit | Grade |\n| 202610 | 12345 | MAT 101 | Mathematics | 4 | AA |");

describe("multi-program transcript audits", () => {
  it("stores one shared transcript and restores legacy plan imports", () => {
    const courses = [...parsed.calculatedCourses, ...parsed.nonCalculatedCourses];
    expect(parseSharedTranscript(serializeSharedTranscript(courses, "2026-09-02T00:00:00.000Z"))).toEqual(courses);
    expect(transcriptFromLegacyProgress([{ ...emptyProgress(1), importedCourses: courses }, emptyProgress(2)])).toEqual(courses);
    expect(transcriptFromLegacyProgressStore(JSON.stringify({ version: 3, plans: { "1": { version: 3, planId: 1, courses: {}, importedCourses: courses } } }))).toEqual(courses);
  });

  it("evaluates the same course independently without combining program totals", () => {
    const courses = [...parsed.calculatedCourses, ...parsed.nonCalculatedCourses];
    const transcript = transcriptParseResult(courses);
    const main = applyTranscriptImport(curriculum(1, "MAIN", "MAT 101"), emptyProgress(1), transcript).progress;
    const minor = applyTranscriptImport(curriculum(2, "MINOR", "MAT 101"), emptyProgress(2), transcript).progress;
    expect(curriculumTotals(curriculum(1, "MAIN", "MAT 101"), main).earnedCredit).toBe(4);
    expect(curriculumTotals(curriculum(2, "MINOR", "MAT 101"), minor).earnedCredit).toBe(4);
    expect(main.planId).not.toBe(minor.planId);
    expect(calculateGpa(courses)).toBe(4);
  });

  it("keeps equivalence evaluation plan-specific", () => {
    const source = curriculum(1, "MAIN", "PHY 101");
    source.equivalenceRules = [{
      id: "rule", curriculumId: "MAIN:1", programId: 1, programCode: "MAIN", planType: "Lisans", planTypeId: 2, planId: 1, branchCode: "PHY",
      targetCourseCode: "PHY 101", targetCourseCodeOfficial: "PHY 101", alternatives: [{ allOf: ["MAT 101"] }], relationshipType: "directional",
      sourceUrl: "https://example.com", sourceLabel: "Official", retrievedAt: "2026-09-02T00:00:00.000Z", verified: true, active: true,
    }];
    const other = curriculum(2, "OTHER", "PHY 101");
    expect(applyTranscriptImport(source, emptyProgress(1), parsed).matched).toHaveLength(1);
    expect(applyTranscriptImport(other, emptyProgress(2), parsed).matched).toHaveLength(0);
  });

  it("keeps earlier program progress when a later semester import belongs to another program", () => {
    const firstSemester = parsed.calculatedCourses;
    const nextSemester = parseTranscriptMarkdown("| Completed English Courses | | | | | |\n| Term | CRN | Course Code | Course Name | Credit | Grade |\n| 202620 | 54321 | EKO 201 | Economics | 3 | BA |");
    const accumulated = mergeTranscriptCourses(firstSemester, nextSemester.calculatedCourses);
    const accumulatedResult = transcriptParseResult(accumulated);

    const main = applyTranscriptImport(curriculum(1, "MAIN", "MAT 101"), emptyProgress(1), accumulatedResult).progress;
    const minor = applyTranscriptImport(curriculum(2, "MINOR", "EKO 201"), emptyProgress(2), accumulatedResult).progress;

    expect(curriculumTotals(curriculum(1, "MAIN", "MAT 101"), main).earnedCredit).toBe(4);
    expect(curriculumTotals(curriculum(2, "MINOR", "EKO 201"), minor).earnedCredit).toBe(4);
    expect(accumulated.map((course) => course.courseCode)).toEqual(["MAT 101", "EKO 201"]);
  });

  it("upserts repeated course attempts without duplicating or downgrading the stored result", () => {
    const failed = parseTranscriptMarkdown("| Completed English Courses | | | | | |\n| Term | CRN | Course Code | Course Name | Credit | Grade |\n| 202410 | 1 | BLG 102E | Programming | 4 | FF |").calculatedCourses;
    const passed = parseTranscriptMarkdown("| Completed English Courses | | | | | |\n| Term | CRN | Course Code | Course Name | Credit | Grade |\n| 202520 | 2 | BLG 102E | Programming | 4 | BA |").calculatedCourses;

    expect(mergeTranscriptCourses(failed, passed)).toMatchObject([{ courseCode: "BLG 102E", term: "202520", grade: "BA", completionStatus: "passed" }]);
    expect(mergeTranscriptCourses(passed, failed)).toMatchObject([{ courseCode: "BLG 102E", term: "202520", grade: "BA", completionStatus: "passed" }]);
    expect(mergeTranscriptCourses(passed, passed)).toHaveLength(1);
  });
});
