import {describe, expect, it} from "vitest";
import {parseCalendarCatalog, mergeSemesterCatalog, isCatalogFresh} from "@/lib/itu/services/semesterCache";
import type {FacultyOption} from "@/types/calendar";
const current: FacultyOption = {facultyCode:"BLG", courses:[], semester:"2026-2027 Güz Dönemi", fetchedAt:"2026-10-05T10:00:00.000Z"};
describe("browser semester cache", () => {
  it.each([["10:00", "10:00"], ["11:00", "10:00"]])("rejects a non-positive recurring meeting %s–%s", (startTime, endTime) => {
    const catalog = {...current, courses: [{ id: "BLG:101", code: "BLG 101", title: "QA", sections: [{ id: "BLG:1", crn: "1", semester: current.semester, meetings: [{ id: "meeting", day: "Monday", startTime, endTime }] }] }]};
    expect(() => parseCalendarCatalog({catalog}, "BLG")).toThrow();
  });

  it("preserves valid adjacent and multi-meeting sections", () => {
    const catalog = {...current, courses: [{ id: "BLG:101", code: "BLG 101", title: "QA", sections: [{ id: "BLG:1", crn: "1", semester: current.semester, meetings: [{ id: "lecture", day: "Monday", startTime: "09:00", endTime: "10:00" }, { id: "laboratory", day: "Monday", startTime: "10:00", endTime: "11:00" }] }] }]};
    expect(parseCalendarCatalog({catalog}, "BLG")).toEqual(catalog);
  });

  it("requires a verified semester and rejects malformed CRN restrictions before replacing data", () => {
    expect(() => parseCalendarCatalog({catalog:{facultyCode:"BLG", courses:[]}}, "BLG")).toThrow();
    expect(() => parseCalendarCatalog({catalog:{...current,courses:[{id:"x", code:"BLG 101", title:"Intro", sections:[{id:"x", crn:"1", meetings:[], programRestriction:{state:"allowlist", codes:"BLG"}}]}]}}, "BLG")).toThrow();
    expect(parseCalendarCatalog({catalog:current}, "BLG")).toEqual(current);
  });
  it("expires catalog data after the official five minute refresh interval", () => {
    expect(isCatalogFresh(current, Date.parse(current.fetchedAt!) + 299_000)).toBe(true);
    expect(isCatalogFresh(current, Date.parse(current.fetchedAt!) + 301_000)).toBe(false);
    expect(isCatalogFresh({...current, semester:undefined}, Date.parse(current.fetchedAt!))).toBe(false);
  });
  it("removes old-semester branches when a verified new-semester catalog arrives", () => {
    const next = {...current, semester:"2026-2027 Bahar Dönemi"};
    expect(mergeSemesterCatalog({BLG:current, MAT:{...current, facultyCode:"MAT"}}, next)).toEqual({BLG:next});
    expect(mergeSemesterCatalog({MAT:{...current, facultyCode:"MAT"}}, current)).toHaveProperty("MAT");
  });
});

it("masks unavailable catalog restrictions without mutating the retained snapshot", async () => {
  const { markCatalogUnavailable } = await import("@/lib/itu/services/semesterCache");
  const source = {...current, courses:[{id:"BLG:BLG 101", code:"BLG 101", title:"Introduction", sections:[{id:"BLG:101", crn:"101", semester:current.semester, majorRestriction:"BLG_LS", programRestriction:{raw:"BLG_LS",state:"allowlist" as const,codes:["BLG_LS"]}, meetings:[]}]}]};
  const unavailable = markCatalogUnavailable(source);
  expect(unavailable.courses[0].sections[0]).toMatchObject({majorRestriction:"BLG_LS", programRestriction:{state:"unknown", reason:"source-unavailable", codes:["BLG_LS"]}});
  expect(source.courses[0].sections[0].programRestriction.state).toBe("allowlist");
  expect(unavailable.fetchedAt).toBe(source.fetchedAt);
  expect(unavailable.semester).toBe(source.semester);
});
