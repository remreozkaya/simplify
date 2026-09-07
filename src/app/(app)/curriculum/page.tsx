"use client";

import { Suspense } from "react";

import CurriculumExplorer from "@/components/curriculum/CurriculumExplorer";
import PageShell from "@/components/PageShell";
import { useLanguage } from "@/lib/i18n/client";

export default function CurriculumPage() {
  const { t } = useLanguage();
  return (
    <PageShell title={t("page.curriculumTitle")}>
      <Suspense fallback={<p role="status">{t("page.loadingCurriculum")}</p>}>
        <CurriculumExplorer />
      </Suspense>
    </PageShell>
  );
}
