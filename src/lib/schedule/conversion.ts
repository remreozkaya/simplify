import type { GeneratedSchedule } from "@/lib/schedule/types";
import type {
  CourseBlock,
  CourseSelection,
  WeeklyProgram,
} from "@/types/calendar";

type WeeklyProgramIdentity = {
  id: string;
  name: string;
  updatedAt?: string;
};

export function generatedScheduleToWeeklyProgram(
  schedule: GeneratedSchedule,
  identity: WeeklyProgramIdentity,
): WeeklyProgram {
  const courseSelections: CourseSelection[] = [];
  const courseBlocks: CourseBlock[] = [];

  schedule.selections.forEach((generatedSelection, selectionIndex) => {
    const selectionId = `${identity.id}-selection-${selectionIndex + 1}`;
    const selectionMeetings = schedule.meetings.filter(
      (meeting) =>
        meeting.branchCode === generatedSelection.branchCode &&
        meeting.courseId === generatedSelection.courseId &&
        meeting.sectionId === generatedSelection.sectionId,
    );
    const blockIds = selectionMeetings.map(
      (_meeting, meetingIndex) =>
        `${identity.id}-course-${selectionIndex + 1}-${meetingIndex + 1}`,
    );

    courseSelections.push({
      id: selectionId,
      facultyCode: generatedSelection.branchCode,
      courseId: generatedSelection.courseId,
      sectionId: generatedSelection.sectionId,
      courseBlockIds: blockIds,
    });

    selectionMeetings.forEach((meeting, meetingIndex) => {
      courseBlocks.push({
        id: blockIds[meetingIndex],
        selectionId,
        code: meeting.courseCode,
        title: meeting.courseTitle,
        crn: meeting.crn,
        day: meeting.day,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        building: meeting.building,
        room: meeting.room,
        instructor: meeting.instructor,
      });
    });
  });

  return {
    id: identity.id,
    name: identity.name,
    courseSelections,
    courseBlocks,
    updatedAt: identity.updatedAt ?? new Date().toISOString(),
  };
}

export function generatedScheduleToCourseBlocks(
  schedule: GeneratedSchedule,
): CourseBlock[] {
  return generatedScheduleToWeeklyProgram(schedule, {
    id: "generated-preview",
    name: "Generated preview",
    updatedAt: "",
  }).courseBlocks;
}
