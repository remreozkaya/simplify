import {
  type CourseSectionOption,
  type Day,
} from "@/types/calendar";

const shortDays: Record<Day, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

export function formatSectionLabel(section: CourseSectionOption) {
  const meetings = section.meetings
    .map(
      (meeting) =>
        `${shortDays[meeting.day]} ${meeting.startTime}–${meeting.endTime}`,
    )
    .join(", ");

  return [section.crn, meetings, section.instructor ?? "TBA"]
    .filter(Boolean)
    .join(" · ");
}
