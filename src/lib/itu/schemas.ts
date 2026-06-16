import { z } from "zod";

import type {
  ItuBranch,
  ItuCourse,
  ItuCourseCatalog,
  ItuCourseMeeting,
  ItuCourseSection,
  ItuCoursesQuery,
  ItuCourseTableRow,
  ParsedHtmlTable,
} from "@/lib/itu/types";

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const BRANCH_CODE_PATTERN = /^[A-Z0-9ÇĞİÖŞÜ]{2,12}$/u;
const COURSE_CODE_PATTERN =
  /^[A-Z0-9ÇĞİÖŞÜ][A-Z0-9ÇĞİÖŞÜ ._-]{1,29}$/u;
const CRN_PATTERN = /^\d{1,10}$/;

function normalizeOptionalText(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return value;
  }

  const normalizedValue = value.replace(/\s+/g, " ").trim();

  return normalizedValue.length > 0
    ? normalizedValue
    : undefined;
}

function normalizeBranchCode(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .replace(/\s+/g, "")
    .trim()
    .toLocaleUpperCase("tr-TR");
}

function normalizeCourseCode(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("tr-TR");
}

function normalizeCrn(value: unknown): unknown {
  if (typeof value === "number" && Number.isInteger(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value;
}

function normalizeOptionalInteger(value: unknown): unknown {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return undefined;
  }

  if (typeof value === "string") {
    const normalizedValue = value.trim();

    if (
      normalizedValue === "" ||
      normalizedValue === "-" ||
      normalizedValue === "--"
    ) {
      return undefined;
    }

    return normalizedValue;
  }

  return value;
}

function timeToMinutes(time: string): number {
  const [hour, minute] = time
    .split(":")
    .map(Number);

  return hour * 60 + minute;
}

export const nonEmptyTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(500);

export const optionalTextSchema = z.preprocess(
  normalizeOptionalText,
  nonEmptyTextSchema.optional(),
);

export const branchCodeSchema = z.preprocess(
  normalizeBranchCode,
  z
    .string()
    .min(2)
    .max(12)
    .regex(
      BRANCH_CODE_PATTERN,
      "Branch code contains invalid characters.",
    ),
);

export const courseCodeSchema = z.preprocess(
  normalizeCourseCode,
  z
    .string()
    .min(2)
    .max(30)
    .regex(
      COURSE_CODE_PATTERN,
      "Course code contains invalid characters.",
    ),
);

export const crnSchema = z.preprocess(
  normalizeCrn,
  z
    .string()
    .regex(
      CRN_PATTERN,
      "CRN must contain only digits.",
    ),
);

export const timeSchema = z
  .string()
  .trim()
  .regex(
    TIME_PATTERN,
    "Time must use the 24-hour HH:MM format.",
  );

export const optionalNonNegativeIntegerSchema =
  z.preprocess(
    normalizeOptionalInteger,
    z
      .coerce
      .number()
      .int()
      .nonnegative()
      .optional(),
  );

export const ituWeekdaySchema = z.enum([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);

export const ituBranchSchema: z.ZodType<ItuBranch> =
  z.object({
    id: z.coerce.number().int().positive(),
    code: branchCodeSchema,
    name: optionalTextSchema,
  });

export const parsedHtmlTableSchema: z.ZodType<ParsedHtmlTable> =
  z.object({
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  });

export const ituCourseTableRowSchema: z.ZodType<ItuCourseTableRow> =
  z.object({
    crn: crnSchema,
    courseCode: courseCodeSchema,
    courseTitle: nonEmptyTextSchema,
    teachingMethod: optionalTextSchema,
    instructor: optionalTextSchema,
    building: optionalTextSchema,
    day: optionalTextSchema,
    time: optionalTextSchema,
    room: optionalTextSchema,
    capacity: optionalTextSchema,
    enrolled: optionalTextSchema,
    reserved: optionalTextSchema,
    majorRestriction: optionalTextSchema,
    classRestriction: optionalTextSchema,
    prerequisites: optionalTextSchema,
  });

export const ituCourseMeetingSchema: z.ZodType<ItuCourseMeeting> =
  z
    .object({
      day: ituWeekdaySchema,
      startTime: timeSchema,
      endTime: timeSchema,
      building: optionalTextSchema,
      room: optionalTextSchema,
    })
    .superRefine((meeting, context) => {
      const startMinutes = timeToMinutes(
        meeting.startTime,
      );
      const endMinutes = timeToMinutes(
        meeting.endTime,
      );

      if (endMinutes <= startMinutes) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endTime"],
          message:
            "Meeting end time must be later than its start time.",
        });
      }
    });

export const ituCourseSectionSchema: z.ZodType<ItuCourseSection> =
  z.object({
    id: z.string().trim().min(1).max(150),
    crn: crnSchema,
    courseCode: courseCodeSchema,
    courseTitle: nonEmptyTextSchema,
    teachingMethod: optionalTextSchema,
    instructor: optionalTextSchema,
    meetings: z
      .array(ituCourseMeetingSchema)
      .min(
        1,
        "A course section must contain at least one meeting.",
      ),
    capacity: optionalNonNegativeIntegerSchema,
    enrolled: optionalNonNegativeIntegerSchema,
    reserved: optionalNonNegativeIntegerSchema,
    majorRestriction: optionalTextSchema,
    classRestriction: optionalTextSchema,
    prerequisites: optionalTextSchema,
  });

export const ituCourseSchema: z.ZodType<ItuCourse> =
  z
    .object({
      id: z.string().trim().min(1).max(150),
      code: courseCodeSchema,
      title: nonEmptyTextSchema,
      sections: z
        .array(ituCourseSectionSchema)
        .min(
          1,
          "A course must contain at least one section.",
        ),
    })
    .superRefine((course, context) => {
      course.sections.forEach((section, index) => {
        if (section.courseCode !== course.code) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [
              "sections",
              index,
              "courseCode",
            ],
            message:
              "Section course code must match the parent course code.",
          });
        }

        if (section.courseTitle !== course.title) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [
              "sections",
              index,
              "courseTitle",
            ],
            message:
              "Section title must match the parent course title.",
          });
        }
      });
    });

export const ituCourseCatalogSchema: z.ZodType<ItuCourseCatalog> =
  z.object({
    branchId: z.coerce.number().int().positive(),
    branchCode: branchCodeSchema,
    courses: z.array(ituCourseSchema),
    fetchedAt: z.iso.datetime({ offset: true }),
  });

export const ituCoursesQuerySchema: z.ZodType<ItuCoursesQuery> =
  z.object({
    branchId: z.coerce.number().int().positive(),
    branchCode: branchCodeSchema,
  });

export const ituBranchesApiResponseSchema =
  z.object({
    branches: z.array(ituBranchSchema),
  });
