import { describe, expect, it } from "vitest";

import {
  calculateCombinationCount,
  generateConflictFreeSchedules,
  generateSchedules,
} from "@/lib/schedule/generator";
import type { GeneratorCourse } from "@/lib/schedule/types";
import type { CourseSectionOption, Day } from "@/types/calendar";

function section(
  crn: string,
  meetings: Array<[Day, string, string]>,
): CourseSectionOption {
  return {
    id: `BLG:${crn}`,
    crn,
    instructor: `Instructor ${crn}`,
    meetings: meetings.map(([day, startTime, endTime], index) => ({
      id: `${crn}:${index}`,
      day,
      startTime,
      endTime,
      room: `Room ${index + 1}`,
    })),
  };
}

function course(
  code: string,
  sections: CourseSectionOption[],
): GeneratorCourse {
  return {
    branchCode: code.split(" ")[0],
    courseId: code,
    courseCode: code,
    courseTitle: `${code} title`,
    sections,
  };
}

describe("schedule generator", () => {
  it("returns every CRN for one course", () => {
    const result = generateConflictFreeSchedules([
      course("BLG 101", [
        section("100", [["Monday", "09:30", "10:30"]]),
        section("101", [["Tuesday", "09:30", "10:30"]]),
      ]),
    ]);

    expect(result.schedules).toHaveLength(2);
    expect(result.schedules.map((schedule) => schedule.selections[0].crn)).toEqual([
      "100",
      "101",
    ]);
  });

  it("returns all combinations for multiple non-conflicting courses", () => {
    const result = generateConflictFreeSchedules([
      course("BLG 101", [
        section("100", [["Monday", "09:30", "10:30"]]),
        section("101", [["Tuesday", "09:30", "10:30"]]),
      ]),
      course("MAT 101", [
        section("200", [["Wednesday", "09:30", "10:30"]]),
        section("201", [["Thursday", "09:30", "10:30"]]),
      ]),
    ]);

    expect(result.schedules).toHaveLength(4);
  });

  it("prunes conflicting CRN combinations", () => {
    const result = generateConflictFreeSchedules([
      course("BLG 101", [
        section("100", [["Monday", "09:30", "11:30"]]),
      ]),
      course("MAT 101", [
        section("200", [["Monday", "10:30", "12:30"]]),
        section("201", [["Tuesday", "10:30", "12:30"]]),
      ]),
    ]);

    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0].selections.map((item) => item.crn)).toEqual([
      "100",
      "201",
    ]);
  });

  it("considers all meetings of a multi-meeting CRN", () => {
    const result = generateConflictFreeSchedules([
      course("BLG 101", [
        section("100", [
          ["Monday", "09:30", "10:30"],
          ["Thursday", "13:30", "15:30"],
        ]),
      ]),
      course("MAT 101", [
        section("200", [["Thursday", "14:30", "16:30"]]),
      ]),
    ]);

    expect(result.schedules).toHaveLength(0);
  });

  it("returns zero schedules when every combination conflicts", () => {
    const result = generateConflictFreeSchedules([
      course("BLG 101", [
        section("100", [["Monday", "09:30", "11:30"]]),
      ]),
      course("MAT 101", [
        section("200", [["Monday", "10:30", "12:30"]]),
      ]),
    ]);

    expect(result.schedules).toEqual([]);
  });

  it("applies hard constraints before searching", () => {
    const result = generateConflictFreeSchedules(
      [
        course("BLG 101", [
          section("100", [["Friday", "10:30", "12:30"]]),
          section("101", [["Monday", "08:30", "10:30"]]),
          section("102", [["Tuesday", "11:30", "13:30"]]),
        ]),
      ],
      {
        constraints: {
          earliestStartTime: "10:30",
          latestEndTime: "17:30",
          excludedDays: ["Friday"],
        },
      },
    );

    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0].selections[0].crn).toBe("102");
  });

  it("stops safely after the configured result count", () => {
    const result = generateConflictFreeSchedules(
      [
        course("BLG 101", [
          section("100", [["Monday", "09:30", "10:30"]]),
          section("101", [["Tuesday", "09:30", "10:30"]]),
          section("102", [["Wednesday", "09:30", "10:30"]]),
        ]),
      ],
      { maxResults: 2 },
    );

    expect(result.schedules).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it("calculates the naive search-space size", () => {
    expect(
      calculateCombinationCount([
        course("BLG 101", [section("1", [["Monday", "09:00", "10:00"]])]),
        course("MAT 101", [
          section("2", [["Tuesday", "09:00", "10:00"]]),
          section("3", [["Wednesday", "09:00", "10:00"]]),
        ]),
      ]),
    ).toBe(2);
  });

  it("falls back to the schedule with the fewest conflict pairs", () => {
    const result = generateSchedules([
      course("BLG 101", [
        section("100", [["Monday", "09:00", "12:00"]]),
      ]),
      course("MAT 101", [
        section("200", [["Monday", "09:30", "10:30"]]),
      ]),
      course("FIZ 101", [
        section("300", [["Monday", "10:00", "11:00"]]),
        section("301", [["Monday", "11:00", "13:00"]]),
      ]),
    ]);

    expect(result.usedConflictFallback).toBe(true);
    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0].conflictCount).toBe(2);
    expect(result.schedules[0].selections.map((item) => item.crn)).toEqual([
      "100",
      "200",
      "301",
    ]);
  });

  it("uses fewer overlap minutes to break equal conflict-count ties", () => {
    const result = generateSchedules([
      course("BLG 101", [
        section("100", [["Monday", "09:00", "11:00"]]),
      ]),
      course("MAT 101", [
        section("200", [["Monday", "10:00", "12:00"]]),
        section("201", [["Monday", "10:30", "12:30"]]),
      ]),
    ]);

    expect(result.usedConflictFallback).toBe(true);
    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0]).toMatchObject({
      conflictCount: 1,
      totalConflictMinutes: 30,
    });
    expect(result.schedules[0].selections[1].crn).toBe("201");
  });

  it("does not use conflict fallback when valid schedules exist", () => {
    const result = generateSchedules([
      course("BLG 101", [
        section("100", [["Monday", "09:00", "10:00"]]),
      ]),
      course("MAT 101", [
        section("200", [["Tuesday", "09:00", "10:00"]]),
      ]),
    ]);

    expect(result.usedConflictFallback).toBe(false);
    expect(result.schedules[0].conflictCount).toBe(0);
  });

  it("keeps hard constraints mandatory during fallback search", () => {
    const result = generateSchedules(
      [
        course("BLG 101", [
          section("100", [["Friday", "09:00", "10:00"]]),
        ]),
      ],
      { constraints: { excludedDays: ["Friday"] } },
    );

    expect(result.schedules).toEqual([]);
  });
});
