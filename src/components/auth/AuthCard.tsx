"use client";

import Link from "next/link";

import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { useLanguage } from "@/lib/i18n/client";

type AuthCardProps = {
  description?: React.ReactNode;
  titleKey: string;
  children: React.ReactNode;
};

export default function AuthCard({
  description,
  titleKey,
  children,
}: AuthCardProps) {
  const { t } = useLanguage();
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-100 px-4 py-10 sm:px-6 dark:bg-slate-950">
      <div className="relative w-full max-w-[440px]">
        <div className="mb-6 flex items-center justify-between px-1">
          <Link
            href="/login"
            className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-950 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:text-white"
            aria-label={t("authentication.home")}
          >
            <span className="grid size-9 place-items-center rounded-xl bg-blue-600 text-sm text-white shadow-sm shadow-blue-600/25">
              S
            </span>
            Simplify
          </Link>
          <div className="flex">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
          <header className="mb-7">
            <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
              {t(titleKey)}
            </h1>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {description}
              </p>
            ) : null}
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
