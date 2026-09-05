import type { Grade } from "@/lib/curriculum/grades";
import type { EquivalenceRule } from "@/lib/curriculum/equivalence";

export type AcademicProgramOffering = {
  /** Stable offering identity. Plan type is deliberately part of this key. */
  id: string;
  baseProgramId: string;
  officialProgramCode: string;
  code: string;
  name: string;
  nameTr?: string;
  nameEn?: string;
  major: string;
  facultyId?: string;
  faculty?: string;
  planType: ItuPlanType;
  curriculumPlans?: ItuCurriculumPlan[];
};

/** Kept as a compatibility name for schedule/curriculum consumers. */
export type ItuUndergraduateProgram = AcademicProgramOffering;

export type ItuPlanType = "undergraduate" | "cap" | "yandal";

export type ItuFaculty = {
  id: string;
  name: string;
  nameTr?: string;
  nameEn?: string;
};

export type ItuCurriculumPlan = {
  id: number;
  programCode: string;
  title: string;
  nameTr?: string;
  nameEn?: string;
  isCurrent: boolean;
  planType: ItuPlanType;
  validityPeriod?: string;
  associatedPrimaryProgramCodes?: string[];
  associatedPrimaryProgramIds?: string[];
  primaryProgramId?: string;
  targetProgramId?: string;
  capPlanId?: number;
  sourceUrl?: string;
  retrievedAt?: string;
};

type NumericOptions = number[];

type ItuCurriculumCourse = {
  kind: "course";
  id: string;
  semester: number;
  code: string;
  title: string;
  nameTr?: string;
  nameEn?: string;
  language?: string;
  requirementType: "compulsory" | "elective";
  creditOptions: NumericOptions;
  ectsOptions: NumericOptions;
  theoryHours?: number;
  tutorialHours?: number;
  labHours?: number;
  category?: string;
};

export type ItuElectiveCourse = {
  code: string;
  title: string;
  nameTr?: string;
  nameEn?: string;
  language?: string;
  creditOptions: NumericOptions;
  ectsOptions: NumericOptions;
  theoryHours?: number;
  tutorialHours?: number;
  labHours?: number;
};

export type ItuElectiveSlot = {
  kind: "elective-slot";
  id: string;
  semester: number;
  title: string;
  nameTr?: string;
  nameEn?: string;
  creditOptions: NumericOptions;
  ectsOptions: NumericOptions;
  category?: string;
  groupId?: number;
  courses: ItuElectiveCourse[];
};

export type ItuCurriculumItem = ItuCurriculumCourse | ItuElectiveSlot;

type ItuCurriculumSemester = {
  semester: number;
  items: ItuCurriculumItem[];
};

export type { Grade } from "@/lib/curriculum/grades";

export type PrerequisiteExpression =
  | {
      kind: "course";
      courseCode: string;
      minimumGrade?: Grade;
    }
  | {
      kind: "and";
      operands: PrerequisiteExpression[];
    }
  | {
      kind: "or";
      operands: PrerequisiteExpression[];
    }
  | {
      kind: "unknown";
      raw: string;
    };

export type ItuCoursePrerequisite = {
  courseCode: string;
  rawExpression?: string;
  expression?: PrerequisiteExpression;
  minimumCredits?: number;
};

export type ItuCurriculum = {
  planId: number;
  programCode: string;
  title: string;
  planTitle: string;
  planType?: ItuPlanType;
  validityPeriod?: string;
  associatedPrimaryProgramCodes?: string[];
  sourceUrl?: string;
  semesters: ItuCurriculumSemester[];
  totalCredit?: number;
  totalEcts?: number;
  note?: string;
  noteTr?: string;
  noteEn?: string;
  prerequisites: Record<string, ItuCoursePrerequisite>;
  equivalenceRules: EquivalenceRule[];
  prerequisiteBranchesLoaded: string[];
  prerequisiteDataAvailable: boolean;
  warnings: string[];
  fetchedAt: string;
};

export type ParsedCurriculum = Omit<
  ItuCurriculum,
  | "prerequisites"
  | "equivalenceRules"
  | "prerequisiteBranchesLoaded"
  | "prerequisiteDataAvailable"
  | "warnings"
  | "fetchedAt"
>;
