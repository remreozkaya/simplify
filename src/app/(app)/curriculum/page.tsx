"use client";

import { Suspense } from "react";

import CurriculumExplorer from "@/components/curriculum/CurriculumExplorer";
import { useLanguage } from "@/lib/i18n/client";

export default function CurriculumPage() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-blue-700">{t("page.degreePlanning")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{t("page.curriculumTitle")}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">{t("page.curriculumDescription")}</p>
        </header>
        <Suspense fallback={<div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{t("page.loadingCurriculum")}</div>}>
          <CurriculumExplorer />
        </Suspense>
      </div>
    </main>
  );
}
