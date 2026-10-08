import type { ItuCourseCatalog } from "@/lib/itu/types";
import type { FacultyOption } from "@/types/calendar";
import { normalizeCourseCode } from "@/lib/itu/courseCode.mjs";

export function toCalendarCatalog(
  catalog: ItuCourseCatalog,
  localCredits?: ReadonlyMap<string, number | null>,
): FacultyOption {
  return {
    facultyCode: catalog.branchCode,
    semester: catalog.semester,
    fetchedAt: catalog.fetchedAt,
    courses: catalog.courses.map((course) => ({
      id: course.id,
      code: course.code,
      title: course.title,
      ...(localCredits ? { localCredits: localCredits.get(normalizeCourseCode(course.code)) ?? null } : {}),
      sections: course.sections.map((section) => ({
        id: section.id,
        crn: section.crn,
        majorRestriction: section.majorRestriction,
        programRestriction: section.programRestriction,
        semester: section.semester ?? catalog.semester,
        instructor: section.instructor,
        teachingMethod: section.teachingMethod,
        capacity: section.capacity,
        enrolled: section.enrolled,
        meetings: section.meetings.map((meeting, index) => ({
          id: `${section.id}:meeting:${index}`,
          day: meeting.day,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          building: meeting.building,
          room: meeting.room,
        })),
      })),
    })),
  };
}
