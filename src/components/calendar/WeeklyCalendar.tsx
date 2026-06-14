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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

import { mockCourseCatalog } from "@/data/mockCourseCatalog";
import {
  days,
  type CourseBlock,
  type CourseOption,
  type CourseSelection,
  type Day,
  type FacultyOption,
  type WeeklyProgram,
} from "@/types/calendar";

const SLOT_HEIGHT = 26;
const SLOT_MINUTES = 30;
const START_TIME = "08:00";

const WEEKLY_PROGRAMS_STORAGE_KEY = "simplify-weekly-programs";
const NEW_PROGRAM_VALUE = "__new_program__";

const selectClassName =
  "min-w-0 w-full truncate rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-out focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400";

const inputClassName =
  "min-w-0 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition-[border-color,box-shadow] duration-200 ease-out focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const overlayFieldClassName =
  "flex h-10 min-w-0 w-full items-center truncate rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm";

const sortableGridClassName =
  "grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-3 rounded-xl p-2";

const timeLabels = generateTimeLabels();

const dropAnimation = {
  duration: 220,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
};

type CourseLayout = {
  leftPercent: number;
  widthPercent: number;
};

type SortableCourseRowProps = {
  selection: CourseSelection;
  courseCatalog: FacultyOption[];
  onFacultyChange: (selectionId: string, facultyCode: string) => void;
  onCourseChange: (selectionId: string, courseId: string) => void;
  onSessionChange: (selectionId: string, sessionId: string) => void;
  onDelete: (selection: CourseSelection) => void;
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
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

  for (let hour = 8; hour < 20; hour += 1) {
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

function reorderCourseBlocksBySelections(
  courseBlocks: CourseBlock[],
  courseSelections: CourseSelection[],
) {
  const courseBlockMap = new Map(
    courseBlocks.map((courseBlock) => [courseBlock.id, courseBlock]),
  );

  const orderedCourseBlockIds = courseSelections
    .map((selection) => selection.courseBlockId)
    .filter((courseBlockId): courseBlockId is string => Boolean(courseBlockId));

  const orderedCourseBlocks = orderedCourseBlockIds
    .map((courseBlockId) => courseBlockMap.get(courseBlockId))
    .filter((courseBlock): courseBlock is CourseBlock => Boolean(courseBlock));

  const orderedCourseBlockIdSet = new Set(orderedCourseBlockIds);

  const remainingCourseBlocks = courseBlocks.filter(
    (courseBlock) => !orderedCourseBlockIdSet.has(courseBlock.id),
  );

  return [...orderedCourseBlocks, ...remainingCourseBlocks];
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

    const unvisitedCourseIds = new Set(
      dayCourses.map((course) => course.id),
    );

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
          leftPercent:
            dayIndex * dayColumnWidth + columnIndex * courseWidth,
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
    courseCatalog.find(
      (faculty) => faculty.facultyCode === facultyCode,
    )?.courses ?? []
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

function getSessionById(
  course: CourseOption | undefined,
  sessionId: string,
) {
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

function removeCourseBlock(
  courseBlocks: CourseBlock[],
  courseBlockId: string | undefined,
) {
  if (!courseBlockId) {
    return courseBlocks;
  }

  return courseBlocks.filter(
    (courseBlock) => courseBlock.id !== courseBlockId,
  );
}

function DragHandleIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
      <path
        d="M4 6h12M4 10h12M4 14h12"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SortableCourseRow({
  selection,
  courseCatalog,
  onFacultyChange,
  onCourseChange,
  onSessionChange,
  onDelete,
}: SortableCourseRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: selection.id,
  });

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
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition:
          transition ??
          "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms ease, box-shadow 160ms ease",
        zIndex: isDragging ? 20 : undefined,
      }}
      className={`${sortableGridClassName} border transition-[background-color,border-color,box-shadow,opacity] duration-200 ease-out ${
        isDragging
          ? "border-blue-200 bg-blue-50/40 opacity-20"
          : "border-transparent bg-transparent hover:border-gray-200 hover:bg-gray-50/70"
      }`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label="Drag to reorder course"
        title="Drag to reorder"
        className="flex h-10 w-9 touch-none cursor-grab items-center justify-center rounded-lg bg-transparent text-gray-400 transition-[background-color,color,transform] duration-150 ease-out hover:bg-gray-100/80 hover:text-gray-600 active:scale-95 active:cursor-grabbing active:bg-gray-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
        {...attributes}
        {...listeners}
      >
        <DragHandleIcon />
      </button>

      <select
        value={selection.facultyCode}
        onChange={(event) =>
          onFacultyChange(selection.id, event.target.value)
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
          onCourseChange(selection.id, event.target.value)
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
          onSessionChange(selection.id, event.target.value)
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
        onClick={() => onDelete(selection)}
        className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 shadow-sm transition-colors duration-200 hover:bg-red-100"
      >
        Delete
      </button>
    </div>
  );
}

function DraggedCourseRow({
  selection,
  courseCatalog,
}: {
  selection: CourseSelection;
  courseCatalog: FacultyOption[];
}) {
  const selectedCourse = getCourseById(
    courseCatalog,
    selection.facultyCode,
    selection.courseId,
  );

  const selectedSession = getSessionById(
    selectedCourse,
    selection.sessionId,
  );

  const facultyText = selection.facultyCode || "Faculty Code";

  const courseText = selectedCourse
    ? `${selectedCourse.code} - ${selectedCourse.title}`
    : "Course Code and Name";

  const sessionText = selectedSession
    ? `${selectedSession.day}, ${selectedSession.startTime} - ${
        selectedSession.endTime
      }${selectedSession.room ? `, ${selectedSession.room}` : ""}`
    : "Session";

  return (
    <div
      className={`${sortableGridClassName} cursor-grabbing border border-blue-300 bg-white shadow-xl ring-2 ring-blue-100/80`}
    >
      <div className="flex h-10 w-9 items-center justify-center rounded-lg bg-transparent text-gray-500">
        <DragHandleIcon />
      </div>

      <div className={overlayFieldClassName}>
        <span className="truncate">{facultyText}</span>
      </div>

      <div className={overlayFieldClassName}>
        <span className="truncate">{courseText}</span>
      </div>

      <div className={overlayFieldClassName}>
        <span className="truncate">{sessionText}</span>
      </div>

      <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 shadow-sm">
        Delete
      </div>
    </div>
  );
}

export default function WeeklyCalendar() {
  const [courseCatalog] = useState<FacultyOption[]>(mockCourseCatalog);

  const [weeklyPrograms, setWeeklyPrograms] = useState<WeeklyProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [programName, setProgramName] = useState("");
  const [hasLoadedPrograms, setHasLoadedPrograms] = useState(false);

  const [activeSelectionId, setActiveSelectionId] = useState<
    string | null
  >(null);

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
      weeklyPrograms.find(
        (program) => program.id === selectedProgramId,
      ) ?? null,
    [weeklyPrograms, selectedProgramId],
  );

  const courseBlocks = selectedProgram?.courseBlocks ?? [];
  const courseSelections = selectedProgram?.courseSelections ?? [];
  const savedProgramName = selectedProgram?.name ?? "";

  const hasUnsavedNameChanges = programName !== savedProgramName;

  const calendarHeight = (timeLabels.length - 1) * SLOT_HEIGHT;

  const activeSelection =
    courseSelections.find(
      (selection) => selection.id === activeSelectionId,
    ) ?? null;

  const courseLayoutMap = useMemo(
    () => getCourseLayoutMap(courseBlocks),
    [courseBlocks],
  );

  useEffect(() => {
    let savedPrograms: WeeklyProgram[] = [];

    try {
      const storedPrograms = localStorage.getItem(
        WEEKLY_PROGRAMS_STORAGE_KEY,
      );

      if (storedPrograms) {
        const parsedPrograms: unknown = JSON.parse(storedPrograms);

        if (Array.isArray(parsedPrograms)) {
          savedPrograms = parsedPrograms as WeeklyProgram[];
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
    setHasLoadedPrograms(true);
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

  function updateSelectedProgram(
    updater: (program: WeeklyProgram) => WeeklyProgram,
  ) {
    setWeeklyPrograms((currentPrograms) =>
      currentPrograms.map((program) =>
        program.id === selectedProgramId
          ? updater(program)
          : program,
      ),
    );
  }

  function confirmDiscardUnsavedName() {
    if (!hasUnsavedNameChanges) {
      return true;
    }

    return window.confirm(
      "The program name has not been saved. Discard the name change?",
    );
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
      `Program ${weeklyPrograms.length + 1}`,
    );

    setWeeklyPrograms((currentPrograms) => [
      ...currentPrograms,
      newProgram,
    ]);

    setSelectedProgramId(newProgram.id);
    setProgramName(newProgram.name);
    setActiveSelectionId(null);
  }

  function handleSaveProgramName() {
    if (!selectedProgram) {
      return;
    }

    const trimmedProgramName =
      programName.trim() || "Untitled Program";

    updateSelectedProgram((program) => ({
      ...program,
      name: trimmedProgramName,
      updatedAt: new Date().toISOString(),
    }));

    setProgramName(trimmedProgramName);
  }

  function handleProgramNameKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    handleSaveProgramName();
  }

  function handleDeleteProgram() {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${
        selectedProgram?.name ?? "this program"
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
      sessionId: "",
    };

    updateSelectedProgram((program) => ({
      ...program,
      courseSelections: [
        newSelection,
        ...(program.courseSelections ?? []),
      ],
      updatedAt: new Date().toISOString(),
    }));
  }

  function handleDeleteSelection(selection: CourseSelection) {
    updateSelectedProgram((program) => ({
      ...program,
      courseBlocks: removeCourseBlock(
        program.courseBlocks ?? [],
        selection.courseBlockId,
      ),
      courseSelections: (program.courseSelections ?? []).filter(
        (currentSelection) =>
          currentSelection.id !== selection.id,
      ),
      updatedAt: new Date().toISOString(),
    }));
  }

  function handleFacultyChange(
    selectionId: string,
    facultyCode: string,
  ) {
    updateSelectedProgram((program) => {
      const currentSelections = program.courseSelections ?? [];

      const currentSelection = currentSelections.find(
        (selection) => selection.id === selectionId,
      );

      return {
        ...program,
        courseBlocks: removeCourseBlock(
          program.courseBlocks ?? [],
          currentSelection?.courseBlockId,
        ),
        courseSelections: currentSelections.map((selection) =>
          selection.id === selectionId
            ? {
                ...selection,
                facultyCode,
                courseId: "",
                sessionId: "",
                courseBlockId: undefined,
              }
            : selection,
        ),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function handleCourseChange(
    selectionId: string,
    courseId: string,
  ) {
    updateSelectedProgram((program) => {
      const currentSelections = program.courseSelections ?? [];

      const currentSelection = currentSelections.find(
        (selection) => selection.id === selectionId,
      );

      return {
        ...program,
        courseBlocks: removeCourseBlock(
          program.courseBlocks ?? [],
          currentSelection?.courseBlockId,
        ),
        courseSelections: currentSelections.map((selection) =>
          selection.id === selectionId
            ? {
                ...selection,
                courseId,
                sessionId: "",
                courseBlockId: undefined,
              }
            : selection,
        ),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function handleSessionChange(
    selectionId: string,
    sessionId: string,
  ) {
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

      const selectedSession = getSessionById(
        selectedCourse,
        sessionId,
      );

      if (!selectedCourse || !selectedSession) {
        return {
          ...program,
          courseSelections: currentSelections.map((selection) =>
            selection.id === selectionId
              ? {
                  ...selection,
                  sessionId,
                }
              : selection,
          ),
          updatedAt: new Date().toISOString(),
        };
      }

      const courseBlockId =
        currentSelection.courseBlockId ?? createId("course");

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

      const currentCourseBlocks = program.courseBlocks ?? [];

      const courseBlockAlreadyExists = currentCourseBlocks.some(
        (courseBlock) => courseBlock.id === courseBlockId,
      );

      const updatedCourseBlocks = courseBlockAlreadyExists
        ? currentCourseBlocks.map((courseBlock) =>
            courseBlock.id === courseBlockId
              ? newCourseBlock
              : courseBlock,
          )
        : [...currentCourseBlocks, newCourseBlock];

      return {
        ...program,
        courseBlocks: updatedCourseBlocks,
        courseSelections: currentSelections.map((selection) =>
          selection.id === selectionId
            ? {
                ...selection,
                sessionId,
                courseBlockId,
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

  return (
    <div className="w-full space-y-4">
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

              <option value={NEW_PROGRAM_VALUE}>
                + New Program
              </option>
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Program Name
            </label>

            <input
              type="text"
              value={programName}
              onChange={(event) =>
                setProgramName(event.target.value)
              }
              onKeyDown={handleProgramNameKeyDown}
              placeholder="Program name"
              className={inputClassName}
            />
          </div>

          <button
            type="button"
            onClick={handleSaveProgramName}
            disabled={
              !hasLoadedPrograms || !hasUnsavedNameChanges
            }
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
          >
            Save
          </button>

          <button
            type="button"
            onClick={handleDeleteProgram}
            disabled={!hasLoadedPrograms}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition-colors duration-200 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete Program
          </button>
        </div>

        <div
          className="mb-4 text-xs text-gray-500"
          aria-live="polite"
        >
          {hasUnsavedNameChanges ? (
            <span className="font-medium text-orange-600">
              Program name is not saved. Course changes are saved
              automatically.
            </span>
          ) : selectedProgram?.updatedAt ? (
            <span>
              Courses save automatically · Last updated{" "}
              {formatUpdatedAt(selectedProgram.updatedAt)}
            </span>
          ) : (
            <span>Courses save automatically</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAddSelectionRow}
          disabled={!selectedProgram}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          Add Course
        </button>

        {courseSelections.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="text-xs text-gray-500">
              Hold the three-line handle and drag the complete row to
              change the course order.
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveSelectionId(null)}
            >
              <SortableContext
                items={courseSelections.map(
                  (selection) => selection.id,
                )}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {courseSelections.map((selection) => (
                    <SortableCourseRow
                      key={selection.id}
                      selection={selection}
                      courseCatalog={courseCatalog}
                      onFacultyChange={handleFacultyChange}
                      onCourseChange={handleCourseChange}
                      onSessionChange={handleSessionChange}
                      onDelete={handleDeleteSelection}
                    />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay
                adjustScale={false}
                dropAnimation={dropAnimation}
              >
                {activeSelection ? (
                  <DraggedCourseRow
                    selection={activeSelection}
                    courseCatalog={courseCatalog}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
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

          <div
            className="relative ml-12"
            style={{
              height: calendarHeight,
            }}
          >
            {timeLabels.map((time, index) => (
              <div
                key={time}
                className="absolute left-0 w-full border-t border-gray-200"
                style={{
                  top: index * SLOT_HEIGHT,
                }}
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

              const height = getCourseHeight(
                course.startTime,
                course.endTime,
              );

              const layout = courseLayoutMap[course.id];

              if (!layout) {
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
                  <div className="h-full overflow-hidden rounded-lg border border-blue-300 bg-blue-100/85 p-2 text-xs shadow-sm transition-[transform,background-color,box-shadow] duration-200 ease-out hover:scale-[1.02] hover:bg-blue-100 hover:shadow-md">
                    <div className="font-semibold text-blue-900">
                      {course.code}
                    </div>

                    <div className="mt-1 text-blue-800">
                      {course.title}
                    </div>

                    <div className="mt-1 text-blue-700">
                      {course.startTime} - {course.endTime}
                    </div>

                    {course.room && (
                      <div className="mt-1 text-blue-700">
                        {course.room}
                      </div>
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