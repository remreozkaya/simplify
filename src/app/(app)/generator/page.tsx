"use client";

import WeeklyCalendar from "@/components/calendar/WeeklyCalendar";
import PageShell from "@/components/PageShell";
import { useLanguage } from "@/lib/i18n/client";

export default function GeneratorPage() {
  const { t } = useLanguage();
  return (
    <PageShell title={t("navigation.scheduleGenerator")}>
      <WeeklyCalendar view="generator" />
    </PageShell>
  );
}
