import { describe, expect, it } from "vitest";
import {
  generateTimeLabels,
  calculateCalendarRange,
  getCourseHeight,
  getCourseLayoutMap,
  getTimeTop,
  reorderCourseBlocksBySelections,
} from "@/lib/calendar/layout";
import type { CourseBlock, CourseSelection } from "@/types/calendar";

const block = (
  id: string,
  startTime: string,
  endTime: string,
  day: CourseBlock["day"] = "Monday",
): CourseBlock => ({ id, code: id, title: id, day, startTime, endTime });

describe("calendar placement", () => {
  it("keeps minute precision independently of half-hour grid lines", () => {
    expect(generateTimeLabels()).toHaveLength(25);
    expect(generateTimeLabels().at(-1)).toBe("20:00");
    expect(getTimeTop("08:15")).toBe(13);
    expect(getCourseHeight("14:30", "16:29")).toBeCloseTo((119 * 26) / 30);
    expect(getCourseHeight("10:00", "09:00")).toBe(0);
  });

  it("expands the displayed grid to contain early and late meetings", () => {
    const courses = [block("early", "07:15", "08:15"), block("late", "21:30", "22:20")];
    const range = calculateCalendarRange(courses);
    expect(range).toEqual({ startMinutes: 7 * 60, endMinutes: 22 * 60 + 30 });
    expect(generateTimeLabels(range.startMinutes, range.endMinutes)[0]).toBe("07:00");
    expect(generateTimeLabels(range.startMinutes, range.endMinutes).at(-1)).toBe("22:30");
    for (const course of courses) {
      const top = getTimeTop(course.startTime, range.startMinutes);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top + getCourseHeight(course.startTime, course.endTime)).toBeLessThanOrEqual((range.endMinutes - range.startMinutes) * 26 / 30);
    }
    expect(calculateCalendarRange([])).toEqual({ startMinutes: 480, endMinutes: 1200 });
  });

  it("contains a last-minute meeting whose grid rounds to midnight", () => {
    const range = calculateCalendarRange([block("late", "23:30", "23:59")]);
    expect(range.endMinutes).toBe(1440);
    expect(generateTimeLabels(range.startMinutes, range.endMinutes).at(-1)).toBe("24:00");
    expect(getTimeTop("24:00", range.startMinutes)).toBe((1440 - range.startMinutes) * 26 / 30);
  });

  it("places transitive overlaps side by side and reuses a column when meetings touch", () => {
    const layout = getCourseLayoutMap([
      block("a", "09:00", "10:00"),
      block("b", "09:30", "10:30"),
      block("c", "10:00", "11:00"),
      block("d", "09:00", "10:00", "Tuesday"),
    ]);
    expect(layout.a.widthPercent).toBeCloseTo(100 / 14);
    expect(layout.b.leftPercent).toBeCloseTo(100 / 14);
    expect(layout.c.leftPercent).toBe(layout.a.leftPercent);
    expect(layout.d).toEqual({ leftPercent: 100 / 7, widthPercent: 100 / 7 });
  });

  it("keeps unassociated legacy blocks when a course row is reordered", () => {
    const blocks = [
      block("a", "09:00", "10:00"),
      block("b", "10:00", "11:00"),
      block("legacy", "12:00", "13:00"),
    ];
    const selections: CourseSelection[] = ["b", "a"].map((id) => ({
      id,
      facultyCode: "BLG",
      courseId: id,
      sectionId: id,
      courseBlockIds: [id],
    }));
    expect(
      reorderCourseBlocksBySelections(blocks, selections).map(({ id }) => id),
    ).toEqual(["b", "a", "legacy"]);
    expect(blocks.map(({ id }) => id)).toEqual(["a", "b", "legacy"]);
  });
});
