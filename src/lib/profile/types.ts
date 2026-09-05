export type EnrollmentType = "main" | "double-major" | "minor";
export type EducationLevel = "undergraduate";
export type ProfilePlanType = "undergraduate" | "cap" | "yandal";

export type ProgramEnrollment = {
  id: string;
  type: EnrollmentType;
  facultyId: string;
  facultyName: string;
  educationLevel: EducationLevel;
  planType: ProfilePlanType;
  programCode: string;
  programName: string;
  programNameTr?: string;
  programNameEn?: string;
  curriculumPlanId: number;
  curriculumPlanName: string;
  curriculumPlanNameTr?: string;
  curriculumPlanNameEn?: string;
  primaryProgramCode?: string;
  targetProgramCode?: string;
  associatedPrimaryProgramCodes?: string[];
  selectionRequiresReview?: boolean;
};

export type UserProfile = {
  version: 2;
  name: string;
  surname: string;
  birthdate: string;
  nickname: string;
  programEnrollments: ProgramEnrollment[];
  profileUpdatedAt: string | null;
};

export type ProfileInput = Omit<UserProfile, "version" | "profileUpdatedAt">;

export const EMPTY_PROFILE: UserProfile = {
  version: 2,
  name: "",
  surname: "",
  birthdate: "",
  nickname: "",
  programEnrollments: [],
  profileUpdatedAt: null,
};

export const ENROLLMENT_LABELS: Record<EnrollmentType, string> = {
  main: "Main program",
  "double-major": "Double major",
  minor: "Minor",
};

export function profileFullName(profile: UserProfile) {
  return [profile.name, profile.surname].filter(Boolean).join(" ");
}

export function profileInitials(profile: UserProfile) {
  return [profile.name, profile.surname]
    .filter(Boolean)
    .map((part) => Array.from(part.trim())[0]?.toLocaleUpperCase("tr-TR"))
    .join("")
    .slice(0, 2);
}

export function isProfileComplete(profile: UserProfile) {
  return Boolean(profile.name && profile.surname && profile.programEnrollments.some((item) => item.type === "main"));
}
