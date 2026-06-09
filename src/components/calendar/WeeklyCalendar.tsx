"use client";

import { useState } from "react";

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type Day = (typeof days)[number];

type CourseBlock = {
  id: string;
  code: string;
  title: string;
  day: Day;
  startTime: string;
  endTime: string;
  room?: string;
};

type CourseSession = {
  id: string;
  day: Day;
  startTime: string;
  endTime: string;
  room?: string;
};

type CourseOption = {
  id: string;
  code: string;
  title: string;
  sessions: CourseSession[];
};

type FacultyOption = {
  facultyCode: string;
  courses: CourseOption[];
};

type CourseSelection = {
  id: string;
  facultyCode: string;
  courseId: string;
  sessionId: string;
  courseBlockId?: string;
};

// Calendar scale settings.
const SLOT_HEIGHT = 26;
const SLOT_MINUTES = 30;
const START_TIME = "08:00";

// Temporary static course data. Later, this can come from an API or database.
const courseCatalog: FacultyOption[] = [
  {
    facultyCode: "BLG",
    courses: [
      {
        id: "blg-312e",
        code: "BLG 312E",
        title: "Operating Systems",
        sessions: [
          {
            id: "blg-312e-1",
            day: "Monday",
            startTime: "09:30",
            endTime: "12:30",
            room: "MED A-23",
          },
          {
            id: "blg-312e-2",
            day: "Thursday",
            startTime: "13:30",
            endTime: "16:30",
            room: "MED A-24",
          },
        ],
      },
      {
        id: "blg-242e",
        code: "BLG 242E",
        title: "Logic Circuits Laboratory",
        sessions: [
          {
            id: "blg-242e-1",
            day: "Friday",
            startTime: "14:00",
            endTime: "16:00",
            room: "DCL LAB",
          },
        ],
      },
    ],
  },
  {
    facultyCode: "MAT",
    courses: [
      {
        id: "mat-271e",
        code: "MAT 271E",
        title: "Probability and Statistics With A Very Long Example Name",
        sessions: [
          {
            id: "mat-271e-1",
            day: "Tuesday",
            startTime: "10:00",
            endTime: "12:00",
            room: "FEB B-04",
          },
          {
            id: "mat-271e-2",
            day: "Wednesday",
            startTime: "15:30",
            endTime: "17:30",
            room: "FEB B-07",
          },
        ],
      },
    ],
  },
  {
    facultyCode: "EEF",
    courses: [
      {
        id: "eef-231e",
        code: "EEF 231E",
        title: "Circuit Analysis",
        sessions: [
          {
            id: "eef-231e-1",
            day: "Wednesday",
            startTime: "13:30",
            endTime: "15:30",
            room: "EEF 2101",
          },
        ],
      },
    ],
  },
  {
    facultyCode: "EHB",
    courses: [
      {
        id: "ehb-222e",
        code: "EHB 222E",
        title: "Signals and Systems",
        sessions: [
          {
            id: "ehb-222e-1",
            day: "Friday",
            startTime: "08:30",
            endTime: "11:30",
            room: "EHB Z-01",
          },
        ],
      },
    ],
  },
];

const selectClassName =
  "min-w-0 w-full truncate rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400";

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

// Converts a course start time into its vertical position in the calendar.
function getCourseTop(startTime: string) {
  const startMinutes = timeToMinutes(startTime);
  const calendarStartMinutes = timeToMinutes(START_TIME);

  return ((startMinutes - calendarStartMinutes) / SLOT_MINUTES) * SLOT_HEIGHT;
}

// Converts course duration into visual block height.
function getCourseHeight(startTime: string, endTime: string) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return ((endMinutes - startMinutes) / SLOT_MINUTES) * SLOT_HEIGHT;
}

function getDayIndex(day: Day) {
  return days.indexOf(day);
}

function getCoursesByFaculty(facultyCode: string) {
  return (
    courseCatalog.find((faculty) => faculty.facultyCode === facultyCode)
      ?.courses ?? []
  );
}

function getCourseById(facultyCode: string, courseId: string) {
  return getCoursesByFaculty(facultyCode).find(
    (course) => course.id === courseId,
  );
}

function getSessionById(course: CourseOption | undefined, sessionId: string) {
  return course?.sessions.find((session) => session.id === sessionId);
}

const timeLabels = generateTimeLabels();

export default function WeeklyCalendar() {
  // Actual course blocks shown on the weekly calendar.
  const [courseBlocks, setCourseBlocks] = useState<CourseBlock[]>([]);

  // Selection rows shown under the Add Course button.
  const [courseSelections, setCourseSelections] = useState<CourseSelection[]>(
    [],
  );

  const calendarHeight = (timeLabels.length - 1) * SLOT_HEIGHT;

  function handleAddSelectionRow() {
    const newSelection: CourseSelection = {
      id: `selection-${Date.now()}`,
      facultyCode: "",
      courseId: "",
      sessionId: "",
    };

    // New selection rows appear above older rows.
    setCourseSelections((currentSelections) => [
      newSelection,
      ...currentSelections,
    ]);
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

        // Changing faculty resets the later choices and removes the old calendar block.
        return {
          ...selection,
          facultyCode,
          courseId: "",
          sessionId: "",
          courseBlockId: undefined,
        };
      }),
    );
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

        // Changing course resets the selected session and removes the old calendar block.
        return {
          ...selection,
          courseId,
          sessionId: "",
          courseBlockId: undefined,
        };
      }),
    );
  }

  function handleSessionChange(selectionId: string, sessionId: string) {
    setCourseSelections((currentSelections) =>
      currentSelections.map((selection) => {
        if (selection.id !== selectionId) {
          return selection;
        }

        const selectedCourse = getCourseById(
          selection.facultyCode,
          selection.courseId,
        );

        const selectedSession = getSessionById(selectedCourse, sessionId);

        if (!selectedCourse || !selectedSession) {
          return {
            ...selection,
            sessionId,
          };
        }

        const courseBlockId =
          selection.courseBlockId ?? `course-${Date.now()}`;

        const newCourseBlock: CourseBlock = {
          id: courseBlockId,
          code: selectedCourse.code,
          title: selectedCourse.title,
          day: selectedSession.day,
          startTime: selectedSession.startTime,
          endTime: selectedSession.endTime,
          room: selectedSession.room,
        };

        // Selecting the session creates or updates the visible course block.
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

        return {
          ...selection,
          sessionId,
          courseBlockId,
        };
      }),
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
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
                selection.facultyCode,
              );

              const selectedCourse = getCourseById(
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
              const dayIndex = getDayIndex(course.day);
              const top = getCourseTop(course.startTime);
              const height = getCourseHeight(course.startTime, course.endTime);

              return (
                <div
                  key={course.id}
                  className="absolute z-10 px-1"
                  style={{
                    top,
                    height,
                    left: `${(dayIndex / days.length) * 100}%`,
                    width: `${100 / days.length}%`,
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