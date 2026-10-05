import { describe, expect, it } from 'vitest';
import { clearPlannerStorage, exportPlannerStorage, PLANNER_STORAGE_KEYS } from '@/lib/legal/browserStorage';
import { getRouteDecision } from '@/lib/auth/redirects';

function store() {
  const values = new Map<string, string>(PLANNER_STORAGE_KEYS.map(key => [key, '{"sample":true}']));
  values.set('sb-test-auth-token', 'secret');
  values.set('another-app', 'keep');
  return { values, getItem: (key: string) => values.get(key) ?? null, removeItem: (key: string) => { values.delete(key); } };
}
describe('privacy controls', () => {
  it('exports only documented planner data, never auth tokens', () => {
    const storage = store();
    expect(Object.keys(exportPlannerStorage(storage))).toEqual([...PLANNER_STORAGE_KEYS]);
    expect(JSON.stringify(exportPlannerStorage(storage))).not.toContain('secret');
  });
  it('clears all Simplify planner and preference keys, preserves unrelated data and auth', () => {
    const storage = store();
    clearPlannerStorage(storage);
    expect([...storage.values.keys()]).toEqual(['sb-test-auth-token', 'another-app']);
  });
  it.each(['/legal/privacy', '/legal/storage', '/legal/terms', '/legal/requests'])('allows %s with and without authentication', path => {
    expect(getRouteDecision(path, '', false).type).toBe('allow');
    expect(getRouteDecision(path, '', true).type).toBe('allow');
  });
});
