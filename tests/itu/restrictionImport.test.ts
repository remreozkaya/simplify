import { describe, expect, it } from "vitest";
import { parseCoursePage } from "@/lib/itu/parsers/parseCoursePage";
import { normalizeCoursePage } from "@/lib/itu/normalizers/normalizeCoursePage";
import { toCalendarCatalog } from "@/lib/itu/adapters/toCalendarCatalog";

const html = `<table><thead><tr><th>CRN</th><th>Ders Kodu</th><th>Ders Adı</th><th>Gün</th><th>Saat</th><th>Dersi Alabilen Programlar</th></tr></thead><tbody>
${["BLG_LS, BLGE_LS", "KHE_YD", "", "-"].map((raw, i) => `<tr><td>${100 + i}</td><td>BLG 101</td><td>Introduction</td><td>Pazartesi</td><td>10:00/11:00</td><td>${raw}</td></tr>`).join("")}</tbody></table>`;

describe("OBS program restriction import", () => {
  it("retains the live header's raw text including empty and placeholder cells", () => {
    expect(parseCoursePage(html).map((row) => row.majorRestriction)).toEqual(["BLG_LS, BLGE_LS", "KHE_YD", "", "-"]);
  });
  it("keeps CRN-specific allowlists and unknown restrictions through the calendar adapter", () => {
    const catalog = toCalendarCatalog(normalizeCoursePage(parseCoursePage(html), 310, "BLG", "2026-10-05T10:00:00.000Z", "2026-2027 Güz Dönemi"));
    expect(catalog).toMatchObject({semester: "2026-2027 Güz Dönemi", fetchedAt: "2026-10-05T10:00:00.000Z"});
    expect(catalog.courses[0].sections.map((section) => section.programRestriction)).toMatchObject([
      {state:"allowlist", codes:["BLG_LS", "BLGE_LS"]},
      {state:"allowlist", codes:["KHE_YD"]},
      {state:"unknown", codes:[]},
      {state:"unknown", codes:[]},
    ]);
    expect(catalog.courses[0].sections.every(section => section.semester === catalog.semester)).toBe(true);
  });
});

it("marks conflicting restriction rows for the same CRN unknown rather than choosing an allowlist", () => {
  const rows = parseCoursePage(html);
  const catalog = normalizeCoursePage([rows[0], {...rows[0], majorRestriction:"KHE_YD", day:"Salı"}], 310, "BLG");
  expect(catalog.courses[0].sections[0].programRestriction).toMatchObject({state:"unknown", reason:"conflicting-source-values"});
  expect(catalog.courses[0].sections[0].majorRestriction).toContain("KHE_YD");
});
