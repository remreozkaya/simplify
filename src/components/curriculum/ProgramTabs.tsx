"use client";

import { localizedAcademicName } from "@/lib/i18n";
import { useLanguage } from "@/lib/i18n/client";
import type { ProgramEnrollment } from "@/lib/profile/types";
import type { KeyboardEvent } from "react";

function safeDomId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function programTabId(enrollmentId: string) {
  return `program-tab-${safeDomId(enrollmentId)}`;
}

export function programPanelId(enrollmentId: string) {
  return `program-panel-${safeDomId(enrollmentId)}`;
}

export default function ProgramTabs({
  enrollments,
  activeEnrollmentId,
  onSelect,
}: {
  enrollments: readonly ProgramEnrollment[];
  activeEnrollmentId: string;
  onSelect: (enrollmentId: string) => void;
}) {
  const { language, t } = useLanguage();
  const resolvedActiveId = enrollments.some((enrollment) => enrollment.id === activeEnrollmentId)
    ? activeEnrollmentId
    : enrollments[0]?.id ?? "";

  function selectFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % enrollments.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + enrollments.length) % enrollments.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = enrollments.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextId = enrollments[nextIndex]?.id;
    if (!nextId) return;
    onSelect(nextId);
    requestAnimationFrame(() => document.getElementById(programTabId(nextId))?.focus());
  }

  return (
    <div role="tablist" aria-label={t("academicPrograms.programViews")} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {enrollments.map((enrollment, index) => {
        const active = enrollment.id === resolvedActiveId;
        return (
          <button
            key={enrollment.id}
            type="button"
            role="tab"
            id={programTabId(enrollment.id)}
            aria-controls={programPanelId(enrollment.id)}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(enrollment.id)}
            onKeyDown={(event) => selectFromKeyboard(event, index)}
            className={`rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${active ? "border-blue-600 bg-blue-50 shadow-sm dark:bg-blue-950" : "border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900"}`}
          >
            <span className="text-[10px] font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
              {t(enrollment.type === "main" ? "academicPrograms.main" : enrollment.type === "double-major" ? "academicPrograms.doubleMajor" : "academicPrograms.minor")}
            </span>
            <span className="mt-1 block truncate text-sm font-black text-slate-900 dark:text-white">
              {localizedAcademicName({ name: enrollment.programName, nameTr: enrollment.programNameTr, nameEn: enrollment.programNameEn }, language)}
            </span>
            <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
              {localizedAcademicName({ name: enrollment.curriculumPlanName, nameTr: enrollment.curriculumPlanNameTr, nameEn: enrollment.curriculumPlanNameEn }, language)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
