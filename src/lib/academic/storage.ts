import { ACADEMIC_KEYS, RECOVERY_PREFIX, ACADEMIC_CHANGE_EVENT } from './keys';

export type AcademicStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
let active: AcademicStorage | null = null;
export function bindAcademicStorage(storage: AcademicStorage) {
  active = storage;
  return () => { if (active === storage) active = null; };
}
function current() {
  if (!active) throw new Error('Account academic storage has not loaded.');
  return active;
}
/** Explicit application adapter. Never falls back to shared browser records. */
export const academicStorage: AcademicStorage = {
  getItem: key => current().getItem(key),
  setItem: (key, value) => { current().setItem(key, value); if (typeof window !== 'undefined') window.dispatchEvent(new Event(ACADEMIC_CHANGE_EVENT)); },
  removeItem: key => { current().removeItem(key); if (typeof window !== 'undefined') window.dispatchEvent(new Event(ACADEMIC_CHANGE_EVENT)); },
};
export function discardLegacyAcademicData(storage: Pick<Storage, 'removeItem'>) {
  for (const key of ACADEMIC_KEYS) storage.removeItem(key);
}
export function recoveryKey(userId: string, writerId?: string) { return RECOVERY_PREFIX + userId + (writerId ? ':' + writerId : ''); }
