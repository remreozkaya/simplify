"use client";

import Link from "next/link";
import PageShell from "@/components/PageShell";
import { useProfile } from "@/components/profile/ProfileProvider";
import { useLanguage } from "@/lib/i18n/client";
import { localizedAcademicName } from "@/lib/i18n";
import { planningTools } from "@/lib/navigation";
import { isProfileComplete } from "@/lib/profile/types";
import { orderedEnrollments } from "@/lib/profile/validation";

const workflow = [
  { href: "/profile", label: "home.setup", description: "home.setupDescription" },
  { href: "/graduation-calculator", label: "home.import", description: "home.importDescription" },
  { href: "/semester-planner", label: "navigation.semesterPlanner", description: "home.semesterDescription" },
  { href: "/generator", label: "navigation.scheduleGenerator", description: "home.generatorDescription" },
  { href: "/weekly-planner", label: "navigation.weeklyPlanner", description: "home.plannerDescription" },
];

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
    <PageShell title={t("home.title")} description={t("home.description")}>
      <section aria-labelledby="workspace-programs" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
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

      <section aria-labelledby="planning-workflow" className="mb-8">
        <h2 id="planning-workflow" className="mb-3 text-base font-semibold text-slate-950 dark:text-white">{t("home.workflow")}</h2>
        <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {workflow.map((step, index) => <li key={step.href} className="min-w-0"><Link href={step.href} className="flex h-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-400 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500 dark:hover:bg-slate-800">
            <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">{index + 1}</span>
            <div><p className="text-sm font-semibold text-slate-900 dark:text-white">{t(step.label)}</p><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{t(step.description)}</p></div>
          </Link></li>)}
        </ol>
      </section>

      <section aria-labelledby="planning-tools">
        <h2 id="planning-tools" className="mb-3 text-base font-semibold text-slate-950 dark:text-white">{t("home.tools")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {planningTools.map((tool, index) => <Link key={tool.href} href={tool.href} className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500 dark:hover:bg-slate-800 sm:p-6">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><ToolIcon index={index} /></span>
            <div className="min-w-0 flex-1"><h3 className="text-base font-semibold text-slate-950 dark:text-white">{t(tool.label)}</h3><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{t(tool.description)}</p></div>
            <span aria-hidden="true" className="mt-2 text-lg text-blue-700 dark:text-blue-300">→</span>
          </Link>)}
        </div>
      </section>
      <p className="mt-6 text-xs leading-5 text-slate-500 dark:text-slate-400">{t("home.localWorkspace")}</p>
    </PageShell>
  );
}
