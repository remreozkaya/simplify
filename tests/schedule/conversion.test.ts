import { describe, expect, it } from "vitest";

import { generatedScheduleToWeeklyProgram } from "@/lib/schedule/conversion";
import type { GeneratedSchedule } from "@/lib/schedule/types";

describe("generated schedule conversion", () => {
  it("creates an editable WeeklyProgram and preserves multi-meeting sections", () => {
    const schedule: GeneratedSchedule = {
      id: "generated",
      score: 600,
      conflictCount: 0,
      totalConflictMinutes: 0,
      metrics: {
        campusDays: 2,
        totalGapMinutes: 0,
        earliestStartMinutes: 9 * 60 + 30,
        latestEndMinutes: 15 * 60 + 30,
      },
      selections: [
        {
          branchCode: "BLG",
          courseId: "BLG 335E",
          courseCode: "BLG 335E",
          sectionId: "BLG:23713",
          crn: "23713",
        },
      ],
      meetings: [
        {
          id: "meeting-1",
          branchCode: "BLG",
          courseId: "BLG 335E",
          courseCode: "BLG 335E",
          courseTitle: "Analysis of Algorithms I",
          sectionId: "BLG:23713",
          crn: "23713",
          instructor: "Ada Lovelace",
          day: "Monday",
          startTime: "09:30",
          endTime: "11:30",
          building: "MED",
          room: "A-101",
        },
        {
          id: "meeting-2",
          branchCode: "BLG",
          courseId: "BLG 335E",
          courseCode: "BLG 335E",
          courseTitle: "Analysis of Algorithms I",
          sectionId: "BLG:23713",
          crn: "23713",
          instructor: "Ada Lovelace",
          day: "Thursday",
          startTime: "13:30",
          endTime: "15:30",
          room: "B-202",
        },
      ],
    };

    const program = generatedScheduleToWeeklyProgram(schedule, {
      id: "program-1",
      name: "Generated Program 1",
      updatedAt: "2026-08-26T00:00:00.000Z",
    });

    expect(program).toMatchObject({
      id: "program-1",
      name: "Generated Program 1",
      updatedAt: "2026-08-26T00:00:00.000Z",
    });
    expect(program.courseSelections).toHaveLength(1);
    expect(program.courseSelections[0]).toMatchObject({
      facultyCode: "BLG",
      courseId: "BLG 335E",
      sectionId: "BLG:23713",
    });
    expect(program.courseSelections[0].courseBlockIds).toHaveLength(2);
    expect(program.courseBlocks).toHaveLength(2);
    expect(program.courseBlocks.map((block) => block.day)).toEqual([
      "Monday",
      "Thursday",
    ]);
    expect(program.courseBlocks[0]).toMatchObject({
      crn: "23713",
      instructor: "Ada Lovelace",
      building: "MED",
      room: "A-101",
    });
  });
});
