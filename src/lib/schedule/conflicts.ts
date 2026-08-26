import { timeToMinutes } from "@/lib/schedule/time";
import type { Day } from "@/types/calendar";

export type MeetingTime = {
  day: Day;
  startTime: string;
  endTime: string;
};

export function meetingsOverlap(
  first: MeetingTime,
  second: MeetingTime,
): boolean {
  if (first.day !== second.day) {
    return false;
  }

  return (
    timeToMinutes(first.startTime) < timeToMinutes(second.endTime) &&
    timeToMinutes(first.endTime) > timeToMinutes(second.startTime)
  );
}

export function meetingConflictMinutes(
  first: MeetingTime,
  second: MeetingTime,
): number {
  if (!meetingsOverlap(first, second)) {
    return 0;
  }

  return Math.min(
    timeToMinutes(first.endTime),
    timeToMinutes(second.endTime),
  ) - Math.max(
    timeToMinutes(first.startTime),
    timeToMinutes(second.startTime),
  );
}

export type ConflictStats = {
  conflictCount: number;
  totalConflictMinutes: number;
};

export function calculateCrossConflictStats(
  firstMeetings: readonly MeetingTime[],
  secondMeetings: readonly MeetingTime[],
): ConflictStats {
  let conflictCount = 0;
  let totalConflictMinutes = 0;

  firstMeetings.forEach((first) => {
    secondMeetings.forEach((second) => {
      const conflictMinutes = meetingConflictMinutes(first, second);

      if (conflictMinutes > 0) {
        conflictCount += 1;
        totalConflictMinutes += conflictMinutes;
      }
    });
  });

  return { conflictCount, totalConflictMinutes };
}

export function calculateConflictStats(
  meetings: readonly MeetingTime[],
): ConflictStats {
  let conflictCount = 0;
  let totalConflictMinutes = 0;

  meetings.forEach((meeting, index) => {
    const stats = calculateCrossConflictStats(
      [meeting],
      meetings.slice(index + 1),
    );
    conflictCount += stats.conflictCount;
    totalConflictMinutes += stats.totalConflictMinutes;
  });

  return { conflictCount, totalConflictMinutes };
}

export function sectionConflicts(
  sectionMeetings: readonly MeetingTime[],
  selectedMeetings: readonly MeetingTime[],
): boolean {
  return (
    hasMeetingConflicts(sectionMeetings) ||
    sectionMeetings.some((meeting) =>
      selectedMeetings.some((selected) => meetingsOverlap(meeting, selected)),
    )
  );
}

export function hasMeetingConflicts(
  meetings: readonly MeetingTime[],
): boolean {
  return meetings.some((meeting, index) =>
    meetings
      .slice(index + 1)
      .some((otherMeeting) => meetingsOverlap(meeting, otherMeeting)),
  );
}
