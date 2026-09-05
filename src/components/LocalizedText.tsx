"use client";

import { useLanguage } from "@/lib/i18n/client";

export default function LocalizedText({ translationKey, values }: { translationKey: string; values?: Record<string, string | number> }) {
  const { t } = useLanguage();
  return <>{t(translationKey, values)}</>;
}
