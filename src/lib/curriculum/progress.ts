import { z } from "zod";

import type { CurriculumProgress } from "@/lib/curriculum/types";

export const CURRICULUM_PROGRESS_STORAGE_KEY = "simplify-curriculum-progress-v1";

const courseProgressSchema = z.object({
  state: z.enum(["passed", "planned", "none"]),
  grade: z.enum(["AA", "BA", "BB", "CB", "CC", "DC", "DD", "FD", "FF"]).optional(),
});
const planProgressSchema = z.object({
  version: z.literal(1),
  planId: z.number().int().positive(),
  courses: z.record(z.string(), courseProgressSchema),
});
const storeSchema = z.object({
  version: z.literal(1),
  plans: z.record(z.string(), planProgressSchema),
});

type ProgressStore = z.infer<typeof storeSchema>;

function emptyProgress(planId: number): CurriculumProgress {
  return { version: 1, planId, courses: {} };
}

export function parseCurriculumProgress(
  storedValue: string | null,
  planId: number,
): CurriculumProgress {
  if (!storedValue) return emptyProgress(planId);
  try {
    const parsed = storeSchema.safeParse(JSON.parse(storedValue));
    return parsed.success ? parsed.data.plans[String(planId)] ?? emptyProgress(planId) : emptyProgress(planId);
  } catch {
    return emptyProgress(planId);
  }
}

export function updateStoredCurriculumProgress(
  storedValue: string | null,
  progress: CurriculumProgress,
): string {
  let store: ProgressStore = { version: 1, plans: {} };
  if (storedValue) {
    try {
      const parsed = storeSchema.safeParse(JSON.parse(storedValue));
      if (parsed.success) store = parsed.data;
    } catch {
      // Replace malformed local data with a validated store.
    }
  }
  return JSON.stringify({
    version: 1,
    plans: { ...store.plans, [String(progress.planId)]: progress },
  });
}
