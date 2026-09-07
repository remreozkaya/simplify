"use client";

import SmartSemesterPlanner from "@/components/semester-planner/SmartSemesterPlanner";
import PageShell from "@/components/PageShell";
import { useLanguage } from "@/lib/i18n/client";

export default function SemesterPlannerPage() {
  const { t } = useLanguage();
  return (
    <PageShell title={t("navigation.semesterPlanner")}>
      <SmartSemesterPlanner />
    </PageShell>
  );
}
