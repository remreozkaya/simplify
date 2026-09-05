import { days, type Day } from "@/types/calendar";

export const GENERATOR_SESSION_STORAGE_KEY = "simplify-schedule-generator-session";

export type GeneratorSessionCourse = {
  id: string;
  branchCode: string;
  courseId: string;
  pinnedSectionId: string;
  courseCode?: string;
};

export type GeneratorSession = {
  version: 1 | 2;
  courses: GeneratorSessionCourse[];
  earliestStartTime: string;
  latestEndTime: string;
  excludedDays: Day[];
  source?: "semester-planner";
  targetSemester?: string;
  plannerLockedCourseCodes?: string[];
  plannerAlternatives?: string[];
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
    ...(typeof value.courseCode === "string" && value.courseCode
      ? { courseCode: value.courseCode }
      : {}),
  };
}

export function parseGeneratorSession(value: unknown): GeneratorSession | null {
  if (
    !isRecord(value) ||
    (value.version !== 1 && value.version !== 2) ||
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
    version: value.version,
    courses: courses as GeneratorSessionCourse[],
    earliestStartTime: value.earliestStartTime,
    latestEndTime: value.latestEndTime,
    excludedDays: [...new Set(value.excludedDays)],
    ...(value.source === "semester-planner" ? { source: value.source } : {}),
    ...(typeof value.targetSemester === "string" && value.targetSemester
      ? { targetSemester: value.targetSemester }
      : {}),
    ...(Array.isArray(value.plannerLockedCourseCodes) && value.plannerLockedCourseCodes.every((code) => typeof code === "string")
      ? { plannerLockedCourseCodes: value.plannerLockedCourseCodes }
      : {}),
    ...(Array.isArray(value.plannerAlternatives) && value.plannerAlternatives.every((code) => typeof code === "string")
      ? { plannerAlternatives: value.plannerAlternatives }
      : {}),
  };
}
