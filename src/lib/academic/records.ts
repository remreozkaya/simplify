import { z } from 'zod';
import { days } from '@/types/calendar';
import { storeSchema as progressSchema } from '@/lib/curriculum/progress';
import { storeSchema as transcriptSchema } from '@/lib/curriculum/transcriptStore';
import { currentSemesterSchema } from '@/lib/curriculum/semesters';
import { savedCurriculumSchema } from '@/lib/curriculum/selection';
import { parseGeneratorSession } from '@/lib/schedule/session';
import { isAcademicKey } from './keys';

export const MAX_DOCUMENT_BYTES = 1024 * 1024;
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const weeklySchema = z.array(z.object({
  id: z.string().min(1), name: z.string(), updatedAt: z.string().datetime(),
  courseBlocks: z.array(z.object({
    id: z.string(), code: z.string(), title: z.string(), day: z.enum(days),
    startTime: time, endTime: time,
    capacity: z.number().int().nonnegative().optional(), enrolled: z.number().int().nonnegative().optional(),
  }).passthrough()),
  courseSelections: z.array(z.object({
    id: z.string(), facultyCode: z.string(), courseId: z.string(), sectionId: z.string(), courseBlockIds: z.array(z.string()),
  }).passthrough()),
}));

export function validateRecord(key: string, payload: unknown): boolean {
  if (!isAcademicKey(key)) return false;
  try {
    const serialized = JSON.stringify(payload);
    if (serialized === undefined || new TextEncoder().encode(serialized).byteLength > MAX_DOCUMENT_BYTES) return false;
    if (payload === null) return true;
    switch (key) {
      case 'simplify-weekly-programs': return weeklySchema.safeParse(payload).success;
      case 'simplify-selected-weekly-program': return z.string().max(512).safeParse(payload).success;
      case 'simplify-schedule-generator-session': return parseGeneratorSession(payload) !== null;
      case 'simplify-transcript-v1': return transcriptSchema.safeParse(payload).success;
      case 'simplify-current-semester-v1': return currentSemesterSchema.safeParse(payload).success;
      case 'simplify-curriculum-progress-v1': return progressSchema.safeParse(payload).success;
      case 'simplify-saved-curriculum-v1': return savedCurriculumSchema.safeParse(payload).success;
    }
  } catch { return false; }
}
