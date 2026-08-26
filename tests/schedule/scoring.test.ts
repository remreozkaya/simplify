import { describe, expect, it } from "vitest";

import { rankSchedules, scoreSchedule } from "@/lib/schedule/scoring";
import type { GeneratedSchedule, ScheduleMetrics } from "@/lib/schedule/types";

function generated(
  crn: string,
  metrics: ScheduleMetrics,
): GeneratedSchedule {
  return {
    id: crn,
    selections: [
      {
        branchCode: "BLG",
        courseId: "BLG 101",
        courseCode: "BLG 101",
        sectionId: crn,
        crn,
      },
    ],
    meetings: [],
    conflictCount: 0,
    totalConflictMinutes: 0,
    metrics,
    score: scoreSchedule(metrics),
  };
}

describe("schedule scoring", () => {
  it("ranks a lower-gap schedule first", () => {
    const base = {
      campusDays: 2,
      earliestStartMinutes: 10 * 60,
      latestEndMinutes: 16 * 60,
    };
    const ranked = rankSchedules([
      generated("200", { ...base, totalGapMinutes: 120 }),
      generated("100", { ...base, totalGapMinutes: 30 }),
    ]);

    expect(ranked[0].selections[0].crn).toBe("100");
  });

  it("ranks fewer campus days first under default weights", () => {
    const ranked = rankSchedules([
      generated("200", {
        campusDays: 2,
        totalGapMinutes: 0,
        earliestStartMinutes: 10 * 60,
        latestEndMinutes: 16 * 60,
      }),
      generated("100", {
        campusDays: 1,
        totalGapMinutes: 100,
        earliestStartMinutes: 10 * 60,
        latestEndMinutes: 16 * 60,
      }),
    ]);

    expect(ranked[0].selections[0].crn).toBe("100");
  });

  it("uses stable numeric CRN ordering for complete ties", () => {
    const metrics = {
      campusDays: 1,
      totalGapMinutes: 0,
      earliestStartMinutes: 10 * 60,
      latestEndMinutes: 12 * 60,
    };
    const ranked = rankSchedules([
      generated("20", metrics),
      generated("3", metrics),
      generated("10", metrics),
    ]);

    expect(ranked.map((schedule) => schedule.selections[0].crn)).toEqual([
      "3",
      "10",
      "20",
    ]);
  });
});
