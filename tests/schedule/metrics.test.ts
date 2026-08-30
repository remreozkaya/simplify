import { describe, expect, it } from "vitest";

import {
  calculateScheduleMetrics,
  normalizeGapMinutes,
} from "@/lib/schedule/metrics";

describe("schedule metrics", () => {
  it("counts unique campus days and earliest/latest times", () => {
    expect(
      calculateScheduleMetrics([
        { day: "Monday", startTime: "10:30", endTime: "12:30" },
        { day: "Wednesday", startTime: "08:30", endTime: "09:30" },
        { day: "Wednesday", startTime: "17:30", endTime: "19:30" },
      ]),
    ).toMatchObject({
      campusDays: 2,
      earliestStartMinutes: 8 * 60 + 30,
      latestEndMinutes: 19 * 60 + 30,
    });
  });

  it("returns no gap for consecutive meetings", () => {
    expect(
      calculateScheduleMetrics([
        { day: "Monday", startTime: "09:30", endTime: "11:30" },
        { day: "Monday", startTime: "11:30", endTime: "12:30" },
      ]).totalGapMinutes,
    ).toBe(0);
  });

  it("calculates one gap", () => {
    expect(
      calculateScheduleMetrics([
        { day: "Monday", startTime: "09:30", endTime: "11:30" },
        { day: "Monday", startTime: "13:30", endTime: "15:30" },
      ]).totalGapMinutes,
    ).toBe(120);
  });

  it("rounds each gap down to a complete 30-minute interval", () => {
    expect(normalizeGapMinutes(1)).toBe(0);
    expect(normalizeGapMinutes(29)).toBe(0);
    expect(normalizeGapMinutes(30)).toBe(30);
    expect(normalizeGapMinutes(31)).toBe(30);
    expect(normalizeGapMinutes(59)).toBe(30);

    expect(
      calculateScheduleMetrics([
        { day: "Monday", startTime: "09:00", endTime: "10:00" },
        { day: "Monday", startTime: "10:31", endTime: "11:30" },
        { day: "Monday", startTime: "11:31", endTime: "12:30" },
      ]).totalGapMinutes,
    ).toBe(30);
  });

  it("sums multiple gaps on one day", () => {
    expect(
      calculateScheduleMetrics([
        { day: "Monday", startTime: "09:30", endTime: "10:30" },
        { day: "Monday", startTime: "11:30", endTime: "12:30" },
        { day: "Monday", startTime: "14:00", endTime: "15:00" },
      ]).totalGapMinutes,
    ).toBe(150);
  });

  it("sums gaps independently across days", () => {
    expect(
      calculateScheduleMetrics([
        { day: "Monday", startTime: "09:00", endTime: "10:00" },
        { day: "Monday", startTime: "11:00", endTime: "12:00" },
        { day: "Tuesday", startTime: "13:00", endTime: "14:00" },
        { day: "Tuesday", startTime: "15:30", endTime: "16:30" },
      ]).totalGapMinutes,
    ).toBe(150);
  });

  it("returns zeroed metrics for an empty schedule", () => {
    expect(calculateScheduleMetrics([])).toEqual({
      campusDays: 0,
      totalGapMinutes: 0,
      earliestStartMinutes: 0,
      latestEndMinutes: 0,
    });
  });
});
