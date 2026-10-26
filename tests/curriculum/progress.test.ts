import { describe, expect, it } from "vitest";

import {
  parseCurriculumProgress,
  mergePrerequisiteProgress,
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
  it("clears every course across active and inactive plans, including manual and zero-credit completions", () => {
    const record = { term: "202510", crn: "1", courseCode: "MAT 103E", courseName: "Math", grade: "BA", countedCredit: 4, transcriptCredit: 4, completionStatus: "passed", source: "transcript", calculated: true };
    const plans = Object.fromEntries([10, 20].map((planId) => [String(planId), {
      version: 3, planId,
      courses: {
        "MAT 103E": { state: "passed", source: "transcript" },
        "MAN 100": { state: "passed", source: "manual", grade: "BB" },
        "TUR 121": { state: "passed", source: "manual", grade: "BL", countedCredit: 0, transcriptCredit: 0 },
        "ATA 121": { state: "passed", source: "transcript", grade: "BL", countedCredit: 0, transcriptCredit: 0 },
        "DAN 102": { state: "passed", countedCredit: 0 },
        "TUR 122": { state: "failed", source: "manual", countedCredit: 0 },
      },
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
      expect(progress.courses).toEqual({});
      expect(progress.importedCourses).toEqual([]);
      expect(progress.requirementSatisfactions).toEqual({});
    }
  });
  it("handles absent and malformed progress safely", () => {
    expect(JSON.parse(resetStoredCurriculumProgress(null)).plans).toEqual({});
    expect(JSON.parse(resetStoredCurriculumProgress("broken")).plans).toEqual({});
  });
});


it.each(["MAT 103", "MAT 103E"])("keeps canonical transcript grades over manual %s prerequisites", (manualCode) => {
  const merged = mergePrerequisiteProgress({
    [manualCode]: { state: "passed", grade: "AA", source: "manual" },
  }, { "MAT 103": { state: "failed", grade: "FF", source: "transcript", courseCode: "MAT 103" } });
  expect(merged["MAT 103"]).toMatchObject({ state: "failed", grade: "FF" });
  expect(merged["MAT 103E"]).toMatchObject({ state: "failed", grade: "FF" });
});

it("retains each exact transcript attempt when both language codes are present", () => {
  const merged = mergePrerequisiteProgress({}, {
    "FIZ 101": { state: "failed", grade: "FF" },
    "FIZ 101E": { state: "passed", grade: "BA" },
  });
  expect(merged["FIZ 101"].grade).toBe("FF");
  expect(merged["FIZ 101E"].grade).toBe("BA");
});
