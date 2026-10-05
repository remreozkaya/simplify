import { z } from "zod";
import { ITU_CACHE_REVALIDATE_SECONDS } from "@/lib/itu/constants";
import type { FacultyOption } from "@/types/calendar";

const text = z.string().min(1);
const restriction = z.object({
  raw: z.string().optional(),
  state: z.enum(["unrestricted", "allowlist", "unknown"]),
  codes: z.array(text),
  reason: z.string().optional(),
});
const catalogSchema = z.object({
  facultyCode: text,
  semester: text,
  fetchedAt: z.iso.datetime({ offset: true }),
  courses: z.array(z.object({
    id: text, code: text, title: text,
    sections: z.array(z.object({
      id: text, crn: text,
      instructor: z.string().optional(), teachingMethod: z.string().optional(),
      capacity: z.number().int().nonnegative().optional(), enrolled: z.number().int().nonnegative().optional(),
      majorRestriction: z.string().optional(), programRestriction: restriction.optional(), semester: text.optional(),
      meetings: z.array(z.object({
        id: text,
        day: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]),
        startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
        endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
        building: z.string().optional(), room: z.string().optional(),
      })).min(1),
    })).min(1),
  })),
});

export function parseCalendarCatalog(value: unknown, branchCode: string): FacultyOption {
  const parsed = z.object({catalog: catalogSchema}).safeParse(value);
  if (!parsed.success || parsed.data.catalog.facultyCode !== branchCode ||
      parsed.data.catalog.courses.some(course => course.sections.some(section => section.semester !== parsed.data.catalog.semester))) {
    throw new Error(`The ${branchCode} catalog response is invalid.`);
  }
  return parsed.data.catalog;
}

export function isCatalogFresh(catalog: FacultyOption | undefined, now = Date.now()): boolean {
  if (!catalog?.semester || !catalog.fetchedAt) return false;
  const age = now - Date.parse(catalog.fetchedAt);
  return Number.isFinite(age) && age >= 0 && age < ITU_CACHE_REVALIDATE_SECONDS * 1000;
}

export function mergeSemesterCatalog(current: Record<string, FacultyOption>, incoming: FacultyOption): Record<string, FacultyOption> {
  const matching = Object.fromEntries(Object.entries(current).filter(([, catalog]) => catalog.semester === incoming.semester));
  return {...matching, [incoming.facultyCode]: incoming};
}

/** Expose retained schedule data as uncertain after a source failure without mutating it. */
export function markCatalogUnavailable<T extends FacultyOption | import("@/lib/itu/types").ItuCourseCatalog>(catalog: T): T {
  return {
    ...catalog,
    courses: catalog.courses.map((course) => ({
      ...course,
      sections: course.sections.map((section) => ({
        ...section,
        programRestriction: {
          ...section.programRestriction,
          raw: section.programRestriction?.raw ?? section.majorRestriction,
          state: "unknown",
          codes: [...(section.programRestriction?.codes ?? [])],
          reason: "source-unavailable",
        },
      })),
    })),
  } as T;
}
