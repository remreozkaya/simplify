import { describe, expect, it } from "vitest";

import { changeEnrollmentFaculty, changeSecondaryEnrollmentType, reconcileMainProgramChange } from "@/lib/profile/enrollments";
import type { ProgramEnrollment } from "@/lib/profile/types";

const base: ProgramEnrollment = { id: "secondary", type: "minor", facultyId: "10", facultyName: "Business", educationLevel: "undergraduate", planType: "yandal", primaryProgramCode: "MAT_LS", targetProgramCode: "ECN_YD", programCode: "ECN_YD", programName: "Economics", curriculumPlanId: 9, curriculumPlanName: "Plan" };

describe("dependent academic selectors", () => {
  it("clears the program and plan when faculty changes", () => {
    expect(changeEnrollmentFaculty(base, { id: "28", name: "Computing" })).toMatchObject({ facultyId: "28", programCode: "", curriculumPlanId: 0 });
  });

  it("clears incompatible values and maps Minor/Double Major to official types", () => {
    expect(changeSecondaryEnrollmentType(base, "double-major")).toMatchObject({ type: "double-major", planType: "cap", programCode: "", curriculumPlanId: 0 });
  });

  it("invalidates secondary eligibility after the main program changes", () => {
    const main: ProgramEnrollment = { ...base, id: "main", type: "main", planType: "undergraduate", programCode: "MAT_LS", curriculumPlanId: 1 };
    const next = { ...main, programCode: "END_LS" };
    expect(reconcileMainProgramChange([main, base], next)[1]).toMatchObject({ primaryProgramCode: "END_LS", programCode: "", curriculumPlanId: 0 });
  });
});
