import { satisfiesConstraints } from "@/lib/schedule/constraints";
import {
  calculateConflictStats,
  calculateCrossConflictStats,
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
export const MAX_GENERATION_VISITED_NODES = 250_000;
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

  function visit(
    index: number,
    selections: IndexedSelection[],
    meetings: GeneratedMeeting[],
  ): void {
    if (truncated || searchLimitReached) {
      return;
    }

    if (visitedNodes >= maxVisitedNodes) {
      searchLimitReached = true;
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
        conflictCount: 0,
        totalConflictMinutes: 0,
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

      if (truncated || searchLimitReached) {
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

/**
 * Searches the constrained Cartesian space with branch-and-bound and keeps
 * only schedules with the smallest number of overlapping meeting pairs.
 * Overlap minutes are the secondary conflict measure.
 */
export function generateLeastConflictSchedules(
  courses: readonly GeneratorCourse[],
  options: GenerateScheduleOptions = {},
): GenerateScheduleResult {
  if (courses.length === 0) {
    return {
      schedules: [],
      truncated: false,
      visitedNodes: 0,
      usedConflictFallback: true,
      searchLimitReached: false,
    };
  }

  const maxResults = Math.max(
    1,
    Math.floor(options.maxResults ?? MAX_GENERATED_SCHEDULES),
  );
  const maxVisitedNodes = Math.max(
    1,
    Math.floor(options.maxVisitedNodes ?? MAX_GENERATION_VISITED_NODES),
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
    return {
      schedules: [],
      truncated: false,
      visitedNodes: 0,
      usedConflictFallback: true,
      searchLimitReached: false,
    };
  }

  let schedules: GeneratedSchedule[] = [];
  let bestConflictCount = Number.POSITIVE_INFINITY;
  let bestConflictMinutes = Number.POSITIVE_INFINITY;
  let visitedNodes = 0;
  let truncated = false;
  let searchLimitReached = false;

  function visit(
    index: number,
    selections: IndexedSelection[],
    meetings: GeneratedMeeting[],
    conflictCount: number,
    totalConflictMinutes: number,
  ): void {
    if (searchLimitReached) {
      return;
    }

    if (visitedNodes >= maxVisitedNodes) {
      searchLimitReached = true;
      return;
    }

    if (
      conflictCount > bestConflictCount ||
      (conflictCount === bestConflictCount &&
        totalConflictMinutes > bestConflictMinutes)
    ) {
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

      if (
        conflictCount < bestConflictCount ||
        (conflictCount === bestConflictCount &&
          totalConflictMinutes < bestConflictMinutes)
      ) {
        schedules = [];
        truncated = false;
        bestConflictCount = conflictCount;
        bestConflictMinutes = totalConflictMinutes;
      }

      if (schedules.length < maxResults) {
        schedules.push({
          id: orderedSelections
            .map(
              (selection) =>
                `${selection.branchCode}:${selection.courseId}:${selection.crn}`,
            )
            .join("|"),
          selections: orderedSelections,
          meetings: [...meetings],
          conflictCount,
          totalConflictMinutes,
          metrics,
          score: scoreSchedule(metrics, weights),
        });
      } else {
        truncated = true;
      }

      return;
    }

    const { course, courseIndex, sections } = searchableCourses[index];

    for (const section of sections) {
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
      const addedConflicts = calculateCrossConflictStats(
        sectionMeetings,
        meetings,
      );
      const internalConflicts = calculateConflictStats(sectionMeetings);

      visit(
        index + 1,
        [...selections, selection],
        [...meetings, ...sectionMeetings],
        conflictCount +
          addedConflicts.conflictCount +
          internalConflicts.conflictCount,
        totalConflictMinutes +
          addedConflicts.totalConflictMinutes +
          internalConflicts.totalConflictMinutes,
      );

      if (searchLimitReached) {
        return;
      }
    }
  }

  visit(0, [], [], 0, 0);

  return {
    schedules: rankSchedules(schedules).slice(0, maxResults),
    truncated,
    visitedNodes,
    usedConflictFallback: true,
    searchLimitReached,
  };
}

export function generateSchedules(
  courses: readonly GeneratorCourse[],
  options: GenerateScheduleOptions = {},
): GenerateScheduleResult {
  const conflictFreeResult = generateConflictFreeSchedules(courses, options);

  if (conflictFreeResult.schedules.length > 0) {
    return { ...conflictFreeResult, usedConflictFallback: false };
  }

  const fallbackResult = generateLeastConflictSchedules(courses, options);
  const foundConflictFreeFallback = fallbackResult.schedules.some(
    (schedule) => schedule.conflictCount === 0,
  );

  return {
    ...fallbackResult,
    usedConflictFallback: !foundConflictFreeFallback,
    visitedNodes:
      conflictFreeResult.visitedNodes + fallbackResult.visitedNodes,
    searchLimitReached:
      Boolean(conflictFreeResult.searchLimitReached) ||
      Boolean(fallbackResult.searchLimitReached),
  };
}
