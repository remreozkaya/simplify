import { describe, expect, it } from "vitest";

import { formatSectionLabel } from "@/lib/calendar/sectionLabels";

describe("CRN / Section labels", () => {
  it("shows the instructor name without an Instructor prefix", () => {
    expect(
      formatSectionLabel({
        id: "BLG:12345",
        crn: "12345",
        instructor: "Ada Lovelace",
        meetings: [
          {
            id: "meeting-1",
            day: "Monday",
            startTime: "09:30",
            endTime: "11:30",
          },
        ],
      }),
    ).toBe("12345 · Mon 09:30–11:30 · Ada Lovelace");
  });

  it("shows TBA without an Instructor prefix when no name is available", () => {
    expect(
      formatSectionLabel({
        id: "BLG:12345",
        crn: "12345",
        meetings: [],
      }),
    ).toBe("12345 · TBA");
  });
});
