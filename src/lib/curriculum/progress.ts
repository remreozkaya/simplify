import { z } from "zod";

import { GRADES } from "@/lib/curriculum/grades";
import type { CourseProgress, CurriculumProgress, RequirementSatisfaction, TranscriptCourseRecord } from "@/lib/curriculum/types";

export const CURRICULUM_PROGRESS_STORAGE_KEY = "simplify-curriculum-progress-v1";
export const CURRICULUM_PROGRESS_EVENT = "simplify:curriculum-progress";

const gradeSchema = z.enum(GRADES);
const storedCourseProgressSchema = z.object({
  state: z.enum(["passed", "failed", "planned", "none"]),
  grade: gradeSchema.optional(),
  term: z.string().optional(), crn: z.string().optional(), courseCode: z.string().optional(),
  courseName: z.string().optional(), courseLanguage: z.string().optional(),
  countedCredit: z.number().nonnegative().optional(), transcriptCredit: z.number().nonnegative().optional(),
  completionStatus: z.enum(["passed", "failed"]).optional(),
  source: z.enum(["manual", "transcript"]).optional(),
  matchedRequirementId: z.string().optional(),
  satisfactionType: z.enum(["direct", "language-equivalence", "equivalence", "elective", "manual"]).optional(),
  equivalenceRuleId: z.string().optional(),
});
const transcriptCourseSchema = z.object({
  term: z.string(), crn: z.string(), courseCode: z.string(), courseName: z.string(),
  courseLanguage: z.string().optional(), grade: gradeSchema,
  countedCredit: z.number().nonnegative(), transcriptCredit: z.number().nonnegative(),
  completionStatus: z.enum(["passed", "failed"]), source: z.literal("transcript"), calculated: z.boolean(),
});
const planProgressSchema = z.object({
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  planId: z.number().int().positive(),
  courses: z.record(z.string(), storedCourseProgressSchema),
  importedCourses: z.array(transcriptCourseSchema).optional(),
  requirementSatisfactions: z.record(z.string(), z.object({
    requirementId: z.string(), requirementCourseCode: z.string(),
    satisfiedByCourseCodes: z.array(z.string()).min(1),
    satisfactionType: z.enum(["direct", "language-equivalence", "equivalence", "elective", "manual"]),
    equivalenceRuleId: z.string().optional(), sourceUrl: z.string().url().optional(),
  })).optional(),
});
const storeSchema = z.object({
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  plans: z.record(z.string(), planProgressSchema),
});

export function emptyProgress(planId: number): CurriculumProgress {
  return { version: 3, planId, courses: {}, importedCourses: [], requirementSatisfactions: {} };
}

function normalizeProgress(value: z.infer<typeof planProgressSchema>): CurriculumProgress {
  const courses: CurriculumProgress["courses"] = {};
  Object.entries(value.courses).forEach(([code, course]) => {
    if (course.state !== "passed" && course.state !== "failed") return;
    courses[code] = { ...(course as CourseProgress), state: course.state };
  });
  return { version: 3, planId: value.planId, courses, importedCourses: (value.importedCourses ?? []) as TranscriptCourseRecord[], requirementSatisfactions: (value.requirementSatisfactions ?? {}) as Record<string, RequirementSatisfaction> };
}

export function parseCurriculumProgress(storedValue: string | null, planId: number): CurriculumProgress {
  if (!storedValue) return emptyProgress(planId);
  try {
    const parsed = storeSchema.safeParse(JSON.parse(storedValue));
    const storedPlan = parsed.success ? parsed.data.plans[String(planId)] : undefined;
    return storedPlan ? normalizeProgress(storedPlan) : emptyProgress(planId);
  } catch { return emptyProgress(planId); }
}

export function updateStoredCurriculumProgress(storedValue: string | null, progress: CurriculumProgress): string {
  let plans: Record<string, CurriculumProgress> = {};
  if (storedValue) {
    try {
      const parsed = storeSchema.safeParse(JSON.parse(storedValue));
      if (parsed.success) plans = Object.fromEntries(Object.entries(parsed.data.plans).map(([id, plan]) => [id, normalizeProgress(plan)]));
    } catch { /* Replace malformed local data with a validated store. */ }
  }
  return JSON.stringify({ version: 3, plans: { ...plans, [String(progress.planId)]: { ...progress, version: 3 } } });
}

export function persistCurriculumProgress(progress: CurriculumProgress): void {
  localStorage.setItem(CURRICULUM_PROGRESS_STORAGE_KEY, updateStoredCurriculumProgress(localStorage.getItem(CURRICULUM_PROGRESS_STORAGE_KEY), progress));
  window.dispatchEvent(new CustomEvent(CURRICULUM_PROGRESS_EVENT, { detail: progress.planId }));
}

export function resetImportedProgress(progress: CurriculumProgress): CurriculumProgress {
  return {
    ...progress,
    courses: Object.fromEntries(Object.entries(progress.courses).filter(([, course]) => course.source !== "transcript")),
    importedCourses: [],
    requirementSatisfactions: Object.fromEntries(Object.entries(progress.requirementSatisfactions ?? {}).filter(([, satisfaction]) => satisfaction.satisfiedByCourseCodes.some((code) => progress.courses[code]?.source !== "transcript"))),
  };
}
