"use client";

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { useProfile } from '@/components/profile/ProfileProvider';
import { CURRICULUM_PROGRESS_STORAGE_KEY } from '@/lib/curriculum/progress';
import { SHARED_TRANSCRIPT_STORAGE_KEY, SHARED_TRANSCRIPT_EVENT } from '@/lib/curriculum/transcriptStore';
import { useLanguage } from '@/lib/i18n/client';
import { getPlanningCompletion, type PlanningRecords } from '@/lib/planning/checklist';
import { GENERATOR_SESSION_STORAGE_KEY, PLANNING_PROGRESS_EVENT } from '@/lib/schedule/session';

const steps = [
  { href: '/profile', label: 'home.setup' },
  { href: '/graduation-calculator', label: 'home.import' },
  { href: '/semester-planner', label: 'navigation.semesterPlanner' },
  { href: '/generator', label: 'navigation.scheduleGenerator' },
  { href: '/weekly-planner', label: 'navigation.weeklyPlanner' },
];
const events = ['storage', 'focus', SHARED_TRANSCRIPT_EVENT, PLANNING_PROGRESS_EVENT];
function subscribe(callback: () => void) {
  events.forEach(event => window.addEventListener(event, callback));
  return () => events.forEach(event => window.removeEventListener(event, callback));
}
function snapshot() {
  const read = (key: string) => {
    try { return window.localStorage.getItem(key); } catch { return null; }
  };
  return JSON.stringify({
    transcript: read(SHARED_TRANSCRIPT_STORAGE_KEY),
    legacyProgress: read(CURRICULUM_PROGRESS_STORAGE_KEY),
    weeklyPrograms: read('simplify-weekly-programs'),
    generatorSession: read(GENERATOR_SESSION_STORAGE_KEY),
  } satisfies PlanningRecords);
}
const serverSnapshot = () => null;

type Translator = (key: string, parameters?: Record<string, string | number>) => string;

export function PlanningChecklistView({ completed, t }: { completed: boolean[]; t: Translator }) {
  const count = steps.filter((_, index) => completed[index]).length;
  if (count === steps.length) return null;
  const next = steps.findIndex((_, index) => !completed[index]);
  const progress = t('home.planningProgress', { completed: count, total: steps.length });
  return (
    <section aria-labelledby="planning-workflow" className="mb-14">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="planning-workflow" className="text-2xl font-semibold text-slate-950 dark:text-white">{t('home.workflow')}</h2>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300" aria-live="polite">{progress}</p>
      </div>
      <div role="progressbar" aria-label={t('home.workflow')} aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={count} aria-valuetext={progress} className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full rounded-full bg-blue-600 transition-[width] motion-reduce:transition-none dark:bg-blue-400" style={{ width: `${count / steps.length * 100}%` }} />
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {steps.map((step, index) => {
          const done = Boolean(completed[index]);
          const active = index === next;
          return <li key={step.href} className="min-w-0">
            <Link href={step.href} className={`group flex h-full flex-col rounded-xl border p-5 transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 ${active ? 'border-blue-300 bg-blue-50/60 hover:bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 dark:hover:bg-blue-950/40' : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800'}`}>
              <div className="mb-4 flex items-center justify-between gap-2">
                <span aria-hidden="true" className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${done ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : active ? 'bg-blue-600 text-white dark:bg-blue-500' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {done ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4"><path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" /></svg> : index + 1}
                </span>
                {done || active ? <span className={`text-xs font-medium ${done ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300'}`}>{t(done ? 'home.planningCompleted' : 'home.planningNext')}</span> : null}
              </div>
              <p className={`text-sm font-semibold ${done ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>{t(step.label)}</p>
              {active ? <span className="mt-auto pt-4 text-xs font-semibold text-blue-700 dark:text-blue-300">{t('home.planningContinue')} <span aria-hidden="true">→</span></span> : null}
            </Link>
          </li>;
        })}
      </ol>
    </section>
  );
}

export default function PlanningChecklist() {
  const { profile } = useProfile();
  const { t } = useLanguage();
  const stored = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  // Wait for browser records before showing progress to avoid a flash of incomplete tasks.
  if (stored === null) return null;
  return <PlanningChecklistView completed={getPlanningCompletion(profile, JSON.parse(stored) as PlanningRecords)} t={t} />;
}
