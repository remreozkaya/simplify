import { describe, expect, it } from 'vitest';
import { AcademicSync, type Transport } from '@/lib/academic/sync';
import { RECOVERY_PREFIX, type AcademicRecord } from '@/lib/academic/keys';
const key = 'simplify-selected-weekly-program';
const cache = () => { const map = new Map<string, string>(); return { map, get length() { return map.size; }, key: (i: number) => [...map.keys()][i] ?? null, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } }; };
function fixture() {
  const memory = cache();
  let records: AcademicRecord[] = [];
  const writes: unknown[] = [];
  const transport: Transport = {
    load: async userId => ({ userId, records }),
    save: async (userId, entry) => {
      writes.push({ userId, ...entry });
      const previous = records.find(r => r.record_key === entry.key);
      if ((previous?.revision ?? 0) !== entry.revision) throw Object.assign(new Error('conflict'), { code: 'conflict' });
      const record = { record_key: entry.key, payload: entry.payload, revision: entry.revision + 1 };
      records = [...records.filter(r => r.record_key !== entry.key), record];
      return { userId, record };
    },
  };
  const sync = new AcademicSync('A', memory, transport, '');
  return { sync, memory, transport, writes, remote: (value: unknown, revision: number) => { records = [{ record_key: key, payload: value, revision }]; } };
}
describe('account academic synchronization', () => {
  it('discards only unowned personal legacy keys and never reads another account recovery cache', async () => {
    const f = fixture();
    f.memory.setItem(key, 'old private record');
    f.memory.setItem('simplify-theme', 'dark');
    f.memory.setItem('itu-catalog', 'official');
    f.memory.setItem(RECOVERY_PREFIX + 'B', 'another user');
    await f.sync.initialize();
    expect(f.sync.getItem(key)).toBeNull();
    expect(f.memory.getItem(key)).toBeNull();
    expect(f.memory.getItem('simplify-theme')).toBe('dark');
    expect(f.memory.getItem('itu-catalog')).toBe('official');
    expect(f.memory.getItem(RECOVERY_PREFIX + 'B')).toBe('another user');
    f.sync.dispose();
  });
  it('hydrates cloud documents and sends ownership assertion plus expected revision', async () => {
    const f = fixture(); f.remote('first', 3);
    await f.sync.initialize();
    expect(f.sync.getItem(key)).toBe('"first"');
    f.sync.setItem(key, '"second"'); await f.sync.flush();
    expect(f.writes).toEqual([{ userId: 'A', key, payload: 'second', revision: 3 }]);
    expect(f.sync.getSnapshot().status).toBe('saved');
    expect(f.memory.getItem(RECOVERY_PREFIX + 'A')).toBeNull();
    f.sync.dispose();
  });
  it('keeps a later edit made during an in-flight save', async () => {
    const f = fixture(); await f.sync.initialize();
    const original = f.transport.save;
    let release!: () => void;
    f.transport.save = async (...args) => { await new Promise<void>(r => { release = r; }); return original(...args); };
    f.sync.setItem(key, '"one"');
    const first = f.sync.flush();
    f.sync.setItem(key, '"two"');
    f.transport.save = original;
    release(); await first; await f.sync.flush();
    expect(f.writes).toEqual([{ userId: 'A', key, payload: 'one', revision: 0 }, { userId: 'A', key, payload: 'two', revision: 1 }]);
    expect(f.sync.getItem(key)).toBe('"two"');
    f.sync.dispose();
  });
  it('preserves offline edits across reload and requires explicit conflict resolution', async () => {
    const f = fixture(); await f.sync.initialize();
    f.sync.setItem(key, '"local"'); f.sync.dispose();
    f.remote('other device', 1);
    const reopened = new AcademicSync('A', f.memory, f.transport, '');
    await reopened.initialize();
    expect(reopened.getItem(key)).toBe('"local"');
    expect(reopened.getSnapshot().conflicts).toEqual([key]);
    await reopened.flush(); expect(f.writes).toEqual([]);
    await reopened.resolve(key, 'cloud');
    expect(reopened.getItem(key)).toBe('"other device"');
    expect(reopened.getSnapshot().epoch).toBeGreaterThan(0);
    reopened.dispose();
  });
  it('writes resets as revisioned tombstones and detects changed cookie identity', async () => {
    const f = fixture(); f.remote('first', 2); await f.sync.initialize();
    f.sync.removeItem(key); await f.sync.flush();
    expect(f.writes).toContainEqual({ userId: 'A', key, payload: null, revision: 2 });
    expect(f.sync.getItem(key)).toBeNull();
    f.transport.load = async () => ({ userId: 'B', records: [] });
    await f.sync.refresh();
    expect(f.sync.getSnapshot().status).toBe('account_changed');
    expect(() => f.sync.setItem(key, '"wrong"')).toThrow();
    f.sync.dispose();
  });
  it('never treats a failed initial cloud load as an empty account', async () => {
    const f = fixture(); f.transport.load = async () => { throw new Error('offline'); };
    await f.sync.initialize();
    expect(f.sync.getSnapshot().ready).toBe(false);
    expect(() => f.sync.setItem(key, '"bad default"')).toThrow();
    expect(f.writes).toEqual([]);
    f.sync.dispose();
  });
});

it('accepts nested JSONB key reordering after a successful database save', async () => {
  const f = fixture(); await f.sync.initialize();
  f.transport.save = async (userId, entry) => ({ userId, record: {
    record_key: entry.key, revision: entry.revision + 1,
    payload: { courses: [], version: 1 },
  } });
  f.sync.setItem('simplify-current-semester-v1', JSON.stringify({ version: 1, courses: [] }));
  await f.sync.flush();
  expect(f.sync.getSnapshot().status).toBe('saved');
  expect(f.sync.getSnapshot().pending).toBe(0);
  f.sync.dispose();
});

it('keeps different writers recovery records independent and offers explicit recovery after reopening', async () => {
  const f = fixture();
  const first = new AcademicSync('A', f.memory, f.transport, 'tab-one');
  const second = new AcademicSync('A', f.memory, f.transport, 'tab-two');
  await first.initialize(); await second.initialize();
  first.setItem(key, '"offline work"');
  second.setItem('simplify-current-semester-v1', JSON.stringify({ version: 1, courses: [] }));
  await second.flush();
  expect(f.memory.getItem(RECOVERY_PREFIX + 'A:tab-one')).toContain('offline work');
  first.dispose(); second.dispose();
  const reopened = new AcademicSync('A', f.memory, f.transport, 'tab-three');
  await reopened.initialize();
  expect(reopened.getItem(key)).toBeNull();
  expect(reopened.getSnapshot().recoveries).toHaveLength(1);
  await reopened.recover(RECOVERY_PREFIX + 'A:tab-one');
  expect(reopened.getItem(key)).toBe('"offline work"');
  expect(f.memory.getItem(RECOVERY_PREFIX + 'A:tab-one')).toContain('offline work');
  reopened.dispose(); f.sync.dispose();
});

it('automatically schedules edits to earlier documents made while later documents save', async () => {
  const { vi } = await import('vitest');
  vi.useFakeTimers();
  const f = fixture(); await f.sync.initialize();
  const original = f.transport.save;
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>(r => { started = r; });
  f.transport.save = async (...args) => {
    if (args[1].key === 'simplify-current-semester-v1') {
      started(); await new Promise<void>(r => { release = r; });
    }
    return original(...args);
  };
  f.sync.setItem(key, '"first"');
  f.sync.setItem('simplify-current-semester-v1', JSON.stringify({ version: 1, courses: [] }));
  const flushing = f.sync.flush();
  await waiting;
  f.sync.setItem(key, '"later"');
  await vi.advanceTimersByTimeAsync(700);
  release(); await flushing;
  await vi.advanceTimersByTimeAsync(700);
  expect(f.sync.getSnapshot().pending).toBe(0);
  expect(f.writes).toContainEqual({ userId: 'A', key, payload: 'later', revision: 1 });
  f.sync.dispose(); vi.useRealTimers();
});

it('preserves edits made while a recovery refresh is in flight', async () => {
  const f = fixture();
  const source = new AcademicSync('A', f.memory, f.transport, 'source');
  await source.initialize(); source.setItem(key, '"old recovery"'); source.dispose();
  const target = new AcademicSync('A', f.memory, f.transport, 'target');
  await target.initialize();
  const original = f.transport.load;
  let release!: () => void;
  f.transport.load = async (...args) => { await new Promise<void>(r => { release = r; }); return original(...args); };
  const recovering = target.recover(RECOVERY_PREFIX + 'A:source');
  target.setItem(key, '"new edit during recovery"');
  release(); await recovering;
  expect(target.getItem(key)).toBe('"new edit during recovery"');
  target.dispose(); f.sync.dispose();
});

it('does not reoffer already completed recovery after later cloud changes, but preserves new source-writer edits', async () => {
  const f = fixture();
  const source = new AcademicSync('A', f.memory, f.transport, 'source');
  await source.initialize(); source.setItem(key, '"recovered once"');
  const target = new AcademicSync('A', f.memory, f.transport, 'target');
  await target.initialize(); await target.recover(RECOVERY_PREFIX + 'A:source'); await target.flush();
  target.setItem(key, '"legitimate later edit"'); await target.flush(); await target.refresh();
  expect(target.getSnapshot().recoveries).toEqual([]);
  source.setItem(key, '"new unsaved source edit"');
  await target.refresh();
  expect(target.getSnapshot().recoveries).toMatchObject([{ id: RECOVERY_PREFIX + 'A:source' }]);
  expect(f.memory.getItem(RECOVERY_PREFIX + 'A:source')).toContain('new unsaved source edit');
  source.dispose(); target.dispose(); f.sync.dispose();
});

it('retains recovery provenance through another interrupted recovery session', async () => {
  const f = fixture();
  const source = new AcademicSync('A', f.memory, f.transport, 'source');
  await source.initialize(); source.setItem(key, '"original pending"'); source.dispose();
  const middle = new AcademicSync('A', f.memory, f.transport, 'middle');
  await middle.initialize(); await middle.recover(RECOVERY_PREFIX + 'A:source'); middle.dispose();
  const last = new AcademicSync('A', f.memory, f.transport, 'last');
  await last.initialize(); await last.recover(RECOVERY_PREFIX + 'A:middle'); await last.flush();
  last.setItem(key, '"later cloud version"'); await last.flush(); await last.refresh();
  expect(last.getSnapshot().recoveries).toEqual([]);
  last.dispose(); f.sync.dispose();
});

it('keeps an account-change lock terminal when an older response arrives afterward', async () => {
  const f = fixture(); await f.sync.initialize();
  let release!: () => void;
  const original = f.transport.load;
  f.transport.load = async (...args) => { await new Promise<void>(r => { release = r; }); return original(...args); };
  const older = f.sync.refresh();
  f.transport.load = async () => { throw Object.assign(new Error('changed'), { code: 'account_changed' }); };
  await f.sync.refresh();
  expect(f.sync.getSnapshot().status).toBe('account_changed');
  release(); await older;
  expect(f.sync.getSnapshot().status).toBe('account_changed');
  expect(f.sync.getSnapshot().ready).toBe(false);
  expect(() => f.sync.setItem(key, '"must not reopen"')).toThrow();
  f.sync.dispose();
});
