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

const GRADE_RANK = {
  FF: 0,
  FD: 1,
  DD: 2,
  DC: 3,
  CC: 4,
  CB: 5,
  BB: 6,
  BA: 7,
  AA: 8,
} as const;

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
    return GRADE_RANK[course.grade] >= GRADE_RANK[expression.minimumGrade]
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

export function evaluateCourseEligibility(
  prerequisite: ItuCoursePrerequisite | undefined,
  progress: Record<string, CourseProgress>,
  prerequisiteDataKnown = true,
): RequirementEvaluation {
  if (!prerequisiteDataKnown) return "unknown";
  if (!prerequisite) return "satisfied";
  if (prerequisite.minimumCredits !== undefined) return "unknown";
  if (!prerequisite.expression) return "satisfied";
  return evaluatePrerequisiteExpression(prerequisite.expression, progress);
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
  return (
    progress[courseCode]?.state !== "passed" &&
    offeredCourseCodes.has(courseCode) &&
    evaluateCourseEligibility(prerequisite, progress, prerequisiteDataKnown) === "satisfied"
  );
}

export function getMissingPrerequisites(
  prerequisite: ItuCoursePrerequisite | undefined,
  progress: Record<string, CourseProgress>,
): MissingRequirement[] {
  if (!prerequisite) return [];
  const missing: MissingRequirement[] = [];
  if (prerequisite.minimumCredits !== undefined) {
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
