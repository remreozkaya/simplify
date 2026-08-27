import { describe, expect, it } from "vitest";

import {
  parseCurriculumProgress,
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
      courses: { "BLG 102E": { state: "planned" } },
    });
    expect(parseCurriculumProgress(both, 2340).courses).toEqual({
      "MAT 103E": { state: "passed", grade: "AA" },
    });
    expect(parseCurriculumProgress(both, 1562).courses).toEqual({
      "BLG 102E": { state: "planned" },
    });
  });
});
