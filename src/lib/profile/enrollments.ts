import type { EnrollmentType, ProgramEnrollment } from "@/lib/profile/types";
import type { ItuFaculty } from "@/lib/itu/curriculum/types";

export function changeEnrollmentFaculty(enrollment: ProgramEnrollment, faculty?: ItuFaculty): ProgramEnrollment {
  return { ...enrollment, facultyId: faculty?.id ?? "", facultyName: faculty?.name ?? "", programCode: "", programName: "", programNameTr: undefined, programNameEn: undefined, targetProgramCode: undefined, curriculumPlanId: 0, curriculumPlanName: "", curriculumPlanNameTr: undefined, curriculumPlanNameEn: undefined, associatedPrimaryProgramCodes: undefined, selectionRequiresReview: undefined };
}

export function changeSecondaryEnrollmentType(enrollment: ProgramEnrollment, type: Exclude<EnrollmentType, "main">): ProgramEnrollment {
  return { ...enrollment, type, planType: type === "double-major" ? "cap" : "yandal", programCode: "", programName: "", programNameTr: undefined, programNameEn: undefined, targetProgramCode: undefined, curriculumPlanId: 0, curriculumPlanName: "", curriculumPlanNameTr: undefined, curriculumPlanNameEn: undefined, associatedPrimaryProgramCodes: undefined, selectionRequiresReview: undefined };
}

export function reconcileMainProgramChange(enrollments: readonly ProgramEnrollment[], nextMain: ProgramEnrollment): ProgramEnrollment[] {
  const previous = enrollments.find((item) => item.id === nextMain.id);
  const changed = previous?.programCode !== nextMain.programCode;
  return enrollments.map((item) => {
    if (item.id === nextMain.id) return nextMain;
    if (!changed || item.type === "main") return item;
    return { ...item, primaryProgramCode: nextMain.programCode || undefined, programCode: "", programName: "", programNameTr: undefined, programNameEn: undefined, targetProgramCode: undefined, curriculumPlanId: 0, curriculumPlanName: "", curriculumPlanNameTr: undefined, curriculumPlanNameEn: undefined, associatedPrimaryProgramCodes: undefined, selectionRequiresReview: undefined };
  });
}
