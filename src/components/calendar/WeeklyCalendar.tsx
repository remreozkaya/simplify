"use client";

import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";

import {
  days,
  type CourseBlock,
  type CourseOption,
  type CourseSelection,
  type Day,
  type FacultyOption,
  type WeeklyProgram,
} from "@/types/calendar";

import { mockCourseCatalog } from "@/data/mockCourseCatalog";

// Calendar scale settings.
const SLOT_HEIGHT = 26;
const SLOT_MINUTES = 30;
const START_TIME = "08:00";

const WEEKLY_PROGRAMS_STORAGE_KEY = "simplify-weekly-programs";
const NEW_PROGRAM_VALUE = "__new_program__";

const selectClassName =
  "min-w-0 w-full truncate rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400";

const inputClassName =
  "min-w-0 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const timeLabels = generateTimeLabels();

type CourseLayout = {
  leftPercent: number;
  widthPercent: number;
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

function generateTimeLabels() {
  const labels: string[] = [];

  for (let hour = 8; hour < 20; hour++) {
    labels.push(`${hour.toString().padStart(2, "0")}:00`);
    labels.push(`${hour.toString().padStart(2, "0")}:30`);
  }

  labels.push("20:00");

  return labels;
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function getCourseTop(startTime: string) {
  const startMinutes = timeToMinutes(startTime);
  const calendarStartMinutes = timeToMinutes(START_TIME);

  return ((startMinutes - calendarStartMinutes) / SLOT_MINUTES) * SLOT_HEIGHT;
}

function getCourseHeight(startTime: string, endTime: string) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return ((endMinutes - startMinutes) / SLOT_MINUTES) * SLOT_HEIGHT;
}

function getDayIndex(day: Day) {
  return days.indexOf(day);
}

function coursesOverlap(firstCourse: CourseBlock, secondCourse: CourseBlock) {
  if (firstCourse.day !== secondCourse.day) {
    return false;
  }

  const firstStart = timeToMinutes(firstCourse.startTime);
  const firstEnd = timeToMinutes(firstCourse.endTime);
  const secondStart = timeToMinutes(secondCourse.startTime);
  const secondEnd = timeToMinutes(secondCourse.endTime);

  return firstStart < secondEnd && firstEnd > secondStart;
}

function getCourseLayoutMap(courseBlocks: CourseBlock[]) {
  const layoutMap: Record<string, CourseLayout> = {};
  const courseOrderMap = new Map<string, number>();

  courseBlocks.forEach((courseBlock, index) => {
    courseOrderMap.set(courseBlock.id, index);
  });

  const dayColumnWidth = 100 / days.length;

  days.forEach((day) => {
    const dayCourses = courseBlocks.filter((course) => course.day === day);
    const unvisitedCourseIds = new Set(dayCourses.map((course) => course.id));

    while (unvisitedCourseIds.size > 0) {
      const firstCourseId = Array.from(unvisitedCourseIds)[0];
      const firstCourse = dayCourses.find(
        (course) => course.id === firstCourseId,
      );

      if (!firstCourse) {
        break;
      }

      const overlapGroup: CourseBlock[] = [];
      const queue: CourseBlock[] = [firstCourse];

      unvisitedCourseIds.delete(firstCourse.id);

      while (queue.length > 0) {
        const currentCourse = queue.shift();

        if (!currentCourse) {
          continue;
        }

        overlapGroup.push(currentCourse);

        dayCourses.forEach((possibleOverlappingCourse) => {
          if (!unvisitedCourseIds.has(possibleOverlappingCourse.id)) {
            return;
          }

          const overlapsWithGroup = overlapGroup.some((groupCourse) =>
            coursesOverlap(groupCourse, possibleOverlappingCourse),
          );

          const overlapsWithCurrentCourse = coursesOverlap(
            currentCourse,
            possibleOverlappingCourse,
          );

          if (!overlapsWithGroup && !overlapsWithCurrentCourse) {
            return;
          }

          unvisitedCourseIds.delete(possibleOverlappingCourse.id);
          queue.push(possibleOverlappingCourse);
        });
      }

      const orderedOverlapGroup = [...overlapGroup].sort((first, second) => {
        return (
          (courseOrderMap.get(first.id) ?? 0) -
          (courseOrderMap.get(second.id) ?? 0)
        );
      });

      const courseColumnMap = new Map<string, number>();

      orderedOverlapGroup.forEach((course) => {
        const usedColumns = new Set<number>();

        orderedOverlapGroup.forEach((otherCourse) => {
          if (course.id === otherCourse.id) {
            return;
          }

          const otherCourseColumn = courseColumnMap.get(otherCourse.id);

          if (otherCourseColumn === undefined) {
            return;
          }

          if (coursesOverlap(course, otherCourse)) {
            usedColumns.add(otherCourseColumn);
          }
        });

        let columnIndex = 0;

        while (usedColumns.has(columnIndex)) {
          columnIndex += 1;
        }

        courseColumnMap.set(course.id, columnIndex);
      });

      const totalColumns =
        Math.max(...Array.from(courseColumnMap.values())) + 1;

      const dayIndex = getDayIndex(day);
      const courseWidth = dayColumnWidth / totalColumns;

      orderedOverlapGroup.forEach((course) => {
        const columnIndex = courseColumnMap.get(course.id) ?? 0;

        layoutMap[course.id] = {
          leftPercent: dayIndex * dayColumnWidth + columnIndex * courseWidth,
          widthPercent: courseWidth,
        };
      });
    }
  });

  return layoutMap;
}

function getCoursesByFaculty(
  courseCatalog: FacultyOption[],
  facultyCode: string,
) {
  return (
    courseCatalog.find((faculty) => faculty.facultyCode === facultyCode)
      ?.courses ?? []
  );
}

function getCourseById(
  courseCatalog: FacultyOption[],
  facultyCode: string,
  courseId: string,
) {
  return getCoursesByFaculty(courseCatalog, facultyCode).find(
    (course) => course.id === courseId,
  );
}

function getSessionById(course: CourseOption | undefined, sessionId: string) {
  return course?.sessions.find((session) => session.id === sessionId);
}

function formatUpdatedAt(updatedAt: string) {
  const date = new Date(updatedAt);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WeeklyCalendar() {
  const [courseCatalog] = useState<FacultyOption[]>(mockCourseCatalog);

  const [weeklyPrograms, setWeeklyPrograms] = useState<WeeklyProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [programName, setProgramName] = useState("");

  const [courseBlocks, setCourseBlocks] = useState<CourseBlock[]>([]);
  const [courseSelections, setCourseSelections] = useState<CourseSelection[]>(
    [],
  );

  const [hasLoadedPrograms, setHasLoadedPrograms] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const calendarHeight = (timeLabels.length - 1) * SLOT_HEIGHT;

  const selectedProgram = weeklyPrograms.find(
    (program) => program.id === selectedProgramId,
  );

  const courseLayoutMap = useMemo(() => {
    return getCourseLayoutMap(courseBlocks);
  }, [courseBlocks]);

  useEffect(() => {
    let savedPrograms: WeeklyProgram[] = [];

    try {
      const storedPrograms = localStorage.getItem(WEEKLY_PROGRAMS_STORAGE_KEY);

      if (storedPrograms) {
        const parsedPrograms = JSON.parse(storedPrograms);

        if (Array.isArray(parsedPrograms)) {
          savedPrograms = parsedPrograms;
        }
      }
    } catch {
      savedPrograms = [];
    }

    const initialPrograms =
      savedPrograms.length > 0
        ? savedPrograms
        : [createEmptyProgram("Program 1")];

    const firstProgram = initialPrograms[0];

    setWeeklyPrograms(initialPrograms);
    setSelectedProgramId(firstProgram.id);
    setProgramName(firstProgram.name);
    setCourseBlocks(firstProgram.courseBlocks ?? []);
    setCourseSelections(firstProgram.courseSelections ?? []);
    setHasLoadedPrograms(true);
    setHasUnsavedChanges(false);
  }, []);

  useEffect(() => {
    if (!hasLoadedPrograms) {
      return;
    }

    localStorage.setItem(
      WEEKLY_PROGRAMS_STORAGE_KEY,
      JSON.stringify(weeklyPrograms),
    );
  }, [weeklyPrograms, hasLoadedPrograms]);

  function markProgramAsChanged() {
    setHasUnsavedChanges(true);
  }

  function confirmDiscardUnsavedChanges() {
    if (!hasUnsavedChanges) {
      return true;
    }

    return window.confirm(
      "You have unsaved changes. If you continue, your current changes will be lost. Continue?",
    );
  }

  function loadProgram(programId: string) {
    if (programId === NEW_PROGRAM_VALUE) {
      handleCreateProgram();
      return;
    }

    if (!confirmDiscardUnsavedChanges()) {
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
    setCourseBlocks(programToLoad.courseBlocks ?? []);
    setCourseSelections(programToLoad.courseSelections ?? []);
    setHasUnsavedChanges(false);
  }

  function handleCreateProgram() {
    if (!confirmDiscardUnsavedChanges()) {
      return;
    }

    const newProgram = createEmptyProgram(`Program ${weeklyPrograms.length + 1}`);

    setWeeklyPrograms((currentPrograms) => [...currentPrograms, newProgram]);
    setSelectedProgramId(newProgram.id);
    setProgramName(newProgram.name);
    setCourseBlocks([]);
    setCourseSelections([]);
    setHasUnsavedChanges(false);
  }

  function handleSaveProgram() {
    const trimmedProgramName = programName.trim() || "Untitled Program";

    const savedProgram: WeeklyProgram = {
      id: selectedProgramId || createId("program"),
      name: trimmedProgramName,
      courseBlocks,
      courseSelections,
      updatedAt: new Date().toISOString(),
    };

    setWeeklyPrograms((currentPrograms) => {
      const programAlreadyExists = currentPrograms.some(
        (program) => program.id === savedProgram.id,
      );

      if (!programAlreadyExists) {
        return [...currentPrograms, savedProgram];
      }

      return currentPrograms.map((program) =>
        program.id === savedProgram.id ? savedProgram : program,
      );
    });

    setSelectedProgramId(savedProgram.id);
    setProgramName(trimmedProgramName);
    setHasUnsavedChanges(false);
  }

  function handleEnterToSave(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter") {
      return;
    }

    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    if (event.nativeEvent.isComposing) {
      return;
    }

    const target = event.target as HTMLElement;
    const ignoredTags = ["BUTTON", "SELECT", "TEXTAREA"];

    if (ignoredTags.includes(target.tagName)) {
      return;
    }

    if (!hasLoadedPrograms) {
      return;
    }

    event.preventDefault();
    handleSaveProgram();
  }

  function handleDeleteProgram() {
    const programToDelete = weeklyPrograms.find(
      (program) => program.id === selectedProgramId,
    );

    const confirmed = window.confirm(
      `Are you sure you want to delete "${
        programToDelete?.name ?? "this program"
      }"? This action cannot be undone.`,
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
      setCourseBlocks([]);
      setCourseSelections([]);
      setHasUnsavedChanges(false);

      return;
    }

    const nextProgram = remainingPrograms[0];

    setWeeklyPrograms(remainingPrograms);
    setSelectedProgramId(nextProgram.id);
    setProgramName(nextProgram.name);
    setCourseBlocks(nextProgram.courseBlocks ?? []);
    setCourseSelections(nextProgram.courseSelections ?? []);
    setHasUnsavedChanges(false);
  }

  function handleProgramNameChange(newProgramName: string) {
    setProgramName(newProgramName);
    markProgramAsChanged();
  }

  function handleAddSelectionRow() {
    const newSelection: CourseSelection = {
      id: createId("selection"),
      facultyCode: "",
      courseId: "",
      sessionId: "",
    };

    setCourseSelections((currentSelections) => [
      newSelection,
      ...currentSelections,
    ]);

    markProgramAsChanged();
  }

  function removeCourseBlock(courseBlockId: string | undefined) {
    if (!courseBlockId) {
      return;
    }

    setCourseBlocks((currentCourseBlocks) =>
      currentCourseBlocks.filter(
        (courseBlock) => courseBlock.id !== courseBlockId,
      ),
    );
  }

  function handleDeleteSelection(selection: CourseSelection) {
    removeCourseBlock(selection.courseBlockId);

    setCourseSelections((currentSelections) =>
      currentSelections.filter(
        (currentSelection) => currentSelection.id !== selection.id,
      ),
    );

    markProgramAsChanged();
  }

  function handleFacultyChange(selectionId: string, facultyCode: string) {
    const currentSelection = courseSelections.find(
      (selection) => selection.id === selectionId,
    );

    removeCourseBlock(currentSelection?.courseBlockId);

    setCourseSelections((currentSelections) =>
      currentSelections.map((selection) => {
        if (selection.id !== selectionId) {
          return selection;
        }

        return {
          ...selection,
          facultyCode,
          courseId: "",
          sessionId: "",
          courseBlockId: undefined,
        };
      }),
    );

    markProgramAsChanged();
  }

  function handleCourseChange(selectionId: string, courseId: string) {
    const currentSelection = courseSelections.find(
      (selection) => selection.id === selectionId,
    );

    removeCourseBlock(currentSelection?.courseBlockId);

    setCourseSelections((currentSelections) =>
      currentSelections.map((selection) => {
        if (selection.id !== selectionId) {
          return selection;
        }

        return {
          ...selection,
          courseId,
          sessionId: "",
          courseBlockId: undefined,
        };
      }),
    );

    markProgramAsChanged();
  }

  function handleSessionChange(selectionId: string, sessionId: string) {
    const currentSelection = courseSelections.find(
      (selection) => selection.id === selectionId,
    );

    if (!currentSelection) {
      return;
    }

    const selectedCourse = getCourseById(
      courseCatalog,
      currentSelection.facultyCode,
      currentSelection.courseId,
    );

    const selectedSession = getSessionById(selectedCourse, sessionId);

    if (!selectedCourse || !selectedSession) {
      setCourseSelections((currentSelections) =>
        currentSelections.map((selection) => {
          if (selection.id !== selectionId) {
            return selection;
          }

          return {
            ...selection,
            sessionId,
          };
        }),
      );

      markProgramAsChanged();
      return;
    }

    const courseBlockId = currentSelection.courseBlockId ?? createId("course");

    const newCourseBlock: CourseBlock = {
      id: courseBlockId,
      code: selectedCourse.code,
      title: selectedCourse.title,
      day: selectedSession.day,
      startTime: selectedSession.startTime,
      endTime: selectedSession.endTime,
      room: selectedSession.room,
      instructor: selectedSession.instructor,
    };

    setCourseBlocks((currentCourseBlocks) => {
      const courseBlockAlreadyExists = currentCourseBlocks.some(
        (courseBlock) => courseBlock.id === courseBlockId,
      );

      if (courseBlockAlreadyExists) {
        return currentCourseBlocks.map((courseBlock) =>
          courseBlock.id === courseBlockId ? newCourseBlock : courseBlock,
        );
      }

      return [...currentCourseBlocks, newCourseBlock];
    });

    setCourseSelections((currentSelections) =>
      currentSelections.map((selection) => {
        if (selection.id !== selectionId) {
          return selection;
        }

        return {
          ...selection,
          sessionId,
          courseBlockId,
        };
      }),
    );

    markProgramAsChanged();
  }

  return (
    <div className="w-full space-y-4" onKeyDown={handleEnterToSave}>
      <div className="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.8fr)_auto_auto] md:items-end">
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Weekly Program
            </label>

            <select
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

              <option value={NEW_PROGRAM_VALUE}>+ New Program</option>
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Program Name
            </label>

            <input
              type="text"
              value={programName}
              onChange={(event) => handleProgramNameChange(event.target.value)}
              placeholder="Program name"
              className={inputClassName}
            />
          </div>

          <button
            type="button"
            onClick={handleSaveProgram}
            disabled={!hasLoadedPrograms}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
          >
            Save
          </button>

          <button
            type="button"
            onClick={handleDeleteProgram}
            disabled={!hasLoadedPrograms}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete Program
          </button>
        </div>

        <div className="mb-4 text-xs text-gray-500">
          {hasUnsavedChanges ? (
            <span className="font-medium text-orange-600">
              Unsaved changes
            </span>
          ) : selectedProgram?.updatedAt ? (
            <span>Saved at {formatUpdatedAt(selectedProgram.updatedAt)}</span>
          ) : (
            <span>No saved changes yet</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAddSelectionRow}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Add Course
        </button>

        {courseSelections.length > 0 && (
          <div className="mt-4 space-y-3">
            {courseSelections.map((selection) => {
              const availableCourses = getCoursesByFaculty(
                courseCatalog,
                selection.facultyCode,
              );

              const selectedCourse = getCourseById(
                courseCatalog,
                selection.facultyCode,
                selection.courseId,
              );

              return (
                <div
                  key={selection.id}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,3fr)_auto] gap-3"
                >
                  <select
                    value={selection.facultyCode}
                    onChange={(event) =>
                      handleFacultyChange(selection.id, event.target.value)
                    }
                    className={selectClassName}
                  >
                    <option value="">Faculty Code</option>

                    {courseCatalog.map((faculty) => (
                      <option
                        key={faculty.facultyCode}
                        value={faculty.facultyCode}
                      >
                        {faculty.facultyCode}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selection.courseId}
                    onChange={(event) =>
                      handleCourseChange(selection.id, event.target.value)
                    }
                    disabled={!selection.facultyCode}
                    className={selectClassName}
                  >
                    <option value="">Course Code and Name</option>

                    {availableCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.title}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selection.sessionId}
                    onChange={(event) =>
                      handleSessionChange(selection.id, event.target.value)
                    }
                    disabled={!selection.courseId}
                    className={selectClassName}
                  >
                    <option value="">Session</option>

                    {selectedCourse?.sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.day}, {session.startTime} - {session.endTime}
                        {session.room ? `, ${session.room}` : ""}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => handleDeleteSelection(selection)}
                    className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="w-full rounded-xl border border-gray-200 bg-transparent shadow-sm">
        <div className="w-full">
          <div className="ml-12 grid grid-cols-7 border-b border-gray-200">
            {days.map((day) => (
              <div
                key={day}
                className="border-r border-gray-200 bg-transparent p-3 text-center text-sm font-semibold text-gray-700 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="relative ml-12" style={{ height: calendarHeight }}>
            {timeLabels.map((time, index) => (
              <div
                key={time}
                className="absolute left-0 w-full border-t border-gray-200"
                style={{ top: index * SLOT_HEIGHT }}
              >
                {time !== "20:00" && (
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

            {courseBlocks.map((course) => {
              const top = getCourseTop(course.startTime);
              const height = getCourseHeight(course.startTime, course.endTime);
              const layout = courseLayoutMap[course.id];

              if (!layout) {
                return null;
              }

              return (
                <div
                  key={course.id}
                  className="absolute z-10 px-[1px]"
                  style={{
                    top,
                    height,
                    left: `${layout.leftPercent}%`,
                    width: `${layout.widthPercent}%`,
                  }}
                >
                  <div className="h-full overflow-hidden rounded-lg border border-blue-300 bg-blue-100/85 p-2 text-xs shadow-sm transition-all duration-200 hover:scale-[1.02] hover:bg-blue-100">
                    <div className="font-semibold text-blue-900">
                      {course.code}
                    </div>

                    <div className="mt-1 text-blue-800">{course.title}</div>

                    <div className="mt-1 text-blue-700">
                      {course.startTime} - {course.endTime}
                    </div>

                    {course.room && (
                      <div className="mt-1 text-blue-700">{course.room}</div>
                    )}

                    {course.instructor && (
                      <div className="mt-1 text-blue-700">
                        {course.instructor}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}