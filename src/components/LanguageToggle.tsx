"use client";

import { useLanguage } from "@/lib/i18n/client";

export default function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <button
      type="button"
      onClick={() => setLanguage(language === "tr" ? "en" : "tr")}
      className="ml-1 inline-grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      aria-label={t("language.switch")}
      title={t("language.switch")}
    >
      {language.toUpperCase()}
    </button>
  );
}
