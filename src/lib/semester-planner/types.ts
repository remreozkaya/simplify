import type { ProgramMembership } from "@/lib/program-restrictions/eligibility";
import type { CourseProgress, CurriculumProgress, MissingRequirement } from "@/lib/curriculum/types";
import type { ItuCurriculum } from "@/lib/itu/curriculum/types";
import type { EnrollmentType, ProgramEnrollment } from "@/lib/profile/types";
import type { GeneratedSchedule, GeneratorCourse } from "@/lib/schedule/types";

export type ProgramPriority = "balanced" | EnrollmentType;
export type PlannerEligibility = "confirmed" | "conditional" | "unknown";
export type PlannerAvailability = "available" | "unavailable" | "unknown";

export type SemesterPlannerProgram = {
  enrollment: ProgramEnrollment;
  curriculum: ItuCurriculum;
  progress: CurriculumProgress;
  prerequisiteProgress?: Record<string, CourseProgress>;
};

export type PlannerContribution = {
  enrollmentId: string;
  enrollmentType: EnrollmentType;
  programName: string;
  programNameTr?: string;
  programNameEn?: string;
  requirementId: string;
  requirementName: string;
  requirementNameTr?: string;
  requirementNameEn?: string;
  requirementKind: "compulsory" | "elective";
  directRequirement: boolean;
};

export type SemesterCourseCandidate = {
  programEligibility?: "eligible" | "unknown";
  code: string;
  title: string;
  titleTr?: string;
  titleEn?: string;
  credits: number;
  ects: number | null;
  contributions: PlannerContribution[];
  eligibility: PlannerEligibility;
  availability: PlannerAvailability;
  missingPrerequisites: MissingRequirement[];
  immediateUnlocks: string[];
  downstreamUnlocks: string[];
  score: number;
};

export type SemesterPlannerOptions = {
  programMemberships?: readonly ProgramMembership[];
  desiredCredits?: number;
  maxCourses?: number;
  priority: ProgramPriority;
  availabilityMode: "published" | "unknown";
  knownBranchCodes?: ReadonlySet<string>;
  offeredCourseCodes?: ReadonlySet<string>;
  courseOfferings?: readonly GeneratorCourse[];
};

export type PlannerSectionConstraint = {
  courseCode: string;
  branchCode: string;
  courseId: string;
  sectionId: string;
  crn: string;
};

export type PlannerProgramSummary = {
  enrollmentId: string;
  enrollmentType: EnrollmentType;
  programName: string;
  programNameTr?: string;
  programNameEn?: string;
  remainingCredits: number | null;
  selectedCredits: number;
  selectedCourses: number;
};

export type PlannerNotice =
  | { kind: "credit-data-unknown" }
  | { kind: "target-shortfall"; credits: number }
  | { kind: "target-overage"; credits: number }
  | { kind: "collision-shortfall" }
  | { kind: "search-limited" }
  | { kind: "max-courses"; count: number }
  | { kind: "availability-unknown" }
  | { kind: "eligibility-unknown" }
  | { kind: "registration-limit-unknown" }
  | { kind: "corequisites-unknown" }
  | { kind: "program-restriction-blocked"; count: number }
  | { kind: "program-restriction-unknown" };

export type SemesterWeeklyProgram = {
  schedule: GeneratedSchedule;
  recommendations: SemesterCourseCandidate[];
  programSummaries: PlannerProgramSummary[];
  selectedCredits: number;
  selectedEcts: number | null;
  compatibleSectionConstraints: PlannerSectionConstraint[];
  notices: PlannerNotice[];
};

export type SemesterPlan = Omit<SemesterWeeklyProgram, "schedule"> & {
  schedule: GeneratedSchedule | null;
  weeklyPrograms: SemesterWeeklyProgram[];
  combinedRemainingCredits: number | null;
  searchLimited: boolean;
  searchStats: { candidateVisits: number; scheduleVisitedNodes: number };
};
