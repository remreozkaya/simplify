'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/client';
import { legalCopy } from '@/lib/legal/copy';
import { clearPlannerStorage, downloadPrivacyData, exportPlannerStorage } from '@/lib/legal/browserStorage';
import { deleteAccountAction, exportAccountAction } from '@/app/privacy/actions';

const button = 'rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800';
export default function PrivacyControls({ account = false, deletionAvailable = false }: { account?: boolean; deletionAvailable?: boolean }) {
  const { language } = useLanguage();
  const router = useRouter();
  const copy = legalCopy[language].controls;
  const [message, setMessage] = useState<keyof typeof copy | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  function exportLocal() {
    try {
      downloadPrivacyData({ exportedAt: new Date().toISOString(), scope: 'this-browser', storage: exportPlannerStorage(localStorage) }, 'simplify-browser-data.json');
      setMessage('success');
    } catch { setMessage('error'); }
  }
  function clearLocal() {
    if (!window.confirm(copy.clearConfirm)) return;
    try { clearPlannerStorage(localStorage); window.location.reload(); } catch { setMessage('error'); }
  }
  async function exportAccount() {
    setBusy(true);
    try {
      const result = await exportAccountAction();
      if (result.status === 'success') {
        downloadPrivacyData({ exportedAt: new Date().toISOString(), scope: 'account-profile', account: result.account }, 'simplify-account-data.json');
        setMessage('success');
      } else { setMessage(result.status); }
    } catch { setMessage('error'); }
    finally { setBusy(false); }
  }
  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await deleteAccountAction({ password, confirm: confirmed });
      setPassword('');
      if (result.status === 'success') {
        try { clearPlannerStorage(localStorage); router.replace('/login'); router.refresh(); }
        catch { setMessage('localFailed'); }
      } else { setMessage(result.status); }
    } catch { setMessage('error'); }
    finally { setBusy(false); }
  }
  return <section id="privacy-controls" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 sm:p-6">
    <h2 className="text-xl font-bold">{copy.title}</h2>
    <h3 className="font-semibold">{copy.local}</h3>
    <p className="max-w-3xl text-sm leading-6">{copy.localHelp}</p>
    <div className="flex flex-wrap gap-3"><button type="button" className={button} onClick={exportLocal} disabled={busy}>{copy.exportLocal}</button><button type="button" className={button} onClick={clearLocal} disabled={busy}>{copy.clear}</button></div>
    {account && <>
      <h3 className="pt-3 font-semibold">{copy.account}</h3>
      <p className="max-w-3xl text-sm leading-6">{copy.accountHelp}</p>
      <button type="button" className={button} onClick={exportAccount} disabled={busy}>{copy.exportAccount}</button>
      <p className="max-w-3xl text-sm leading-6">{copy.deletionHelp}</p>
      {deletionAvailable ? <form noValidate onSubmit={deleteAccount} className="max-w-lg space-y-3">
        <label className="block text-sm font-semibold" htmlFor="privacy-password">{copy.password}</label>
        <input id="privacy-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required maxLength={1024} className="w-full rounded-xl border border-slate-300 bg-transparent p-3 dark:border-slate-600" />
        <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required className="mt-1 size-4" />{copy.confirmation}</label>
        <button type="submit" disabled={busy || !password || !confirmed} className={`${button} border-red-300 text-red-700 dark:text-red-300`}>{busy ? copy.busy : copy.delete}</button>
      </form> : <p className="text-sm">{copy.unavailable}</p>}
    </>}
    {message && <p role="status" aria-live="polite" className="text-sm font-semibold">{copy[message]}</p>}
    <Link href="/legal/requests" className="inline-block text-sm font-semibold text-blue-700 underline dark:text-blue-300">{legalCopy[language].titles.requests}</Link>
  </section>;
}
