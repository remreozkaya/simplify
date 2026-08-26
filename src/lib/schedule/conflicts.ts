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

export function sectionConflicts(
  sectionMeetings: readonly MeetingTime[],
  selectedMeetings: readonly MeetingTime[],
): boolean {
  return sectionMeetings.some((meeting) =>
    selectedMeetings.some((selected) => meetingsOverlap(meeting, selected)),
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
