import { z } from "zod";

import { EMPTY_PROFILE, type ProfileInput, type ProgramEnrollment, type UserProfile } from "@/lib/profile/types";

const trimmedText = (label: string, maximum: number, required = false) => {
  let schema = z.string().trim().max(maximum, `${label} must contain no more than ${maximum} characters.`);
  if (required) schema = schema.min(1, `${label} is required.`);
  return schema;
};

export const programEnrollmentSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(["main", "double-major", "minor"]),
  facultyId: z.string().trim().min(1, "Select a faculty.").max(40),
  facultyName: z.string().trim().min(1, "The selected faculty is invalid.").max(240),
  educationLevel: z.literal("undergraduate"),
  planType: z.enum(["undergraduate", "cap", "yandal"]),
  programCode: z.string().trim().min(1, "Select a program.").max(80),
  programName: z.string().trim().min(1, "The selected program is invalid.").max(240),
  programNameTr: z.string().trim().max(240).optional(),
  programNameEn: z.string().trim().max(240).optional(),
  curriculumPlanId: z.number().int().positive("Select a valid curriculum plan."),
  curriculumPlanName: z.string().trim().min(1, "Select a curriculum plan.").max(240),
  curriculumPlanNameTr: z.string().trim().max(240).optional(),
  curriculumPlanNameEn: z.string().trim().max(240).optional(),
  primaryProgramCode: z.string().trim().max(80).optional(),
  targetProgramCode: z.string().trim().max(80).optional(),
  associatedPrimaryProgramCodes: z.array(z.string().trim().min(1).max(80)).optional(),
  selectionRequiresReview: z.boolean().optional(),
});

export const profileInputSchema = z.object({
  name: trimmedText("Name", 80, true),
  surname: trimmedText("Surname", 80, true),
  birthdate: z.string().trim().refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "Enter a valid birthdate.").refine(
    (value) => !value || value <= new Date().toISOString().slice(0, 10),
    "Birthdate cannot be in the future.",
  ),
  nickname: trimmedText("Nickname", 50),
  programEnrollments: z.array(programEnrollmentSchema).max(8, "Too many academic programs have been added."),
}).superRefine((value, context) => {
  const mains = value.programEnrollments.filter((item) => item.type === "main");
  if (mains.length !== 1) {
    context.addIssue({ code: "custom", path: ["programEnrollments"], message: "Select exactly one main program and curriculum plan." });
  }

  const seen = new Set<string>();
  value.programEnrollments.forEach((item, index) => {
    const expectedPlanType = item.type === "main" ? "undergraduate" : item.type === "double-major" ? "cap" : "yandal";
    if (item.planType !== expectedPlanType) {
      context.addIssue({ code: "custom", path: ["programEnrollments", index], message: "The selected curriculum type does not match the enrollment type." });
    }
    if (item.type !== "main" && !item.primaryProgramCode) {
      context.addIssue({ code: "custom", path: ["programEnrollments", index], message: "A secondary curriculum must reference the main program." });
    }
    const key = `${item.programCode}:${item.curriculumPlanId}`;
    if (seen.has(key)) {
      context.addIssue({ code: "custom", path: ["programEnrollments", index], message: "The same program and curriculum plan cannot be added twice." });
    }
    seen.add(key);
  });

  const mainProgramCodes = new Set(mains.map((item) => item.programCode));
  value.programEnrollments.forEach((item, index) => {
    if (item.type !== "main" && mainProgramCodes.has(item.programCode)) {
      context.addIssue({ code: "custom", path: ["programEnrollments", index], message: "The main program cannot also be a secondary program." });
    }
  });
});

const storedProfileSchema = profileInputSchema.and(z.object({
  version: z.literal(2),
  profileUpdatedAt: z.string().datetime().nullable(),
}));

const legacyEnrollmentSchema = z.object({
  id: z.string(),
  type: z.enum(["main", "double-major", "minor"]),
  programCode: z.string(),
  programName: z.string(),
  curriculumPlanId: z.number(),
  curriculumPlanName: z.string(),
});

const legacyProfileSchema = z.object({
  version: z.literal(1), name: z.string(), surname: z.string(), birthdate: z.string(), nickname: z.string(),
  programEnrollments: z.array(legacyEnrollmentSchema), profileUpdatedAt: z.string().nullable(),
});

const looseStoredProfileV2Schema = z.object({
  version: z.literal(2),
  name: z.string(), surname: z.string(), birthdate: z.string(), nickname: z.string(),
  programEnrollments: z.array(programEnrollmentSchema.partial().and(z.object({
    id: z.string(), type: z.enum(["main", "double-major", "minor"]),
  }))),
  profileUpdatedAt: z.string().nullable(),
});

export type ProfileFieldErrors = Partial<Record<"name" | "surname" | "birthdate" | "nickname" | "programEnrollments", string>>;

export function profileFieldErrors(error: z.ZodError): ProfileFieldErrors {
  const result: ProfileFieldErrors = {};
  error.issues.forEach((issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && !result[field as keyof ProfileFieldErrors]) {
      result[field as keyof ProfileFieldErrors] = issue.message;
    }
  });
  return result;
}

export function parseProfileInput(value: unknown) {
  return profileInputSchema.safeParse(value);
}

export function parseStoredProfile(value: unknown, facultyByProgram: Readonly<Record<string, { id: string; name: string }>> = {}): UserProfile {
  const parsed = storedProfileSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const looseV2 = looseStoredProfileV2Schema.safeParse(value);
  if (looseV2.success) {
    const mainCode = looseV2.data.programEnrollments.find((item) => item.type === "main")?.programCode ?? "";
    return {
      ...looseV2.data,
      programEnrollments: looseV2.data.programEnrollments.map((item) => {
        const expectedPlanType = item.type === "main" ? "undergraduate" : item.type === "double-major" ? "cap" : "yandal";
        const incompatible = item.planType !== expectedPlanType;
        return {
          id: item.id,
          type: item.type,
          facultyId: item.facultyId ?? facultyByProgram[item.programCode ?? ""]?.id ?? "",
          facultyName: item.facultyName ?? facultyByProgram[item.programCode ?? ""]?.name ?? "",
          educationLevel: "undergraduate",
          planType: expectedPlanType,
          programCode: item.programCode ?? "",
          programName: item.programName ?? "",
          programNameTr: item.programNameTr,
          programNameEn: item.programNameEn,
          curriculumPlanId: incompatible ? 0 : item.curriculumPlanId ?? 0,
          curriculumPlanName: incompatible ? "" : item.curriculumPlanName ?? "",
          curriculumPlanNameTr: incompatible ? undefined : item.curriculumPlanNameTr,
          curriculumPlanNameEn: incompatible ? undefined : item.curriculumPlanNameEn,
          ...(item.type === "main" ? {} : { primaryProgramCode: mainCode || undefined, targetProgramCode: item.programCode }),
          associatedPrimaryProgramCodes: incompatible ? undefined : item.associatedPrimaryProgramCodes,
          selectionRequiresReview: incompatible || item.selectionRequiresReview || undefined,
        } satisfies ProgramEnrollment;
      }),
    };
  }
  const legacy = legacyProfileSchema.safeParse(value);
  if (!legacy.success) return EMPTY_PROFILE;
  const mainCode = legacy.data.programEnrollments.find((item) => item.type === "main")?.programCode;
  return {
    ...legacy.data,
    version: 2,
    programEnrollments: legacy.data.programEnrollments.map((item) => ({
      ...item,
      curriculumPlanId: item.type === "main" ? item.curriculumPlanId : 0,
      curriculumPlanName: item.type === "main" ? item.curriculumPlanName : "",
      facultyId: facultyByProgram[item.programCode]?.id ?? "",
      facultyName: facultyByProgram[item.programCode]?.name ?? "",
      educationLevel: "undergraduate",
      planType: item.type === "main" ? "undergraduate" : item.type === "double-major" ? "cap" : "yandal",
      ...(item.type === "main" ? {} : { primaryProgramCode: mainCode, targetProgramCode: item.programCode, selectionRequiresReview: true }),
    })),
  };
}

export function orderedEnrollments(enrollments: readonly ProgramEnrollment[]) {
  const order = { main: 0, "double-major": 1, minor: 2 } as const;
  return [...enrollments].sort((first, second) => order[first.type] - order[second.type]);
}

export function makeProfile(input: ProfileInput, updatedAt = new Date().toISOString()): UserProfile {
  return { version: 2, ...input, programEnrollments: orderedEnrollments(input.programEnrollments), profileUpdatedAt: updatedAt };
}
