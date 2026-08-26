import { timeToMinutes } from "@/lib/schedule/time";
import type { MeetingTime } from "@/lib/schedule/conflicts";
import type { ScheduleConstraints } from "@/lib/schedule/types";

export const EMPTY_SCHEDULE_CONSTRAINTS: ScheduleConstraints = {
  excludedDays: [],
};

export function meetingSatisfiesConstraints(
  meeting: MeetingTime,
  constraints: ScheduleConstraints,
): boolean {
  if (constraints.excludedDays.includes(meeting.day)) {
    return false;
  }

  if (
    constraints.earliestStartTime &&
    timeToMinutes(meeting.startTime) <
      timeToMinutes(constraints.earliestStartTime)
  ) {
    return false;
  }

  if (
    constraints.latestEndTime &&
    timeToMinutes(meeting.endTime) >
      timeToMinutes(constraints.latestEndTime)
  ) {
    return false;
  }

  return true;
}

export function satisfiesConstraints(
  meetings: readonly MeetingTime[],
  constraints: ScheduleConstraints,
): boolean {
  return meetings.every((meeting) =>
    meetingSatisfiesConstraints(meeting, constraints),
  );
}
