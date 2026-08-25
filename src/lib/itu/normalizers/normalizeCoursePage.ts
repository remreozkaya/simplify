import {
  ITU_EMPTY_CELL_VALUES,
  ITU_WEEKDAY_ALIASES,
} from "@/lib/itu/constants";
import {
  ituCourseCatalogSchema,
  ituCourseMeetingSchema,
} from "@/lib/itu/schemas";
import type {
  ItuCourse,
  ItuCourseCatalog,
  ItuCourseMeeting,
  ItuCourseSection,
  ItuCourseTableRow,
  ItuWeekday,
} from "@/lib/itu/types";

const TIME_RANGE_PATTERN =
  /(?:^|\s)([0-2]?\d)[.:]([0-5]\d)\s*(?:\/|[-–—])\s*([0-2]?\d)[.:]([0-5]\d)(?=\s|$)/g;

function cleanOptionalText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  return ITU_EMPTY_CELL_VALUES.has(normalized)
    ? undefined
    : normalized;
}

function parseOptionalInteger(value: string | undefined): number | undefined {
  const normalized = cleanOptionalText(value);

  if (!normalized || !/^\d+$/.test(normalized)) {
    return undefined;
  }

  return Number(normalized);
}

export function normalizeWeekdays(value: string | undefined): ItuWeekday[] {
  if (!cleanOptionalText(value)) {
    return [];
  }

  const days: ItuWeekday[] = [];
  const tokens = value!
    .toLocaleLowerCase("tr-TR")
    .replace(/[.,()[\]]/g, " ")
    .split(/[\s/;|,-]+/)
    .filter(Boolean);

  for (const token of tokens) {
    const day = ITU_WEEKDAY_ALIASES[token];

    if (day) {
      days.push(day);
    }
  }

  return days;
}

export function normalizeTimeRanges(
  value: string | undefined,
): Array<{ startTime: string; endTime: string }> {
  if (!cleanOptionalText(value)) {
    return [];
  }

  const ranges: Array<{ startTime: string; endTime: string }> = [];

  for (const match of value!.matchAll(TIME_RANGE_PATTERN)) {
    const startTime = `${match[1].padStart(2, "0")}:${match[2]}`;
    const endTime = `${match[3].padStart(2, "0")}:${match[4]}`;
    const result = ituCourseMeetingSchema.safeParse({
      day: "Monday",
      startTime,
      endTime,
    });

    if (result.success) {
      ranges.push({ startTime, endTime });
    }
  }

  return ranges;
}

function splitLocationValues(
  value: string | undefined,
  meetingCount: number,
): Array<string | undefined> {
  const normalized = cleanOptionalText(value);

  if (!normalized) {
    return Array.from({ length: meetingCount }, () => undefined);
  }

  const lineValues = value!
    .split(/\r?\n|[;,|]+/)
    .map(cleanOptionalText)
    .filter((item): item is string => Boolean(item));

  if (lineValues.length === meetingCount) {
    return lineValues;
  }

  const wordValues = normalized.split(/\s+/);

  if (wordValues.length === meetingCount) {
    return wordValues;
  }

  return Array.from({ length: meetingCount }, () => normalized);
}

function pairScheduleValues<T>(values: T[], count: number): Array<T | undefined> {
  if (values.length === 1 && count > 1) {
    return Array.from({ length: count }, () => values[0]);
  }

  return Array.from({ length: count }, (_, index) => values[index]);
}

export function normalizeMeetings(row: ItuCourseTableRow): ItuCourseMeeting[] {
  const days = normalizeWeekdays(row.day);
  const times = normalizeTimeRanges(row.time);

  if (days.length === 0 || times.length === 0) {
    return [];
  }

  const meetingCount =
    days.length === 1
      ? times.length
      : times.length === 1
        ? days.length
        : Math.min(days.length, times.length);

  const pairedDays = pairScheduleValues(days, meetingCount);
  const pairedTimes = pairScheduleValues(times, meetingCount);
  const buildings = splitLocationValues(row.building, meetingCount);
  const rooms = splitLocationValues(row.room, meetingCount);
  const meetings: ItuCourseMeeting[] = [];

  for (let index = 0; index < meetingCount; index += 1) {
    const day = pairedDays[index];
    const time = pairedTimes[index];

    if (!day || !time) {
      continue;
    }

    const result = ituCourseMeetingSchema.safeParse({
      day,
      startTime: time.startTime,
      endTime: time.endTime,
      building: buildings[index],
      room: rooms[index],
    });

    if (result.success) {
      meetings.push(result.data);
    }
  }

  return meetings;
}

function mergeMeetings(
  current: ItuCourseMeeting[],
  incoming: ItuCourseMeeting[],
): ItuCourseMeeting[] {
  const meetings = new Map<string, ItuCourseMeeting>();

  for (const meeting of [...current, ...incoming]) {
    const key = [
      meeting.day,
      meeting.startTime,
      meeting.endTime,
      meeting.building ?? "",
      meeting.room ?? "",
    ].join("|");

    meetings.set(key, meeting);
  }

  return [...meetings.values()];
}

function createSection(
  row: ItuCourseTableRow,
  branchCode: string,
  meetings: ItuCourseMeeting[],
): ItuCourseSection {
  return {
    id: `${branchCode}:${row.crn}`,
    crn: row.crn,
    courseCode: row.courseCode,
    courseTitle: row.courseTitle,
    teachingMethod: cleanOptionalText(row.teachingMethod),
    instructor: cleanOptionalText(row.instructor),
    meetings,
    capacity: parseOptionalInteger(row.capacity),
    enrolled: parseOptionalInteger(row.enrolled),
    reserved: parseOptionalInteger(row.reserved),
    majorRestriction: cleanOptionalText(row.majorRestriction),
    classRestriction: cleanOptionalText(row.classRestriction),
    prerequisites: cleanOptionalText(row.prerequisites),
  };
}

export function normalizeCoursePage(
  rows: ItuCourseTableRow[],
  branchId: number,
  branchCode: string,
  fetchedAt = new Date().toISOString(),
): ItuCourseCatalog {
  const sections = new Map<string, ItuCourseSection>();

  for (const row of rows) {
    const meetings = normalizeMeetings(row);

    // The weekly planner catalog intentionally excludes unscheduled and exam
    // rows. They cannot produce a truthful recurring calendar block.
    if (meetings.length === 0) {
      continue;
    }

    const existing = sections.get(row.crn);

    if (existing) {
      existing.meetings = mergeMeetings(existing.meetings, meetings);
      continue;
    }

    sections.set(row.crn, createSection(row, branchCode, meetings));
  }

  const courseMap = new Map<string, ItuCourse>();

  for (const section of sections.values()) {
    const key = `${section.courseCode}|${section.courseTitle}`;
    const course = courseMap.get(key);

    if (course) {
      course.sections.push(section);
    } else {
      courseMap.set(key, {
        id: `${branchCode}:${section.courseCode}`,
        code: section.courseCode,
        title: section.courseTitle,
        sections: [section],
      });
    }
  }

  const courses = [...courseMap.values()]
    .map((course) => ({
      ...course,
      sections: course.sections.sort((first, second) =>
        first.crn.localeCompare(second.crn, undefined, { numeric: true }),
      ),
    }))
    .sort((first, second) =>
      first.code.localeCompare(second.code, undefined, { numeric: true }),
    );

  return ituCourseCatalogSchema.parse({
    branchId,
    branchCode,
    courses,
    fetchedAt,
  });
}
