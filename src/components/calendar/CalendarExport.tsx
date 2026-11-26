"use client";

import { useEffect, useRef, useState } from "react";

import {
  ITU_ACADEMIC_CALENDAR_URL,
  calendarTermDetails,
  resolveCalendarTerm,
  type CalendarDateRange,
  type CalendarExportSource,
} from "@/lib/calendar/academicCalendar";
import { CalendarExportError, downloadWeeklyCalendar } from "@/lib/calendar/exportIcs";
import { useLanguage } from "@/lib/i18n/client";
import type { WeeklyProgram } from "@/types/calendar";

const buttonClass = "rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50";

type Lookup<T> =
  | { kind: "loading" }
  | { kind: "ready"; value: T }
  | { kind: "failed"; code: "termUnavailable" | "loadError" };

function useCalendarLookup<T>(term: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ term: string; attempt: number; state: Lookup<T> }>();

  useEffect(() => {
    if (term === null) return;
    const controller = new AbortController();
    const query = term ? `?term=${encodeURIComponent(term)}` : "";

    void (async () => {
      let state: Lookup<T>;
      try {
        const response = await fetch(`/api/itu/academic-calendar${query}`, { signal: controller.signal });
        if (response.ok) {
          state = { kind: "ready", value: await response.json() as T };
        } else {
          state = { kind: "failed", code: response.status === 404 ? "termUnavailable" : "loadError" };
        }
      } catch {
        state = { kind: "failed", code: "loadError" };
      }
      if (!controller.signal.aborted) setResult({ term, attempt, state });
    })();

    return () => controller.abort();
  }, [term, attempt]);

  const state: Lookup<T> | null = term === null ? null
    : result?.term === term && result.attempt === attempt ? result.state
      : { kind: "loading" };
  return { state, retry: () => setAttempt(value => value + 1) };
}

function CalendarExportDialog({ plan, onClose }: { plan: WeeklyProgram; onClose: () => void }) {
  const { language, t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const resolution = resolveCalendarTerm(plan.courseBlocks);
  const knownTerm = resolution.kind === "known" || resolution.kind === "confirm" ? resolution.term : undefined;
  const [confirmedTerm, setConfirmedTerm] = useState("");
  const [downloadStatus, setDownloadStatus] = useState<{ message: string; error: boolean } | null>(null);
  const selectedTerm = (resolution.kind === "known" ? knownTerm : confirmedTerm) || null;
  const years = useCalendarLookup<{ years: string[] }>(resolution.kind === "confirm" && !knownTerm ? "" : null);
  const lookup = useCalendarLookup<CalendarExportSource>(selectedTerm);
  const ready = lookup.state?.kind === "ready" ? lookup.state.value : null;
  const failed = lookup.state?.kind === "failed" ? lookup : years.state?.kind === "failed" ? years : null;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const termLabel = (term: string) => {
    const details = calendarTermDetails(term);
    return details ? `${details.year} ${t(`weeklyPlanner.calendarExport.${details.season}`)}` : term;
  };
  const choices = knownTerm ? [knownTerm] : years.state?.kind === "ready"
    ? years.state.value.years.flatMap(year => [`${year.slice(-4)}10`, `${year.slice(-4)}20`])
    : [];
  const dateFormat = new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-US", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
  const rangeLabel = ({ start, end }: CalendarDateRange) => start === end
    ? dateFormat.format(new Date(start))
    : `${dateFormat.format(new Date(start))} – ${dateFormat.format(new Date(end))}`;

  function handleDownload() {
    if (!ready) return;
    try {
      const filename = downloadWeeklyCalendar(plan, ready.calendar, language);
      setDownloadStatus({ message: t("weeklyPlanner.downloaded", { filename }), error: false });
    } catch (error) {
      const code = error instanceof CalendarExportError ? error.code : "downloadError";
      setDownloadStatus({ message: t(`weeklyPlanner.calendarExport.${code}`), error: true });
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="calendar-export-title"
      onCancel={onClose}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-auto rounded-xl border border-gray-200 bg-white p-5 text-gray-700 shadow-xl backdrop:bg-black/30"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="calendar-export-title" className="text-lg font-semibold">
          {t("weeklyPlanner.calendarExport.action")}
        </h2>
        <button type="button" autoFocus aria-label={t("weeklyPlanner.calendarExport.close")} onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-lg text-xl hover:bg-gray-100 dark:hover:bg-gray-700">
          ×
        </button>
      </div>

      <div className="space-y-3 text-sm">
        {resolution.kind === "mixed" && <p role="alert">{t("weeklyPlanner.calendarExport.mixed")}</p>}
        {resolution.kind === "unsupported" && <p role="alert">{t("weeklyPlanner.calendarExport.unsupported")}</p>}

        {resolution.kind === "confirm" && choices.length > 0 && (
          <label className="block space-y-1">
            <span className="font-semibold">{t("weeklyPlanner.calendarExport.semester")}</span>
            <select
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
              value={confirmedTerm}
              onChange={event => {
                setDownloadStatus(null);
                setConfirmedTerm(event.target.value);
              }}
            >
              <option value="">{t("weeklyPlanner.calendarExport.selectSemester")}</option>
              {choices.map(term => <option key={term} value={term}>{termLabel(term)}</option>)}
            </select>
          </label>
        )}

        {(years.state?.kind === "loading" || lookup.state?.kind === "loading") && (
          <p role="status">{t("weeklyPlanner.calendarExport.loading")}</p>
        )}
        {failed?.state?.kind === "failed" && (
          <div role="alert" className="space-y-2">
            <p>{t(`weeklyPlanner.calendarExport.${failed.state.code}`, { semester: selectedTerm ? termLabel(selectedTerm) : "" })}</p>
            {failed.state.code === "loadError" && (
              <button type="button" className={buttonClass} onClick={failed.retry}>{t("weeklyPlanner.retry")}</button>
            )}
          </div>
        )}

        {ready && (
          <dl className="space-y-2 rounded-lg border border-gray-200 p-3">
            <div>
              <dt className="font-semibold">{t("weeklyPlanner.calendarExport.semester")}</dt>
              <dd>{termLabel(ready.calendar.term)}</dd>
            </div>
            <div>
              <dt className="font-semibold">{t("weeklyPlanner.calendarExport.teachingDates")}</dt>
              <dd>{rangeLabel(ready.calendar)}</dd>
            </div>
            <div>
              <dt className="font-semibold">{t("weeklyPlanner.calendarExport.breakDates")}</dt>
              <dd>{ready.calendar.breaks.length ? ready.calendar.breaks.map(rangeLabel).join(", ")
                : t("weeklyPlanner.calendarExport.noBreak")}</dd>
            </div>
          </dl>
        )}

        <a href={ready?.source ?? ITU_ACADEMIC_CALENDAR_URL} target="_blank" rel="noreferrer"
          className="inline-block font-medium text-blue-700 underline">
          {t("weeklyPlanner.calendarExport.source")}
        </a>
        {downloadStatus && <p role={downloadStatus.error ? "alert" : "status"}>{downloadStatus.message}</p>}

        <div className="flex justify-end">
          <button type="button" className={buttonClass} disabled={!ready} onClick={handleDownload}>
            {t("weeklyPlanner.calendarExport.download")}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default function CalendarExport({ plan }: { plan: WeeklyProgram | null }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonClass} aria-haspopup="dialog"
        disabled={!plan?.courseBlocks.length} onClick={() => setOpen(true)}>
        {t("weeklyPlanner.calendarExport.action")}
      </button>
      {open && plan && <CalendarExportDialog plan={plan} onClose={() => setOpen(false)} />}
    </>
  );
}
