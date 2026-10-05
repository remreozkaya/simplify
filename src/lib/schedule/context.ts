import type { ProgramMembership } from "@/lib/program-restrictions/eligibility";
import type { GeneratorCourse } from "@/lib/schedule/types";

/** Results are tied to the memberships and section data used by their search. */
export function scheduleGenerationContextKey(
  courses: readonly GeneratorCourse[] | null,
  memberships: readonly ProgramMembership[],
): string {
  return JSON.stringify({ memberships, courses });
}
