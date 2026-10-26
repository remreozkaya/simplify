"use client";

import { localizeRuntimeMessage } from "@/lib/i18n";
import { useLanguage } from "@/lib/i18n/client";

export default function CurriculumWarnings({ warnings }: { warnings: readonly string[] }) {
  const { language } = useLanguage();
  if (!warnings.length) return null;
  return (
    <ul role="status" className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      {[...new Set(warnings)].map((warning) => <li key={warning}>{localizeRuntimeMessage(language, warning, { fallback: true })}</li>)}
    </ul>
  );
}
