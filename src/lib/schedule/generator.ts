import { satisfiesConstraints } from "@/lib/schedule/constraints";
import {
  hasMeetingConflicts,
  sectionConflicts,
} from "@/lib/schedule/conflicts";
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
const MAX_GENERATION_VISITED_NODES = 250_000;
export const LARGE_SEARCH_SPACE_THRESHOLD = 50_000;

type IndexedSelection = GeneratedCourseSelection & {
  courseIndex: number;
};

export function calculateCombinationCount(
  courses: readonly GeneratorCourse[],
): number {
  return courses.reduce((count, course) => {
    const sectionCount = course.pinnedSectionId
      ? course.sections.some((section) => section.id === course.pinnedSectionId)
        ? 1
        : 0
      : course.sections.length;

    if (count > Number.MAX_SAFE_INTEGER / Math.max(1, sectionCount)) {
      return Number.MAX_SAFE_INTEGER;
    }

    return count * sectionCount;
  }, 1);
}

export function generateConflictFreeSchedules(
  courses: readonly GeneratorCourse[],
  options: GenerateScheduleOptions = {},
): GenerateScheduleResult {
  if (courses.length === 0) {
    return {
      schedules: [],
      truncated: false,
      visitedNodes: 0,
      searchLimitReached: false,
    };
  }

  const maxResults = Math.max(
    1,
    Math.floor(options.maxResults ?? MAX_GENERATED_SCHEDULES),
  );
  const constraints = options.constraints ?? { excludedDays: [] };
  const stopAfterFirst = options.stopAfterFirst ?? false;
  const weights = options.weights ?? DEFAULT_SCHEDULE_WEIGHTS;
  const maxVisitedNodes = Math.max(
    1,
    Math.floor(options.maxVisitedNodes ?? MAX_GENERATION_VISITED_NODES),
  );

  const searchableCourses = courses
    .map((course, courseIndex) => ({
      course,
      courseIndex,
      sections: [...course.sections]
        .filter(
          (section) =>
            (!course.pinnedSectionId ||
              section.id === course.pinnedSectionId) &&
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
    return {
      schedules: [],
      truncated: false,
      visitedNodes: 0,
      searchLimitReached: false,
    };
  }

  const schedules: GeneratedSchedule[] = [];
  let visitedNodes = 0;
  let truncated = false;
  let searchLimitReached = false;
  let foundFirst = false;

  function visit(
    index: number,
    selections: IndexedSelection[],
    meetings: GeneratedMeeting[],
  ): void {
    if (truncated || searchLimitReached || foundFirst) {
      return;
    }

    if (visitedNodes >= maxVisitedNodes) {
      searchLimitReached = true;
      return;
    }

    visitedNodes += 1;

    if (index === searchableCourses.length) {
      // Defense in depth: even though every section is checked while it is
      // added, never publish an assignment that fails the complete-set check.
      if (hasMeetingConflicts(meetings)) {
        return;
      }
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
        conflictCount: 0,
        totalConflictMinutes: 0,
        metrics,
        score: scoreSchedule(metrics, weights),
      });

      if (stopAfterFirst) {
        foundFirst = true;
        return;
      }

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
          teachingMethod: section.teachingMethod,
          capacity: section.capacity,
          enrolled: section.enrolled,
        }),
      );

      visit(
        index + 1,
        [...selections, selection],
        [...meetings, ...sectionMeetings],
      );

      if (truncated || searchLimitReached || foundFirst) {
        return;
      }
    }
  }

  visit(0, [], []);

  return {
    schedules: rankSchedules(schedules).slice(0, maxResults),
    truncated,
    visitedNodes,
    searchLimitReached,
  };
}

export function generateSchedules(
  courses: readonly GeneratorCourse[],
  options: GenerateScheduleOptions = {},
): GenerateScheduleResult {
  const conflictFreeResult = generateConflictFreeSchedules(courses, options);
  return {
    ...conflictFreeResult,
    schedules: conflictFreeResult.schedules.filter(
      (schedule) => schedule.conflictCount === 0 && !hasMeetingConflicts(schedule.meetings),
    ),
    usedConflictFallback: false,
  };
}
