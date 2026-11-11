"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/client";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <main id="main-content" tabIndex={-1} className="grid min-h-[55svh] flex-1 place-items-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <section className="max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">404</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{t("errors.notFoundTitle")}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{t("errors.notFoundDescription")}</p>
        <Link href="/" className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">{t("errors.home")}</Link>
      </section>
    </main>
  );
}
