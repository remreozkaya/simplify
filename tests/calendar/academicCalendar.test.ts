import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveCalendarTerm } from "@/lib/calendar/academicCalendar";
import { parseAcademicCalendar, parseCalendarFilters } from "@/lib/itu/academicCalendar";

const html = readFileSync(new URL("./fixtures/itu-calendar-2026-2027.html", import.meta.url), "utf8");

describe("İTÜ academic calendar", () => {
  it("resolves actual OBS labels and numeric codes to the same term", () => {
    expect(resolveCalendarTerm([{ semester: "2026-2027 Güz Dönemi" }, { semester: "202710" }]))
      .toEqual({ kind: "known", term: "202710" });
    expect(resolveCalendarTerm([{ semester: "202620" }, {}]))
      .toEqual({ kind: "confirm", term: "202620" });
    expect(resolveCalendarTerm([{ semester: "unknown" }])).toEqual({ kind: "confirm" });
    expect(resolveCalendarTerm([{ semester: "202710" }, { semester: "202720" }])).toEqual({ kind: "mixed" });
    expect(resolveCalendarTerm([{ semester: "202730" }])).toEqual({ kind: "unsupported" });
  });

  it("reads the year and undergraduate filter values from the page", () => {
    expect(parseCalendarFilters(html)).toMatchObject({
      undergraduate: "15",
      years: { "2026-2027": "854", "2025-2026": "564" },
    });
  });

  it("isolates the matching undergraduate semester and exact boundary labels", () => {
    expect(parseAcademicCalendar(html, "202710")).toEqual({
      term: "202710", start: "2026-09-28", end: "2026-12-31",
      breaks: [{ start: "2026-11-16", end: "2026-11-20" }],
    });
    expect(parseAcademicCalendar(html, "202720")).toEqual({
      term: "202720", start: "2027-02-01", end: "2027-04-30",
      breaks: [{ start: "2027-03-08", end: "2027-03-12" }],
    });
    expect(parseAcademicCalendar(html, "202620")).toBeNull();
  });

  it("validates dates, handles a cross-year break, and allows an unpublished break row", () => {
    expect(() => parseAcademicCalendar(html.replace("16  - 20 Kasım 2026", "31 - 32 Kasım 2026"), "202710")).toThrow();
    const longerFall = html.replace(/(<td>Güz Yarıyılı Sonu<\/td><td>)[^<]+/, "$115 Ocak 2027");
    expect(parseAcademicCalendar(longerFall.replace("16  - 20 Kasım 2026", "28 Aralık - 01 Ocak 2027"), "202710")?.breaks)
      .toEqual([{ start: "2026-12-28", end: "2027-01-01" }]);
    expect(parseAcademicCalendar(html.replace("Ara Tatil", "Başka Olay"), "202710")?.breaks).toEqual([]);
  });
});
