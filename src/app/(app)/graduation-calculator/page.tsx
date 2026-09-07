"use client";

import GraduationCalculator from "@/components/curriculum/GraduationCalculator";
import PageShell from "@/components/PageShell";
import { useLanguage } from "@/lib/i18n/client";

export default function GraduationCalculatorPage() {
  const { t } = useLanguage();
  return (
    <PageShell title={t("navigation.graduationCalculator")}>
      <GraduationCalculator />
    </PageShell>
  );
}
