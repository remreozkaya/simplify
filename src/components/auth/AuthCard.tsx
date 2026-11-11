"use client";

import Link from "next/link";
import BrandMark from "@/components/BrandMark";

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
    <main id="main-content" tabIndex={-1} className="auth-shell relative grid flex-1 place-items-center bg-slate-50 px-4 py-10 sm:px-6 sm:py-16 dark:bg-slate-950">
      <div className="relative w-full max-w-[440px]">
        <div className="mb-6 flex items-center justify-between px-1">
          <Link
            href="/login"
            className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-950 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:text-white"
            aria-label={t("authentication.home")}
          >
            <BrandMark />
            Simplify
          </Link>
          <div className="flex">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
          <header className="mb-7">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl text-slate-950 dark:text-white">
              {t(titleKey)}
            </h1>
            {description ? (
              <p className="mt-3 break-words text-sm leading-6 text-slate-600 dark:text-slate-300">
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
