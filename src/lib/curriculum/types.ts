import type { Grade } from "@/lib/itu/curriculum/types";

export type CourseProgressState = "passed" | "planned" | "none";
export type CourseProgress = { state: CourseProgressState; grade?: Grade };
export type CurriculumProgress = {
  version: 1;
  planId: number;
  courses: Record<string, CourseProgress>;
};

export type RequirementEvaluation = "satisfied" | "unsatisfied" | "unknown";
export type CourseDerivedStatus =
  | "passed"
  | "planned"
  | "eligible"
  | "blocked"
  | "unknown";

export type CourseStatusResult = {
  status: CourseDerivedStatus;
  eligibility: RequirementEvaluation;
  plannedWarning: boolean;
};

export type MissingRequirement =
  | { kind: "course"; courseCode: string; minimumGrade?: Grade }
  | { kind: "all" | "one-of"; requirements: MissingRequirement[] }
  | { kind: "unknown"; raw: string }
  | { kind: "credits"; minimumCredits: number };
