import { describe, expect, it } from "vitest";

import {
  calculateScheduleRating,
  rankSchedules,
  scoreSchedule,
} from "@/lib/schedule/scoring";
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

  it("converts lower internal scores into higher 1–5 ratings", () => {
    const best = generated("100", {
      campusDays: 3,
      totalGapMinutes: 0,
      earliestStartMinutes: 10 * 60,
      latestEndMinutes: 16 * 60,
    });
    const slightlyWorse = {
      ...generated("200", {
        campusDays: 3,
        totalGapMinutes: 72,
        earliestStartMinutes: 10 * 60,
        latestEndMinutes: 16 * 60,
      }),
      score: best.score * 1.12,
    };

    expect(calculateScheduleRating(best, best)).toBe(5);
    expect(calculateScheduleRating(slightlyWorse, best)).toBe(4.7);
  });

  it("reduces ratings for least-conflict fallback schedules", () => {
    const fallback = {
      ...generated("100", {
        campusDays: 3,
        totalGapMinutes: 0,
        earliestStartMinutes: 10 * 60,
        latestEndMinutes: 16 * 60,
      }),
      conflictCount: 1,
      totalConflictMinutes: 180,
    };

    expect(calculateScheduleRating(fallback, fallback)).toBe(4.5);
  });

  it("never returns a rating outside the 1–5 range", () => {
    const best = generated("100", {
      campusDays: 1,
      totalGapMinutes: 0,
      earliestStartMinutes: 10 * 60,
      latestEndMinutes: 11 * 60,
    });
    const veryPoor = {
      ...best,
      id: "poor",
      score: best.score * 100,
      conflictCount: 20,
      totalConflictMinutes: 2_000,
    };

    expect(calculateScheduleRating(veryPoor, best)).toBe(1);
  });
});
