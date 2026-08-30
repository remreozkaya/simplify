import { z } from "zod";

export const SAVED_CURRICULUM_STORAGE_KEY = "simplify-saved-curriculum-v1";

const savedCurriculumSchema = z.object({
  version: z.literal(1),
  programCode: z.string().min(1),
  planId: z.number().int().positive(),
  savedAt: z.string().datetime(),
});

export type SavedCurriculum = z.infer<typeof savedCurriculumSchema>;

export function parseSavedCurriculum(value: string | null): SavedCurriculum | null {
  if (!value) return null;
  try {
    const parsed = savedCurriculumSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function serializeSavedCurriculum(
  programCode: string,
  planId: number,
  savedAt = new Date().toISOString(),
): string {
  return JSON.stringify({ version: 1, programCode, planId, savedAt });
}
