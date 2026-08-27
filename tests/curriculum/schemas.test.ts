import { describe, expect, it } from "vitest";

import {
  curriculumGroupIdSchema,
  curriculumPlanIdSchema,
  curriculumProgramCodeSchema,
} from "@/lib/itu/curriculum/schemas";

describe("curriculum API input validation", () => {
  it("normalizes valid undergraduate program codes", () => {
    expect(curriculumProgramCodeSchema.parse(" blge_ls ")).toBe("BLGE_LS");
  });

  it("rejects non-undergraduate and URL-like program inputs", () => {
    expect(curriculumProgramCodeSchema.safeParse("BLG_DR").success).toBe(false);
    expect(curriculumProgramCodeSchema.safeParse("https://example.com").success).toBe(false);
  });

  it("accepts only positive integer identifiers", () => {
    expect(curriculumPlanIdSchema.parse("2340")).toBe(2340);
    expect(curriculumGroupIdSchema.safeParse("../1").success).toBe(false);
    expect(curriculumPlanIdSchema.safeParse(-1).success).toBe(false);
  });
});
