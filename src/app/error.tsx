"use client";

import { useLanguage } from "@/lib/i18n/client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();
  return (
    <main id="main-content" tabIndex={-1} className="grid min-h-[55svh] flex-1 place-items-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <section className="max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900 dark:bg-slate-900">
        <h1 className="text-3xl font-semibold text-slate-950 dark:text-white">{t("errors.unexpectedTitle")}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{t("errors.unexpectedDescription")}</p>
        <button type="button" onClick={reset} className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">{t("errors.tryAgain")}</button>
      </section>
    </main>
  );
}
