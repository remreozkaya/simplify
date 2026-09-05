"use client";

import SmartSemesterPlanner from "@/components/semester-planner/SmartSemesterPlanner";
import { useLanguage } from "@/lib/i18n/client";

export default function SemesterPlannerPage() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 dark:bg-slate-950 sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-blue-700 dark:text-blue-300">{t("page.smartPlanning")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">{t("navigation.semesterPlanner")}</h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">{t("page.semesterPlannerDescription")}</p>
        </header>
        <SmartSemesterPlanner />
      </div>
    </main>
  );
}
