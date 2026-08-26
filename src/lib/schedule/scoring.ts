import type {
  GeneratedSchedule,
  ScheduleMetrics,
  ScheduleWeights,
} from "@/lib/schedule/types";

export const DEFAULT_SCHEDULE_WEIGHTS: ScheduleWeights = {
  campusDay: 300,
  gapMinute: 1,
  earlyMinute: 0.25,
  lateMinute: 0.25,
};

const PREFERRED_EARLIEST_START = 10 * 60;
const PREFERRED_LATEST_END = 17 * 60 + 30;

export function scoreSchedule(
  metrics: ScheduleMetrics,
  weights: ScheduleWeights = DEFAULT_SCHEDULE_WEIGHTS,
): number {
  const earlyMinutes = Math.max(
    0,
    PREFERRED_EARLIEST_START - metrics.earliestStartMinutes,
  );
  const lateMinutes = Math.max(
    0,
    metrics.latestEndMinutes - PREFERRED_LATEST_END,
  );

  return (
    metrics.campusDays * weights.campusDay +
    metrics.totalGapMinutes * weights.gapMinute +
    earlyMinutes * weights.earlyMinute +
    lateMinutes * weights.lateMinute
  );
}

function compareStableCrns(
  first: GeneratedSchedule,
  second: GeneratedSchedule,
): number {
  const firstKey = first.selections
    .map((selection) => selection.crn)
    .join("|");
  const secondKey = second.selections
    .map((selection) => selection.crn)
    .join("|");

  return firstKey.localeCompare(secondKey, undefined, { numeric: true });
}

export function compareSchedules(
  first: GeneratedSchedule,
  second: GeneratedSchedule,
): number {
  return (
    first.conflictCount - second.conflictCount ||
    first.totalConflictMinutes - second.totalConflictMinutes ||
    first.score - second.score ||
    first.metrics.campusDays - second.metrics.campusDays ||
    first.metrics.totalGapMinutes - second.metrics.totalGapMinutes ||
    second.metrics.earliestStartMinutes -
      first.metrics.earliestStartMinutes ||
    first.metrics.latestEndMinutes - second.metrics.latestEndMinutes ||
    compareStableCrns(first, second)
  );
}

export function rankSchedules(
  schedules: readonly GeneratedSchedule[],
): GeneratedSchedule[] {
  return [...schedules].sort(compareSchedules);
}
