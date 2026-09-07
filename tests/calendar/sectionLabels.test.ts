import { describe, expect, it } from "vitest";

import { formatSectionLabel } from "@/lib/calendar/sectionLabels";

describe("CRN / Section labels", () => {
  it("uses Turkish by default and preserves English on request", () => {
    const section = {
      id: "test",
      crn: "12345",
      meetings: [
        {
          id: "meeting",
          day: "Monday" as const,
          startTime: "09:00",
          endTime: "10:00",
        },
      ],
    };
    expect(formatSectionLabel(section)).toBe(
      "12345 · Pzt 09:00–10:00 · Belirtilmedi",
    );
    expect(formatSectionLabel(section, "en")).toBe(
      "12345 · Mon 09:00–10:00 · TBA",
    );
  });
  it("shows the instructor name without an Instructor prefix", () => {
    expect(
      formatSectionLabel(
        {
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
        },
        "en",
      ),
    ).toBe("12345 · Mon 09:30–11:30 · Ada Lovelace");
  });

  it("shows TBA without an Instructor prefix when no name is available", () => {
    expect(
      formatSectionLabel(
        {
          id: "BLG:12345",
          crn: "12345",
          meetings: [],
        },
        "en",
      ),
    ).toBe("12345 · TBA");
  });
});
