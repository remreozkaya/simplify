import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseUndergraduateBranches } from "@/lib/itu/parsers/parseUndergraduateBranches";

const fixture = JSON.parse(
  readFileSync(
    new URL("../fixtures/itu/branches-page.html", import.meta.url),
    "utf8",
  ),
) as unknown;

describe("parseUndergraduateBranches", () => {
  it("validates, normalizes, de-duplicates, and sorts OBS branches", () => {
    expect(parseUndergraduateBranches(fixture)).toEqual([
      { id: 310, code: "BLG", name: undefined },
      { id: 210, code: "EHB", name: undefined },
      { id: 120, code: "MAT", name: undefined },
    ]);
  });

  it("accepts a common wrapped response shape", () => {
    expect(
      parseUndergraduateBranches({
        data: [{ bransKoduId: "42", dersBransKodu: "ecn" }],
      }),
    ).toEqual([{ id: 42, code: "ECN", name: undefined }]);
  });

  it("rejects responses without a branch list", () => {
    expect(() => parseUndergraduateBranches({ message: "changed" })).toThrow(
      /branch list/i,
    );
  });
});
