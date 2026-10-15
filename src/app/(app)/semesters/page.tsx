"use client";

import PageShell from "@/components/PageShell";
import MySemesters from "@/components/semesters/MySemesters";
import { useLanguage } from "@/lib/i18n/client";

export default function SemestersPage() {
  const { t } = useLanguage();
  return (
    <PageShell title={t("navigation.semesters")}>
      <MySemesters />
    </PageShell>
  );
}
