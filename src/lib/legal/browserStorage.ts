import { RECOVERY_PREFIX, RECOVERY_ACK_PREFIX } from "@/lib/academic/keys";
/** Explicit allowlist: do not export cookies, tokens or arbitrary origin storage. */
export const PLANNER_STORAGE_KEYS = [
  'simplify-weekly-programs',
  'simplify-schedule-generator-session',
  'simplify-transcript-v1',
  'simplify-current-semester-v1',
  'simplify-curriculum-progress-v1',
  'simplify-saved-curriculum-v1',
  'simplify-language',
  'simplify-theme',
] as const;
type EnumerableStorage = Partial<Pick<Storage, 'length' | 'key'>>;
function recoveryKeys(storage: EnumerableStorage, ownerId?: string) {

  const keys: string[] = [];
  if (storage.key && typeof storage.length === 'number') {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key && [RECOVERY_PREFIX, RECOVERY_ACK_PREFIX].some(prefix => key.startsWith(prefix) && (!ownerId || key === prefix + ownerId || key.startsWith(prefix + ownerId + ':')))) keys.push(key);
    }
  }
  if (ownerId && !keys.length) keys.push(RECOVERY_PREFIX + ownerId);
  return keys;
}
export function exportPlannerStorage(storage: Pick<Storage, 'getItem'> & EnumerableStorage, ownerId?: string) {
  const records: Record<string, string> = {};
  for (const key of [...PLANNER_STORAGE_KEYS, ...(ownerId ? recoveryKeys(storage, ownerId) : [])]) {
    const value = storage.getItem(key);
    if (value !== null) records[key] = value;
  }
  return records;
}
export function clearPlannerStorage(storage: Pick<Storage, 'removeItem'> & EnumerableStorage, ownerId?: string) {
  // Enumerate before removal because Storage indexes shift as entries disappear.
  for (const key of [...PLANNER_STORAGE_KEYS, ...recoveryKeys(storage, ownerId)]) storage.removeItem(key);
}
export function downloadPrivacyData(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
