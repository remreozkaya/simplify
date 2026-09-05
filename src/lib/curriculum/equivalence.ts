import type { Grade } from "@/lib/curriculum/grades";

export type EquivalenceAlternative = {
  allOf: string[];
  officialCourseCodes?: string[];
};

export type EquivalenceRule = {
  id: string;
  curriculumId: string;
  programId: number;
  programCode: string;
  planType: string;
  planTypeId: number;
  planId: number;
  branchCode: string;
  targetCourseCode: string;
  targetCourseCodeOfficial: string;
  equivalentCourseCode?: string;
  equivalentCourseCodeOfficial?: string;
  alternatives: EquivalenceAlternative[];
  relationshipType: "directional";
  minimumGrade?: Grade;
  effectiveFrom?: string;
  effectiveUntil?: string;
  sourceUrl: string;
  sourceLabel: string;
  retrievedAt: string;
  verified: boolean;
  active: boolean;
  notes?: string;
};

export type EquivalenceImportFailure = {
  programCode: string;
  planId: number;
  branchCode?: string;
  sourceUrl: string;
  attemptedAt: string;
  reason: string;
};

export type EquivalenceStore = {
  version: 1;
  generatedAt: string | null;
  rules: EquivalenceRule[];
  failures: EquivalenceImportFailure[];
};
