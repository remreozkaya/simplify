import { describe, expect, it } from "vitest";
import { buildWeeklyCalendar } from "@/lib/calendar/exportIcs";
import type { CourseBlock, WeeklyProgram } from "@/types/calendar";

const term = {
  term: "202710",
  start: "2026-09-28",
  end: "2026-12-31",
  breaks: [{ start: "2026-11-16", end: "2026-11-20" }],
};
const block: CourseBlock = {
  id: "mon", code: "FIZ 101", title: "Fizik, Ölçüm; Laboratuvarı", day: "Monday",
  startTime: "09:00", endTime: "10:00", building: "MED", room: "101", crn: "12345",
};
const plan: WeeklyProgram = { id: "plan", name: "Fall", courseSelections: [], courseBlocks: [block], updatedAt: "" };
const stamp = new Date("2026-01-01T00:00:00Z");

describe("weekly calendar export", () => {
  it("includes the teaching boundaries and skips the exact break dates", () => {
    const ics = buildWeeklyCalendar({
      ...plan,
      courseBlocks: [block, { ...block, id: "thu", day: "Thursday" }, { ...block, id: "sat", day: "Saturday" }, { ...block, id: "fri", day: "Friday" }],
    }, term, "en", stamp);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(ics).toContain("DTSTART;TZID=Europe/Istanbul:20260928T090000");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=20261231T060000Z");
    expect(ics).toContain("EXDATE;TZID=Europe/Istanbul:20261116T090000");
    expect(ics).toContain("EXDATE;TZID=Europe/Istanbul:20261120T090000");
    expect(ics).not.toContain("20261121T090000");
    expect(ics).toContain("SUMMARY:FIZ 101 Fizik\\, Ölçüm\\; Laboratuvarı");
    expect(ics).toContain("LOCATION:MED · 101");
  });

  it("keeps stable event IDs and folds UTF-8 lines without changing their contents", () => {
    const longTitle = "Ölçüm ".repeat(19);
    const first = buildWeeklyCalendar({ ...plan, courseBlocks: [{ ...block, title: longTitle }] }, term, "en", stamp);
    const second = buildWeeklyCalendar(plan, term, "tr", stamp);
    expect(first.match(/^UID:.+/m)?.[0]).toBe(second.match(/^UID:.+/m)?.[0]);
    expect(first.replace(/\r\n /g, "")).toContain(longTitle.trim());
    expect(first.split("\r\n").every(line => Buffer.byteLength(line) <= 75)).toBe(true);
  });

  it("rejects invalid meetings and schedules with no valid occurrences", () => {
    expect(() => buildWeeklyCalendar({ ...plan, courseBlocks: [{ ...block, endTime: "08:59" }] }, term, "en")).toThrow("invalidMeeting");
    expect(() => buildWeeklyCalendar(plan, { ...term, start: "2026-11-16", end: "2026-11-16" }, "en")).toThrow("noOccurrences");
  });
});
