"use client";

import type { ProgramMembership } from "@/lib/program-restrictions/eligibility";

import { recordPlanningMilestone } from "@/lib/planning/checklist";

import { getCoursesByFaculty } from "@/lib/calendar/catalog";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  LARGE_SEARCH_SPACE_THRESHOLD,
  MAX_GENERATED_SCHEDULES,
  calculateCombinationCount,
  generateSchedules,
} from "@/lib/schedule/generator";
import { calculateScheduleRating } from "@/lib/schedule/scoring";
import {
  GENERATOR_SESSION_STORAGE_KEY,
  parseGeneratorSession,
  persistGeneratorSession,
  type GeneratorSessionCourse,
} from "@/lib/schedule/session";
import { minutesToTime } from "@/lib/schedule/time";
import { scheduleGenerationContextKey } from "@/lib/schedule/context";
import { useLanguage } from "@/lib/i18n/client";
import {
  formatNumber,
  localizedWeekday,
  localizeRuntimeMessage,
} from "@/lib/i18n";
import { courseLanguageVariants } from "@/lib/itu/courseCode.mjs";
import type {
  GeneratedSchedule,
  GeneratorCourse,
  ScheduleConstraints,
} from "@/lib/schedule/types";
import { days, type Day, type FacultyOption } from "@/types/calendar";

type DesiredCourseRow = GeneratorSessionCourse;

type GeneratorStatus =
  "idle" | "ready" | "generating" | "success" | "no-results" | "error";

type ScheduleGeneratorPanelProps = {
  programMemberships: readonly ProgramMembership[];
  courseCatalog: FacultyOption[];
  isLoadingBranches: boolean;
  isBranchLoading: (branchCode: string) => boolean;
  loadBranch: (branchCode: string) => Promise<void>;
  catalogError: string | null;
  onRetryCatalog: () => void;
  onPreviewChange: (schedule: GeneratedSchedule | null) => void;
  onSave: (schedule: GeneratedSchedule) => string;
};

const selectClassName =
  "min-w-0 w-full truncate rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400";

const desiredCourseRowGridClassName =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,2.3fr)_minmax(0,2.3fr)_5rem] items-end gap-3";

const inputClassName =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const TIME_OPTIONS = Array.from({ length: 25 }, (_value, index) =>
  minutesToTime(8 * 60 + index * 30),
);

function ScheduleStarRating({ rating }: { rating: number }) {
  const { language, t } = useLanguage();
  const filledWidth = `${(rating / 5) * 100}%`;

  return (
    <span
      className="inline-flex items-center gap-2"
      aria-label={t("courses.stars", {
        rating: formatNumber(language, rating, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
      })}
    >
      <span className="relative inline-block text-lg leading-none tracking-wide">
        <span className="text-gray-300" aria-hidden="true">
          ★★★★★
        </span>
        <span
          className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-amber-400"
          style={{ width: filledWidth }}
          aria-hidden="true"
        >
          ★★★★★
        </span>
      </span>
      <span className="font-semibold text-gray-900">
        {formatNumber(language, rating, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}
        /5
      </span>
    </span>
  );
}

function createRowId(): string {
  return `desired-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveGeneratorCourses(
  rows: DesiredCourseRow[],
  courseCatalog: FacultyOption[],
): GeneratorCourse[] | null {
  const resolved: Array<GeneratorCourse | null> = rows.map((row) => {
    const course = getCoursesByFaculty(courseCatalog, row.branchCode).find(
      (candidate) => candidate.id === row.courseId,
    );

    return course
      ? {
          branchCode: row.branchCode,
          courseId: course.id,
          courseCode: course.code,
          courseTitle: course.title,
          sections: course.sections,
          pinnedSectionId: row.pinnedSectionId || undefined,
        }
      : null;
  });

  return resolved.every((course): course is GeneratorCourse => course !== null)
    ? resolved
    : null;
}

export default function ScheduleGeneratorPanel({
  programMemberships,
  courseCatalog,
  isLoadingBranches,
  isBranchLoading,
  loadBranch,
  catalogError,
  onRetryCatalog,
  onPreviewChange,
  onSave,
}: ScheduleGeneratorPanelProps) {
  const { language, t } = useLanguage();
  const [rows, setRows] = useState<DesiredCourseRow[]>([]);
  const [earliestStartTime, setEarliestStartTime] = useState("");
  const [latestEndTime, setLatestEndTime] = useState("");
  const [excludedDays, setExcludedDays] = useState<Day[]>([]);
  const [status, setStatus] = useState<GeneratorStatus>("idle");
  const [message, setMessage] = useState("");
  const [schedules, setSchedules] = useState<GeneratedSchedule[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [savedProgramId, setSavedProgramId] = useState("");
  const [plannerAlternatives, setPlannerAlternatives] = useState<string[]>([]);
  const generationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolvedCourses = useMemo(
    () => resolveGeneratorCourses(rows, courseCatalog),
    [rows, courseCatalog],
  );
  const isLoadingSelectedCourses = rows.some(
    (row) => row.branchCode && isBranchLoading(row.branchCode),
  );
  const isReady =
    rows.length > 0 &&
    resolvedCourses !== null &&
    !isLoadingBranches &&
    !isLoadingSelectedCourses;
  const combinationCount = resolvedCourses
    ? calculateCombinationCount(resolvedCourses)
    : 0;
  const generationContextKey = scheduleGenerationContextKey(resolvedCourses, programMemberships);
  const [resultContextKey, setResultContextKey] = useState(generationContextKey);
  const contextChanged = resultContextKey !== generationContextKey;
  const currentSchedule = contextChanged ? null : schedules[currentIndex] ?? null;
  const currentRating = currentSchedule
    ? calculateScheduleRating(currentSchedule, schedules[0])
    : 0;

  useEffect(() => {
    onPreviewChange(currentSchedule);
  }, [currentSchedule, onPreviewChange]);

  /* eslint-disable react-hooks/set-state-in-effect -- The generator session is
   * restored only after hydration so localStorage never affects server HTML. */
  useEffect(() => {
    try {
      const storedSession = localStorage.getItem(GENERATOR_SESSION_STORAGE_KEY);
      const session = storedSession
        ? parseGeneratorSession(JSON.parse(storedSession) as unknown)
        : null;

      if (session) {
        setRows(session.courses);
        setEarliestStartTime(session.earliestStartTime);
        setLatestEndTime(session.latestEndTime);
        setExcludedDays(session.excludedDays);
        setPlannerAlternatives(session.plannerAlternatives ?? []);
      }
    } catch {
      // Ignore malformed or unavailable browser storage.
    } finally {
      setHasLoadedSession(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hasLoadedSession) {
      return;
    }

    persistGeneratorSession({
      version: 2,
      courses: rows,
      earliestStartTime,
      latestEndTime,
      excludedDays,
      ...(plannerAlternatives.length
        ? { source: "semester-planner", plannerAlternatives }
        : {}),
    });
  }, [
    earliestStartTime,
    excludedDays,
    hasLoadedSession,
    latestEndTime,
    plannerAlternatives,
    rows,
  ]);

  useEffect(() => {
    if (!hasLoadedSession || isLoadingBranches) {
      return;
    }

    new Set(rows.map((row) => row.branchCode).filter(Boolean)).forEach(
      (branchCode) => {
        void loadBranch(branchCode);
      },
    );
  }, [hasLoadedSession, isLoadingBranches, loadBranch, rows]);

  useEffect(() => {
    if (!hasLoadedSession) return;
    /* eslint-disable react-hooks/set-state-in-effect -- Planner handoff rows
     * resolve after the matching branch catalog has loaded. */
    setRows((current) => {
      let changed = false;
      const next = current.map((row) => {
        if (!row.courseCode || !row.branchCode) return row;
        const courses = getCoursesByFaculty(courseCatalog, row.branchCode);
        const currentCourse = courses.find(
          (course) => course.id === row.courseId,
        );
        if (currentCourse?.code === row.courseCode) return row;
        const variants = new Set(courseLanguageVariants(row.courseCode));
        const resolved = courses.find((course) => variants.has(course.code));
        if (!resolved) return row;
        changed = true;
        return { ...row, courseId: resolved.id };
      });
      return changed ? next : current;
    });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [courseCatalog, hasLoadedSession]);

  useEffect(
    () => () => {
      if (generationTimer.current) {
        clearTimeout(generationTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!contextChanged) return;
    if (generationTimer.current) clearTimeout(generationTimer.current);
    /* eslint-disable react-hooks/set-state-in-effect -- Profile or catalog changes invalidate
     * recommendations only; saved weekly programs are managed separately. */
    setSchedules([]);
    setCurrentIndex(0);
    setTruncated(false);
    setSavedProgramId("");
    setMessage("");
    setStatus("idle");
    setResultContextKey(generationContextKey);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [generationContextKey, contextChanged]);

  function invalidateResults(nextStatus: GeneratorStatus = "idle") {
    if (generationTimer.current) clearTimeout(generationTimer.current);
    setSavedProgramId("");
    setSchedules([]);
    setCurrentIndex(0);
    setTruncated(false);
    setMessage("");
    setStatus(nextStatus);
  }

  function handleAddCourse() {
    setRows((current) => [
      ...current,
      {
        id: createRowId(),
        branchCode: "",
        courseId: "",
        pinnedSectionId: "",
      },
    ]);
    invalidateResults("idle");
  }

  function handleBranchChange(rowId: string, branchCode: string) {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              branchCode,
              courseId: "",
              courseCode: undefined,
              pinnedSectionId: "",
            }
          : row,
      ),
    );
    invalidateResults("idle");

    if (branchCode) {
      void loadBranch(branchCode);
    }
  }

  function handleCourseChange(rowId: string, courseId: string) {
    const row = rows.find((candidate) => candidate.id === rowId);
    const duplicate = rows.some(
      (candidate) =>
        candidate.id !== rowId &&
        candidate.branchCode === row?.branchCode &&
        candidate.courseId === courseId &&
        Boolean(courseId),
    );

    if (duplicate) {
      invalidateResults("error");
      setMessage(t("courses.alreadyAdded"));
      return;
    }

    setRows((current) =>
      current.map((candidate) =>
        candidate.id === rowId
          ? {
              ...candidate,
              courseId,
              courseCode: undefined,
              pinnedSectionId: "",
            }
          : candidate,
      ),
    );
    invalidateResults(courseId ? "ready" : "idle");
  }

  function handlePinnedSectionChange(rowId: string, pinnedSectionId: string) {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, pinnedSectionId } : row,
      ),
    );
    invalidateResults(isReady ? "ready" : "idle");
  }

  function handleRemoveCourse(rowId: string) {
    setRows((current) => current.filter((row) => row.id !== rowId));
    invalidateResults("idle");
  }

  function toggleExcludedDay(day: Day) {
    setExcludedDays((current) =>
      current.includes(day)
        ? current.filter((candidate) => candidate !== day)
        : [...current, day],
    );
    invalidateResults(isReady ? "ready" : "idle");
  }

  function handleGenerate() {
    if (!resolvedCourses || !isReady) {
      setStatus("error");
      setMessage(t("courses.selectComplete"));
      return;
    }

    const courseWithoutSections = resolvedCourses.find(
      (course) => course.sections.length === 0,
    );

    if (courseWithoutSections) {
      setStatus("error");
      setMessage(
        t("courses.noCrn", { code: courseWithoutSections.courseCode }),
      );
      return;
    }

    const constraints: ScheduleConstraints = {
      earliestStartTime: earliestStartTime || undefined,
      latestEndTime: latestEndTime || undefined,
      excludedDays,
    };

    if (
      earliestStartTime &&
      latestEndTime &&
      earliestStartTime > latestEndTime
    ) {
      setStatus("error");
      setMessage(t("courses.invalidTime"));
      return;
    }

    setStatus("generating");
    setMessage(t("courses.generating"));
    setSchedules([]);
    setCurrentIndex(0);

    generationTimer.current = setTimeout(() => {
      try {
        const result = generateSchedules(resolvedCourses, {
          constraints,
          programMemberships,
          maxResults: MAX_GENERATED_SCHEDULES,
        });

        setSchedules(result.schedules);
        setTruncated(result.truncated);
        setCurrentIndex(0);

        if (result.schedules.length === 0) {
          setStatus("no-results");
          setMessage(
            result.restrictionBlockedCourses?.length
              ? t("courses.restrictionNoSchedule", { courses: result.restrictionBlockedCourses.join(", ") })
              : result.searchLimitReached
              ? t("courses.searchLimit")
              : t("courses.noSchedule"),
          );
        } else {
          recordPlanningMilestone("generator");
          setStatus("success");
          setMessage(
            result.truncated
              ? t("courses.truncated", { limit: MAX_GENERATED_SCHEDULES })
              : t("courses.found", { count: result.schedules.length }),
          );
        }
      } catch (error: unknown) {
        setStatus("error");
        setMessage(
          error instanceof Error ? error.message : t("courses.generationError"),
        );
      }
    }, 0);
  }

  function handleResultKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft" && currentIndex > 0) {
      event.preventDefault();
      setCurrentIndex((index) => index - 1);
    }

    if (event.key === "ArrowRight" && currentIndex < schedules.length - 1) {
      event.preventDefault();
      setCurrentIndex((index) => index + 1);
    }
  }

  const visibleStatus: GeneratorStatus = contextChanged
    ? "idle"
    : isLoadingBranches
    ? "idle"
    : isLoadingSelectedCourses
      ? "idle"
      : status === "idle" && isReady
        ? "ready"
        : status;

  return (
    <section
      id="schedule-generator"
      className="w-full scroll-mt-24 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("common.courses")}
          </h2>
        </div>

        <button
          type="button"
          onClick={handleAddCourse}
          disabled={isLoadingBranches}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {t("courses.addCourse")}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 px-4 py-5 text-center text-sm text-gray-500">
          {t("courses.emptyDesired")}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[640px] space-y-2">
            <div className={`${desiredCourseRowGridClassName} text-sm font-medium text-slate-700`}>
              <span>{t("courses.prefix")}</span>
              <span>{t("courses.desired")}</span>
              <span>{t("courses.pinnedCrn")}</span>
              <span aria-hidden="true" />
            </div>
            {rows.map((row) => {
              const branchIsLoading = isBranchLoading(row.branchCode);
              const courses = getCoursesByFaculty(courseCatalog, row.branchCode);
              const selectedCourse = courses.find(
                (course) => course.id === row.courseId,
              );

              return (
                <div
                  key={row.id}
                  className={`${desiredCourseRowGridClassName} border-b border-slate-200 py-4`}
                >
                  <label className="min-w-0">
                    <span className="sr-only">
                      {t("courses.prefix")}
                    </span>
                    <select
                      aria-label={t("courses.prefix")}
                      value={row.branchCode}
                      onChange={(event) =>
                        handleBranchChange(row.id, event.target.value)
                      }
                      disabled={isLoadingBranches}
                      className={selectClassName}
                    >
                      <option value="">
                        {t(
                          isLoadingBranches
                            ? "courses.loadingPrefixes"
                            : "courses.prefix",
                        )}
                      </option>
                      {courseCatalog.map((branch) => (
                        <option
                          key={branch.facultyCode}
                          value={branch.facultyCode}
                        >
                          {branch.facultyCode}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="min-w-0">
                    <span className="sr-only">
                      {t("courses.desired")}
                    </span>
                    <select
                      aria-label={t("courses.desired")}
                      value={row.courseId}
                      onChange={(event) =>
                        handleCourseChange(row.id, event.target.value)
                      }
                      disabled={!row.branchCode || branchIsLoading}
                      className={selectClassName}
                    >
                      <option value="">
                        {t(
                          branchIsLoading
                            ? "courses.loadingCourses"
                            : "courses.codeAndName",
                        )}
                      </option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.code} - {course.title} ({course.sections.length}{" "}
                          CRN)
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="min-w-0">
                    <span className="sr-only">
                      {t("courses.pinnedCrn")}
                    </span>
                    <select
                      aria-label={t("courses.pinnedCrn")}
                      value={row.pinnedSectionId}
                      onChange={(event) =>
                        handlePinnedSectionChange(row.id, event.target.value)
                      }
                      disabled={!selectedCourse || branchIsLoading}
                      className={selectClassName}
                    >
                      <option value="">{t("courses.anyCrn")}</option>
                      {selectedCourse?.sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {t("courses.pin")} {section.crn} ·{" "}
                          {section.meetings
                            .map(
                              (meeting) =>
                                `${localizedWeekday(language, meeting.day, "short")} ${meeting.startTime}–${meeting.endTime}`,
                            )
                            .join(", ")}
                          {section.instructor ? ` · ${section.instructor}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleRemoveCourse(row.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-100"
                  >
                    {t("common.remove")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <fieldset className="mt-5 border-t border-gray-200 pt-4">
        <legend className="px-1 text-sm font-semibold text-gray-800">
          {t("courses.preferences")}
        </legend>

        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            {t("courses.earliest")}
            <select
              value={earliestStartTime}
              onChange={(event) => {
                setEarliestStartTime(event.target.value);
                invalidateResults(isReady ? "ready" : "idle");
              }}
              className={`mt-1 w-full ${inputClassName}`}
            >
              <option value="">{t("courses.noEarliest")}</option>
              {TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            {t("courses.latest")}
            <select
              value={latestEndTime}
              onChange={(event) => {
                setLatestEndTime(event.target.value);
                invalidateResults(isReady ? "ready" : "idle");
              }}
              className={`mt-1 w-full ${inputClassName}`}
            >
              <option value="">{t("courses.noLatest")}</option>
              {TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4">
          <span className="text-sm font-medium text-gray-700">
            {t("courses.keepDaysFree")}
          </span>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {days.map((day) => (
              <label
                key={day}
                className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700"
              >
                <input
                  type="checkbox"
                  checked={excludedDays.includes(day)}
                  onChange={() => toggleExcludedDay(day)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {localizedWeekday(language, day)}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {combinationCount >= LARGE_SEARCH_SPACE_THRESHOLD && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t("courses.largeSearch", {
            count: formatNumber(language, combinationCount),
            limit: MAX_GENERATED_SCHEDULES,
          })}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={
            !isReady || status === "generating" || Boolean(catalogError)
          }
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t(
            status === "generating"
              ? "courses.generating"
              : "courses.generateSchedules",
          )}
        </button>

        <div
          className={`text-sm ${
            catalogError || status === "error" || status === "no-results"
              ? "text-red-700"
              : status === "success"
                ? "font-medium text-green-700"
                : "text-gray-500"
          }`}
          aria-live="polite"
          role={catalogError || status === "error" ? "alert" : "status"}
        >
          {isLoadingBranches
            ? t("courses.loadingCourses")
            : isLoadingSelectedCourses
              ? t("courses.loadingSelected")
              : catalogError
                ? localizeRuntimeMessage(language, catalogError, { fallback: true })
                : contextChanged
                  ? ""
                  : localizeRuntimeMessage(language, message)}
        </div>
        {catalogError && (
          <button
            type="button"
            onClick={onRetryCatalog}
            disabled={isLoadingBranches || isLoadingSelectedCourses}
            title={t("weeklyPlanner.retry")}
            aria-label={t("weeklyPlanner.retry")}
            className="rounded-md border border-red-700 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("weeklyPlanner.retry")}
          </button>
        )}
      </div>

      {visibleStatus === "no-results" && plannerAlternatives.length > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{t("courses.plannerReplacements")}</p>
          <p className="mt-2 font-semibold">
            {plannerAlternatives.join(" · ")}
          </p>
          <Link
            href="/semester-planner"
            className="mt-3 inline-flex rounded-lg bg-amber-700 px-3 py-2 font-semibold text-white"
          >
            {t("courses.returnToPlanner")}
          </Link>
        </div>
      ) : null}

      {currentSchedule && (
        <div
          className="mt-5 rounded-xl border border-blue-200 bg-blue-50/40 p-4 outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          tabIndex={0}
          onKeyDown={handleResultKeyDown}
          aria-label={t("courses.resultsLabel")}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentIndex((index) => index - 1)}
              disabled={currentIndex === 0}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← {t("courses.previous")}
            </button>

            <div className="text-sm font-semibold text-gray-800">
              {t("courses.schedule", {
                current: currentIndex + 1,
                total: schedules.length,
              })}
              {truncated ? "+" : ""}
            </div>

            <button
              type="button"
              onClick={() => setCurrentIndex((index) => index + 1)}
              disabled={currentIndex === schedules.length - 1}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("courses.next")} →
            </button>
          </div>

          {Boolean(currentSchedule.unknownRestrictionCount) && (
            <p className="mt-3 text-sm text-amber-900">
              {t("courses.unknownProgramRestrictions", { count: currentSchedule.unknownRestrictionCount ?? 0 })}
            </p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <div>
              <dt className="text-gray-500">{t("courses.rating")}</dt>
              <dd className="mt-1">
                <ScheduleStarRating rating={currentRating} />
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">{t("courses.campusDays")}</dt>
              <dd className="font-semibold text-gray-900">
                {currentSchedule.metrics.campusDays}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">{t("courses.totalGaps")}</dt>
              <dd className="font-semibold text-gray-900">
                {formatNumber(
                  language,
                  currentSchedule.metrics.totalGapMinutes,
                )}{" "}
                {t("courses.minute")}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">{t("courses.earliestShort")}</dt>
              <dd className="font-semibold text-gray-900">
                {minutesToTime(currentSchedule.metrics.earliestStartMinutes)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">{t("courses.latestShort")}</dt>
              <dd className="font-semibold text-gray-900">
                {minutesToTime(currentSchedule.metrics.latestEndMinutes)}
              </dd>
            </div>
          </dl>

          {savedProgramId ? (
            <p
              role="status"
              className="mt-4 text-sm text-emerald-700 dark:text-emerald-300"
            >
              {t("courses.savedWeekly")}{" "}
              <Link
                href={`/weekly-planner?program=${encodeURIComponent(savedProgramId)}`}
                className="font-semibold underline"
              >
                {t("courses.openWeekly")}
              </Link>
            </p>
          ) : null}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setSavedProgramId(onSave(currentSchedule))}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              {t("courses.saveWeekly")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
