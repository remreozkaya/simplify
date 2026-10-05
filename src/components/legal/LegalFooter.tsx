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
  const linkClass = 'block py-1.5 text-sm text-slate-700 hover:text-blue-700 dark:text-slate-200 dark:hover:text-blue-300';
  return <footer className="border-t border-slate-200 bg-white px-4 py-12 dark:border-slate-800 dark:bg-slate-950 sm:px-6 sm:py-16">
    <div className="mx-auto grid max-w-[1120px] gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_0.8fr_1.2fr]">
      <div>
        <Link href="/" className="inline-flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white"><BrandMark />Simplify</Link>
      </div>
      <nav aria-label={t('footer.planning')}>
        <h2 className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">{t('footer.planning')}</h2>
        {planningTools.map(tool => <Link className={linkClass} key={tool.href} href={tool.href}>{t(tool.label)}</Link>)}
      </nav>
      <nav aria-label={t('footer.workspace')}>
        <h2 className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">{t('footer.workspace')}</h2>
        <Link className={linkClass} href="/">{t('home.title')}</Link>
        <Link className={linkClass} href="/profile">{t('navigation.viewProfile')}</Link>
      </nav>
      <nav aria-label={copy.settings}>
        <h2 className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400">{t('footer.privacy')}</h2>
        {(['privacy', 'storage', 'terms', 'requests'] as const).map(key => <Link key={key} href={`/legal/${key}`} className={linkClass}>{copy.titles[key]}</Link>)}
      </nav>
    </div>
    <div className="mx-auto mt-12 flex max-w-[1120px] flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
      <p>{t('footer.independent')}</p>
      <div className="flex items-center gap-2"><ThemeToggle /><LanguageToggle /></div>
    </div>
  </footer>;
}
