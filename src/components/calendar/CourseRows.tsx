"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  getCoursesByFaculty,
  getCourseById,
  getSectionById,
} from "@/lib/calendar/catalog";
import { formatSectionLabel } from "@/lib/calendar/sectionLabels";
import { useLanguage } from "@/lib/i18n/client";
import type { CourseSelection, FacultyOption } from "@/types/calendar";

const selectClassName =
  "min-w-0 w-full truncate rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-out focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400";

const overlayFieldClassName =
  "flex h-10 min-w-0 w-full items-center truncate rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm";

export const courseRowGridClassName =
  "grid w-full min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,2fr)_minmax(0,3fr)_5rem] items-end gap-3 rounded-xl p-2";

type SortableCourseRowProps = {
  selection: CourseSelection;
  courseCatalog: FacultyOption[];
  isLoadingBranches: boolean;
  isBranchLoading: (branchCode: string) => boolean;
  onFacultyChange: (selectionId: string, facultyCode: string) => void;
  onCourseChange: (selectionId: string, courseId: string) => void;
  onSectionChange: (selectionId: string, sectionId: string) => void;
  onDelete: (selection: CourseSelection) => void;
};

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

export function SortableCourseRow({
  selection,
  courseCatalog,
  isLoadingBranches,
  isBranchLoading,
  onFacultyChange,
  onCourseChange,
  onSectionChange,
  onDelete,
}: SortableCourseRowProps) {
  const { language, t } = useLanguage();
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

  const branchIsLoading = isBranchLoading(selection.facultyCode);

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
      className={`${courseRowGridClassName} border transition-[background-color,border-color,box-shadow,opacity] duration-200 ease-out ${
        isDragging
          ? "border-blue-200 bg-blue-50/40 opacity-20"
          : "border-transparent bg-transparent"
      }`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={t("weeklyPlanner.dragCourse")}
        title={t("weeklyPlanner.drag")}
        className="flex h-10 w-9 touch-none cursor-grab items-center justify-center rounded-lg bg-transparent text-gray-400 transition-[background-color,color,transform] duration-150 ease-out active:scale-95 active:cursor-grabbing active:bg-gray-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
        {...attributes}
        {...listeners}
        aria-roledescription={t("courses.desired")}
      >
        <DragHandleIcon />
      </button>

      <label className="min-w-0">
        <span className="sr-only">
          {t("courses.prefix")}
        </span>
        <select
          value={selection.facultyCode}
          onChange={(event) =>
            onFacultyChange(selection.id, event.target.value)
          }
          disabled={isLoadingBranches}
          className={selectClassName}
        >
          <option value="">
            {t(
              isLoadingBranches ? "courses.loadingPrefixes" : "courses.prefix",
            )}
          </option>

          {courseCatalog.map((faculty) => (
            <option key={faculty.facultyCode} value={faculty.facultyCode}>
              {faculty.facultyCode}
            </option>
          ))}
        </select>
      </label>

      <label className="min-w-0">
        <span className="sr-only">
          {t("courses.desired")}
        </span>
        <select
          value={selection.courseId}
          onChange={(event) => onCourseChange(selection.id, event.target.value)}
          disabled={!selection.facultyCode || branchIsLoading}
          className={selectClassName}
        >
          <option value="">
            {t(
              branchIsLoading
                ? "courses.loadingCourses"
                : "courses.codeAndName",
            )}
          </option>

          {availableCourses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} - {course.title}
            </option>
          ))}
        </select>
      </label>

      <label className="min-w-0">
        <span className="sr-only">
          {t("weeklyPlanner.crnSection")}
        </span>
        <select
          value={selection.sectionId}
          onChange={(event) =>
            onSectionChange(selection.id, event.target.value)
          }
          disabled={!selection.courseId || branchIsLoading}
          className={selectClassName}
        >
          <option value="">{t("weeklyPlanner.crnSection")}</option>

          {selectedCourse?.sections.map((section) => (
            <option key={section.id} value={section.id}>
              {formatSectionLabel(section, language)}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={() => onDelete(selection)}
        className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 shadow-sm transition-colors duration-200"
      >
        {t("weeklyPlanner.delete")}
      </button>
    </div>
  );
}

export function DraggedCourseRow({
  selection,
  courseCatalog,
}: {
  selection: CourseSelection;
  courseCatalog: FacultyOption[];
}) {
  const { language, t } = useLanguage();
  const selectedCourse = getCourseById(
    courseCatalog,
    selection.facultyCode,
    selection.courseId,
  );

  const selectedSection = getSectionById(selectedCourse, selection.sectionId);

  const facultyText = selection.facultyCode || t("courses.prefix");

  const courseText = selectedCourse
    ? `${selectedCourse.code} - ${selectedCourse.title}`
    : t("courses.codeAndName");

  const sectionText = selectedSection
    ? formatSectionLabel(selectedSection, language)
    : t("weeklyPlanner.crnSection");

  return (
    <div
      className={`${courseRowGridClassName} cursor-grabbing border border-blue-300 bg-white shadow-xl ring-2 ring-blue-100/80`}
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
        <span className="truncate">{sectionText}</span>
      </div>

      <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 shadow-sm">
        {t("weeklyPlanner.delete")}
      </div>
    </div>
  );
}
