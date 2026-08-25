import {
  days,
  type CourseBlock,
  type CourseSelection,
  type Day,
  type WeeklyProgram,
} from "@/types/calendar";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDay(value: unknown): value is Day {
  return typeof value === "string" && days.some((day) => day === value);
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseCourseBlock(value: unknown): CourseBlock | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.code !== "string" ||
    typeof value.title !== "string" ||
    !isDay(value.day) ||
    !isTime(value.startTime) ||
    !isTime(value.endTime)
  ) {
    return null;
  }

  return {
    id: value.id,
    selectionId: optionalString(value.selectionId),
    code: value.code,
    title: value.title,
    crn: optionalString(value.crn),
    day: value.day,
    startTime: value.startTime,
    endTime: value.endTime,
    building: optionalString(value.building),
    room: optionalString(value.room),
    instructor: optionalString(value.instructor),
  };
}

function parseCourseSelection(value: unknown): CourseSelection | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.facultyCode !== "string" ||
    typeof value.courseId !== "string"
  ) {
    return null;
  }

  const legacySectionId = optionalString(value.sessionId);
  const sectionId = optionalString(value.sectionId) ?? legacySectionId ?? "";
  const blockIds = Array.isArray(value.courseBlockIds)
    ? value.courseBlockIds.filter(
        (blockId): blockId is string => typeof blockId === "string",
      )
    : [];
  const legacyBlockId = optionalString(value.courseBlockId);

  return {
    id: value.id,
    facultyCode: value.facultyCode,
    courseId: value.courseId,
    sectionId,
    courseBlockIds:
      blockIds.length > 0
        ? blockIds
        : legacyBlockId
          ? [legacyBlockId]
          : [],
  };
}

export function parseStoredWeeklyPrograms(value: unknown): WeeklyProgram[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate) => {
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== "string" ||
      typeof candidate.name !== "string"
    ) {
      return [];
    }

    const rawBlocks = Array.isArray(candidate.courseBlocks)
      ? candidate.courseBlocks
      : [];
    const rawSelections = Array.isArray(candidate.courseSelections)
      ? candidate.courseSelections
      : [];

    return [
      {
        id: candidate.id,
        name: candidate.name,
        courseBlocks: rawBlocks.flatMap((block) => {
          const parsed = parseCourseBlock(block);
          return parsed ? [parsed] : [];
        }),
        courseSelections: rawSelections.flatMap((selection) => {
          const parsed = parseCourseSelection(selection);
          return parsed ? [parsed] : [];
        }),
        updatedAt:
          typeof candidate.updatedAt === "string"
            ? candidate.updatedAt
            : new Date().toISOString(),
      },
    ];
  });
}
