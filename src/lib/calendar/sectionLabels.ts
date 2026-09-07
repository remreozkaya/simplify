import {
  DEFAULT_LANGUAGE,
  localizedWeekday,
  translate,
  type Language,
} from "@/lib/i18n";
import type { CourseSectionOption } from "@/types/calendar";

export function formatSectionLabel(
  section: CourseSectionOption,
  language: Language = DEFAULT_LANGUAGE,
) {
  const meetings = section.meetings
    .map(
      (meeting) =>
        `${localizedWeekday(language, meeting.day, "short")} ${meeting.startTime}–${meeting.endTime}`,
    )
    .join(", ");
  return [
    section.crn,
    meetings,
    section.instructor ?? translate(language, "weeklyPlanner.tba"),
  ]
    .filter(Boolean)
    .join(" · ");
}
