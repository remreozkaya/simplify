"use client";

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
  type GeneratorSessionCourse,
} from "@/lib/schedule/session";
import { minutesToTime } from "@/lib/schedule/time";
import type {
  GeneratedSchedule,
  GeneratorCourse,
  ScheduleConstraints,
} from "@/lib/schedule/types";
import {
  days,
  type CourseOption,
  type Day,
  type FacultyOption,
} from "@/types/calendar";

type DesiredCourseRow = GeneratorSessionCourse;

type GeneratorStatus =
  | "idle"
  | "ready"
  | "generating"
  | "success"
  | "fallback"
  | "no-results"
  | "error";

type ScheduleGeneratorPanelProps = {
  courseCatalog: FacultyOption[];
  isLoadingBranches: boolean;
  isBranchLoading: (branchCode: string) => boolean;
  loadBranch: (branchCode: string) => Promise<void>;
  catalogError: string | null;
  onPreviewChange: (schedule: GeneratedSchedule | null) => void;
  onSave: (schedule: GeneratedSchedule) => void;
};

const selectClassName =
  "min-w-0 w-full truncate rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400";

const inputClassName =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const TIME_OPTIONS = Array.from({ length: 25 }, (_value, index) =>
  minutesToTime(8 * 60 + index * 30),
);

function ScheduleStarRating({ rating }: { rating: number }) {
  const filledWidth = `${(rating / 5) * 100}%`;

  return (
    <span
      className="inline-flex items-center gap-2"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
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
        {rating.toFixed(1)}/5
      </span>
    </span>
  );
}

function createRowId(): string {
  return `desired-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function coursesForBranch(
  courseCatalog: FacultyOption[],
  branchCode: string,
): CourseOption[] {
  return (
    courseCatalog.find((branch) => branch.facultyCode === branchCode)
      ?.courses ?? []
  );
}

function resolveGeneratorCourses(
  rows: DesiredCourseRow[],
  courseCatalog: FacultyOption[],
): GeneratorCourse[] | null {
  const resolved: Array<GeneratorCourse | null> = rows.map((row) => {
    const course = coursesForBranch(courseCatalog, row.branchCode).find(
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

  return resolved.every(
    (course): course is GeneratorCourse => course !== null,
  )
    ? resolved
    : null;
}

export default function ScheduleGeneratorPanel({
  courseCatalog,
  isLoadingBranches,
  isBranchLoading,
  loadBranch,
  catalogError,
  onPreviewChange,
  onSave,
}: ScheduleGeneratorPanelProps) {
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
  const currentSchedule = schedules[currentIndex] ?? null;
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
      const storedSession = localStorage.getItem(
        GENERATOR_SESSION_STORAGE_KEY,
      );
      const session = storedSession
        ? parseGeneratorSession(JSON.parse(storedSession) as unknown)
        : null;

      if (session) {
        setRows(session.courses);
        setEarliestStartTime(session.earliestStartTime);
        setLatestEndTime(session.latestEndTime);
        setExcludedDays(session.excludedDays);
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

    try {
      localStorage.setItem(
        GENERATOR_SESSION_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          courses: rows,
          earliestStartTime,
          latestEndTime,
          excludedDays,
        }),
      );
    } catch {
      // Generation remains usable when storage is blocked or full.
    }
  }, [
    earliestStartTime,
    excludedDays,
    hasLoadedSession,
    latestEndTime,
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

  useEffect(
    () => () => {
      if (generationTimer.current) {
        clearTimeout(generationTimer.current);
      }
    },
    [],
  );

  function invalidateResults(nextStatus: GeneratorStatus = "idle") {
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
          ? { ...row, branchCode, courseId: "", pinnedSectionId: "" }
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
      setMessage("That course is already in your desired course list.");
      return;
    }

    setRows((current) =>
      current.map((candidate) =>
        candidate.id === rowId
          ? { ...candidate, courseId, pinnedSectionId: "" }
          : candidate,
      ),
    );
    invalidateResults(courseId ? "ready" : "idle");
  }

  function handlePinnedSectionChange(
    rowId: string,
    pinnedSectionId: string,
  ) {
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
      setMessage("Select at least one complete course before generating.");
      return;
    }

    const courseWithoutSections = resolvedCourses.find(
      (course) => course.sections.length === 0,
    );

    if (courseWithoutSections) {
      setStatus("error");
      setMessage(`${courseWithoutSections.courseCode} has no valid CRNs.`);
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
      setMessage("Earliest class time must be before latest class time.");
      return;
    }

    setStatus("generating");
    setMessage("Generating conflict-free schedules…");
    setSchedules([]);
    setCurrentIndex(0);

    generationTimer.current = setTimeout(() => {
      try {
        const result = generateSchedules(resolvedCourses, {
          constraints,
          maxResults: MAX_GENERATED_SCHEDULES,
        });

        setSchedules(result.schedules);
        setTruncated(result.truncated);
        setCurrentIndex(0);

        if (result.schedules.length === 0) {
          setStatus("no-results");
          setMessage(
            result.searchLimitReached
              ? "No schedule was found before the safe search limit was reached. Try fewer courses or stricter preferences."
              : "No schedule satisfies the selected hard constraints.",
          );
        } else if (result.usedConflictFallback) {
          const minimumConflicts = result.schedules[0].conflictCount;
          setStatus("fallback");
          setMessage(
            `No conflict-free schedule exists. Showing ${
              result.schedules.length
            } schedule${result.schedules.length === 1 ? "" : "s"} with the minimum of ${
              minimumConflicts
            } overlapping meeting pair${minimumConflicts === 1 ? "" : "s"}${
              result.searchLimitReached ? " found within the safe search limit" : ""
            }.`,
          );
        } else {
          setStatus("success");
          setMessage(
            result.truncated
              ? `More than ${MAX_GENERATED_SCHEDULES} valid schedules exist. Showing the best ${MAX_GENERATED_SCHEDULES} found.`
              : `${result.schedules.length} valid schedule${
                  result.schedules.length === 1 ? "" : "s"
                } found.`,
          );
        }
      } catch (error: unknown) {
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Schedules could not be generated.",
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

  const visibleStatus: GeneratorStatus = isLoadingBranches
    ? "idle"
    : isLoadingSelectedCourses
      ? "idle"
      : status === "idle" && isReady
        ? "ready"
        : status;

  return (
    <section id="schedule-generator" className="w-full scroll-mt-24 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Generate Schedule
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose courses; Simplify will select and rank conflict-free CRNs.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Your latest generator session is saved automatically in this browser.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAddCourse}
          disabled={isLoadingBranches}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          Add Course
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 px-4 py-5 text-center text-sm text-gray-500">
          Add the courses you want to take. You will not need to choose CRNs.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.map((row) => {
            const branchIsLoading = isBranchLoading(row.branchCode);
            const courses = coursesForBranch(courseCatalog, row.branchCode);
            const selectedCourse = courses.find(
              (course) => course.id === row.courseId,
            );

            return (
              <div
                key={row.id}
                className="grid gap-2 rounded-xl border border-gray-200 bg-gray-50/60 p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2.3fr)_minmax(0,2.3fr)_auto]"
              >
                <label className="min-w-0">
                  <span className="sr-only">Course prefix</span>
                  <select
                    aria-label="Course prefix"
                    value={row.branchCode}
                    onChange={(event) =>
                      handleBranchChange(row.id, event.target.value)
                    }
                    disabled={isLoadingBranches}
                    className={selectClassName}
                  >
                    <option value="">
                      {isLoadingBranches ? "Loading prefixes…" : "Course Prefix"}
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
                  <span className="sr-only">Desired course</span>
                  <select
                    aria-label="Desired course"
                    value={row.courseId}
                    onChange={(event) =>
                      handleCourseChange(row.id, event.target.value)
                    }
                    disabled={!row.branchCode || branchIsLoading}
                    className={selectClassName}
                  >
                    <option value="">
                      {branchIsLoading ? "Loading courses…" : "Course Code and Name"}
                    </option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.title} ({course.sections.length}{" "}
                        CRNs)
                      </option>
                    ))}
                  </select>
                </label>

                <label className="min-w-0">
                  <span className="sr-only">Pinned CRN</span>
                  <select
                    aria-label="Pinned CRN"
                    value={row.pinnedSectionId}
                    onChange={(event) =>
                      handlePinnedSectionChange(row.id, event.target.value)
                    }
                    disabled={!selectedCourse || branchIsLoading}
                    className={selectClassName}
                  >
                    <option value="">Any CRN</option>
                    {selectedCourse?.sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        Pin {section.crn} · {section.meetings
                          .map(
                            (meeting) =>
                              `${meeting.day.slice(0, 3)} ${meeting.startTime}–${meeting.endTime}`,
                          )
                          .join(", ")}
                        {section.instructor
                          ? ` · ${section.instructor}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => handleRemoveCourse(row.id)}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-100"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      <fieldset className="mt-5 border-t border-gray-200 pt-4">
        <legend className="px-1 text-sm font-semibold text-gray-800">
          Preferences
        </legend>

        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            Earliest class time
            <select
              value={earliestStartTime}
              onChange={(event) => {
                setEarliestStartTime(event.target.value);
                invalidateResults(isReady ? "ready" : "idle");
              }}
              className={`mt-1 w-full ${inputClassName}`}
            >
              <option value="">No earliest limit</option>
              {TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-gray-700">
            Latest class time
            <select
              value={latestEndTime}
              onChange={(event) => {
                setLatestEndTime(event.target.value);
                invalidateResults(isReady ? "ready" : "idle");
              }}
              className={`mt-1 w-full ${inputClassName}`}
            >
              <option value="">No latest limit</option>
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
            Keep days free
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
                {day}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {combinationCount >= LARGE_SEARCH_SPACE_THRESHOLD && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This selection has {combinationCount.toLocaleString()} possible CRN
          combinations. Conflict pruning and the {MAX_GENERATED_SCHEDULES}-result
          limit will keep generation bounded.
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!isReady || status === "generating" || Boolean(catalogError)}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
        >
          {status === "generating" ? "Generating…" : "Generate Schedules"}
        </button>

        <div
          className={`text-sm ${
            status === "error" || status === "no-results"
              ? "text-red-700"
              : status === "fallback"
                ? "font-medium text-amber-700"
              : status === "success"
                ? "font-medium text-green-700"
                : "text-gray-500"
          }`}
          aria-live="polite"
          role={status === "error" ? "alert" : "status"}
        >
          {isLoadingBranches
            ? "Loading courses…"
            : isLoadingSelectedCourses
              ? "Loading selected course catalog…"
              : catalogError
                ? catalogError
                : message ||
                  (visibleStatus === "ready"
                    ? "Ready to generate."
                    : "Select your desired courses.")}
        </div>
      </div>

      {currentSchedule && (
        <div
          className="mt-5 rounded-xl border border-blue-200 bg-blue-50/40 p-4 outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          tabIndex={0}
          onKeyDown={handleResultKeyDown}
          aria-label="Generated schedule results. Use left and right arrow keys to navigate."
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentIndex((index) => index - 1)}
              disabled={currentIndex === 0}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>

            <div className="text-sm font-semibold text-gray-800">
              Schedule {currentIndex + 1} / {schedules.length}
              {truncated ? "+" : ""}
            </div>

            <button
              type="button"
              onClick={() => setCurrentIndex((index) => index + 1)}
              disabled={currentIndex === schedules.length - 1}
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>

          {currentSchedule.conflictCount > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Best available fallback: {currentSchedule.conflictCount}{" "}
              overlapping meeting pair
              {currentSchedule.conflictCount === 1 ? "" : "s"},{" "}
              {currentSchedule.totalConflictMinutes} overlapping minutes.
            </div>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <div>
              <dt className="text-gray-500">Rating</dt>
              <dd className="mt-1">
                <ScheduleStarRating rating={currentRating} />
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Campus days</dt>
              <dd className="font-semibold text-gray-900">
                {currentSchedule.metrics.campusDays}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Total gaps</dt>
              <dd className="font-semibold text-gray-900">
                {currentSchedule.metrics.totalGapMinutes} min
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Earliest</dt>
              <dd className="font-semibold text-gray-900">
                {minutesToTime(currentSchedule.metrics.earliestStartMinutes)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Latest</dt>
              <dd className="font-semibold text-gray-900">
                {minutesToTime(currentSchedule.metrics.latestEndMinutes)}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => onSave(currentSchedule)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              Save as Weekly Program
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
