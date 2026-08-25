import { describe, expect, it } from "vitest";

import { toCalendarCatalog } from "@/lib/itu/adapters/toCalendarCatalog";
import type { ItuCourseCatalog } from "@/lib/itu/types";

describe("toCalendarCatalog", () => {
  it("keeps one CRN choice with all of its meetings", () => {
    const source: ItuCourseCatalog = {
      branchId: 310,
      branchCode: "BLG",
      fetchedAt: "2026-08-25T10:00:00.000Z",
      courses: [
        {
          id: "BLG:BLG 102E",
          code: "BLG 102E",
          title: "Computer Programming",
          sections: [
            {
              id: "BLG:23713",
              crn: "23713",
              courseCode: "BLG 102E",
              courseTitle: "Computer Programming",
              instructor: "Ali Çakmak",
              meetings: [
                {
                  day: "Monday",
                  startTime: "13:00",
                  endTime: "14:59",
                  room: "123",
                },
                {
                  day: "Thursday",
                  startTime: "13:30",
                  endTime: "16:29",
                  room: "Z-16",
                },
              ],
            },
          ],
        },
      ],
    };

    const result = toCalendarCatalog(source);

    expect(result.courses[0].sections).toHaveLength(1);
    expect(result.courses[0].sections[0]).toMatchObject({
      crn: "23713",
      instructor: "Ali Çakmak",
    });
    expect(result.courses[0].sections[0].meetings).toHaveLength(2);
  });
});
