import { describe, expect, it } from "vitest";
import {
  generateTimeLabels,
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
