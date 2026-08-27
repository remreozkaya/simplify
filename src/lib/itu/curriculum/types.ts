export type ItuUndergraduateProgram = {
  code: string;
  name: string;
  major: string;
  faculty?: string;
};

export type ItuCurriculumPlan = {
  id: number;
  programCode: string;
  title: string;
  isCurrent: boolean;
};

export type NumericOptions = number[];

export type ItuCurriculumCourse = {
  kind: "course";
  id: string;
  semester: number;
  code: string;
  title: string;
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
  creditOptions: NumericOptions;
  ectsOptions: NumericOptions;
  category?: string;
  groupId?: number;
  courses: ItuElectiveCourse[];
};

export type ItuCurriculumItem = ItuCurriculumCourse | ItuElectiveSlot;

export type ItuCurriculumSemester = {
  semester: number;
  items: ItuCurriculumItem[];
};

export type Grade =
  | "AA"
  | "BA"
  | "BB"
  | "CB"
  | "CC"
  | "DC"
  | "DD"
  | "FD"
  | "FF";

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
  semesters: ItuCurriculumSemester[];
  totalCredit?: number;
  totalEcts?: number;
  note?: string;
  prerequisites: Record<string, ItuCoursePrerequisite>;
  prerequisiteBranchesLoaded: string[];
  prerequisiteDataAvailable: boolean;
  warnings: string[];
  fetchedAt: string;
};

export type ParsedCurriculum = Omit<
  ItuCurriculum,
  | "prerequisites"
  | "prerequisiteBranchesLoaded"
  | "prerequisiteDataAvailable"
  | "warnings"
  | "fetchedAt"
>;
