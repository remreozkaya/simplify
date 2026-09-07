import { days, type CourseBlock, type CourseSelection } from "@/types/calendar";
import { meetingsOverlap } from "@/lib/schedule/conflicts";
import { minutesToTime, timeToMinutes } from "@/lib/schedule/time";

type CourseLayout = { leftPercent: number; widthPercent: number };

/*
 * The background calendar grid still displays one line every 30 minutes,
 * but course blocks can begin and end at any valid minute.
 */
const SLOT_HEIGHT = 26;
const GRID_INTERVAL_MINUTES = 30;

export const START_TIME = "08:00";
export const END_TIME = "20:00";

const PIXELS_PER_MINUTE = SLOT_HEIGHT / GRID_INTERVAL_MINUTES;

export function generateTimeLabels(): string[] {
  const labels: string[] = [];

  const calendarStartMinutes = timeToMinutes(START_TIME);

  const calendarEndMinutes = timeToMinutes(END_TIME);

  for (
    let currentMinutes = calendarStartMinutes;
    currentMinutes <= calendarEndMinutes;
    currentMinutes += GRID_INTERVAL_MINUTES
  ) {
    labels.push(minutesToTime(currentMinutes));
  }

  return labels;
}

export function getTimeTop(time: string): number {
  return (timeToMinutes(time) - timeToMinutes(START_TIME)) * PIXELS_PER_MINUTE;
}

export function getCourseHeight(startTime: string, endTime: string): number {
  return (
    Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime)) *
    PIXELS_PER_MINUTE
  );
}

export function reorderCourseBlocksBySelections(
  courseBlocks: CourseBlock[],
  courseSelections: CourseSelection[],
) {
  const courseBlockMap = new Map(
    courseBlocks.map((courseBlock) => [courseBlock.id, courseBlock]),
  );

  const orderedCourseBlockIds = courseSelections.flatMap(
    (selection) => selection.courseBlockIds,
  );

  const orderedCourseBlocks = orderedCourseBlockIds
    .map((courseBlockId) => courseBlockMap.get(courseBlockId))
    .filter((courseBlock): courseBlock is CourseBlock => Boolean(courseBlock));

  const orderedCourseBlockIdSet = new Set(orderedCourseBlockIds);

  const remainingCourseBlocks = courseBlocks.filter(
    (courseBlock) => !orderedCourseBlockIdSet.has(courseBlock.id),
  );

  return [...orderedCourseBlocks, ...remainingCourseBlocks];
}

export function getCourseLayoutMap(courseBlocks: CourseBlock[]) {
  const layoutMap: Record<string, CourseLayout> = {};
  const courseOrderMap = new Map<string, number>();

  courseBlocks.forEach((courseBlock, index) => {
    courseOrderMap.set(courseBlock.id, index);
  });

  const dayColumnWidth = 100 / days.length;

  days.forEach((day) => {
    const dayCourses = courseBlocks.filter((course) => course.day === day);

    const unvisitedCourseIds = new Set(dayCourses.map((course) => course.id));

    while (unvisitedCourseIds.size > 0) {
      const firstCourseId = Array.from(unvisitedCourseIds)[0];

      const firstCourse = dayCourses.find(
        (course) => course.id === firstCourseId,
      );

      if (!firstCourse) {
        break;
      }

      const overlapGroup: CourseBlock[] = [];
      const queue: CourseBlock[] = [firstCourse];

      unvisitedCourseIds.delete(firstCourse.id);

      while (queue.length > 0) {
        const currentCourse = queue.shift();

        if (!currentCourse) {
          continue;
        }

        overlapGroup.push(currentCourse);

        dayCourses.forEach((possibleOverlappingCourse) => {
          if (!unvisitedCourseIds.has(possibleOverlappingCourse.id)) {
            return;
          }

          const overlapsWithCurrentCourse = meetingsOverlap(
            currentCourse,
            possibleOverlappingCourse,
          );

          if (!overlapsWithCurrentCourse) {
            return;
          }

          unvisitedCourseIds.delete(possibleOverlappingCourse.id);

          queue.push(possibleOverlappingCourse);
        });
      }

      const orderedOverlapGroup = [...overlapGroup].sort((first, second) => {
        return (
          (courseOrderMap.get(first.id) ?? 0) -
          (courseOrderMap.get(second.id) ?? 0)
        );
      });

      const courseColumnMap = new Map<string, number>();

      orderedOverlapGroup.forEach((course) => {
        const usedColumns = new Set<number>();

        orderedOverlapGroup.forEach((otherCourse) => {
          if (course.id === otherCourse.id) {
            return;
          }

          const otherCourseColumn = courseColumnMap.get(otherCourse.id);

          if (otherCourseColumn === undefined) {
            return;
          }

          if (meetingsOverlap(course, otherCourse)) {
            usedColumns.add(otherCourseColumn);
          }
        });

        let columnIndex = 0;

        while (usedColumns.has(columnIndex)) {
          columnIndex += 1;
        }

        courseColumnMap.set(course.id, columnIndex);
      });

      const totalColumns =
        Math.max(...Array.from(courseColumnMap.values())) + 1;

      const dayIndex = days.indexOf(day);

      const courseWidth = dayColumnWidth / totalColumns;

      orderedOverlapGroup.forEach((course) => {
        const columnIndex = courseColumnMap.get(course.id) ?? 0;

        layoutMap[course.id] = {
          leftPercent: dayIndex * dayColumnWidth + columnIndex * courseWidth,

          widthPercent: courseWidth,
        };
      });
    }
  });

  return layoutMap;
}
