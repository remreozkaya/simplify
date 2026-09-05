import storedEquivalences from "@/data/itu/equivalences.json";
import { z } from "zod";

import { GRADES } from "@/lib/curriculum/grades";
import type { EquivalenceRule, EquivalenceStore } from "@/lib/curriculum/equivalence";

const courseCode = z.string().regex(/^[A-ZÇĞİÖŞÜ]{2,8}\s\d{2,5}[A-Z]{0,3}$/u);
const ruleSchema = z.object({
  id: z.string().min(1), curriculumId: z.string().min(1), programId: z.number().int().positive(),
  programCode: z.string().min(1), planType: z.string().min(1), planTypeId: z.number().int().positive(),
  planId: z.number().int().positive(), branchCode: z.string().min(1), targetCourseCode: courseCode,
  targetCourseCodeOfficial: z.string().min(1), equivalentCourseCode: courseCode.optional(),
  equivalentCourseCodeOfficial: z.string().min(1).optional(),
  alternatives: z.array(z.object({ allOf: z.array(courseCode).min(1), officialCourseCodes: z.array(z.string().min(1)).optional() })).min(1),
  relationshipType: z.literal("directional"), minimumGrade: z.enum(GRADES).optional(),
  effectiveFrom: z.string().optional(), effectiveUntil: z.string().optional(),
  sourceUrl: z.string().url(), sourceLabel: z.string().min(1), retrievedAt: z.string().datetime(),
  verified: z.boolean(), active: z.boolean(), notes: z.string().optional(),
});
const storeSchema = z.object({
  version: z.literal(1), generatedAt: z.string().datetime().nullable(), rules: z.array(ruleSchema),
  failures: z.array(z.object({ programCode: z.string(), planId: z.number().int().positive(), branchCode: z.string().optional(), sourceUrl: z.string().url(), attemptedAt: z.string().datetime(), reason: z.string() })),
});
const store = storeSchema.parse(storedEquivalences) as EquivalenceStore;

export function getStoredEquivalenceRules(programCode: string, planId: number): EquivalenceRule[] {
  return store.rules.filter((rule) =>
    rule.verified &&
    rule.active &&
    rule.programCode === programCode &&
    rule.planId === planId,
  );
}

export function getEquivalenceStore(): EquivalenceStore {
  return store;
}
