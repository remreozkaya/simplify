"use client";

import Link from "next/link";
import PlanningChecklist from "@/components/planning/PlanningChecklist";
import PageShell from "@/components/PageShell";
import { useProfile } from "@/components/profile/ProfileProvider";
import { useLanguage } from "@/lib/i18n/client";
import { localizedAcademicName } from "@/lib/i18n";
import { planningTools } from "@/lib/navigation";
import { isProfileComplete } from "@/lib/profile/types";
import { orderedEnrollments } from "@/lib/profile/validation";

function ToolIcon({ index }: { index: number }) {
  const paths = [
    "M4 5h16v15H4zM8 3v4M16 3v4M4 10h16M8 14h3M8 17h6",
    "M4 5h16v15H4zM4 10h16M9 10v10M14 10v10M4 15h16",
    "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6",
    "M12 3v6M5 15v6M19 15v6M5 15V9h14v6M9 3h6M2 21h6M16 21h6",
    "M6 3h12v18H6zM9 7h6M9 11h1M14 11h1M9 15h1M14 15h1",
  ];
  return <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[index]} /></svg>;
}

export default function Home() {
  const { language, t } = useLanguage();
  const { profile } = useProfile();
  const enrollments = orderedEnrollments(profile.programEnrollments);
  const complete = isProfileComplete(profile);
  return (
    <PageShell title={t("home.title")} home header={
      <header className="mx-auto max-w-3xl pb-12 pt-6 text-center sm:pb-16 sm:pt-12">
        <h1 className="text-4xl font-bold leading-[1.05] tracking-[-0.045em] text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
          {t("home.heroTitleLine1")}<br />{t("home.heroTitleLine2")}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-7 text-slate-600 dark:text-slate-300">{t("home.description")}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href={complete ? "/semester-planner" : "/profile"} className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">{t("home.startPlanning")} <span aria-hidden="true">→</span></Link>
          <Link href="/curriculum" className="rounded-lg bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700">{t("home.exploreCurriculum")}</Link>
        </div>
      </header>
    }>
      <section aria-labelledby="workspace-programs" className="mb-12 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="workspace-programs" className="font-semibold text-slate-950 dark:text-white">{t("home.yourPrograms")}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{t(complete ? "home.programsDescription" : "navigation.profileIncompleteDescription")}</p>
          </div>
          <Link href="/profile" className={`rounded-lg px-4 py-2 text-sm font-semibold ${complete ? "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" : "bg-blue-600 text-white hover:bg-blue-700"}`}>{t(complete ? "navigation.viewProfile" : "profile.complete")}</Link>
        </div>
        {enrollments.length ? <ul className="mt-4 grid gap-3 lg:grid-cols-3">
          {enrollments.map(enrollment => <li key={enrollment.id} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">{t(enrollment.type === "main" ? "academicPrograms.main" : enrollment.type === "double-major" ? "academicPrograms.doubleMajor" : "academicPrograms.minor")}</p>
            <p className="mt-1 break-words text-sm font-semibold text-slate-950 dark:text-white">{localizedAcademicName({name:enrollment.programName, nameTr:enrollment.programNameTr, nameEn:enrollment.programNameEn}, language)}</p>
            <p className="mt-1 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">{localizedAcademicName({name:enrollment.curriculumPlanName, nameTr:enrollment.curriculumPlanNameTr, nameEn:enrollment.curriculumPlanNameEn}, language)}</p>
            {enrollment.selectionRequiresReview ? <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">{t("academicPrograms.selectionReview")}</p> : null}
          </li>)}
        </ul> : null}
      </section>

      <PlanningChecklist />

      <section aria-labelledby="planning-tools">
        <h2 id="planning-tools" className="mb-5 text-2xl font-semibold text-slate-950 dark:text-white">{t("home.tools")}</h2>
        <div className="grid gap-x-10 md:grid-cols-2">
          {planningTools.map((tool, index) => <Link key={tool.href} href={tool.href} className="group flex items-start gap-4 border-t border-slate-200 py-7 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200"><ToolIcon index={index} /></span>
            <div className="min-w-0 flex-1"><h3 className="text-lg font-semibold text-slate-950 dark:text-white">{t(tool.label)}</h3></div>
            <span aria-hidden="true" className="mt-2 text-lg text-blue-700 dark:text-blue-300">→</span>
          </Link>)}
        </div>
      </section>
      <section className="mt-14 rounded-xl bg-slate-50 px-5 py-16 text-center dark:bg-slate-900 sm:py-20">
        <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">{t("home.closingTitle")}</h2>
        <Link href={complete ? "/semester-planner" : "/profile"} className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">{t("home.startPlanning")} <span aria-hidden="true">→</span></Link>
      </section>
    </PageShell>
  );
}
