import type {
  CourseMeetingOption,
  CourseSectionOption,
  Day,
} from "@/types/calendar";

export type ScheduleConstraints = {
  earliestStartTime?: string;
  latestEndTime?: string;
  excludedDays: Day[];
};

export type ScheduleMetrics = {
  campusDays: number;
  totalGapMinutes: number;
  earliestStartMinutes: number;
  latestEndMinutes: number;
};

export type ScheduleWeights = {
  campusDay: number;
  gapMinute: number;
  earlyMinute: number;
  lateMinute: number;
};

export type GeneratorCourse = {
  branchCode: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  sections: CourseSectionOption[];
};

export type GeneratedCourseSelection = {
  branchCode: string;
  courseId: string;
  courseCode: string;
  sectionId: string;
  crn: string;
};

export type GeneratedMeeting = CourseMeetingOption & {
  branchCode: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  sectionId: string;
  crn: string;
  instructor?: string;
};

export type GeneratedSchedule = {
  id: string;
  selections: GeneratedCourseSelection[];
  meetings: GeneratedMeeting[];
  conflictCount: number;
  totalConflictMinutes: number;
  score: number;
  metrics: ScheduleMetrics;
};

export type GenerateScheduleOptions = {
  constraints?: ScheduleConstraints;
  maxResults?: number;
  maxVisitedNodes?: number;
  weights?: ScheduleWeights;
};

export type GenerateScheduleResult = {
  schedules: GeneratedSchedule[];
  truncated: boolean;
  visitedNodes: number;
  usedConflictFallback?: boolean;
  searchLimitReached?: boolean;
};
