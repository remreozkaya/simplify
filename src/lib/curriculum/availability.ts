import { isCourseTakeableThisSemester } from "@/lib/curriculum/eligibility";
import { progressForRequirement } from "@/lib/curriculum/graduation";
import type { CourseProgress, CurriculumProgress } from "@/lib/curriculum/types";
import type { ItuCurriculum, ItuCurriculumItem, ItuElectiveCourse, ItuElectiveSlot } from "@/lib/itu/curriculum/types";

export function courseBranch(courseCode: string): string {
  return courseCode.split(" ")[0];
}

export function curriculumPrerequisitesKnown(curriculum: ItuCurriculum, courseCode: string): boolean {
  return (
    curriculum.prerequisiteDataAvailable &&
    curriculum.prerequisiteBranchesLoaded.includes(courseBranch(courseCode))
  );
}

export function availableCoursesForElectiveSlot(
  slot: ItuElectiveSlot,
  curriculum: ItuCurriculum,
  progress: CurriculumProgress,
  resolvedProgress: Record<string, CourseProgress>,
  offeredCourseCodes: ReadonlySet<string>,
): ItuElectiveCourse[] {
  if (progressForRequirement(slot, progress)?.course.state === "passed") return [];

  return slot.courses.filter((course) =>
    isCourseTakeableThisSemester(
      course.code,
      curriculum.prerequisites[course.code],
      resolvedProgress,
      offeredCourseCodes,
      curriculumPrerequisitesKnown(curriculum, course.code),
    ),
  );
}

export function isCurriculumItemAvailableThisSemester(
  item: ItuCurriculumItem,
  curriculum: ItuCurriculum,
  progress: CurriculumProgress,
  resolvedProgress: Record<string, CourseProgress>,
  offeredCourseCodes: ReadonlySet<string>,
): boolean {
  if (progressForRequirement(item, progress)?.course.state === "passed") return false;

  if (item.kind === "elective-slot") {
    return availableCoursesForElectiveSlot(
      item,
      curriculum,
      progress,
      resolvedProgress,
      offeredCourseCodes,
    ).length > 0;
  }

  return isCourseTakeableThisSemester(
    item.code,
    curriculum.prerequisites[item.code],
    resolvedProgress,
    offeredCourseCodes,
    curriculumPrerequisitesKnown(curriculum, item.code),
  );
}
