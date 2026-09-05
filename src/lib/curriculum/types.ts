import type { Grade } from "@/lib/curriculum/grades";

type CourseProgressState = "passed" | "failed" | "none";
export type CourseProgressSource = "manual" | "transcript";
export type CompletionStatus = "passed" | "failed";

export type TranscriptCourseRecord = {
  term: string;
  crn: string;
  courseCode: string;
  courseName: string;
  courseLanguage?: string;
  grade: Grade;
  countedCredit: number;
  transcriptCredit: number;
  completionStatus: CompletionStatus;
  source: "transcript";
  calculated: boolean;
};

export type CourseProgress = {
  state: CourseProgressState;
  grade?: Grade;
  term?: string;
  crn?: string;
  courseCode?: string;
  courseName?: string;
  courseLanguage?: string;
  countedCredit?: number;
  transcriptCredit?: number;
  completionStatus?: CompletionStatus;
  source?: CourseProgressSource;
  matchedRequirementId?: string;
  satisfactionType?: RequirementSatisfactionType;
  equivalenceRuleId?: string;
};

export type RequirementSatisfactionType = "direct" | "language-equivalence" | "equivalence" | "elective" | "manual";

export type RequirementSatisfaction = {
  requirementId: string;
  requirementCourseCode: string;
  satisfiedByCourseCodes: string[];
  satisfactionType: RequirementSatisfactionType;
  equivalenceRuleId?: string;
  sourceUrl?: string;
};

export type CurriculumProgress = {
  version: 1 | 2 | 3;
  planId: number;
  courses: Record<string, CourseProgress>;
  importedCourses?: TranscriptCourseRecord[];
  requirementSatisfactions?: Record<string, RequirementSatisfaction>;
};

export type RequirementEvaluation = "satisfied" | "unsatisfied" | "unknown";
export type CourseDerivedStatus = "not-taken" | "passed" | "failed";

export type CourseStatusResult = {
  status: CourseDerivedStatus;
  eligibility: RequirementEvaluation;
};

export type MissingRequirement =
  | { kind: "course"; courseCode: string; minimumGrade?: Grade }
  | { kind: "all" | "one-of"; requirements: MissingRequirement[] }
  | { kind: "unknown"; raw: string }
  | { kind: "credits"; minimumCredits: number };
