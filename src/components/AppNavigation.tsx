"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { planningTools } from "@/lib/navigation";
import { logoutAction } from "@/app/auth/actions";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import { useProfile } from "@/components/profile/ProfileProvider";
import {
  isProfileComplete,
  profileFullName,
  profileInitials,
} from "@/lib/profile/types";
import { orderedEnrollments } from "@/lib/profile/validation";
import { useLanguage } from "@/lib/i18n/client";
import { localizedAcademicName } from "@/lib/i18n";

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProfileControl() {
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const complete = isProfileComplete(profile);
  const initials = profileInitials(profile);
  const enrollments = orderedEnrollments(profile.programEnrollments);
  const { language, t } = useLanguage();
  const enrollmentLabel = (type: (typeof enrollments)[number]["type"]) =>
    t(
      type === "main"
        ? "academicPrograms.main"
        : type === "double-major"
          ? "academicPrograms.doubleMajor"
          : "academicPrograms.minor",
    );

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          triggerRef.current?.focus();
          setOpen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={t("navigation.profilePreview")}
        aria-controls={open ? "profile-preview" : undefined}
        aria-expanded={open}
        className="inline-grid size-9 sm:size-10 place-items-center rounded-xl border border-slate-200 bg-white font-black text-slate-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        {initials ? (
          <span className="text-xs" aria-hidden="true">
            {initials}
          </span>
        ) : (
          <UserIcon />
        )}
      </button>

      {open ? (
        <div
          id="profile-preview"
          role="region"
          aria-label={t("navigation.profilePreview")}
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {complete ? (
            <>
              <p className="font-black text-slate-950 dark:text-white">
                {profileFullName(profile)}
              </p>
              {profile.nickname ? (
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {profile.nickname}
                </p>
              ) : null}
              <div className="mt-3 space-y-2">
                {enrollments.map((enrollment) => (
                  <div key={enrollment.id} className="text-xs">
                    <span className="font-black text-blue-700 dark:text-blue-300">
                      {enrollmentLabel(enrollment.type)}
                    </span>
                    <span className="block truncate text-slate-600 dark:text-slate-300">
                      {localizedAcademicName(
                        {
                          name: enrollment.programName,
                          nameTr: enrollment.programNameTr,
                          nameEn: enrollment.programNameEn,
                        },
                        language,
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="font-black text-slate-950 dark:text-white">
                {t("navigation.profileIncomplete")}
              </p>
              <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                {t("navigation.profileIncompleteDescription")}
              </p>
            </>
          )}
          <Link
            href="/profile"
            className="mt-4 inline-flex text-sm font-black text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300"
          >
            {t("navigation.viewProfile")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function AppNavigation() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <nav
      className="app-navigation sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
      aria-label={t("navigation.primary")}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded focus:bg-white focus:p-3 focus:text-blue-700"
      >
        {t("navigation.skipContent")}
      </a>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-black tracking-tight text-slate-950 dark:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          <span className="grid size-8 place-items-center rounded-xl bg-blue-600 text-sm text-white shadow-sm">
            S
          </span>
          Simplify
        </Link>
        <div className="order-3 flex w-full flex-wrap gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:text-sm xl:order-none xl:w-auto xl:flex-1">
          {planningTools.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-lg px-3 py-2 transition ${active ? "bg-blue-600 text-white shadow-sm" : "hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white"}`}
              >
                {t(link.label)}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <LanguageToggle />
          <ProfileControl />
          <form
            action={logoutAction}
            className="ml-1 border-l border-slate-200 pl-2 dark:border-slate-700"
          >
            <button
              type="submit"
              title={t("navigation.logout")}
              className="rounded-xl px-2 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <span className="sr-only sm:not-sr-only">{t("navigation.logout")}</span>
              <svg className="size-5 sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M9 4H4v16h5M14 8l4 4-4 4M8 12h10" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
