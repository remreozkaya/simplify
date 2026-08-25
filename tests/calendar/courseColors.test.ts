import { describe, expect, it } from "vitest";

import {
  COURSE_COLOR_STYLES,
  getCourseColorStyle,
} from "@/lib/calendar/courseColors";

describe("getCourseColorStyle", () => {
  it("gives adjacent course selections different colors", () => {
    const orderedIds = ["selection-a", "selection-b", "selection-c"];

    expect(getCourseColorStyle("selection-a", orderedIds)).toBe(
      COURSE_COLOR_STYLES[0],
    );
    expect(getCourseColorStyle("selection-b", orderedIds)).toBe(
      COURSE_COLOR_STYLES[1],
    );
  });

  it("keeps every meeting owned by one selection on the same color", () => {
    const orderedIds = ["selection-a", "selection-b"];

    expect(getCourseColorStyle("selection-b", orderedIds)).toBe(
      getCourseColorStyle("selection-b", orderedIds),
    );
  });
});
