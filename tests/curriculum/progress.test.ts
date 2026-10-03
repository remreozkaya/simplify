import { describe, expect, it } from "vitest";

import {
  parseCurriculumProgress,
  resetStoredCurriculumProgress,
  updateStoredCurriculumProgress,
} from "@/lib/curriculum/progress";

describe("curriculum progress persistence", () => {
  it("isolates progress by plan and rejects malformed storage", () => {
    expect(parseCurriculumProgress("broken", 2340).courses).toEqual({});
    const first = updateStoredCurriculumProgress(null, {
      version: 1,
      planId: 2340,
      courses: { "MAT 103E": { state: "passed", grade: "AA" } },
    });
    const both = updateStoredCurriculumProgress(first, {
      version: 1,
      planId: 1562,
      courses: { "BLG 102E": { state: "failed" } },
    });
    expect(parseCurriculumProgress(both, 2340).courses).toEqual({
      "MAT 103E": { state: "passed", grade: "AA" },
    });
    expect(parseCurriculumProgress(both, 1562).courses).toEqual({
      "BLG 102E": { state: "failed" },
    });
  });

  it("migrates legacy planned courses to not taken", () => {
    const legacy = JSON.stringify({
      version: 1,
      plans: {
        "2340": {
          version: 1,
          planId: 2340,
          courses: {
            "BLG 102E": { state: "planned" },
            "MAT 103E": { state: "passed", grade: "AA" },
          },
        },
      },
    });

    expect(parseCurriculumProgress(legacy, 2340).courses).toEqual({
      "MAT 103E": { state: "passed", grade: "AA" },
    });
  });
});


describe("transcript reset across stored plans", () => {
  it("clears inactive plan imports and preserves manual completions", () => {
    const record = { term: "202510", crn: "1", courseCode: "MAT 103E", courseName: "Math", grade: "BA", countedCredit: 4, transcriptCredit: 4, completionStatus: "passed", source: "transcript", calculated: true };
    const plans = Object.fromEntries([10, 20].map((planId) => [String(planId), {
      version: 3, planId,
      courses: { "MAT 103E": { state: "passed", source: "transcript" }, "MAN 100": { state: "passed", source: "manual", grade: "BB" } },
      importedCourses: [record],
      requirementSatisfactions: {
        imported: { requirementId: "imported", requirementCourseCode: "MAT 103E", satisfiedByCourseCodes: ["MAT 103E"], satisfactionType: "direct" },
        manual: { requirementId: "manual", requirementCourseCode: "MAN 100", satisfiedByCourseCodes: ["MAN 100"], satisfactionType: "manual" },
        mixed: { requirementId: "mixed", requirementCourseCode: "OTHER", satisfiedByCourseCodes: ["MAT 103E", "MAN 100"], satisfactionType: "equivalence" },
      },
    }]));
    const cleared = resetStoredCurriculumProgress(JSON.stringify({ version: 3, plans }));
    for (const planId of [10, 20]) {
      const progress = parseCurriculumProgress(cleared, planId);
      expect(progress.courses).toEqual({ "MAN 100": { state: "passed", source: "manual", grade: "BB" } });
      expect(progress.importedCourses).toEqual([]);
      expect(Object.keys(progress.requirementSatisfactions ?? {})).toEqual(["manual"]);
    }
  });
  it("handles absent and malformed progress safely", () => {
    expect(JSON.parse(resetStoredCurriculumProgress(null)).plans).toEqual({});
    expect(JSON.parse(resetStoredCurriculumProgress("broken")).plans).toEqual({});
  });
});
