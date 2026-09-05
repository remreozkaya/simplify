import { describe, expect, it } from "vitest";

import { changePasswordSchema, providerSupportsPassword } from "@/lib/profile/password";
import { EMPTY_PROFILE, isProfileComplete, profileInitials, type ProgramEnrollment } from "@/lib/profile/types";
import { makeProfile, orderedEnrollments, parseProfileInput, parseStoredProfile } from "@/lib/profile/validation";

const main: ProgramEnrollment = {
  id: "main",
  type: "main",
  facultyId: "10",
  facultyName: "İşletme Fakültesi",
  educationLevel: "undergraduate",
  planType: "undergraduate",
  programCode: "PROGRAM_A",
  programName: "Program A",
  curriculumPlanId: 101,
  curriculumPlanName: "2025 plan",
};

function input(overrides: Record<string, unknown> = {}) {
  return { name: " Remre ", surname: " Özkaya ", birthdate: "2000-01-01", nickname: "Rem", programEnrollments: [main], ...overrides };
}

describe("profile validation and persistence", () => {
  it("requires personal names and a main program", () => {
    expect(parseProfileInput(input({ name: "" })).success).toBe(false);
    expect(parseProfileInput(input({ surname: "" })).success).toBe(false);
    expect(parseProfileInput(input({ programEnrollments: [] })).success).toBe(false);
  });

  it("rejects future birthdates and preserves Turkish characters", () => {
    expect(parseProfileInput(input({ birthdate: "2999-01-01" })).success).toBe(false);
    const parsed = parseProfileInput(input());
    expect(parsed.success && parsed.data.surname).toBe("Özkaya");
  });

  it("supports a double major and minor and keeps the main program first", () => {
    const minor: ProgramEnrollment = { ...main, id: "minor", type: "minor", planType: "yandal", primaryProgramCode: main.programCode, targetProgramCode: "PROGRAM_C", programCode: "PROGRAM_C", programName: "Program C", curriculumPlanId: 303 };
    const doubleMajor: ProgramEnrollment = { ...main, id: "double", type: "double-major", planType: "cap", primaryProgramCode: main.programCode, targetProgramCode: "PROGRAM_B", programCode: "PROGRAM_B", programName: "Program B", curriculumPlanId: 202 };
    const ordered = orderedEnrollments([minor, main, doubleMajor]);
    expect(ordered.map((item) => item.type)).toEqual(["main", "double-major", "minor"]);
    expect(parseProfileInput(input({ programEnrollments: ordered })).success).toBe(true);
  });

  it("rejects duplicate programs and a main program repeated as secondary", () => {
    expect(parseProfileInput(input({ programEnrollments: [main, { ...main, id: "duplicate", type: "minor" }] })).success).toBe(false);
    expect(parseProfileInput(input({ programEnrollments: [main, { ...main, id: "other-plan", type: "minor", curriculumPlanId: 999 }] })).success).toBe(false);
  });

  it("round-trips stored profiles and safely defaults malformed existing users", () => {
    const parsed = parseProfileInput(input());
    if (!parsed.success) throw new Error("fixture");
    const profile = makeProfile(parsed.data, "2026-09-02T00:00:00.000Z");
    expect(parseStoredProfile(profile)).toEqual(profile);
    expect(parseStoredProfile({ old: true })).toEqual(EMPTY_PROFILE);
    expect(isProfileComplete(profile)).toBe(true);
    expect(profileInitials(profile)).toBe("RÖ");
  });

  it("migrates existing records without turning secondary programs into undergraduate plans", () => {
    const legacy = { version: 1, name: "A", surname: "B", birthdate: "", nickname: "", profileUpdatedAt: null, programEnrollments: [
      { id: "main", type: "main", programCode: "MAT_LS", programName: "Matematik", curriculumPlanId: 1, curriculumPlanName: "Main" },
      { id: "minor", type: "minor", programCode: "ECN_YD", programName: "Ekonomi", curriculumPlanId: 2, curriculumPlanName: "Minor" },
    ] };
    const migrated = parseStoredProfile(legacy);
    expect(migrated.version).toBe(2);
    expect(migrated.programEnrollments[0]).toMatchObject({ educationLevel: "undergraduate", planType: "undergraduate", facultyId: "" });
    expect(migrated.programEnrollments[1]).toMatchObject({ planType: "yandal", primaryProgramCode: "MAT_LS" });
    expect(parseStoredProfile(legacy, { MAT_LS: { id: "1", name: "Fen-Edebiyat Fakültesi" } }).programEnrollments[0]).toMatchObject({ facultyId: "1", facultyName: "Fen-Edebiyat Fakültesi" });
  });

  it("rejects cross-type plans and secondary records without their primary relationship", () => {
    expect(parseProfileInput(input({ programEnrollments: [{ ...main, planType: "yandal" }] }))).toHaveProperty("success", false);
    expect(parseProfileInput(input({ programEnrollments: [{ ...main }, { ...main, id: "secondary", type: "double-major", planType: "cap", programCode: "END_LS", curriculumPlanId: 2 }] }))).toHaveProperty("success", false);
  });

  it("marks incorrectly classified stored secondary selections for review", () => {
    const stored = {
      version: 2, name: "A", surname: "B", birthdate: "", nickname: "", profileUpdatedAt: null,
      programEnrollments: [main, { ...main, id: "cap", type: "double-major", planType: "undergraduate", primaryProgramCode: main.programCode, programCode: "ECNE_LS", curriculumPlanId: 999 }],
    };
    const migrated = parseStoredProfile(stored);
    expect(migrated.programEnrollments[1]).toMatchObject({ planType: "cap", curriculumPlanId: 0, selectionRequiresReview: true });
  });
});

describe("profile password validation", () => {
  it("requires the current password and the existing password policy", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "", newPassword: "short", confirmPassword: "short" }).success).toBe(false);
  });

  it("rejects confirmation mismatches and reusing the current password", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "old-password", newPassword: "new-password", confirmPassword: "different" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "same-password", newPassword: "same-password", confirmPassword: "same-password" }).success).toBe(false);
  });

  it("accepts a valid password change without persisting password values", () => {
    expect(changePasswordSchema.safeParse({ currentPassword: "old-password", newPassword: "new-password", confirmPassword: "new-password" }).success).toBe(true);
  });

  it("distinguishes local passwords from SSO-managed passwords", () => {
    expect(providerSupportsPassword({ provider: "email", providers: ["email"] })).toBe(true);
    expect(providerSupportsPassword({ provider: "google", providers: ["google"] })).toBe(false);
  });
});
