import { z } from "zod";

import type { CurriculumProgress } from "@/lib/curriculum/types";

export const CURRICULUM_PROGRESS_STORAGE_KEY = "simplify-curriculum-progress-v1";

const storedCourseProgressSchema = z.object({
  // `planned` is accepted only to migrate progress saved by the previous UI.
  state: z.enum(["passed", "failed", "planned", "none"]),
  grade: z.enum(["AA", "BA", "BB", "CB", "CC", "DC", "DD", "FD", "FF"]).optional(),
});
const planProgressSchema = z.object({
  version: z.literal(1),
  planId: z.number().int().positive(),
  courses: z.record(z.string(), storedCourseProgressSchema),
});
const storeSchema = z.object({
  version: z.literal(1),
  plans: z.record(z.string(), planProgressSchema),
});

function emptyProgress(planId: number): CurriculumProgress {
  return { version: 1, planId, courses: {} };
}

function normalizeProgress(value: z.infer<typeof planProgressSchema>): CurriculumProgress {
  const courses: CurriculumProgress["courses"] = {};
  Object.entries(value.courses).forEach(([code, course]) => {
    if (course.state === "passed") {
      courses[code] = {
        state: "passed",
        ...(course.grade ? { grade: course.grade } : {}),
      };
    } else if (course.state === "failed") {
      courses[code] = { state: "failed" };
    }
  });
  return { version: 1, planId: value.planId, courses };
}

export function parseCurriculumProgress(
  storedValue: string | null,
  planId: number,
): CurriculumProgress {
  if (!storedValue) return emptyProgress(planId);
  try {
    const parsed = storeSchema.safeParse(JSON.parse(storedValue));
    const storedPlan = parsed.success ? parsed.data.plans[String(planId)] : undefined;
    return storedPlan ? normalizeProgress(storedPlan) : emptyProgress(planId);
  } catch {
    return emptyProgress(planId);
  }
}

export function updateStoredCurriculumProgress(
  storedValue: string | null,
  progress: CurriculumProgress,
): string {
  let plans: Record<string, CurriculumProgress> = {};
  if (storedValue) {
    try {
      const parsed = storeSchema.safeParse(JSON.parse(storedValue));
      if (parsed.success) {
        plans = Object.fromEntries(
          Object.entries(parsed.data.plans).map(([id, plan]) => [id, normalizeProgress(plan)]),
        );
      }
    } catch {
      // Replace malformed local data with a validated store.
    }
  }
  return JSON.stringify({
    version: 1,
    plans: { ...plans, [String(progress.planId)]: progress },
  });
}
