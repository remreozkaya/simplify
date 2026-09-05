import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { mergeVerifiedScope } from "@/lib/itu/equivalence/importState.mjs";
import { parseOfficialEquivalenceTable } from "@/lib/itu/equivalence/parser.mjs";
import { getEquivalenceStore } from "@/lib/curriculum/equivalenceStore";

const html = readFileSync("tests/fixtures/itu/equivalence.html", "utf8");

describe("official equivalence importer", () => {
  it("parses official direction and preserves meaningful suffixes", () => {
    const parsed = parseOfficialEquivalenceTable(html, ["BLG 113E", "FIZ 101L"]);
    expect(parsed.failures).toEqual([]);
    expect(parsed.records[0]).toEqual({
      target: { normalized: "BLG 113E", official: "BLG 113E" },
      alternatives: [
        { normalized: "BLG 111", official: "BLG 111" },
        { normalized: "CEN 113E", official: "CEN 113E" },
      ],
    });
    expect(parsed.records[1].target.normalized).toBe("FIZ 101L");
  });

  it("is idempotent and never deletes verified rows after a temporary failure", () => {
    const existing = [{ id: "one", programCode: "BLG_LS", planId: 1561, branchCode: "BLG", active: true, verified: true }];
    const incoming = [{ ...existing[0], retrievedAt: "2026-09-01T00:00:00.000Z" }];
    const first = mergeVerifiedScope(existing, incoming, { programCode: "BLG_LS", planId: 1561, branchCode: "BLG" }, "2026-09-01T00:00:00.000Z");
    const second = mergeVerifiedScope(first.rules, incoming, { programCode: "BLG_LS", planId: 1561, branchCode: "BLG" }, "2026-09-01T00:00:00.000Z");
    expect(second.rules).toHaveLength(1);
    expect(second.stale).toBe(0);
    expect(mergeVerifiedScope(second.rules, [], { programCode: "BLG_LS", planId: 1561, branchCode: "BLG" }, "2026-09-02T00:00:00.000Z", false).rules).toEqual(second.rules);
  });

  it("stores unique, verified official records with source metadata", () => {
    const store = getEquivalenceStore();
    expect(store.rules.length).toBeGreaterThan(0);
    expect(new Set(store.rules.map((rule) => rule.id)).size).toBe(store.rules.length);
    expect(store.rules.filter((rule) => rule.active).every((rule) => rule.verified && rule.sourceUrl.startsWith("https://obs.itu.edu.tr/"))).toBe(true);
    expect(store.failures).toEqual([]);
  });
});
