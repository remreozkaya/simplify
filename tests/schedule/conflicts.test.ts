import { describe, expect, it } from "vitest";

import {
  calculateConflictStats,
  hasMeetingConflicts,
  meetingConflictMinutes,
  meetingsOverlap,
  sectionConflicts,
} from "@/lib/schedule/conflicts";

const mondayMorning = {
  day: "Monday" as const,
  startTime: "09:30",
  endTime: "11:30",
};

describe("schedule conflicts", () => {
  it("detects overlapping meetings", () => {
    expect(
      meetingsOverlap(mondayMorning, {
        day: "Monday",
        startTime: "10:30",
        endTime: "12:30",
      }),
    ).toBe(true);
  });

  it("allows non-overlapping meetings", () => {
    expect(
      meetingsOverlap(mondayMorning, {
        day: "Monday",
        startTime: "13:30",
        endTime: "14:30",
      }),
    ).toBe(false);
  });

  it("allows meetings with touching boundaries", () => {
    expect(
      meetingsOverlap(mondayMorning, {
        day: "Monday",
        startTime: "11:30",
        endTime: "12:30",
      }),
    ).toBe(false);
  });

  it("allows the same time on different weekdays", () => {
    expect(
      meetingsOverlap(mondayMorning, {
        day: "Tuesday",
        startTime: "09:30",
        endTime: "11:30",
      }),
    ).toBe(false);
  });

  it("checks every meeting in a multi-meeting section", () => {
    expect(
      sectionConflicts(
        [
          mondayMorning,
          { day: "Thursday", startTime: "13:30", endTime: "15:30" },
        ],
        [
          { day: "Thursday", startTime: "15:00", endTime: "16:00" },
        ],
      ),
    ).toBe(true);
  });

  it("detects overlapping meetings inside one malformed section", () => {
    expect(
      sectionConflicts(
        [
          mondayMorning,
          { day: "Monday", startTime: "10:30", endTime: "12:30" },
        ],
        [],
      ),
    ).toBe(true);
  });

  it("finds a conflict anywhere in a complete meeting list", () => {
    expect(
      hasMeetingConflicts([
        mondayMorning,
        { day: "Tuesday", startTime: "09:30", endTime: "11:30" },
        { day: "Monday", startTime: "10:00", endTime: "10:30" },
      ]),
    ).toBe(true);
  });

  it("calculates overlap duration and aggregate conflict pairs", () => {
    expect(
      meetingConflictMinutes(mondayMorning, {
        day: "Monday",
        startTime: "10:30",
        endTime: "12:30",
      }),
    ).toBe(60);

    expect(
      calculateConflictStats([
        mondayMorning,
        { day: "Monday", startTime: "10:00", endTime: "10:30" },
        { day: "Monday", startTime: "11:00", endTime: "12:00" },
      ]),
    ).toEqual({ conflictCount: 2, totalConflictMinutes: 60 });
  });
});
