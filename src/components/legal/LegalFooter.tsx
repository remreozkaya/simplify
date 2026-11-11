'use client';
import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/lib/i18n/client';
import { planningTools } from '@/lib/navigation';
import { legalCopy } from '@/lib/legal/copy';

export default function LegalFooter() {
  const { language, t } = useLanguage();
  const copy = legalCopy[language];
  const linkClass = 'block w-fit max-w-full py-2 text-sm leading-6 text-slate-700 hover:text-blue-700 dark:text-slate-200 dark:hover:text-blue-300';
  return <footer className="border-t border-slate-200 bg-white px-4 py-9 dark:border-slate-800 dark:bg-slate-950 sm:px-6 sm:py-12">
    <div className="mx-auto grid max-w-[1120px] grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1fr_1.5fr]">
      <div className="col-span-2 sm:col-span-1">
        <Link href="/" className="inline-flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white"><BrandMark />Simplify</Link>
      </div>
      <nav aria-label={t('footer.planning')}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('footer.planning')}</h2>
        {planningTools.map(tool => <Link className={linkClass} key={tool.href} href={tool.href}>{t(tool.label)}</Link>)}
      </nav>
      <nav aria-label={t('footer.workspace')}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('footer.workspace')}</h2>
        <Link className={linkClass} href="/">{t('home.title')}</Link>
        <Link className={linkClass} href="/profile">{t('navigation.viewProfile')}</Link>
      </nav>
      <nav aria-label={copy.settings} className="col-span-2 sm:col-span-1">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('footer.privacy')}</h2>
        {(['privacy', 'storage', 'terms', 'requests'] as const).map(key => <Link key={key} href={`/legal/${key}`} className={linkClass}>{copy.titles[key]}</Link>)}
      </nav>
    </div>
    <div className="mx-auto mt-8 border-t border-slate-200 pt-6 dark:border-slate-800 flex max-w-[1120px] flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
      <p>{t('footer.independent')}</p>
      <div className="flex items-center gap-2"><ThemeToggle /><LanguageToggle /></div>
    </div>
  </footer>;
}
