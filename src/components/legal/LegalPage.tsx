'use client';
import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import PageShell from '@/components/PageShell';
import LanguageToggle from '@/components/LanguageToggle';
import ThemeToggle from '@/components/ThemeToggle';
import PrivacyControls from './PrivacyControls';
import { useLanguage } from '@/lib/i18n/client';
import { legalConfig, type LegalDocument } from '@/lib/legal/config';
import { legalCopy, legalSections } from '@/lib/legal/copy';
import { PLANNER_STORAGE_KEYS } from '@/lib/legal/browserStorage';

export default function LegalPage({ document, sourceDates }: { document: LegalDocument; sourceDates: { catalog: string; equivalences: string } }) {
  const { language } = useLanguage();
  const copy = legalCopy[language];
  const sections = legalSections(document, language);
  const tr = language === 'tr';
  const incomplete = !legalConfig.effectiveDate || !legalConfig.controllerName || !legalConfig.postalAddress || !legalConfig.privacyEmail || Object.values(legalConfig.reviews).some(review => !review);
  const cookieRows = [
    ['sb-<project-ref>-auth-token[.n]', copy.authProvider, tr ? 'Oturum erişim ve yenileme belirteçleri; büyük değerler parçalara ayrılabilir.' : 'Session access and refresh tokens; large values may be chunked.', tr ? 'SDK varsayılanı 400 gün; yenilemeyle uzayabilir. Beni hatırla kapalıysa tarayıcı oturumu.' : 'SDK default 400 days; refresh may extend it. Browser session when Remember me is off.'],
    ['sb-<project-ref>-auth-token-code-verifier / -flow-<id>-code-verifier / -flows-code-verifier[.n]', copy.authProvider, tr ? 'E-posta doğrulama ve kurtarma bağlantılarında PKCE akış doğrulaması ve bekleyen akış dizini.' : 'PKCE verification and pending-flow index for confirmation and recovery links.', tr ? 'Akış tamamlanınca kaldırılır; SDK varsayılan üst süresi 400 gün veya oturum ayarı. Akış zaman aşımı çerezin ömründen farklıdır.' : 'Removed when the flow completes; SDK default upper lifetime 400 days or session setting. Flow timeout differs from cookie lifetime.'],
    ['simplify-remember', tr ? 'Simplify / giriş tercihi' : 'Simplify / sign-in preference', tr ? 'Oturum çerezlerinin kalıcılık tercihi' : 'Session persistence preference', tr ? 'Seçiliyse 365 gün, değilse tarayıcı oturumu' : '365 days when selected, otherwise browser session'],
    ['simplify-password-recovery', tr ? 'Simplify / gerekli güvenlik' : 'Simplify / necessary security', tr ? 'Parola kurtarma oturumunu sınırlama' : 'Restrict password recovery session', tr ? '15 dakika' : '15 minutes'],
    ['simplify-verification-resend', tr ? 'Simplify / gerekli güvenlik' : 'Simplify / necessary security', tr ? 'Doğrulama e-postası yeniden gönderim sınırı' : 'Verification email resend throttle', tr ? '30 saniye' : '30 seconds'],
  ];
  const storageRows = PLANNER_STORAGE_KEYS.map((key, index) => [`localStorage: ${key}`, copy.firstParty, copy.storedPurposes[index], copy.noExpiry]);
  const rows = [...cookieRows.map(row => [`Cookie: ${row[0]}`, ...row.slice(1)]), ...storageRows];
  return <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-blue-700 focus:p-3 focus:text-white">{tr ? "İçeriğe geç" : "Skip to content"}</a>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
      <Link href="/" prefetch={false} className="flex items-center gap-3 font-semibold text-slate-950 dark:text-white"><BrandMark /> Simplify · {copy.home}</Link>
      <div className="flex gap-2"><ThemeToggle /><LanguageToggle /></div>
    </header>
    <PageShell title={copy.titles[document]}>
      <article className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-slate-200 bg-white p-4 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 sm:p-8">
        <p className="text-sm">{copy.version}: {legalConfig.version} · {copy.effective}: {legalConfig.effectiveDate ?? copy.draft}</p>
        {incomplete && <p role="note" className="rounded-xl border border-amber-300 p-3 text-sm leading-6 dark:border-amber-700">{copy.incomplete}</p>}
        {sections.map(section => <section key={section.title} className="space-y-3"><h2 className="text-lg font-bold">{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph} className="text-sm leading-7">{paragraph}</p>)}</section>)}
        {(document === 'privacy' || document === 'requests') && <section className="space-y-3">
          <h2 className="text-lg font-bold">{copy.controller}</h2>
          <dl className="space-y-2 break-words text-sm leading-6">
            {[[copy.controller, legalConfig.controllerName], [copy.address, legalConfig.postalAddress], [copy.email, legalConfig.privacyEmail], ['KEP', legalConfig.kepAddress]].map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd>{value ?? copy.missing}</dd></div>)}
          </dl>
          {document === 'requests' && (legalConfig.privacyEmail ? <><p className="text-sm leading-6">{copy.contact.emailHelp}</p><a href={`mailto:${legalConfig.privacyEmail}?subject=${encodeURIComponent(tr ? 'KVKK başvurusu' : 'KVKK privacy request')}`} className="inline-block font-semibold text-blue-700 underline dark:text-blue-300">{copy.contact.emailButton}</a></> : <p className="text-sm leading-6">{copy.contact.unavailable}</p>)}
        </section>}
        {document === 'privacy' && <>
          <section className="space-y-3"><h2 className="text-lg font-bold">{tr ? 'Sağlayıcılar ve yurt dışı erişim' : 'Providers and overseas access'}</h2>
            {[[tr ? 'Barındırma' : 'Hosting', legalConfig.hosting], [tr ? 'Kimlik doğrulama' : 'Authentication', legalConfig.authentication], [tr ? 'E-posta' : 'Email', legalConfig.email]] .map(([label, provider]) => {
              const item = provider as typeof legalConfig.hosting;
              return <p key={String(label)} className="text-sm leading-6">{String(label)}: {item.name ?? copy.missing} · {tr ? 'İşleme/erişim konumları' : 'Processing/access locations'}: {item.locations ?? copy.missing}</p>;
            })}
            <p className="text-sm leading-6">{legalConfig.transferDisclosure[language] ?? (tr ? 'Supabase projesinin bölgesi, alt işleyenleri ve yabancı destek erişimi; barındırma ve e-posta konumları henüz doğrulanmadı. Yurt dışı aktarımın gerçekleşip gerçekleşmediği ve varsa KVKK m.9 mekanizması yayın öncesi belirlenmelidir. Genel sağlayıcı koşulları veya toplu rıza bu incelemenin yerine geçmez.' : 'Supabase project region, subprocessors and foreign support access, and hosting/email locations are unverified. Before launch determine whether overseas transfer occurs and, if so, its KVKK Article 9 mechanism. Generic provider terms or blanket consent do not replace this assessment.')}</p>
          </section>
          <section className="space-y-3"><h2 className="text-lg font-bold">{tr ? 'Sunucu kayıtlarının saklanması' : 'Server record retention'}</h2>
            {(['account', 'logs', 'requests', 'backups'] as const).map((key, index) => <p key={key} className="text-sm leading-6">{(tr ? ['Hesap/profil', 'Teknik günlükler', 'Veri başvuruları', 'Yedekler'] : ['Account/profile', 'Technical logs', 'Privacy requests', 'Backups'])[index]}: {legalConfig.retention[key][language] ?? copy.missing}</p>)}
          </section>
        </>}
        {document === 'storage' && <>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm leading-6"><caption className="mb-3 text-left font-semibold">{tr ? 'Bu sürümde kullanılan depolama' : 'Storage used in this version'}</caption><thead><tr>{copy.storageHeaders.map(header => <th key={header} scope="col" className="border-b p-2 align-top">{header}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row[0]}>{row.map((cell, index) => index === 0 ? <th key={index} scope="row" className="max-w-xs break-words border-b p-2 align-top font-medium">{cell}</th> : <td key={index} className="border-b p-2 align-top">{cell}</td>)}</tr>)}</tbody></table></div>
          <PrivacyControls />
        </>}
        {document === 'terms' && <p className="text-sm leading-6">{tr ? 'Program seçici görüntüsü' : 'Program selector snapshot'}: {sourceDates.catalog} · {tr ? 'Denklik görüntüsü' : 'Equivalence snapshot'}: {sourceDates.equivalences}. <a href="https://obs.itu.edu.tr/public/DersPlan/" rel="noreferrer" className="text-blue-700 underline dark:text-blue-300">İTÜ OBS</a></p>}
        <nav className="flex flex-wrap gap-4 border-t border-slate-200 pt-4 text-sm dark:border-slate-700" aria-label={copy.settings}>{(['privacy', 'storage', 'terms', 'requests'] as const).filter(key => key !== document).map(key => <Link key={key} href={`/legal/${key}`} className="text-blue-700 underline dark:text-blue-300">{copy.titles[key]}</Link>)}</nav>
      </article>
    </PageShell>
  </>;
}
