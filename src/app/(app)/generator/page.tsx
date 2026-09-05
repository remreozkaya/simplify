"use client";

import WeeklyCalendar from "@/components/calendar/WeeklyCalendar";
import { useLanguage } from "@/lib/i18n/client";

export default function GeneratorPage() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-violet-700">{t("page.bestFit")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">{t("navigation.scheduleGenerator")}</h1>
          <p className="mt-2 max-w-2xl text-gray-600">{t("page.generatorDescription")}</p>
        </header>
        <WeeklyCalendar view="generator" />
      </div>
    </main>
  );
}
