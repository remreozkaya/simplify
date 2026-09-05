"use client";

import { useEffect } from "react";
import { useLanguage } from "@/lib/i18n/client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLanguage();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 dark:bg-slate-950">
      <section className="max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900 dark:bg-slate-900">
        <h1 className="text-3xl font-black text-slate-950 dark:text-white">{t("errors.unexpectedTitle")}</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">{t("errors.unexpectedDescription")}</p>
        <button type="button" onClick={reset} className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white">{t("errors.tryAgain")}</button>
      </section>
    </main>
  );
}
