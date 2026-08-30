import { days, type Day } from "@/types/calendar";

export const GENERATOR_SESSION_STORAGE_KEY = "simplify-schedule-generator-session";

export type GeneratorSessionCourse = {
  id: string;
  branchCode: string;
  courseId: string;
  pinnedSectionId: string;
};

export type GeneratorSession = {
  version: 1;
  courses: GeneratorSessionCourse[];
  earliestStartTime: string;
  latestEndTime: string;
  excludedDays: Day[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTimeOrEmpty(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value === "" || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))
  );
}

function isDay(value: unknown): value is Day {
  return typeof value === "string" && days.some((day) => day === value);
}

function parseCourse(value: unknown): GeneratorSessionCourse | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    typeof value.branchCode !== "string" ||
    typeof value.courseId !== "string" ||
    typeof value.pinnedSectionId !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    branchCode: value.branchCode,
    courseId: value.courseId,
    pinnedSectionId: value.pinnedSectionId,
  };
}

export function parseGeneratorSession(value: unknown): GeneratorSession | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.courses) ||
    !isTimeOrEmpty(value.earliestStartTime) ||
    !isTimeOrEmpty(value.latestEndTime) ||
    !Array.isArray(value.excludedDays) ||
    !value.excludedDays.every(isDay)
  ) {
    return null;
  }

  const courses = value.courses.map(parseCourse);

  if (courses.some((course) => course === null)) {
    return null;
  }

  return {
    version: 1,
    courses: courses as GeneratorSessionCourse[],
    earliestStartTime: value.earliestStartTime,
    latestEndTime: value.latestEndTime,
    excludedDays: [...new Set(value.excludedDays)],
  };
}
