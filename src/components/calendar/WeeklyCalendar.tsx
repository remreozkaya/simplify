"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

import { useProfile } from "@/components/profile/ProfileProvider";
import { resolveProgramMemberships } from "@/lib/program-restrictions/eligibility";

import ScheduleGeneratorPanel from "@/components/calendar/ScheduleGeneratorPanel";
import { useItuCourseCatalog } from "@/hooks/useItuCourseCatalog";
import { getCourseColorStyle } from "@/lib/calendar/courseColors";
import { exportWeeklyProgramAsJpeg } from "@/lib/calendar/exportJpeg";
import { loadWeeklyPrograms, saveWeeklyPrograms } from "@/lib/calendar/persistence";
import { getCourseById, getSectionById } from "@/lib/calendar/catalog";
import {
  SortableCourseRow,
  DraggedCourseRow,
  courseRowGridClassName,
} from "@/components/calendar/CourseRows";
import CourseDetails from "@/components/calendar/CourseDetails";
import CrnBookmarkletLink from "@/components/calendar/CrnBookmarkletLink";
import { createCrnBookmarklet, getLocalCreditTotal } from "@/lib/calendar/planActions";
import { generatedScheduleToWeeklyProgram } from "@/lib/schedule/conversion";
import { formatNumber, localizedWeekday, localizeRuntimeMessage } from "@/lib/i18n";
import { useLanguage } from "@/lib/i18n/client";
import { hasMeetingConflicts } from "@/lib/schedule/conflicts";
import {
  calculateCalendarRange,
  generateTimeLabels,
  getTimeTop,
  getCourseHeight,
  getCourseLayoutMap,
  reorderCourseBlocksBySelections,
} from "@/lib/calendar/layout";
import type { GeneratedSchedule } from "@/lib/schedule/types";
import {
  days,
  type CourseBlock,
  type CourseSelection,
  type WeeklyProgram,
} from "@/types/calendar";

const NEW_PROGRAM_VALUE = "__new_program__";

const selectClassName =
  "min-w-0 w-full truncate rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-out focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400";

const inputClassName =
  "min-w-0 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition-[border-color,box-shadow] duration-200 ease-out focus:border-blue-500 focus:ring-2 focus:ring-blue-100";


const dropAnimation = {
  duration: 220,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyProgram(name: string): WeeklyProgram {
  return {
    id: createId("program"),
    name,
    courseBlocks: [],
    courseSelections: [],
    updatedAt: new Date().toISOString(),
  };
}

function removeCourseBlocks(
  courseBlocks: CourseBlock[],
  courseBlockIds: string[],
) {
  if (courseBlockIds.length === 0) {
    return courseBlocks;
  }

  const removedIds = new Set(courseBlockIds);

  return courseBlocks.filter((courseBlock) => !removedIds.has(courseBlock.id));
}

type WeeklyCalendarProps = {
  view?: "planner" | "generator";
};

export default function WeeklyCalendar({
  view = "planner",
}: WeeklyCalendarProps) {
  const { language, t } = useLanguage();
  const { profile } = useProfile();
  const programMemberships = useMemo(
    () => resolveProgramMemberships(profile.programEnrollments),
    [profile.programEnrollments],
  );
  const {
    courseCatalog,
    isLoadingBranches,
    isBranchLoading,
    loadBranch,
    retryBranches,
    retryFailedBranch,
    failedBranchCode,
    error: courseCatalogError,
  } = useItuCourseCatalog();

  const [weeklyPrograms, setWeeklyPrograms] = useState<WeeklyProgram[]>([]);

  const [selectedProgramId, setSelectedProgramId] = useState("");

  const [programName, setProgramName] = useState("");

  const [hasLoadedPrograms, setHasLoadedPrograms] = useState(false);
  const [storageRecoveryRequired, setStorageRecoveryRequired] = useState(false);
  const [storageWriteFailed, setStorageWriteFailed] = useState(false);

  const [activeSelectionId, setActiveSelectionId] = useState<string | null>(
    null,
  );

  const [detailsCourseId, setDetailsCourseId] = useState<string | null>(null);

  const [dismissedConflictKey, setDismissedConflictKey] = useState<string | null>(null);

  const [generatedPreview, setGeneratedPreview] =
    useState<GeneratedSchedule | null>(null);

  const [jpegExportStatus, setJpegExportStatus] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),

    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const selectedProgram = useMemo(
    () =>
      weeklyPrograms.find((program) => program.id === selectedProgramId) ??
      null,

    [weeklyPrograms, selectedProgramId],
  );

  const courseBlocks = useMemo(
    () => selectedProgram?.courseBlocks ?? [],
    [selectedProgram],
  );

  const courseSelections = useMemo(
    () => selectedProgram?.courseSelections ?? [],
    [selectedProgram],
  );

  const savedProgramName = selectedProgram?.name ?? "";
  const localCreditTotal = useMemo(
    () => getLocalCreditTotal(courseSelections, courseCatalog),
    [courseSelections, courseCatalog],
  );
  const bookmarklet = useMemo(
    () => createCrnBookmarklet(courseSelections, courseCatalog),
    [courseSelections, courseCatalog],
  );

  const hasUnsavedNameChanges = programName !== savedProgramName;


  const activeSelection =
    courseSelections.find((selection) => selection.id === activeSelectionId) ??
    null;

  const displayedCourseBlocks = useMemo(
    () =>
      view === "generator"
        ? generatedPreview
          ? generatedScheduleToWeeklyProgram(generatedPreview, {
              id: "generated-preview",
              name: "Generated preview",
              updatedAt: "",
            }).courseBlocks
          : []
        : courseBlocks,
    [courseBlocks, generatedPreview, view],
  );

  const calendarRange = useMemo(
    () => calculateCalendarRange(displayedCourseBlocks),
    [displayedCourseBlocks],
  );
  const timeLabels = useMemo(
    () => generateTimeLabels(calendarRange.startMinutes, calendarRange.endMinutes),
    [calendarRange],
  );
  const calendarEndTime = timeLabels.at(-1)!;
  const calendarHeight = getTimeTop(calendarEndTime, calendarRange.startMinutes);

  const detailsCourse = displayedCourseBlocks.find(
    (course) => course.id === detailsCourseId,
  );
  const detailsSelection = courseSelections.find(
    (selection) => selection.id === detailsCourse?.selectionId,
  );
  const detailsSection = detailsSelection
    ? getSectionById(
        getCourseById(
          courseCatalog,
          detailsSelection.facultyCode,
          detailsSelection.courseId,
        ),
        detailsSelection.sectionId,
      )
    : undefined;
  const detailsMeetings = detailsCourse
    ? displayedCourseBlocks.filter((course) =>
        detailsCourse.selectionId
          ? course.selectionId === detailsCourse.selectionId
          : course.id === detailsCourse.id,
      )
    : [];

  const courseLayoutMap = useMemo(
    () => getCourseLayoutMap(displayedCourseBlocks),

    [displayedCourseBlocks],
  );

  const hasScheduleConflicts = useMemo(
    () => hasMeetingConflicts(courseBlocks),
    [courseBlocks],
  );

  const scheduleConflictKey = useMemo(
    () => JSON.stringify([
      selectedProgramId,
      courseBlocks.map(({ id, day, startTime, endTime }) =>
        JSON.stringify([id, day, startTime, endTime]),
      ).sort(),
    ]),
    [selectedProgramId, courseBlocks],
  );

  const orderedSelectionIds = useMemo(
    () =>
      view === "generator"
        ? [
            ...new Set(
              displayedCourseBlocks.flatMap((block) =>
                block.selectionId ? [block.selectionId] : [],
              ),
            ),
          ]
        : courseSelections.map((selection) => selection.id),
    [courseSelections, displayedCourseBlocks, view],
  );

  /* eslint-disable react-hooks/set-state-in-effect -- This one-time client
   * hydration intentionally synchronizes React state with localStorage after
   * SSR, preventing stored user schedules from causing a hydration mismatch. */
  useEffect(() => {
    // Access to the localStorage object itself can also throw (blocked storage).
    let loaded: ReturnType<typeof loadWeeklyPrograms>;
    try {
      loaded = loadWeeklyPrograms(localStorage);
    } catch {
      loaded = { programs: [], recoveryRequired: true };
    }
    const savedPrograms = loaded.programs;
    setStorageRecoveryRequired(loaded.recoveryRequired);

    const initialPrograms =
      savedPrograms.length > 0
        ? savedPrograms
        : [createEmptyProgram("Program 1")];

    const requestedProgramId = new URLSearchParams(window.location.search).get(
      "program",
    );
    const firstProgram =
      initialPrograms.find((program) => program.id === requestedProgramId) ??
      initialPrograms[0];

    setWeeklyPrograms(initialPrograms);
    setSelectedProgramId(firstProgram.id);
    setProgramName(firstProgram.name);
    setHasLoadedPrograms(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (isLoadingBranches) {
      return;
    }

    const savedBranchCodes = new Set(
      courseSelections
        .map((selection) => selection.facultyCode)
        .filter(Boolean),
    );

    savedBranchCodes.forEach((branchCode) => {
      void loadBranch(branchCode);
    });
  }, [courseSelections, isLoadingBranches, loadBranch]);

  useEffect(() => {
    if (!hasLoadedPrograms) {
      return;
    }

    let result: ReturnType<typeof saveWeeklyPrograms>;
    try {
      result = saveWeeklyPrograms(localStorage, weeklyPrograms, storageRecoveryRequired);
    } catch {
      result = "error";
    }
    // The warning reflects an external write result, while edits remain in memory.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStorageWriteFailed(result === "error");
  }, [weeklyPrograms, hasLoadedPrograms, storageRecoveryRequired]);

  function updateSelectedProgram(
    updater: (program: WeeklyProgram) => WeeklyProgram,
  ) {
    setWeeklyPrograms((currentPrograms) =>
      currentPrograms.map((program) =>
        program.id === selectedProgramId ? updater(program) : program,
      ),
    );
  }

  function confirmDiscardUnsavedName() {
    if (!hasUnsavedNameChanges) {
      return true;
    }

    return window.confirm(t("weeklyPlanner.discardName"));
  }

  function loadProgram(programId: string) {
    if (programId === NEW_PROGRAM_VALUE) {
      handleCreateProgram();
      return;
    }

    if (!confirmDiscardUnsavedName()) {
      return;
    }

    const programToLoad = weeklyPrograms.find(
      (program) => program.id === programId,
    );

    if (!programToLoad) {
      return;
    }

    setSelectedProgramId(programToLoad.id);

    setProgramName(programToLoad.name);

    setActiveSelectionId(null);
  }

  function handleCreateProgram() {
    if (!confirmDiscardUnsavedName()) {
      return;
    }

    const newProgram = createEmptyProgram(
      t("weeklyPlanner.defaultProgram", { number: weeklyPrograms.length + 1 }),
    );

    setWeeklyPrograms((currentPrograms) => [...currentPrograms, newProgram]);

    setSelectedProgramId(newProgram.id);
    setProgramName(newProgram.name);
    setActiveSelectionId(null);
  }

  function handleSaveProgramName() {
    if (!selectedProgram) {
      return;
    }

    const trimmedProgramName =
      programName.trim() || t("weeklyPlanner.untitled");

    updateSelectedProgram((program) => ({
      ...program,
      name: trimmedProgramName,
      updatedAt: new Date().toISOString(),
    }));

    setProgramName(trimmedProgramName);
  }

  function handleProgramNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    handleSaveProgramName();
  }

  function handleDeleteProgram() {
    const confirmed = window.confirm(
      t("weeklyPlanner.deleteConfirm", {
        name: selectedProgram?.name ?? t("weeklyPlanner.thisProgram"),
      }),
    );

    if (!confirmed) {
      return;
    }

    const remainingPrograms = weeklyPrograms.filter(
      (program) => program.id !== selectedProgramId,
    );

    if (remainingPrograms.length === 0) {
      const newProgram = createEmptyProgram("Program 1");

      setWeeklyPrograms([newProgram]);

      setSelectedProgramId(newProgram.id);

      setProgramName(newProgram.name);

      setActiveSelectionId(null);

      return;
    }

    const nextProgram = remainingPrograms[0];

    setWeeklyPrograms(remainingPrograms);

    setSelectedProgramId(nextProgram.id);

    setProgramName(nextProgram.name);
    setActiveSelectionId(null);
  }

  function handleAddSelectionRow() {
    const newSelection: CourseSelection = {
      id: createId("selection"),
      facultyCode: "",
      courseId: "",
      sectionId: "",
      courseBlockIds: [],
    };

    updateSelectedProgram((program) => ({
      ...program,

      courseSelections: [...(program.courseSelections ?? []), newSelection],

      updatedAt: new Date().toISOString(),
    }));
  }

  function handleDeleteSelection(selection: CourseSelection) {
    updateSelectedProgram((program) => ({
      ...program,

      courseBlocks: removeCourseBlocks(
        program.courseBlocks ?? [],
        selection.courseBlockIds,
      ),

      courseSelections: (program.courseSelections ?? []).filter(
        (currentSelection) => currentSelection.id !== selection.id,
      ),

      updatedAt: new Date().toISOString(),
    }));
  }

  function handleFacultyChange(selectionId: string, facultyCode: string) {
    if (facultyCode) {
      void loadBranch(facultyCode);
    }

    updateSelectedProgram((program) => {
      const currentSelections = program.courseSelections ?? [];

      const currentSelection = currentSelections.find(
        (selection) => selection.id === selectionId,
      );

      return {
        ...program,

        courseBlocks: removeCourseBlocks(
          program.courseBlocks ?? [],
          currentSelection?.courseBlockIds ?? [],
        ),

        courseSelections: currentSelections.map((selection) =>
          selection.id === selectionId
            ? {
                ...selection,
                facultyCode,
                courseId: "",
                sectionId: "",
                courseBlockIds: [],
              }
            : selection,
        ),

        updatedAt: new Date().toISOString(),
      };
    });
  }

  function handleCourseChange(selectionId: string, courseId: string) {
    updateSelectedProgram((program) => {
      const currentSelections = program.courseSelections ?? [];

      const currentSelection = currentSelections.find(
        (selection) => selection.id === selectionId,
      );

      return {
        ...program,

        courseBlocks: removeCourseBlocks(
          program.courseBlocks ?? [],
          currentSelection?.courseBlockIds ?? [],
        ),

        courseSelections: currentSelections.map((selection) =>
          selection.id === selectionId
            ? {
                ...selection,
                courseId,
                sectionId: "",
                courseBlockIds: [],
              }
            : selection,
        ),

        updatedAt: new Date().toISOString(),
      };
    });
  }

  function handleSectionChange(selectionId: string, sectionId: string) {
    updateSelectedProgram((program) => {
      const currentSelections = program.courseSelections ?? [];

      const currentSelection = currentSelections.find(
        (selection) => selection.id === selectionId,
      );

      if (!currentSelection) {
        return program;
      }

      const selectedCourse = getCourseById(
        courseCatalog,
        currentSelection.facultyCode,
        currentSelection.courseId,
      );

      const selectedSection = getSectionById(selectedCourse, sectionId);

      const currentCourseBlocks = removeCourseBlocks(
        program.courseBlocks ?? [],
        currentSelection.courseBlockIds,
      );

      if (!selectedCourse || !selectedSection) {
        return {
          ...program,

          courseBlocks: currentCourseBlocks,

          courseSelections: currentSelections.map((selection) =>
            selection.id === selectionId
              ? {
                  ...selection,
                  sectionId,
                  courseBlockIds: [],
                }
              : selection,
          ),

          updatedAt: new Date().toISOString(),
        };
      }

      const newCourseBlocks: CourseBlock[] = selectedSection.meetings.map(
        (meeting, index) => ({
          id: `course-${selectionId}-${index}`,
          selectionId,
          code: selectedCourse.code,
          title: selectedCourse.title,
          crn: selectedSection.crn,
          majorRestriction: selectedSection.majorRestriction,
          programRestriction: selectedSection.programRestriction,
          semester: selectedSection.semester,
          day: meeting.day,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          building: meeting.building,
          room: meeting.room,
          instructor: selectedSection.instructor,
          teachingMethod: selectedSection.teachingMethod,
          capacity: selectedSection.capacity,
          enrolled: selectedSection.enrolled,
        }),
      );

      const courseBlockIds = newCourseBlocks.map((block) => block.id);

      return {
        ...program,

        courseBlocks: [...currentCourseBlocks, ...newCourseBlocks],

        courseSelections: currentSelections.map((selection) =>
          selection.id === selectionId
            ? {
                ...selection,
                sectionId,
                courseBlockIds,
              }
            : selection,
        ),

        updatedAt: new Date().toISOString(),
      };
    });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveSelectionId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveSelectionId(null);

    if (!over || active.id === over.id) {
      return;
    }

    updateSelectedProgram((program) => {
      const currentSelections = program.courseSelections ?? [];

      const oldIndex = currentSelections.findIndex(
        (selection) => selection.id === String(active.id),
      );

      const newIndex = currentSelections.findIndex(
        (selection) => selection.id === String(over.id),
      );

      if (oldIndex === -1 || newIndex === -1) {
        return program;
      }

      const reorderedSelections = arrayMove(
        currentSelections,
        oldIndex,
        newIndex,
      );

      return {
        ...program,

        courseSelections: reorderedSelections,

        courseBlocks: reorderCourseBlocksBySelections(
          program.courseBlocks ?? [],
          reorderedSelections,
        ),

        updatedAt: new Date().toISOString(),
      };
    });
  }

  function handleSaveGeneratedSchedule(schedule: GeneratedSchedule) {
    const programId = createId("program");
    const generatedProgramCount = weeklyPrograms.filter((program) =>
      /^(?:Generated Program|Oluşturulan Program) /u.test(program.name),
    ).length;
    const program = generatedScheduleToWeeklyProgram(schedule, {
      id: programId,
      name: t("weeklyPlanner.generated", { number: generatedProgramCount + 1 }),
    });

    setWeeklyPrograms((currentPrograms) => [...currentPrograms, program]);
    setSelectedProgramId(program.id);
    setProgramName(program.name);
    setActiveSelectionId(null);
    return programId;
  }

  function handleExportJpeg() {
    if (!selectedProgram) {
      return;
    }

    try {
      const filename = exportWeeklyProgramAsJpeg({
        ...selectedProgram,
        name: programName.trim() || selectedProgram.name,
      }, language);
      setJpegExportStatus({
        message: t("weeklyPlanner.downloaded", { filename }),
        isError: false,
      });
    } catch (error: unknown) {
      setJpegExportStatus({
        message:
          error instanceof Error
            ? error.message
            : t("weeklyPlanner.exportError"),
        isError: true,
      });
    }
  }

  return (
    <div className="w-full space-y-4">
      {(storageRecoveryRequired || storageWriteFailed) && (
        <p role="alert" className="text-sm text-red-700">
          {t(storageRecoveryRequired ? "weeklyPlanner.storageRecovery" : "weeklyPlanner.storageError")}
        </p>
      )}
      {detailsCourse && (
        <CourseDetails
          key={detailsCourse.id}
          course={detailsCourse}
          section={detailsSection ?? undefined}
          meetings={detailsMeetings}
          onClose={() => setDetailsCourseId(null)}
        />
      )}
      {view === "planner" ? (
        <div className="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.8fr)_auto_auto_auto] lg:items-end">
            <div className="min-w-0">
              <label
                htmlFor="weekly-program"
                className="mb-1 block text-sm font-medium text-gray-600"
              >
                {t("weeklyPlanner.weeklyProgram")}
              </label>

              <select
                id="weekly-program"
                value={selectedProgramId}
                onChange={(event) => loadProgram(event.target.value)}
                disabled={!hasLoadedPrograms}
                className={selectClassName}
              >
                {weeklyPrograms.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}

                <option value={NEW_PROGRAM_VALUE}>
                  + {t("weeklyPlanner.newProgram")}
                </option>
              </select>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="weekly-program-name"
                className="mb-1 block text-sm font-medium text-gray-600"
              >
                {t("weeklyPlanner.programName")}
              </label>

              <input
                id="weekly-program-name"
                type="text"
                value={programName}
                onChange={(event) => setProgramName(event.target.value)}
                onKeyDown={handleProgramNameKeyDown}
                placeholder={t("weeklyPlanner.programNamePlaceholder")}
                className={inputClassName}
              />
            </div>

            <CrnBookmarkletLink
              url={bookmarklet.url}
              label={t("weeklyPlanner.fillCrns")}
              tooltip={t("weeklyPlanner.bookmarkletTooltip")}
            />

            <button
              type="button"
              onClick={handleSaveProgramName}
              disabled={!hasLoadedPrograms || !hasUnsavedNameChanges}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
            >
              {t("weeklyPlanner.save")}
            </button>

            <button
              type="button"
              onClick={handleDeleteProgram}
              disabled={!hasLoadedPrograms}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition-colors duration-200 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("weeklyPlanner.deleteProgram")}
            </button>
          </div>

          {bookmarklet.error && (
            <div
              className="mb-3 text-sm text-red-700"
              role="alert"
              aria-live="polite"
            >
              {t("weeklyPlanner.invalidCrn")}
            </div>
          )}

          {hasUnsavedNameChanges ? (
            <p
              role="status"
              className="mb-4 text-sm text-amber-700 dark:text-amber-300"
            >
              {t("weeklyPlanner.unsavedName")}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              type="button"
              onClick={handleAddSelectionRow}
              disabled={!selectedProgram}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {t("weeklyPlanner.addCourse")}
            </button>
            <span className="text-sm text-gray-600" role="status" aria-live="polite">
              {localCreditTotal === null
                ? t("weeklyPlanner.localCreditsUnavailable")
                : t("weeklyPlanner.localCredits", {
                    credits: formatNumber(language, localCreditTotal, { maximumFractionDigits: 10 }),
                  })}
            </span>
          </div>

          {(isLoadingBranches || courseCatalogError) && (
            <div
              className={`mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                courseCatalogError
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
              }`}
              role={courseCatalogError ? "alert" : "status"}
            >
              <span>
                {localizeRuntimeMessage(
                  language,
                  courseCatalogError ?? undefined,
                  { fallback: true },
                ) ?? t("weeklyPlanner.loadingPrefixes")}
              </span>

              {courseCatalogError && (
                <button
                  type="button"
                  onClick={failedBranchCode ? retryFailedBranch : retryBranches}
                  className="rounded-md border border-current px-2 py-1 text-xs font-semibold"
                >
                  {t("weeklyPlanner.retry")}
                </button>
              )}
            </div>
          )}

          {hasScheduleConflicts && dismissedConflictKey !== scheduleConflictKey && (
            <div
              className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
              role="status"
            >
              <span>{t("weeklyPlanner.conflict")}</span>
              <button
                type="button"
                aria-label={t("weeklyPlanner.dismissConflict")}
                onClick={() => setDismissedConflictKey(scheduleConflictKey)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-amber-700 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
                  <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}

          {courseSelections.length > 0 && (
            <div className="relative mt-4 overflow-x-auto">
              <div className="min-w-[640px] space-y-2">
                <div className={`${courseRowGridClassName} border border-transparent text-sm font-medium text-slate-700`}>
                  <span aria-hidden="true" />
                  <span>{t("courses.prefix")}</span>
                  <span>{t("courses.desired")}</span>
                  <span>{t("weeklyPlanner.crnSection")}</span>
                  <span aria-hidden="true" />
                </div>

                <DndContext
                  accessibility={{
                    screenReaderInstructions: {
                      draggable: t("weeklyPlanner.dragHelp"),
                    },
                    announcements: {
                      onDragStart: () => t("weeklyPlanner.dragStarted"),
                      onDragOver: ({ over }) =>
                        over
                          ? t("weeklyPlanner.dragPosition", {
                              position:
                                courseSelections.findIndex(
                                  (selection) => selection.id === over.id,
                                ) + 1,
                              count: courseSelections.length,
                            })
                          : t("weeklyPlanner.dragOutside"),
                      onDragEnd: () => t("weeklyPlanner.dragEnded"),
                      onDragCancel: () => t("weeklyPlanner.dragCancelled"),
                    },
                  }}
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={() => setActiveSelectionId(null)}
                >
                  <SortableContext
                    items={courseSelections.map((selection) => selection.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {courseSelections.map((selection) => (
                        <SortableCourseRow
                          key={selection.id}
                          selection={selection}
                          programMemberships={programMemberships}
                          courseCatalog={courseCatalog}
                          isLoadingBranches={isLoadingBranches}
                          isBranchLoading={isBranchLoading}
                          onFacultyChange={handleFacultyChange}
                          onCourseChange={handleCourseChange}
                          onSectionChange={handleSectionChange}
                          onDelete={handleDeleteSelection}
                        />
                      ))}
                    </div>
                  </SortableContext>

                  <DragOverlay adjustScale={false} dropAnimation={dropAnimation}>
                    {activeSelection ? (
                      <DraggedCourseRow
                        selection={activeSelection}
                        courseCatalog={courseCatalog}
                      />
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            </div>
          )}
        </div>
      ) : (
        <ScheduleGeneratorPanel
          programMemberships={programMemberships}
          courseCatalog={courseCatalog}
          isLoadingBranches={isLoadingBranches}
          isBranchLoading={isBranchLoading}
          loadBranch={loadBranch}
          catalogError={courseCatalogError}
          onRetryCatalog={failedBranchCode ? retryFailedBranch : retryBranches}
          onPreviewChange={setGeneratedPreview}
          onSave={handleSaveGeneratedSchedule}
        />
      )}

      <div
        className="w-full overflow-x-auto overflow-y-hidden rounded-xl border border-gray-200 bg-white"
        tabIndex={0}
        role="region"
        aria-label={t("weeklyPlanner.weeklyProgram")}
      >
        <div className="min-w-[840px]">
          <div className="ml-12 grid grid-cols-7 border-b border-gray-200">
            {days.map((day) => (
              <div
                key={day}
                className="border-r border-gray-200 bg-transparent p-3 text-center text-sm font-semibold text-gray-700 last:border-r-0"
              >
                {localizedWeekday(language, day)}
              </div>
            ))}
          </div>

          <div
            className="relative ml-12"
            style={{
              height: calendarHeight,
            }}
          >
            {timeLabels.map((time) => (
              <div
                key={time}
                className="absolute left-0 w-full border-t border-gray-200"
                style={{
                  top: getTimeTop(time, calendarRange.startMinutes),
                }}
              >
                {time !== calendarEndTime && (
                  <span
                    className={
                      time.endsWith(":00")
                        ? "absolute -left-11 w-10 -translate-y-1/2 pr-1 text-right text-xs font-medium text-gray-600"
                        : "absolute -left-11 w-10 -translate-y-1/2 pr-1 text-right text-xs text-gray-400"
                    }
                  >
                    {time}
                  </span>
                )}
              </div>
            ))}

            <div className="grid h-full grid-cols-7">
              {days.map((day) => (
                <div
                  key={day}
                  className="border-r border-gray-200 last:border-r-0"
                />
              ))}
            </div>

            {displayedCourseBlocks.map((course) => {
              const top = getTimeTop(course.startTime, calendarRange.startMinutes);

              const height = getCourseHeight(course.startTime, course.endTime);

              const layout = courseLayoutMap[course.id];

              const colorStyle = getCourseColorStyle(
                course.selectionId ?? course.id,
                orderedSelectionIds,
              );

              if (!layout || height <= 0) {
                return null;
              }

              return (
                <div
                  key={course.id}
                  className="absolute z-10 px-[1px] transition-[top,left,width,height] duration-200 ease-out"
                  style={{
                    top,
                    height,

                    left: `${layout.leftPercent}%`,

                    width: `${layout.widthPercent}%`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setDetailsCourseId(course.id)}
                    aria-haspopup="dialog"
                    className={`h-full w-full cursor-pointer overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-blue-500 rounded-lg border p-2 text-xs shadow-sm ${colorStyle.block}`}
                  >
                    <span className={`block font-semibold ${colorStyle.heading}`}>
                      {course.code}
                      {course.crn ? ` · ${course.crn}` : ""}
                    </span>

                    <span className={`mt-1 block ${colorStyle.body}`}>
                      {course.title}
                    </span>

                    <span className={`mt-1 block ${colorStyle.body}`}>
                      {course.startTime} - {course.endTime}
                    </span>

                    <span className={`mt-1 block font-medium ${colorStyle.body}`}>
                      {t("weeklyPlanner.instructor")}: {course.instructor ?? t("weeklyPlanner.tba")}
                    </span>

                    {(course.building || course.room) && (
                      <span className={`mt-1 block ${colorStyle.body}`}>
                        {[course.building, course.room].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </button>

                </div>
              );
            })}
          </div>
        </div>
      </div>
      {view === "planner" && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {jpegExportStatus && (
            <span
              className={`min-w-0 break-words text-sm ${jpegExportStatus.isError ? "text-red-700" : "text-green-700"}`}
              role={jpegExportStatus.isError ? "alert" : "status"}
              aria-live="polite"
            >
              {localizeRuntimeMessage(language, jpegExportStatus.message)}
            </span>
          )}
          <button
            type="button"
            onClick={handleExportJpeg}
            disabled={!selectedProgram}
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition-colors duration-200 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("weeklyPlanner.exportJpeg")}
          </button>
        </div>
      )}
    </div>
  );
}
