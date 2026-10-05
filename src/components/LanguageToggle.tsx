"use client";

import { useLanguage } from "@/lib/i18n/client";

export default function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <button
      type="button"
      onClick={() => setLanguage(language === "tr" ? "en" : "tr")}
      className="inline-grid size-9 sm:size-10 place-items-center rounded-xl border border-transparent bg-white text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-transparent dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-white"
      aria-label={t("language.switch")}
      title={t("language.switch")}
    >
      {language.toUpperCase()}
    </button>
  );
}
