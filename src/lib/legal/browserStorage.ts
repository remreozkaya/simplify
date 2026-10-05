/** Explicit allowlist: do not export cookies, tokens or arbitrary origin storage. */
export const PLANNER_STORAGE_KEYS = [
  'simplify-weekly-programs',
  'simplify-schedule-generator-session',
  'simplify-transcript-v1',
  'simplify-curriculum-progress-v1',
  'simplify-saved-curriculum-v1',
  'simplify-language',
  'simplify-theme',
] as const;
export function exportPlannerStorage(storage: Pick<Storage, 'getItem'>) {
  const records: Record<string, string> = {};
  for (const key of PLANNER_STORAGE_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) records[key] = value;
  }
  return records;
}
export function clearPlannerStorage(storage: Pick<Storage, 'removeItem'>) {
  for (const key of PLANNER_STORAGE_KEYS) storage.removeItem(key);
}
export function downloadPrivacyData(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
