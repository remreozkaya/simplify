"use client";

import { useEffect, useRef } from "react";
import { localizedWeekday } from "@/lib/i18n";
import { useLanguage } from "@/lib/i18n/client";
import type { CourseBlock, CourseSectionOption } from "@/types/calendar";

export default function CourseDetails({
  course,
  section,
  meetings,
  onClose,
}: {
  course: CourseBlock;
  section?: CourseSectionOption;
  meetings: CourseBlock[];
  onClose: () => void;
}) {
  const { language, t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const fields = [
    { label: t("weeklyPlanner.crn"), value: section?.crn ?? course.crn },
    { label: t("common.courseCode"), value: course.code },
    { label: t("weeklyPlanner.courseTitle"), value: course.title },
    {
      label: t("weeklyPlanner.teachingMethod"),
      value: section?.teachingMethod ?? course.teachingMethod,
    },
    { label: t("weeklyPlanner.instructor"), value: section?.instructor ?? course.instructor },
    { label: t("weeklyPlanner.capacity"), value: section?.capacity ?? course.capacity },
    { label: t("weeklyPlanner.enrolled"), value: section?.enrolled ?? course.enrolled },
  ];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="course-details-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-xl border border-gray-200 bg-white p-0 text-gray-700 shadow-xl backdrop:bg-black/30"
    >
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id="course-details-title" className="text-lg font-semibold">
            {t("weeklyPlanner.courseDetails")} · {course.code}
          </h2>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label={t("weeklyPlanner.closeDetails")}
            className="rounded-lg px-3 py-1 text-xl focus-visible:outline-2 focus-visible:outline-blue-500"
          >
            ×
          </button>
        </div>
        <dl className="space-y-2 text-sm">
          {fields.map(({ label, value }) => (
            <div key={label} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-baseline gap-x-4">
              <dt className="font-semibold text-gray-700">{label}</dt>
              <dd className="min-w-0 break-words text-gray-700">
                {value ?? t("weeklyPlanner.unspecified")}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 space-y-3">
          {meetings.map((meeting) => (
            <dl key={meeting.id} className="space-y-2 border-t border-gray-200 pt-3 text-sm">
              {[
                { label: t("weeklyPlanner.building"), value: meeting.building },
                { label: t("weeklyPlanner.day"), value: localizedWeekday(language, meeting.day) },
                { label: t("weeklyPlanner.time"), value: `${meeting.startTime} – ${meeting.endTime}` },
                { label: t("weeklyPlanner.room"), value: meeting.room },
              ].map(({ label, value }) => (
                <div key={label} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-baseline gap-x-4">
                  <dt className="font-semibold text-gray-700">{label}</dt>
                  <dd className="min-w-0 break-words text-gray-700">
                    {value ?? t("weeklyPlanner.unspecified")}
                  </dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      </div>
    </dialog>
  );
}
