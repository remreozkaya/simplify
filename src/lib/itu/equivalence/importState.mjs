/**
 * Replace one fully verified plan/branch scope without creating duplicates.
 * A failed/unverified response is a no-op, preserving previously verified data.
 */
export function mergeVerifiedScope(existingRules, incomingRules, scope, retrievedAt, verifiedResponse = true) {
  if (!verifiedResponse) return { rules: existingRules, stale: 0 };
  const incomingIds = new Set(incomingRules.map((rule) => rule.id));
  let stale = 0;
  const merged = new Map(existingRules.map((rule) => [rule.id, rule]));
  for (const [id, existing] of merged) {
    if (existing.programCode === scope.programCode && existing.planId === scope.planId && existing.branchCode === scope.branchCode && existing.active && !incomingIds.has(id)) {
      merged.set(id, { ...existing, active: false, notes: `Not returned by the verified OBS import on ${retrievedAt}.` });
      stale += 1;
    }
  }
  incomingRules.forEach((rule) => merged.set(rule.id, rule));
  return { rules: [...merged.values()], stale };
}
