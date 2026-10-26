/** Personal academic records only; official catalog snapshots are never included. */
export const ACADEMIC_KEYS = [
  'simplify-weekly-programs',
  'simplify-selected-weekly-program',
  'simplify-schedule-generator-session',
  'simplify-transcript-v1',
  'simplify-current-semester-v1',
  'simplify-curriculum-progress-v1',
  'simplify-saved-curriculum-v1',
] as const;
export type AcademicKey = typeof ACADEMIC_KEYS[number];
export const ACADEMIC_CHANGE_EVENT = 'simplify:academic-records';
export const SELECTED_WEEKLY_PROGRAM_KEY = ACADEMIC_KEYS[1];
export const RECOVERY_ACK_PREFIX = 'simplify-academic-recovered-v1:';
export const RECOVERY_PREFIX = 'simplify-academic-pending-v1:';
export function isAcademicKey(key: string): key is AcademicKey {
  return ACADEMIC_KEYS.some(value => value === key);
}
export type AcademicRecord = { record_key: AcademicKey; payload: unknown; revision: number; updated_at?: string; schema_version?: number };
