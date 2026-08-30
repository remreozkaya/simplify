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
const MIN_SCHEDULE_RATING = 1;
const MAX_SCHEDULE_RATING = 5;
const RELATIVE_SCORE_RATING_FACTOR = 2.5;
const CONFLICT_PAIR_RATING_PENALTY = 0.35;
const CONFLICT_MINUTE_RATING_PENALTY = 1 / 900;

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

/**
 * Converts the internal lower-is-better penalty into a user-facing 1–5
 * rating. Ratings are relative to the best generated schedule so small score
 * differences remain visible as values such as 4.7 instead of exposing the
 * implementation-specific weighted score.
 */
export function calculateScheduleRating(
  schedule: GeneratedSchedule,
  bestSchedule: GeneratedSchedule,
): number {
  const bestScore = Math.max(1, bestSchedule.score);
  const relativeScorePenalty =
    (Math.max(0, schedule.score - bestSchedule.score) / bestScore) *
    RELATIVE_SCORE_RATING_FACTOR;
  const conflictPenalty =
    schedule.conflictCount * CONFLICT_PAIR_RATING_PENALTY +
    schedule.totalConflictMinutes * CONFLICT_MINUTE_RATING_PENALTY;
  const rating = Math.min(
    MAX_SCHEDULE_RATING,
    Math.max(
      MIN_SCHEDULE_RATING,
      MAX_SCHEDULE_RATING - relativeScorePenalty - conflictPenalty,
    ),
  );

  return Math.round(rating * 10) / 10;
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

function compareSchedules(
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
