'use client';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/client';
import { legalCopy } from '@/lib/legal/copy';

export default function CollectionNotice({ kind }: { kind: 'account' }) {
  const { language } = useLanguage();
  const copy = legalCopy[language];
  const content = <>
    <p>{copy.notices[kind]}</p>
    <Link href="/legal/privacy" className="font-medium text-blue-700 underline dark:text-blue-300">{copy.noticeLink}</Link>
    {' · '}<Link href="/legal/storage" className="font-medium text-blue-700 underline dark:text-blue-300">{copy.storageLink}</Link>
  </>;
  return <aside className="my-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{content}</aside>;
}
