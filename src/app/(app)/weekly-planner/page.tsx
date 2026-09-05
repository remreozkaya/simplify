"use client";

import WeeklyCalendar from "@/components/calendar/WeeklyCalendar";
import { useLanguage } from "@/lib/i18n/client";

export default function WeeklyPlannerPage() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-blue-700">{t("page.buildWeek")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">
            {t("page.weeklyTitle")}
          </h1>
          <p className="mt-2 text-gray-600">{t("page.weeklyDescription")}</p>
        </header>
        <WeeklyCalendar view="planner" />
      </div>
    </main>
  );
}
