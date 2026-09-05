import type { CurriculumProgress, MissingRequirement } from "@/lib/curriculum/types";
import type { ItuCurriculum } from "@/lib/itu/curriculum/types";
import type { EnrollmentType, ProgramEnrollment } from "@/lib/profile/types";

export type ProgramPriority = "balanced" | EnrollmentType;
export type PlannerEligibility = "confirmed" | "conditional" | "unknown";
export type PlannerAvailability = "available" | "unavailable" | "unknown";

export type SemesterPlannerProgram = {
  enrollment: ProgramEnrollment;
  curriculum: ItuCurriculum;
  progress: CurriculumProgress;
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
  code: string;
  title: string;
  titleTr?: string;
  titleEn?: string;
  credits: number;
  ects: number;
  contributions: PlannerContribution[];
  eligibility: PlannerEligibility;
  availability: PlannerAvailability;
  missingPrerequisites: MissingRequirement[];
  immediateUnlocks: string[];
  downstreamUnlocks: string[];
  score: number;
};

export type SemesterPlannerOptions = {
  desiredCredits: number;
  maxCourses?: number;
  priority: ProgramPriority;
  includedCourseCodes?: readonly string[];
  excludedCourseCodes?: readonly string[];
  lockedCourseCodes?: readonly string[];
  inProgressCourseCodes?: readonly string[];
  availabilityMode: "published" | "unknown";
  knownBranchCodes?: ReadonlySet<string>;
  offeredCourseCodes?: ReadonlySet<string>;
};

export type PlannerProgramSummary = {
  enrollmentId: string;
  enrollmentType: EnrollmentType;
  programName: string;
  programNameTr?: string;
  programNameEn?: string;
  remainingCredits: number;
  selectedCredits: number;
  selectedCourses: number;
};

export type PlannerNotice =
  | { kind: "target-shortfall"; credits: number }
  | { kind: "forced-over-target"; credits: number }
  | { kind: "max-courses"; count: number }
  | { kind: "included-ineligible"; courseCode: string }
  | { kind: "included-unavailable"; courseCode: string }
  | { kind: "included-not-found"; courseCode: string }
  | { kind: "availability-unknown" }
  | { kind: "registration-limit-unknown" }
  | { kind: "corequisites-unknown" };

export type SemesterPlan = {
  recommendations: SemesterCourseCandidate[];
  alternatives: SemesterCourseCandidate[];
  programSummaries: PlannerProgramSummary[];
  selectedCredits: number;
  selectedEcts: number;
  combinedRemainingCredits: number;
  suggestedCredits: number;
  notices: PlannerNotice[];
};
