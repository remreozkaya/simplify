import { timeToMinutes } from "@/lib/schedule/time";
import type { MeetingTime } from "@/lib/schedule/conflicts";
import type { ScheduleMetrics } from "@/lib/schedule/types";

export function normalizeGapMinutes(gapMinutes: number): number {
  return Math.floor(Math.max(0, gapMinutes) / 30) * 30;
}

export function calculateScheduleMetrics(
  meetings: readonly MeetingTime[],
): ScheduleMetrics {
  if (meetings.length === 0) {
    return {
      campusDays: 0,
      totalGapMinutes: 0,
      earliestStartMinutes: 0,
      latestEndMinutes: 0,
    };
  }

  const meetingsByDay = new Map<string, MeetingTime[]>();

  meetings.forEach((meeting) => {
    const current = meetingsByDay.get(meeting.day) ?? [];
    current.push(meeting);
    meetingsByDay.set(meeting.day, current);
  });

  let totalGapMinutes = 0;

  meetingsByDay.forEach((dayMeetings) => {
    const sorted = [...dayMeetings].sort(
      (first, second) =>
        timeToMinutes(first.startTime) - timeToMinutes(second.startTime),
    );

    let latestEnd = timeToMinutes(sorted[0].endTime);

    sorted.slice(1).forEach((meeting) => {
      const start = timeToMinutes(meeting.startTime);
      const end = timeToMinutes(meeting.endTime);
      totalGapMinutes += normalizeGapMinutes(start - latestEnd);
      latestEnd = Math.max(latestEnd, end);
    });
  });

  return {
    campusDays: meetingsByDay.size,
    totalGapMinutes,
    earliestStartMinutes: Math.min(
      ...meetings.map((meeting) => timeToMinutes(meeting.startTime)),
    ),
    latestEndMinutes: Math.max(
      ...meetings.map((meeting) => timeToMinutes(meeting.endTime)),
    ),
  };
}
