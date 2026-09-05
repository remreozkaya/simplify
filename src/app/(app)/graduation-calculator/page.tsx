"use client";

import GraduationCalculator from "@/components/curriculum/GraduationCalculator";
import { useLanguage } from "@/lib/i18n/client";

export default function GraduationCalculatorPage() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-blue-700">{t("page.degreeProgress")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{t("navigation.graduationCalculator")}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">{t("page.graduationDescription")}</p>
        </header>
        <GraduationCalculator />
      </div>
    </main>
  );
}
