import type {
  ItuCoursePrerequisite,
  PrerequisiteExpression,
} from "@/lib/itu/curriculum/types";
import type {
  CourseProgress,
  CourseStatusResult,
  MissingRequirement,
  RequirementEvaluation,
} from "@/lib/curriculum/types";
import { GRADE_POINTS } from "@/lib/curriculum/grades";
import { courseLanguageVariants, normalizeCourseCode } from "@/lib/itu/courseCode.mjs";

export function evaluatePrerequisiteExpression(
  expression: PrerequisiteExpression,
  progress: Record<string, CourseProgress>,
): RequirementEvaluation {
  if (expression.kind === "unknown") return "unknown";
  if (expression.kind === "course") {
    const course = progress[expression.courseCode];
    if (course?.state !== "passed") return "unsatisfied";
    if (!expression.minimumGrade) return "satisfied";
    if (!course.grade) return "unknown";
    const actual = course.grade === "BL" ? undefined : GRADE_POINTS[course.grade];
    const minimum = expression.minimumGrade === "BL" ? undefined : GRADE_POINTS[expression.minimumGrade];
    if (actual === undefined || minimum === undefined) return "unknown";
    return actual >= minimum
      ? "satisfied"
      : "unsatisfied";
  }

  const evaluations = expression.operands.map((operand) =>
    evaluatePrerequisiteExpression(operand, progress),
  );
  if (expression.kind === "and") {
    if (evaluations.includes("unsatisfied")) return "unsatisfied";
    if (evaluations.includes("unknown")) return "unknown";
    return "satisfied";
  }
  if (evaluations.includes("satisfied")) return "satisfied";
  if (evaluations.includes("unknown")) return "unknown";
  return "unsatisfied";
}

/** A lower bound from explicit counted credits; aliases cannot add credits twice. */
function establishedEarnedCredits(progress: Record<string, CourseProgress>): number {
  const creditsByCourse = new Map<string, number | null>();
  Object.entries(progress).forEach(([code, course]) => {
    if (course.state !== "passed") return;
    const actualCode = course.courseCode
      ? normalizeCourseCode(course.courseCode)
      : [...courseLanguageVariants(code)].sort()[0];
    const credit = course.countedCredit;
    const known = typeof credit === "number" && Number.isFinite(credit) && credit >= 0 ? credit : null;
    if (!creditsByCourse.has(actualCode)) creditsByCourse.set(actualCode, known);
    else if (creditsByCourse.get(actualCode) !== known) creditsByCourse.set(actualCode, null);
  });
  return [...creditsByCourse.values()].reduce<number>((sum, credit) => sum + (credit ?? 0), 0);
}

export function evaluateCourseEligibility(
  prerequisite: ItuCoursePrerequisite | undefined,
  progress: Record<string, CourseProgress>,
  prerequisiteDataKnown = true,
): RequirementEvaluation {
  if (!prerequisiteDataKnown) return "unknown";
  if (!prerequisite) return "satisfied";
  const expression = prerequisite.expression
    ? evaluatePrerequisiteExpression(prerequisite.expression, progress)
    : "satisfied";
  if (expression === "unsatisfied") return "unsatisfied";
  if (prerequisite.minimumCredits !== undefined && establishedEarnedCredits(progress) < prerequisite.minimumCredits) return "unknown";
  return expression;
}

export function getCourseStatus(
  courseCode: string,
  prerequisite: ItuCoursePrerequisite | undefined,
  progress: Record<string, CourseProgress>,
  prerequisiteDataKnown = true,
): CourseStatusResult {
  const manualState = progress[courseCode]?.state ?? "none";
  const eligibility = evaluateCourseEligibility(
    prerequisite,
    progress,
    prerequisiteDataKnown,
  );
  if (manualState === "passed") {
    return { status: "passed", eligibility };
  }
  if (manualState === "failed") {
    return { status: "failed", eligibility };
  }
  return { status: "not-taken", eligibility };
}

export function isCourseTakeableThisSemester(
  courseCode: string,
  prerequisite: ItuCoursePrerequisite | undefined,
  progress: Record<string, CourseProgress>,
  offeredCourseCodes: ReadonlySet<string>,
  prerequisiteDataKnown = true,
): boolean {
  const languageVariants = courseLanguageVariants(courseCode);
  return (
    !languageVariants.some((code) => progress[code]?.state === "passed") &&
    languageVariants.some((code) => offeredCourseCodes.has(code)) &&
    evaluateCourseEligibility(prerequisite, progress, prerequisiteDataKnown) === "satisfied"
  );
}

export function getMissingPrerequisites(
  prerequisite: ItuCoursePrerequisite | undefined,
  progress: Record<string, CourseProgress>,
): MissingRequirement[] {
  if (!prerequisite) return [];
  const missing: MissingRequirement[] = [];
  if (prerequisite.minimumCredits !== undefined && establishedEarnedCredits(progress) < prerequisite.minimumCredits) {
    missing.push({ kind: "credits", minimumCredits: prerequisite.minimumCredits });
  }
  if (!prerequisite.expression) return missing;

  function visit(expression: PrerequisiteExpression): MissingRequirement | null {
    if (evaluatePrerequisiteExpression(expression, progress) === "satisfied") return null;
    if (expression.kind === "unknown") return { kind: "unknown", raw: expression.raw };
    if (expression.kind === "course") {
      return {
        kind: "course",
        courseCode: expression.courseCode,
        ...(expression.minimumGrade ? { minimumGrade: expression.minimumGrade } : {}),
      };
    }
    const requirements = expression.operands
      .map(visit)
      .filter((item): item is MissingRequirement => Boolean(item));
    return requirements.length
      ? { kind: expression.kind === "and" ? "all" : "one-of", requirements }
      : null;
  }

  const expressionMissing = visit(prerequisite.expression);
  if (expressionMissing) missing.push(expressionMissing);
  return missing;
}
