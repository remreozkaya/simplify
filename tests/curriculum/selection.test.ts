import { describe, expect, it } from "vitest";

import {
  parseSavedCurriculum,
  serializeSavedCurriculum,
} from "@/lib/curriculum/selection";

describe("saved curriculum selection", () => {
  it("round-trips a saved program and plan", () => {
    const stored = serializeSavedCurriculum("BLGE_LS", 2340, "2026-08-30T12:00:00.000Z");
    expect(parseSavedCurriculum(stored)).toEqual({
      version: 1,
      programCode: "BLGE_LS",
      planId: 2340,
      savedAt: "2026-08-30T12:00:00.000Z",
    });
  });

  it("rejects malformed saved selections", () => {
    expect(parseSavedCurriculum("broken")).toBeNull();
    expect(parseSavedCurriculum(JSON.stringify({ version: 1, planId: -1 }))).toBeNull();
  });
});
