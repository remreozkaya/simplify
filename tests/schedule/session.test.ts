import { describe, expect, it } from "vitest";

import { parseGeneratorSession } from "@/lib/schedule/session";

describe("generator session persistence", () => {
  it("restores selected courses, pinned CRNs, and preferences", () => {
    expect(
      parseGeneratorSession({
        version: 1,
        courses: [
          {
            id: "desired-1",
            branchCode: "BLG",
            courseId: "BLG 212E",
            pinnedSectionId: "BLG:12486",
          },
        ],
        earliestStartTime: "10:30",
        latestEndTime: "17:30",
        excludedDays: ["Friday", "Friday"],
      }),
    ).toEqual({
      version: 1,
      courses: [
        {
          id: "desired-1",
          branchCode: "BLG",
          courseId: "BLG 212E",
          pinnedSectionId: "BLG:12486",
        },
      ],
      earliestStartTime: "10:30",
      latestEndTime: "17:30",
      excludedDays: ["Friday"],
    });
  });

  it("rejects malformed sessions", () => {
    expect(parseGeneratorSession(null)).toBeNull();
    expect(
      parseGeneratorSession({
        version: 1,
        courses: [],
        earliestStartTime: "25:00",
        latestEndTime: "",
        excludedDays: [],
      }),
    ).toBeNull();
    expect(
      parseGeneratorSession({
        version: 1,
        courses: [],
        earliestStartTime: "",
        latestEndTime: "",
        excludedDays: ["Funday"],
      }),
    ).toBeNull();
  });
});
