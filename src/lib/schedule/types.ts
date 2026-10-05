import type { ProgramMembership, ProgramRestriction } from "@/lib/program-restrictions/eligibility";
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
  pinnedSectionId?: string;
};

export type GeneratedCourseSelection = {
  programEligibility?: "eligible" | "ineligible" | "unknown";
  branchCode: string;
  courseId: string;
  courseCode: string;
  sectionId: string;
  crn: string;
};

export type GeneratedMeeting = CourseMeetingOption & {
  majorRestriction?: string;
  programRestriction?: ProgramRestriction;
  semester?: string;
  branchCode: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  sectionId: string;
  crn: string;
  instructor?: string;
  teachingMethod?: string;
  capacity?: number;
  enrolled?: number;
};

export type GeneratedSchedule = {
  unknownRestrictionCount?: number;
  id: string;
  selections: GeneratedCourseSelection[];
  meetings: GeneratedMeeting[];
  conflictCount: number;
  totalConflictMinutes: number;
  score: number;
  metrics: ScheduleMetrics;
};

export type GenerateScheduleOptions = {
  programMemberships?: readonly ProgramMembership[];
  constraints?: ScheduleConstraints;
  maxResults?: number;
  maxVisitedNodes?: number;
  stopAfterFirst?: boolean;
  weights?: ScheduleWeights;
};

export type GenerateScheduleResult = {
  restrictionBlockedCourses?: string[];
  schedules: GeneratedSchedule[];
  truncated: boolean;
  visitedNodes: number;
  usedConflictFallback?: boolean;
  searchLimitReached?: boolean;
};
