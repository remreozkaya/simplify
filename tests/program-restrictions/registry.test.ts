import { describe, expect, it } from "vitest";
import registry from "../../src/data/itu/program-restrictions.json";
import catalog from "../../src/data/itu/curriculum-catalog.json";
import fixtures from "./fixtures/official-sections.json";
// The importer is also exercised directly by the offline CLI; the exports keep
// source parsing and evidence retention independently testable.
import { buildRegistry, parseSchedule, parseProgramTable } from "../../scripts/import-program-restrictions.mjs";

describe("official program restriction registry", () => {
  it("represents every catalog minor with literal evidence for verified identities", () => {
    const minors = catalog.programs.filter(p => p.planType === "yandal");
    expect(registry.minorMappings.map(m => m.curriculumCode).sort()).toEqual(minors.map(m => m.code).sort());
    for (const mapping of registry.minorMappings) {
      expect(mapping.restrictionCode).toBe(mapping.curriculumCode);
      if (mapping.verified) {
        expect(mapping.observations.length).toBeGreaterThan(0);
        expect(registry.observationSummary.observedTokens).toContain(mapping.restrictionCode);
        expect(mapping.sources).toContain(catalog.sourceUrl);
      }
    }
    expect(registry.observationSummary.unresolvedLegacyMinorCodes).toContain("MKN");
    expect(registry.minorMappings.flatMap(m => m.legacyCodes)).not.toContain("MKN");
  });

  it("keeps different real allowlists for two sections of BLG 231E", () => {
    const rows = parseSchedule(fixtures.find(f => f.branch === "BLG")!.html);
    expect(rows[0].crn).toBe("12476");
    expect(rows[1].crn).toBe("12477");
    expect(rows[0].courseCode).toBe(rows[1].courseCode);
    expect(rows[0].tokens).toContain("END_LS");
    expect(rows[1].tokens).not.toContain("END_LS");
  });

  it("extracts a real full minor code and leaves a real dash unknown", () => {
    const rows = fixtures.flatMap(f => parseSchedule(f.html));
    expect(rows.some(r => r.tokens.includes("FIZ_YD"))).toBe(true);
    expect(rows.find(r => r.raw === "-").tokens).toEqual([]);
    expect(registry.observationSummary.unrestrictedSentinels).toEqual([]);
  });

  it("rejects a moved header and an error page", () => {
    expect(() => parseSchedule(fixtures[0].html.replace("Dersi Alabilen Programlar", "Other"))).toThrow();
    expect(() => parseProgramTable("<html>Maintenance</html>")).toThrow();
  });

  it("does not verify an unobserved candidate or guess a legacy suffix", () => {
    const next = buildRegistry({ programs: [], minorMappings: [] }, {
      sourceUrl: catalog.sourceUrl, programs: [
        { code: "FIZ_YD", name: "Fizik Mühendisliği (Yandal)", planType: "yandal" },
        { code: "ZZZ_YD", name: "Unobserved (Yandal)", planType: "yandal" },
      ], plans: [],
    }, [{ code: "FIZ_LS", name: "Fizik Mühendisliği" }], [{ code: "ZZZM", name: "Different (Yandal)" }],
    fixtures.map(f => ({ ...f, rows: parseSchedule(f.html) })), "2026-2027 Güz Dönemi", "2026-10-05");
    expect(next.minorMappings.find((m: { curriculumCode: string }) => m.curriculumCode === "ZZZ_YD").verified).toBe(false);
    expect(next.minorMappings.find((m: { curriculumCode: string }) => m.curriculumCode === "ZZZ_YD").legacyCodes).toEqual([]);
  });

  it("retains prior verified observations with dated provenance during partial refresh", () => {
    const next = buildRegistry(registry, catalog,
      registry.programs.map(p => ({ code: p.code, name: p.nameTr })), registry.legacyPrograms,
      [{ ...fixtures[0], rows: parseSchedule(fixtures[0].html) }], "another semester", "later");
    const retained = next.minorMappings.find((m: { curriculumCode: string }) => m.curriculumCode === "FIZ_YD");
    expect(retained.verified).toBe(true);
    expect(retained.retainedFrom).toBe(registry.retrievedAt);
    expect(retained.observations[0].semester).toBe(registry.observationSummary.semester);
  });
});
