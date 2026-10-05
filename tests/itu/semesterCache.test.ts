import { markCatalogUnavailable } from "@/lib/itu/services/semesterCache";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
const fixture = readFileSync(new URL("../fixtures/itu/course-page.html", import.meta.url), "utf8");
vi.mock("@/lib/itu/services/getUndergraduateBranches", () => ({ getUndergraduateBranches: async () => [{id:310, code:"BLG"}] }));
afterEach(() => {vi.unstubAllGlobals(); vi.useRealTimers(); vi.resetModules();});

describe("semester scoped validated catalog cache", () => {
  it("refetches CRNs on a semester transition even within the normal cache lifetime", async () => {
    let semester = "2026-2027 Güz Dönemi";
    let html = fixture;
    vi.stubGlobal("fetch", async (url: URL) => new Response(url.pathname.includes("GetAktifDonem") ? JSON.stringify({aktifDonem: semester}) : html));
    const {getCoursesByBranch} = await import("@/lib/itu/services/getCoursesByBranch");
    const first = await getCoursesByBranch({branchId:310, branchCode:"BLG"});
    semester = "2026-2027 Bahar Dönemi";
    html = fixture.replaceAll("23713", "99999");
    const next = await getCoursesByBranch({branchId:310, branchCode:"BLG"});
    expect(first.semester).toBe("2026-2027 Güz Dönemi");
    expect(next.semester).toBe(semester);
    expect(next.courses.flatMap(c => c.sections.map(s => s.crn))).toContain("99999");
  });
  it("retains validated data on malformed refresh only within the verified same semester", async () => {
    vi.useFakeTimers();
    let semester = "2026-2027 Güz Dönemi";
    let html = fixture;
    vi.stubGlobal("fetch", async (url: URL) => new Response(url.pathname.includes("GetAktifDonem") ? JSON.stringify({aktifDonem: semester}) : html));
    const {getCoursesByBranch} = await import("@/lib/itu/services/getCoursesByBranch");
    const first = await getCoursesByBranch({branchId:310, branchCode:"BLG"});
    vi.advanceTimersByTime(301_000);
    html = "<html>maintenance</html>";
    expect(await getCoursesByBranch({branchId:310, branchCode:"BLG"})).toEqual(markCatalogUnavailable(first));
    semester = "2026-2027 Bahar Dönemi";
    await expect(getCoursesByBranch({branchId:310, branchCode:"BLG"})).rejects.toThrow();
  });
  it("fails rather than assigning restrictions to an unverified semester", async () => {
    vi.stubGlobal("fetch", async (url: URL) => new Response(url.pathname.includes("GetAktifDonem") ? JSON.stringify({aktifDonem:""}) : fixture));
    const {getCoursesByBranch} = await import("@/lib/itu/services/getCoursesByBranch");
    await expect(getCoursesByBranch({branchId:310, branchCode:"BLG"})).rejects.toThrow();
  });
});

it("accepts a recognized empty schedule for a new semester without reusing old restrictions", async () => {
  let semester = "2026-2027 Güz Dönemi";
  let html = fixture;
  vi.stubGlobal("fetch", async (url: URL) => new Response(url.pathname.includes("GetAktifDonem") ? JSON.stringify({aktifDonem:semester}) : html));
  const {getCoursesByBranch} = await import("@/lib/itu/services/getCoursesByBranch");
  await getCoursesByBranch({branchId:310, branchCode:"BLG"});
  semester = "2026-2027 Bahar Dönemi";
  html = `<table><thead><tr><th>CRN</th><th>Ders Kodu</th><th>Ders Adı</th></tr></thead><tbody><tr><td colspan="3">Kayıt bulunamadı.</td></tr></tbody></table>`;
  expect(await getCoursesByBranch({branchId:310, branchCode:"BLG"})).toMatchObject({semester, courses:[]});
});

const restrictedSchedule = (restriction: string | undefined, day = "Pazartesi") => `<table><thead><tr><th>CRN</th><th>Ders Kodu</th><th>Ders Adı</th><th>Gün</th><th>Saat</th>${restriction === undefined ? "" : "<th>Dersi Alabilen Programlar</th>"}</tr></thead><tbody><tr><td>101</td><td>BLG 101</td><td>Introduction</td><td>${day}</td><td>10:00/11:00</td>${restriction === undefined ? "" : `<td>${restriction}</td>`}</tr></tbody></table>`;

it.each([undefined, "", "-"])("preserves validated same-term restrictions when source restrictions disappear (%s)", async (restriction) => {
  vi.useFakeTimers();
  let semester = "2026-2027 Güz Dönemi";
  let html = restrictedSchedule("BLG_LS, BLGE_LS");
  vi.stubGlobal("fetch", async (url: URL) => new Response(url.pathname.includes("GetAktifDonem") ? JSON.stringify({aktifDonem:semester}) : html));
  const {getCoursesByBranch} = await import("@/lib/itu/services/getCoursesByBranch");
  const first = await getCoursesByBranch({branchId:310, branchCode:"BLG"});
  vi.advanceTimersByTime(301_000);
  html = restrictedSchedule(restriction);
  expect(await getCoursesByBranch({branchId:310, branchCode:"BLG"})).toEqual(markCatalogUnavailable(first));
  // A second failed refresh must still derive uncertainty from the untouched
  // validated snapshot, retaining its original raw restriction and timestamp.
  expect(await getCoursesByBranch({branchId:310, branchCode:"BLG"})).toEqual(markCatalogUnavailable(first));
  semester = "2026-2027 Bahar Dönemi";
  const next = await getCoursesByBranch({branchId:310, branchCode:"BLG"});
  expect(next.semester).toBe(semester);
  expect(next.courses[0].sections[0].programRestriction?.state).toBe("unknown");
  expect(next.courses[0].sections[0].majorRestriction).toBe(restriction);
});

it("preserves same-term offerings when parsed rows normalize to no recurring meetings", async () => {
  vi.useFakeTimers();
  let html = restrictedSchedule("BLG_LS");
  vi.stubGlobal("fetch", async (url: URL) => new Response(url.pathname.includes("GetAktifDonem") ? JSON.stringify({aktifDonem:"2026-2027 Güz Dönemi"}) : html));
  const {getCoursesByBranch} = await import("@/lib/itu/services/getCoursesByBranch");
  const first = await getCoursesByBranch({branchId:310, branchCode:"BLG"});
  vi.advanceTimersByTime(301_000);
  html = restrictedSchedule("BLG_LS", "Final Exam");
  expect(await getCoursesByBranch({branchId:310, branchCode:"BLG"})).toEqual(markCatalogUnavailable(first));
});
