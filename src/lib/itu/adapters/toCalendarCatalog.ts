import type { ItuCourseCatalog } from "@/lib/itu/types";
import type { FacultyOption } from "@/types/calendar";

export function toCalendarCatalog(
  catalog: ItuCourseCatalog,
): FacultyOption {
  return {
    facultyCode: catalog.branchCode,
    courses: catalog.courses.map((course) => ({
      id: course.id,
      code: course.code,
      title: course.title,
      sections: course.sections.map((section) => ({
        id: section.id,
        crn: section.crn,
        instructor: section.instructor,
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
