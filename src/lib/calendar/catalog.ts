import type { CourseOption, FacultyOption } from "@/types/calendar";

export function getCoursesByFaculty(
  courseCatalog: FacultyOption[],
  facultyCode: string,
) {
  return (
    courseCatalog.find((faculty) => faculty.facultyCode === facultyCode)
      ?.courses ?? []
  );
}

export function getCourseById(
  courseCatalog: FacultyOption[],
  facultyCode: string,
  courseId: string,
) {
  return getCoursesByFaculty(courseCatalog, facultyCode).find(
    (course) => course.id === courseId,
  );
}

export function getSectionById(
  course: CourseOption | undefined,
  sectionId: string,
) {
  return course?.sections.find((section) => section.id === sectionId);
}
