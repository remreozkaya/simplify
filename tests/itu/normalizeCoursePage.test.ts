import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  normalizeCoursePage,
  normalizeMeetings,
  normalizeTimeRanges,
  normalizeWeekdays,
} from "@/lib/itu/normalizers/normalizeCoursePage";
import { parseCoursePage } from "@/lib/itu/parsers/parseCoursePage";
import type { ItuCourseTableRow } from "@/lib/itu/types";

const fixture = readFileSync(
  new URL("../fixtures/itu/course-page.html", import.meta.url),
  "utf8",
);

const baseRow: ItuCourseTableRow = {
  crn: "1",
  courseCode: "BLG 101",
  courseTitle: "Introduction",
};

describe("course schedule normalization", () => {
  it("normalizes Turkish and English weekday aliases", () => {
    expect(normalizeWeekdays("Monday Salı Çarşamba Thu Cuma Cmt Pazar")).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
  });

  it("normalizes valid time separators and rejects invalid ranges", () => {
    expect(normalizeTimeRanges("8.30 / 10:20 13:00–14:59")).toEqual([
      { startTime: "08:30", endTime: "10:20" },
      { startTime: "13:00", endTime: "14:59" },
    ]);
    expect(normalizeTimeRanges("25:00/26:00 -- 14:00/13:00")).toEqual([]);
  });

  it("does not invent meetings for empty, placeholder, or exam-style rows", () => {
    expect(normalizeMeetings({ ...baseRow, day: "-", time: "--" })).toEqual(
      [],
    );
    expect(normalizeMeetings({ ...baseRow, day: "Final Exam", time: "" })).toEqual(
      [],
    );
  });

  it("creates every meeting in a multi-meeting CRN with paired locations", () => {
    const catalog = normalizeCoursePage(
      parseCoursePage(fixture),
      310,
      "BLG",
      "2026-08-25T10:00:00.000Z",
    );
    const course = catalog.courses.find((item) => item.code === "BLG 102E");
    const section = course?.sections.find((item) => item.crn === "23713");

    expect(section?.meetings).toEqual([
      {
        day: "Monday",
        startTime: "13:00",
        endTime: "14:59",
        building: "MED",
        room: "123",
      },
      {
        day: "Thursday",
        startTime: "13:30",
        endTime: "16:29",
        building: "EEB",
        room: "Z-16",
      },
    ]);
  });

  it("merges separate OBS rows that belong to the same CRN", () => {
    const catalog = normalizeCoursePage(
      [
        {
          ...baseRow,
          crn: "500",
          day: "Monday",
          time: "10:00/11:00",
        },
        {
          ...baseRow,
          crn: "500",
          day: "Wednesday",
          time: "14:00/15:00",
        },
      ],
      310,
      "BLG",
    );

    expect(catalog.courses[0].sections).toHaveLength(1);
    expect(catalog.courses[0].sections[0].meetings).toHaveLength(2);
  });

  it("reuses a single time and location for multiple weekdays", () => {
    const catalog = normalizeCoursePage(parseCoursePage(fixture), 310, "BLG");
    const section = catalog.courses
      .find((item) => item.code === "BLG 335E")
      ?.sections[0];

    expect(section?.meetings).toHaveLength(2);
    expect(section?.meetings.map((meeting) => meeting.day)).toEqual([
      "Tuesday",
      "Friday",
    ]);
  });

  it("omits CRNs that have no usable recurring meeting", () => {
    const catalog = normalizeCoursePage(parseCoursePage(fixture), 310, "BLG");
    const crns = catalog.courses.flatMap((course) =>
      course.sections.map((section) => section.crn),
    );

    expect(crns).not.toContain("23800");
    expect(crns).not.toContain("23801");
    expect(crns).not.toContain("23900");
  });
});
