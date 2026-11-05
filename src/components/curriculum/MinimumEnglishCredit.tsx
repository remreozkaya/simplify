"use client";

import { formatCredits } from "@/lib/i18n";
import { useLanguage } from "@/lib/i18n/client";

export function MinimumEnglishCredit({ credit }: { credit: number | null }) {
  const { t } = useLanguage();
  return (
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
      {t("graduationCalculator.minimumEnglishCredit")}: {formatCredits(credit)}
    </p>
  );
}
