'use client';

import { Fragment, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { AcademicAccountContext } from './AccountContext';
import { useLanguage } from '@/lib/i18n/client';
import { AcademicSync, browserTransport, type SyncSnapshot } from '@/lib/academic/sync';
import { bindAcademicStorage } from '@/lib/academic/storage';
import { downloadPrivacyData } from '@/lib/legal/browserStorage';
import type { AcademicKey } from '@/lib/academic/keys';

const initial: SyncSnapshot = { ready: false, status: 'loading', conflicts: [], recoveries: [], pending: 0, epoch: 0, cacheFailed: false };
const labels = {
  en: {
    loading: 'Loading your saved academic work…', saved: 'Saved to your account', saving: 'Saving…',
    unsaved: 'Changes waiting to save. Unsaved work is kept on this device when browser storage is available.',
    error: 'Account storage is unavailable. Check your connection and retry. Keep this page open to preserve pending edits.',
    conflict: 'This record was changed on another device or tab. Export your pending work before choosing which version to keep.',
    account_changed: 'Your sign-in session changed. Reload and sign in to the correct account. Pending work remains associated with its original account.',
    invalid_recovery: 'This device has an unreadable recovery record. Export it before clearing it to load your cloud data.',
    retry: 'Retry', download: 'Export pending work', cloud: 'Use cloud version', local: 'Replace cloud with my pending version',
    cache: 'Device recovery storage is unavailable. Keep this page open until changes save to your account.',
    reload: 'Reload', clear: 'Clear unreadable recovery record',
    confirm: 'Discard this unreadable recovery record? Export it first. Saved cloud records will remain.',
    replace: 'Replace the latest cloud version with this device’s pending work? Other changes to this record will be replaced.',
    signIn: 'Sign in', recovery: 'Unsaved work from another session on this device', restore: 'Recover these edits', savedFirst: 'Save or resolve your current pending work before recovering another session.',
  },
  tr: {
    loading: 'Kayıtlı akademik verileriniz yükleniyor…', saved: 'Hesabınıza kaydedildi', saving: 'Kaydediliyor…',
    unsaved: 'Değişiklikler kaydedilmeyi bekliyor. Tarayıcı depolaması kullanılabiliyorsa kaydedilmemiş veriler bu cihazda korunur.',
    error: 'Hesap depolamasına erişilemiyor. Bağlantınızı kontrol edip yeniden deneyin. Bekleyen değişiklikleri korumak için bu sayfayı açık tutun.',
    conflict: 'Bu kayıt başka bir cihazda veya sekmede değiştirildi. Hangi sürümü kullanacağınızı seçmeden önce bekleyen verilerinizi indirin.',
    account_changed: 'Oturumunuz değişti. Sayfayı yenileyip doğru hesaba giriş yapın. Bekleyen veriler ilk hesabına bağlı kalır.',
    invalid_recovery: 'Bu cihazdaki kurtarma kaydı okunamıyor. Bulut verilerinizi yüklemek için temizlemeden önce kaydı indirin.',
    retry: 'Yeniden dene', download: 'Bekleyen verileri indir', cloud: 'Bulut sürümünü kullan', local: 'Bulut sürümünü bekleyen verilerimle değiştir',
    cache: 'Cihaz kurtarma depolaması kullanılamıyor. Değişiklikler hesabınıza kaydedilene kadar bu sayfayı açık tutun.',
    reload: 'Yenile', clear: 'Okunamayan kurtarma kaydını temizle',
    confirm: 'Okunamayan kurtarma kaydı silinsin mi? Önce indirin. Buluttaki kayıtlar korunur.',
    replace: 'En güncel bulut sürümü bu cihazdaki bekleyen verilerle değiştirilsin mi? Bu kayıttaki diğer değişiklikler silinir.',
    signIn: 'Giriş yap', recovery: 'Bu cihazdaki başka bir oturumdan kaydedilmemiş veriler', restore: 'Bu değişiklikleri kurtar', savedFirst: 'Başka bir oturumu kurtarmadan önce mevcut bekleyen verilerinizi kaydedin veya çakışmaları çözün.',
  },
};
const names = {
  en: ['Weekly plans', 'Selected weekly plan', 'Schedule generator', 'Transcript history', 'Current semester', 'Curriculum progress', 'Selected curriculum'],
  tr: ['Haftalık programlar', 'Seçili haftalık program', 'Program oluşturucu', 'Transkript geçmişi', 'Mevcut dönem', 'Müfredat ilerlemesi', 'Seçili müfredat'],
};
const keys: AcademicKey[] = ['simplify-weekly-programs', 'simplify-selected-weekly-program', 'simplify-schedule-generator-session', 'simplify-transcript-v1', 'simplify-current-semester-v1', 'simplify-curriculum-progress-v1', 'simplify-saved-curriculum-v1'];
const button = 'rounded-lg border border-current px-3 py-1.5 text-sm font-medium disabled:opacity-50';

export default function AcademicProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const { language } = useLanguage();
  const copy = labels[language];
  const [sync, setSync] = useState<AcademicSync | null>(null);
  const [snapshot, setSnapshot] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // Storage access itself can fail; cloud saves remain usable without recovery caching.
    const cache = {
      get length() { return window.localStorage.length; },
      key: (index: number) => window.localStorage.key(index),
      getItem: (key: string) => window.localStorage.getItem(key),
      setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
      removeItem: (key: string) => window.localStorage.removeItem(key),
    };
    const store = new AcademicSync(userId, cache, browserTransport);
    const unbind = bindAcademicStorage(store);
    let renderedEpoch = 0;
    const unsubscribe = store.subscribe(() => {
      const next = store.getSnapshot();
      if (next.epoch !== renderedEpoch) {
        renderedEpoch = next.epoch;
        // Commit remote hydration before another input event can write stale tool state.
        flushSync(() => setSnapshot(next));
      } else setSnapshot(next);
    });
    // The provider's identity/hydration lifecycle intentionally installs an external store.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSync(store);
    void store.initialize();
    const refresh = () => { if (document.visibilityState === 'visible') void store.refresh(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (store.getSnapshot().pending || store.getSnapshot().cacheFailed) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('beforeunload', beforeUnload);
    const timer = setInterval(refresh, 60_000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('beforeunload', beforeUnload);
      unsubscribe(); unbind(); store.dispose();
    };
  }, [userId]);

  const locked = !snapshot.ready || snapshot.status === 'account_changed' || snapshot.status === 'invalid_recovery';
  async function retry() {
    if (!sync || busy) return;
    setBusy(true);
    try {
      if (!snapshot.ready) await sync.initialize();
      else { await sync.refresh(); await sync.flush(); }
    } finally { setBusy(false); }
  }
  function exportPending() {
    const data = snapshot.status === 'invalid_recovery'
      ? { userId, unreadableRecovery: sync?.exportRecovery(sync.recoveryId).recovery }
      : sync?.exportPending();
    downloadPrivacyData(data, 'simplify-pending-academic-work.json');
  }
  async function resolve(key: AcademicKey, choice: 'cloud' | 'local') {
    if (!sync || busy || (choice === 'local' && !window.confirm(copy.replace))) return;
    setBusy(true);
    try { await sync.resolve(key, choice); } finally { setBusy(false); }
  }
  const showNotice = snapshot.status !== 'saved' || snapshot.cacheFailed || snapshot.recoveries.length > 0;
  return <AcademicAccountContext.Provider value={userId}>
    {showNotice && <section aria-label={language === 'tr' ? 'Hesap kaydı' : 'Account saving'} className={`mx-4 my-3 rounded-xl border px-4 py-3 text-sm sm:mx-8 ${['error', 'conflict', 'account_changed', 'invalid_recovery'].includes(snapshot.status) || snapshot.cacheFailed ? 'border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100' : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300'}`}>
      {snapshot.status !== 'saved' && <p role="status" aria-live="polite">{copy[snapshot.status]}</p>}
      {snapshot.cacheFailed && <p role="alert" className="mt-2">{copy.cache}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {['error', 'unsaved'].includes(snapshot.status) && <button className={button} disabled={busy} onClick={() => void retry()}>{copy.retry}</button>}
        {(snapshot.pending > 0 || snapshot.status === 'invalid_recovery') && <button className={button} onClick={exportPending}>{copy.download}</button>}
        {snapshot.status === 'account_changed' && <><button className={button} onClick={() => window.location.reload()}>{copy.reload}</button><Link className={button} href="/login">{copy.signIn}</Link></>}
        {snapshot.status === 'invalid_recovery' && <button className={button} onClick={() => { if (sync && window.confirm(copy.confirm)) { window.localStorage.removeItem(sync.recoveryId); window.location.reload(); } }}>{copy.clear}</button>}
      </div>
      {snapshot.recoveries.length > 0 && <div className="mt-3 space-y-2">
        <p className="font-semibold">{copy.recovery}</p>
        {snapshot.pending > 0 && <p>{copy.savedFirst}</p>}
        {snapshot.recoveries.map((entry, index) => <div key={entry.id} className="flex flex-wrap items-center gap-2">
          <span>{index + 1}. {entry.records}</span>
          <button className={button} onClick={() => downloadPrivacyData(sync?.exportRecovery(entry.id), 'simplify-recovery.json')}>{copy.download}</button>
          {entry.readable && <button className={button} disabled={busy || snapshot.pending > 0 || locked} onClick={async () => { if (!sync) return; setBusy(true); try { await sync.recover(entry.id); } finally { setBusy(false); } }}>{copy.restore}</button>}
        </div>)}
      </div>}
      {snapshot.conflicts.map(key => <div key={key} className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-semibold">{names[language][keys.indexOf(key)]}</span>
        <button className={button} disabled={busy} onClick={() => void resolve(key, 'cloud')}>{copy.cloud}</button>
        <button className={button} disabled={busy} onClick={() => void resolve(key, 'local')}>{copy.local}</button>
      </div>)}
    </section>}
    {!locked && <Fragment key={snapshot.epoch}>{children}</Fragment>}
  </AcademicAccountContext.Provider>;
}
