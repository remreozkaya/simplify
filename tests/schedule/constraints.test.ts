import { describe, expect, it } from "vitest";

import { satisfiesConstraints } from "@/lib/schedule/constraints";

const meetings = [
  { day: "Monday" as const, startTime: "10:30", endTime: "12:30" },
  { day: "Friday" as const, startTime: "14:30", endTime: "16:30" },
];

describe("schedule constraints", () => {
  it("accepts meetings exactly at the earliest boundary", () => {
    expect(
      satisfiesConstraints(meetings, {
        earliestStartTime: "10:30",
        excludedDays: [],
      }),
    ).toBe(true);
  });

  it("rejects a meeting before the earliest start", () => {
    expect(
      satisfiesConstraints(meetings, {
        earliestStartTime: "11:00",
        excludedDays: [],
      }),
    ).toBe(false);
  });

  it("accepts meetings exactly at the latest boundary", () => {
    expect(
      satisfiesConstraints(meetings, {
        latestEndTime: "16:30",
        excludedDays: [],
      }),
    ).toBe(true);
  });

  it("rejects a meeting after the latest end", () => {
    expect(
      satisfiesConstraints(meetings, {
        latestEndTime: "16:00",
        excludedDays: [],
      }),
    ).toBe(false);
  });

  it("rejects an excluded weekday", () => {
    expect(
      satisfiesConstraints(meetings, { excludedDays: ["Friday"] }),
    ).toBe(false);
  });

  it("combines earliest, latest, and free-day constraints", () => {
    expect(
      satisfiesConstraints(meetings, {
        earliestStartTime: "10:00",
        latestEndTime: "17:00",
        excludedDays: ["Tuesday"],
      }),
    ).toBe(true);
  });
});
