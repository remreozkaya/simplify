"use client";

import { localizeRuntimeMessage } from "@/lib/i18n";
import { useLanguage } from "@/lib/i18n/client";

const PREREQUISITE_WARNING = /^(?:Prerequisite information is temporarily unavailable|Prerequisites for .+ could not be loaded|Some prerequisites for .+ could not be verified)\.$/u;

export function withoutPrerequisiteWarnings(warnings: readonly string[]) {
  return warnings.filter((warning) => !PREREQUISITE_WARNING.test(warning));
}

export default function CurriculumWarnings({
  warnings,
  hidePrerequisiteWarnings = false,
}: {
  warnings: readonly string[];
  hidePrerequisiteWarnings?: boolean;
}) {
  const { language } = useLanguage();
  const visibleWarnings = [...new Set(hidePrerequisiteWarnings ? withoutPrerequisiteWarnings(warnings) : warnings)];
  if (!visibleWarnings.length) return null;
  return (
    <ul role="status" className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      {visibleWarnings.map((warning) => <li key={warning}>{localizeRuntimeMessage(language, warning, { fallback: true })}</li>)}
    </ul>
  );
}
