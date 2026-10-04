import { describe, expect, it } from "vitest";

import { parseStoredWeeklyPrograms } from "@/lib/calendar/persistence";

describe("parseStoredWeeklyPrograms", () => {
  it("retains course details through saving and rejects invalid counts", () => {
    const block = {
      id: "course-1", code: "BLG 102E", title: "Programming",
      day: "Monday", startTime: "13:00", endTime: "14:59",
      teachingMethod: "Face to face", capacity: 40, enrolled: 0,
    };
    const [program] = parseStoredWeeklyPrograms(JSON.parse(JSON.stringify([
      { id: "program-1", name: "Saved", courseBlocks: [block,
        { ...block, id: "invalid", capacity: -1, enrolled: "20" }], courseSelections: [] },
    ])));
    expect(program.courseBlocks[0]).toMatchObject({
      teachingMethod: "Face to face", capacity: 40, enrolled: 0,
    });
    expect(program.courseBlocks[1]).toMatchObject({ capacity: undefined, enrolled: undefined });
  });

  it("migrates the former single-session selection shape", () => {
    const programs = parseStoredWeeklyPrograms([
      {
        id: "program-1",
        name: "Saved program",
        updatedAt: "2026-08-25T10:00:00.000Z",
        courseBlocks: [],
        courseSelections: [
          {
            id: "selection-1",
            facultyCode: "BLG",
            courseId: "BLG:BLG 102E",
            sessionId: "BLG:23713",
            courseBlockId: "course-1",
          },
        ],
      },
    ]);

    expect(programs[0].courseSelections[0]).toMatchObject({
      sectionId: "BLG:23713",
      courseBlockIds: ["course-1"],
    });
  });

  it("filters malformed programs, selections, and blocks without throwing", () => {
    expect(
      parseStoredWeeklyPrograms([
        null,
        { name: "missing id" },
        {
          id: "valid",
          name: "Valid",
          courseBlocks: [{ id: "broken" }],
          courseSelections: [{ id: 12 }],
        },
      ]),
    ).toMatchObject([
      {
        id: "valid",
        courseBlocks: [],
        courseSelections: [],
      },
    ]);
  });
});
