import { satisfiesConstraints } from "@/lib/schedule/constraints";
import { sectionConflicts } from "@/lib/schedule/conflicts";
import { calculateScheduleMetrics } from "@/lib/schedule/metrics";
import {
  DEFAULT_SCHEDULE_WEIGHTS,
  rankSchedules,
  scoreSchedule,
} from "@/lib/schedule/scoring";
import type {
  GeneratedCourseSelection,
  GeneratedMeeting,
  GeneratedSchedule,
  GenerateScheduleOptions,
  GenerateScheduleResult,
  GeneratorCourse,
} from "@/lib/schedule/types";

export const MAX_GENERATED_SCHEDULES = 500;
export const LARGE_SEARCH_SPACE_THRESHOLD = 50_000;

type IndexedSelection = GeneratedCourseSelection & {
  courseIndex: number;
};

export function calculateCombinationCount(
  courses: readonly GeneratorCourse[],
): number {
  return courses.reduce((count, course) => {
    if (count > Number.MAX_SAFE_INTEGER / Math.max(1, course.sections.length)) {
      return Number.MAX_SAFE_INTEGER;
    }

    return count * course.sections.length;
  }, 1);
}

export function generateConflictFreeSchedules(
  courses: readonly GeneratorCourse[],
  options: GenerateScheduleOptions = {},
): GenerateScheduleResult {
  if (courses.length === 0) {
    return { schedules: [], truncated: false, visitedNodes: 0 };
  }

  const maxResults = Math.max(
    1,
    Math.floor(options.maxResults ?? MAX_GENERATED_SCHEDULES),
  );
  const constraints = options.constraints ?? { excludedDays: [] };
  const weights = options.weights ?? DEFAULT_SCHEDULE_WEIGHTS;

  const searchableCourses = courses
    .map((course, courseIndex) => ({
      course,
      courseIndex,
      sections: [...course.sections]
        .filter(
          (section) =>
            section.meetings.length > 0 &&
            satisfiesConstraints(section.meetings, constraints),
        )
        .sort(
          (first, second) =>
            first.crn.localeCompare(second.crn, undefined, {
              numeric: true,
            }) || first.id.localeCompare(second.id),
        ),
    }))
    .sort(
      (first, second) =>
        first.sections.length - second.sections.length ||
        first.courseIndex - second.courseIndex,
    );

  if (searchableCourses.some((course) => course.sections.length === 0)) {
    return { schedules: [], truncated: false, visitedNodes: 0 };
  }

  const schedules: GeneratedSchedule[] = [];
  let visitedNodes = 0;
  let truncated = false;

  function visit(
    index: number,
    selections: IndexedSelection[],
    meetings: GeneratedMeeting[],
  ): void {
    if (truncated) {
      return;
    }

    visitedNodes += 1;

    if (index === searchableCourses.length) {
      const orderedSelections = [...selections]
        .sort((first, second) => first.courseIndex - second.courseIndex)
        .map((selection) => ({
          branchCode: selection.branchCode,
          courseId: selection.courseId,
          courseCode: selection.courseCode,
          sectionId: selection.sectionId,
          crn: selection.crn,
        }));
      const metrics = calculateScheduleMetrics(meetings);

      schedules.push({
        id: orderedSelections
          .map(
            (selection) =>
              `${selection.branchCode}:${selection.courseId}:${selection.crn}`,
          )
          .join("|"),
        selections: orderedSelections,
        meetings: [...meetings],
        metrics,
        score: scoreSchedule(metrics, weights),
      });

      if (schedules.length > maxResults) {
        truncated = true;
      }

      return;
    }

    const { course, courseIndex, sections } = searchableCourses[index];

    for (const section of sections) {
      if (sectionConflicts(section.meetings, meetings)) {
        continue;
      }

      const selection: IndexedSelection = {
        courseIndex,
        branchCode: course.branchCode,
        courseId: course.courseId,
        courseCode: course.courseCode,
        sectionId: section.id,
        crn: section.crn,
      };
      const sectionMeetings: GeneratedMeeting[] = section.meetings.map(
        (meeting) => ({
          ...meeting,
          branchCode: course.branchCode,
          courseId: course.courseId,
          courseCode: course.courseCode,
          courseTitle: course.courseTitle,
          sectionId: section.id,
          crn: section.crn,
          instructor: section.instructor,
        }),
      );

      visit(
        index + 1,
        [...selections, selection],
        [...meetings, ...sectionMeetings],
      );

      if (truncated) {
        return;
      }
    }
  }

  visit(0, [], []);

  return {
    schedules: rankSchedules(schedules).slice(0, maxResults),
    truncated,
    visitedNodes,
  };
}
