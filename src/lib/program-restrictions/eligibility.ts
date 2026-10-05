import registry from "@/data/itu/program-restrictions.json";
import type { EnrollmentType, ProgramEnrollment } from "@/lib/profile/types";

export type ProgramRestriction = {
  raw?: string;
  state: "unrestricted" | "allowlist" | "unknown";
  codes: string[];
  reason?: string;
};
export type ProgramMembership = {
  enrollmentId: string;
  type: EnrollmentType;
  rawCode: string;
  codes: string[];
  resolved: boolean;
};
export type ProgramEligibility = {
  status: "eligible" | "ineligible" | "unknown";
  reason: string;
  allowedCodes: string[];
  matchedCodes: string[];
};

export const normalizeProgramCode = (code: string) => code.trim().toUpperCase();

/** Blank/dash/special-value semantics are unverified. Never infer unrestricted. */
export function parseProgramRestriction(raw?: string): ProgramRestriction {
  const tokens = raw?.trim().toUpperCase().split(/[\s,;|/]+/u).filter(Boolean) ?? [];
  const codes = [...new Set(tokens.filter((token) => /^[A-Z0-9]+(?:_[A-Z0-9]+)*_(?:LS|YD)(?:_[A-Z0-9]+)*$/u.test(token)))];
  if (!tokens.length || tokens.length !== tokens.filter((token) => /^[A-Z0-9]+(?:_[A-Z0-9]+)*_(?:LS|YD)(?:_[A-Z0-9]+)*$/u.test(token)).length) {
    return { raw, state: "unknown", codes, reason: tokens.length ? "unrecognized-value" : "missing-value" };
  }
  return { raw, state: "allowlist", codes };
}

type MinorMapping = { curriculumCode: string; restrictionCode: string; verified: boolean; nameTr?: string; nameEn?: string; legacyCodes?: string[] };
const minorMappings: readonly MinorMapping[] = registry.minorMappings;

/** Resolve identities, never baseProgramId or fuzzy names; retain unknown selections. */
export function resolveProgramMemberships(enrollments: readonly ProgramEnrollment[]): ProgramMembership[] {
  return enrollments.filter((enrollment) => enrollment.programCode.trim()).map((enrollment) => {
    const rawCode = enrollment.targetProgramCode || enrollment.programCode;
    const identity = normalizeProgramCode(rawCode);
    const minor = enrollment.type === "minor" || enrollment.planType === "yandal";
    const record = minor
      ? minorMappings.find((mapping) => mapping.verified && (mapping.curriculumCode === identity || mapping.legacyCodes?.includes(identity)))
      : registry.programs.find((program) => program.code === identity || program.legacyCodes.includes(identity));
    const codes = record ? ["restrictionCode" in record ? record.restrictionCode : record.code] : [];
    return { enrollmentId: enrollment.id, type: enrollment.type, rawCode, codes, resolved: codes.length > 0 && !enrollment.selectionRequiresReview };
  });
}

export function evaluateProgramEligibility(
  value: ProgramRestriction | string | undefined,
  memberships: readonly ProgramMembership[],
): ProgramEligibility {
  const restriction = typeof value === "object" ? value : parseProgramRestriction(value);
  const allowedCodes = restriction.codes.map(normalizeProgramCode);
  const result = (status: ProgramEligibility["status"], reason: string, matchedCodes: string[] = []): ProgramEligibility => ({status, reason, allowedCodes, matchedCodes});
  if (!memberships.length) return result("unknown", "no-selected-programs");
  if (restriction.state === "unrestricted") return result("eligible", "unrestricted");
  if (restriction.state !== "allowlist" || !allowedCodes.length) return result("unknown", restriction.reason ?? "restriction-unavailable");
  const matchedCodes = [...new Set(memberships.filter((membership) => membership.resolved).flatMap((membership) => membership.codes.map(normalizeProgramCode)).filter((code) => allowedCodes.includes(code)))];
  if (matchedCodes.length) return result("eligible", "program-match", matchedCodes);
  if (memberships.some((membership) => !membership.resolved)) return result("unknown", "unresolved-membership");
  return result("ineligible", "no-program-match");
}

export function programRestrictionLabel(code: string, language: "tr" | "en"): string {
  const identity = normalizeProgramCode(code);
  const program = registry.programs.find((value) => value.code === identity);
  const minor = minorMappings.find((value) => value.restrictionCode === identity);
  const name = language === "en" ? minor?.nameEn ?? program?.nameEn ?? minor?.nameTr ?? program?.nameTr : minor?.nameTr ?? program?.nameTr;
  return name ? `${name} (${identity})` : identity;
}
