import { ACADEMIC_KEYS, RECOVERY_PREFIX, RECOVERY_ACK_PREFIX, isAcademicKey, type AcademicKey, type AcademicRecord } from './keys';
import { validateRecord } from './records';
import { discardLegacyAcademicData, recoveryKey, type AcademicStorage } from './storage';

type RecoveryStorage = AcademicStorage & Partial<Pick<Storage, 'length' | 'key'>>;
export type RecoverySummary = { id: string; records: number; readable: boolean };
type Write = { key: AcademicKey; payload: unknown; revision: number };
export type Transport = {
  load: (userId: string) => Promise<{ userId: string; records: AcademicRecord[] }>;
  save: (userId: string, entry: Write) => Promise<{ userId: string; record: AcademicRecord }>;
};
export type SyncSnapshot = {
  ready: boolean; status: 'loading' | 'saved' | 'saving' | 'unsaved' | 'error' | 'conflict' | 'account_changed' | 'invalid_recovery';
  conflicts: AcademicKey[]; recoveries: RecoverySummary[]; pending: number; epoch: number; cacheFailed: boolean;
};
function fault(code: string) { return Object.assign(new Error(code), { code }); }
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
function same(a: unknown, b: unknown) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
async function digest(raw: string) {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function acknowledgementKey(id: string) { return RECOVERY_ACK_PREFIX + id.slice(RECOVERY_PREFIX.length); }
function valid(record: AcademicRecord) {
  return isAcademicKey(record.record_key) && Number.isSafeInteger(record.revision) && record.revision > 0 && validateRecord(record.record_key, record.payload);
}

export class AcademicSync implements AcademicStorage {
  private records = new Map<AcademicKey, AcademicRecord>();
  private pending = new Map<AcademicKey, Write>();
  private recoveredSources = new Map<string, { fingerprint: string; keys: AcademicKey[] }>();
  private conflicts = new Set<AcademicKey>();
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setTimeout>;
  private running: Promise<void> | null = null;
  private disposed = false;
  private snapshot: SyncSnapshot = { ready: false, status: 'loading', conflicts: [], recoveries: [], pending: 0, epoch: 0, cacheFailed: false };
  constructor(readonly userId: string, private cache: RecoveryStorage, private transport: Transport, writerId = globalThis.crypto.randomUUID()) { this.recoveryId = recoveryKey(userId, writerId); }
  readonly recoveryId: string;
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<SyncSnapshot> = {}) {
    if (this.disposed) return;
    if (this.snapshot.status === 'account_changed' || patch.status === 'account_changed') {
      patch = { ...patch, ready: false, status: 'account_changed', epoch: this.snapshot.epoch };
    }
    this.snapshot = { ...this.snapshot, ...patch, conflicts: [...this.conflicts], pending: this.pending.size };
    for (const listener of this.listeners) listener();
  }
  private assertReady() {
    if (this.disposed || !this.snapshot.ready || ['account_changed', 'invalid_recovery'].includes(this.snapshot.status)) throw new Error('Account storage unavailable.');
  }
  private checkIdentity(actual: string) { if (this.snapshot.status === 'account_changed' || actual !== this.userId) throw fault('account_changed'); }
  private fail(error: unknown) {
    const code = (error as { code?: string })?.code;
    this.publish({ status: code === 'account_changed' ? 'account_changed' : code === 'invalid_recovery' ? 'invalid_recovery' : 'error' });
  }
  private persist() {
    try {
      if (this.pending.size || this.recoveredSources.size) this.cache.setItem(this.recoveryId, JSON.stringify({ version: 1, pending: [...this.pending.values()], sources: [...this.recoveredSources].map(([id, source]) => ({ id, ...source })) }));
      else this.cache.removeItem(this.recoveryId);
      this.publish({ cacheFailed: false });
    } catch { this.publish({ cacheFailed: true }); }
  }
  private schedule() {
    clearTimeout(this.timer);
    if (!this.disposed) this.timer = setTimeout(() => { void this.flush(); }, 600);
  }
  async initialize() {
    try {
      try { discardLegacyAcademicData(this.cache); } catch { this.publish({ cacheFailed: true }); }
      const result = await this.transport.load(this.userId);
      if (this.disposed) return;
      this.checkIdentity(result.userId);
      if (!Array.isArray(result.records) || !result.records.every(valid)) throw new Error('Invalid cloud records.');
      this.records = new Map(result.records.map(record => [record.record_key, record]));
      let raw: string | null = null;
      try { raw = this.cache.getItem(this.recoveryId); } catch { this.publish({ cacheFailed: true }); }
      if (raw) {
        const entries = this.parseRecovery(raw);
        this.restoreRecoverySources(raw);
        for (const entry of entries) {
          const cloud = this.records.get(entry.key);
          // A response may have been lost after the database successfully saved.
          if (cloud && same(cloud.payload, entry.payload)) continue;
          this.pending.set(entry.key, entry);
          if ((cloud?.revision ?? 0) !== entry.revision) this.conflicts.add(entry.key);
        }
      }
      await this.acknowledgeCompletedSources();
      this.publish({ ready: true, status: this.conflicts.size ? 'conflict' : this.pending.size ? 'unsaved' : 'saved' });
      this.persist();
      await this.findRecoveries();
      if (this.pending.size) this.schedule();
    } catch (error) { this.fail(error); }
  }
  getItem(key: string): string | null {
    this.assertReady();
    if (!isAcademicKey(key)) throw new Error('Unknown academic record.');
    const payload = this.pending.has(key) ? this.pending.get(key)!.payload : this.records.get(key)?.payload;
    return payload == null ? null : JSON.stringify(payload);
  }
  setItem(key: string, value: string) {
    this.assertReady();
    const payload: unknown = JSON.parse(value);
    if (!isAcademicKey(key) || !validateRecord(key, payload)) throw new Error('Invalid or oversized academic record.');
    const current = this.getItem(key);
    if (same(current === null ? null : JSON.parse(current), payload)) return;
    this.pending.set(key, { key, payload, revision: this.pending.get(key)?.revision ?? this.records.get(key)?.revision ?? 0 });
    this.persist();
    this.publish({ status: this.conflicts.size ? 'conflict' : 'unsaved' });
    this.schedule();
  }
  removeItem(key: string) { this.setItem(key, 'null'); }
  flush(): Promise<void> {
    if (this.running) return this.running;
    clearTimeout(this.timer);
    if (this.disposed || !this.snapshot.ready || ['account_changed', 'invalid_recovery'].includes(this.snapshot.status)) return Promise.resolve();
    this.running = this.savePending().finally(() => {
      this.running = null;
      if (!this.disposed && !['error', 'account_changed', 'invalid_recovery'].includes(this.snapshot.status) && [...this.pending.keys()].some(key => !this.conflicts.has(key))) this.schedule();
    });
    return this.running;
  }
  private async savePending() {
    this.publish({ status: 'saving' });
    for (const key of ACADEMIC_KEYS) {
      // Drain edits queued during an earlier request, preserving its new revision.
      while (this.pending.has(key) && !this.conflicts.has(key) && !this.disposed) {
        const entry = this.pending.get(key)!;
        try {
          const result = await this.transport.save(this.userId, { ...entry });
          if (this.disposed) return;
          this.checkIdentity(result.userId);
          if (!valid(result.record) || result.record.record_key !== key || result.record.revision !== entry.revision + 1 || !same(result.record.payload, entry.payload)) throw new Error('Invalid save response.');
          this.records.set(key, result.record);
          if (this.pending.get(key) === entry) this.pending.delete(key);
          else this.pending.set(key, { ...this.pending.get(key)!, revision: result.record.revision });
          this.persist();
        } catch (error) {
          if (this.disposed) return;
          if ((error as { code?: string })?.code === 'conflict') {
            this.conflicts.add(key);
            this.publish({ status: 'conflict' });
            break;
          }
          this.fail(error);
          return;
        }
      }
    }
    await this.acknowledgeCompletedSources();
    this.publish({ status: this.conflicts.size ? 'conflict' : this.pending.size ? 'unsaved' : 'saved' });
    await this.findRecoveries();
  }
  async refresh() {
    if (this.disposed || !this.snapshot.ready || this.running || this.snapshot.status === 'account_changed') return;
    try {
      const result = await this.transport.load(this.userId);
      if (this.disposed) return;
      this.checkIdentity(result.userId);
      if (this.running) return;
      if (!result.records.every(valid)) throw new Error('Invalid cloud records.');
      const incoming = new Map(result.records.map(record => [record.record_key, record]));
      let changed = false;
      for (const key of ACADEMIC_KEYS) {
        const next = incoming.get(key);
        const edit = this.pending.get(key);
        if (edit) {
          if ((next?.revision ?? 0) !== edit.revision) this.conflicts.add(key);
        } else if (!same(this.records.get(key), next)) changed = true;
      }
      this.records = incoming;
      this.publish({ epoch: this.snapshot.epoch + (changed ? 1 : 0), status: this.conflicts.size ? 'conflict' : this.pending.size ? 'unsaved' : 'saved' });
      await this.findRecoveries();
    } catch (error) { this.fail(error); }
  }
  async resolve(key: AcademicKey, choice: 'cloud' | 'local') {
    if (!this.conflicts.has(key)) return;
    const chosenPending = this.pending.get(key);
    try {
      const result = await this.transport.load(this.userId);
      if (this.disposed) return;
      this.checkIdentity(result.userId);
      if (!result.records.every(valid)) throw new Error('Invalid cloud records.');
      if (this.pending.get(key) !== chosenPending) return;
      const remote = result.records.find(record => record.record_key === key);
      if (remote) this.records.set(key, remote); else this.records.delete(key);
      if (choice === 'cloud') this.pending.delete(key);
      else this.pending.set(key, { ...this.pending.get(key)!, revision: remote?.revision ?? 0 });
      this.conflicts.delete(key);
      this.persist();
      this.publish({ epoch: this.snapshot.epoch + 1, status: this.conflicts.size ? 'conflict' : this.pending.size ? 'unsaved' : 'saved' });
      await this.acknowledgeCompletedSources();
      if (choice === 'local') await this.flush();
      await this.findRecoveries();
    } catch (error) { this.fail(error); }
  }
  private parseRecovery(raw: string): Write[] {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1 || !Array.isArray(parsed.pending) || parsed.pending.length > ACADEMIC_KEYS.length) throw new Error();
      const entries: Write[] = parsed.pending;
      if (new Set(entries.map(e => e.key)).size !== entries.length || !entries.every(e => isAcademicKey(e.key) && Number.isSafeInteger(e.revision) && e.revision >= 0 && validateRecord(e.key, e.payload))) throw new Error();
      return entries;
    } catch { throw fault('invalid_recovery'); }
  }
  private restoreRecoverySources(raw: string) {
    const sources: unknown = JSON.parse(raw).sources;
    if (sources === undefined) return;
    if (!Array.isArray(sources) || sources.length > 100) throw fault('invalid_recovery');
    for (const source of sources) {
      if (!source || typeof source.id !== 'string' || !this.ownsRecovery(source.id)
        || typeof source.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(source.fingerprint)
        || !Array.isArray(source.keys) || source.keys.length > ACADEMIC_KEYS.length
        || !source.keys.every((key: unknown) => typeof key === 'string' && isAcademicKey(key))) throw fault('invalid_recovery');
      this.recoveredSources.set(source.id, { fingerprint: source.fingerprint, keys: source.keys });
    }
  }
  private ownsRecovery(id: string) {
    const base = recoveryKey(this.userId);
    return id === base || id.startsWith(base + ':');
  }
  private async findRecoveries() {
    const recoveries: RecoverySummary[] = [];
    try {
      if (this.cache.key && typeof this.cache.length === 'number') {
        for (let index = 0; index < this.cache.length; index++) {
          const id = this.cache.key(index);
          if (!id || id === this.recoveryId || !this.ownsRecovery(id)) continue;
          const raw = this.cache.getItem(id);
          if (!raw) continue;
          if (this.cache.getItem(acknowledgementKey(id)) === await digest(raw)) continue;
          try {
            const entries = this.parseRecovery(raw);
            const changed = entries.filter(entry => !same(this.records.get(entry.key)?.payload ?? null, entry.payload));
            if (changed.length) recoveries.push({ id, records: changed.length, readable: true });
          } catch { recoveries.push({ id, records: 0, readable: false }); }
        }
      }
    } catch { this.publish({ cacheFailed: true }); }
    this.publish({ recoveries });
  }
  exportRecovery(id: string) {
    if (!this.ownsRecovery(id)) throw new Error('Invalid recovery owner.');
    return { userId: this.userId, recovery: this.cache.getItem(id) };
  }
  async recover(id: string) {
    this.assertReady();
    if (!this.ownsRecovery(id) || this.pending.size || this.running) return;
    try {
      await this.refresh();
      this.assertReady();
      if (this.pending.size || this.running) return;
      const raw = this.cache.getItem(id);
      if (!raw) return;
      const entries = this.parseRecovery(raw);
      const fingerprint = await digest(raw);
      this.assertReady();
      if (this.disposed || this.pending.size || this.running) return;
      this.restoreRecoverySources(raw);
      this.recoveredSources.set(id, { fingerprint, keys: entries.map(entry => entry.key) });
      for (const entry of entries) {
        const cloud = this.records.get(entry.key);
        if (same(cloud?.payload ?? null, entry.payload)) continue;
        this.pending.set(entry.key, entry);
        if ((cloud?.revision ?? 0) !== entry.revision) this.conflicts.add(entry.key);
      }
      // Copy into this writer's slot. Never overwrite or remove another tab's slot.
      this.persist();
      this.publish({ epoch: this.snapshot.epoch + 1, status: this.conflicts.size ? 'conflict' : this.pending.size ? 'unsaved' : 'saved' });
      await this.acknowledgeCompletedSources();
      await this.findRecoveries();
      if (this.pending.size) this.schedule();
    } catch (error) {
      if ((error as { code?: string })?.code === 'invalid_recovery') this.publish({ status: 'error' });
      else this.fail(error);
    }
  }
  private async acknowledgeCompletedSources() {
    for (const [id, source] of this.recoveredSources) {
      if (source.keys.some(key => this.pending.has(key))) continue;
      try {
        // A separate digest acknowledges this exact snapshot without touching an
        // active writer's slot. Later changes to that slot get a different digest.
        this.cache.setItem(acknowledgementKey(id), source.fingerprint);
        this.recoveredSources.delete(id);
      } catch { this.publish({ cacheFailed: true }); }
    }
    this.persist();
  }
  exportPending() { return { userId: this.userId, pending: [...this.pending.values()] }; }
  dispose() { this.disposed = true; clearTimeout(this.timer); this.listeners.clear(); }
}

async function responseBody(response: Response, userId: string) {
  if (response.status === 401 || response.status === 403) throw fault('account_changed');
  if (response.status === 409) throw fault('conflict');
  if (!response.ok) throw fault('storage_unavailable');
  const body = await response.json();
  if (body.userId !== userId) throw fault('account_changed');
  return body;
}
export const browserTransport: Transport = {
  async load(userId) {
    return responseBody(await fetch('/api/academic-records', { cache: 'no-store', headers: { 'x-simplify-account': userId } }), userId);
  },
  async save(userId, entry) {
    return responseBody(await fetch('/api/academic-records', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-simplify-account': userId }, body: JSON.stringify(entry) }), userId);
  },
};
