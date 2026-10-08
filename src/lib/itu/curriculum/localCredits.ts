import { normalizeCourseCode } from "@/lib/itu/courseCode.mjs";
import { parseNumericOptions } from "@/lib/itu/curriculum/parsers/numbers";

type CreditRecord = { kind?: string; code?: string; credit?: string };
type CreditCatalog = {
  plans: { courses?: unknown[] }[];
  electiveGroups?: Record<string, { courses?: unknown[] }>;
};

export function buildLocalCreditIndex(catalog: CreditCatalog): Map<string, number | null> {
  const index = new Map<string, number | null>();
  const add = (raw: unknown, elective: boolean) => {
    if (!raw || typeof raw !== "object") return;
    const record = raw as CreditRecord;
    if ((!elective && record.kind !== "course") || typeof record.code !== "string") return;
    const code = normalizeCourseCode(record.code);
    const rawCredit = typeof record.credit === "string" ? record.credit.trim() : undefined;
    const options = typeof rawCredit === "string" && /^\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*$/.test(rawCredit)
      ? parseNumericOptions(rawCredit)
      : [];
    const credit = options.length === 1 && options[0] >= 0 ? options[0] : null;
    // Conflicting curriculum records cannot establish one authoritative value.
    index.set(code, index.has(code) && index.get(code) !== credit ? null : credit);
  };
  for (const plan of catalog.plans) for (const record of plan.courses ?? []) add(record, false);
  for (const group of Object.values(catalog.electiveGroups ?? {})) {
    for (const record of group.courses ?? []) add(record, true);
  }
  return index;
}
