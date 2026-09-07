"use client";

import Link from "next/link";
import PageShell from "@/components/PageShell";
import { useLanguage } from "@/lib/i18n/client";
import { planningTools } from "@/lib/navigation";

export default function Home() {
  const { t } = useLanguage();
  return (
    <PageShell title={t("home.title")}>
      <section
        aria-label={t("home.tools")}
        className="grid gap-4 md:grid-cols-2"
      >
        {planningTools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group flex items-center justify-between gap-6 rounded-xl bg-white p-6 transition hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {t(tool.label)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {t(tool.description)}
              </p>
            </div>
            <span
              aria-hidden="true"
              className="text-xl text-blue-700 dark:text-blue-300"
            >
              →
            </span>
          </Link>
        ))}
      </section>
    </PageShell>
  );
}
