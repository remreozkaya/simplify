import {
  evaluatePrerequisiteExpression,
  getMissingPrerequisites,
} from "@/lib/curriculum/eligibility";
import {
  progressForRequirement,
  resolvedCourseProgress,
} from "@/lib/curriculum/graduation";
import type { CourseProgress, RequirementEvaluation } from "@/lib/curriculum/types";
import { courseBranch } from "@/lib/curriculum/availability";
import type {
  ItuCoursePrerequisite,
  ItuCurriculumItem,
  PrerequisiteExpression,
} from "@/lib/itu/curriculum/types";
import {
  courseLanguageVariants,
  normalizeCourseCode,
} from "@/lib/itu/courseCode.mjs";
import { generateConflictFreeSchedules } from "@/lib/schedule/generator";
import type { GeneratedSchedule, GeneratorCourse } from "@/lib/schedule/types";
import type {
  PlannerAvailability,
  PlannerContribution,
  PlannerEligibility,
  PlannerNotice,
  PlannerProgramSummary,
  SemesterCourseCandidate,
  SemesterPlan,
  SemesterPlannerOptions,
  SemesterPlannerProgram,
} from "@/lib/semester-planner/types";

export const MAX_PLANNER_CREDITS = 60;
export const MAX_PLANNER_COURSES = 30;

type MutableCandidate = Omit<SemesterCourseCandidate, "eligibility" | "availability" | "missingPrerequisites" | "immediateUnlocks" | "downstreamUnlocks" | "score"> & {
  prerequisiteSources: Array<{ prerequisite?: ItuCoursePrerequisite; prerequisiteKnown: boolean }>;
};

function firstCredit(item: ItuCurriculumItem) {
  return item.creditOptions[0] ?? 0;
}

function firstEcts(item: ItuCurriculumItem) {
  return item.ectsOptions[0] ?? 0;
}

function isRequirementCompleted(item: ItuCurriculumItem, program: SemesterPlannerProgram) {
  return progressForRequirement(item, program.progress)?.course.state === "passed";
}

function prerequisiteForCode(program: SemesterPlannerProgram, code: string) {
  return courseLanguageVariants(code)
    .map((variant) => program.curriculum.prerequisites[variant])
    .find((value): value is ItuCoursePrerequisite => Boolean(value));
}

function prerequisitesKnown(program: SemesterPlannerProgram, code: string) {
  return program.curriculum.prerequisiteDataAvailable &&
    program.curriculum.prerequisiteBranchesLoaded.includes(courseBranch(code));
}

function addProgress(target: Record<string, CourseProgress>, code: string, progress: CourseProgress) {
  if (target[code]?.state === "passed" && progress.state !== "passed") return;
  target[code] = progress;
  if (progress.state === "passed") {
    courseLanguageVariants(code).forEach((variant) => {
      if (target[variant]?.state !== "passed") target[variant] = progress;
    });
  }
}

function combinedProgress(programs: readonly SemesterPlannerProgram[]) {
  const result: Record<string, CourseProgress> = {};
  programs.forEach((program) => {
    Object.entries(resolvedCourseProgress(program.curriculum, program.progress)).forEach(([code, progress]) => {
      addProgress(result, normalizeCourseCode(code), progress);
    });
  });
  return result;
}

function earnedCredits(progress: Record<string, CourseProgress>) {
  const seen = new Set<string>();
  return Object.entries(progress).reduce((sum, [code, course]) => {
    const actual = normalizeCourseCode(course.courseCode ?? code);
    if (course.state !== "passed" || seen.has(actual)) return sum;
    seen.add(actual);
    return sum + (course.countedCredit ?? 0);
  }, 0);
}

function evaluatePrerequisite(
  prerequisite: ItuCoursePrerequisite | undefined,
  progress: Record<string, CourseProgress>,
  known: boolean,
): RequirementEvaluation {
  if (!known) return "unknown";
  if (!prerequisite) return "satisfied";
  if (prerequisite.minimumCredits !== undefined && earnedCredits(progress) < prerequisite.minimumCredits) return "unknown";
  if (!prerequisite.expression) return "satisfied";
  return evaluatePrerequisiteExpression(prerequisite.expression, progress);
}

function evaluateCandidateEligibility(
  sources: MutableCandidate["prerequisiteSources"],
  confirmedProgress: Record<string, CourseProgress>,
  projectedProgress: Record<string, CourseProgress>,
): { eligibility: PlannerEligibility | "ineligible"; missing: ReturnType<typeof getMissingPrerequisites> } {
  let unknown = false;
  let conditional = false;
  const missing = sources.flatMap(({ prerequisite }) => getMissingPrerequisites(prerequisite, confirmedProgress));

  for (const { prerequisite, prerequisiteKnown } of sources) {
    const confirmed = evaluatePrerequisite(prerequisite, confirmedProgress, prerequisiteKnown);
    if (confirmed === "satisfied") continue;
    const projected = evaluatePrerequisite(prerequisite, projectedProgress, prerequisiteKnown);
    if (confirmed === "unsatisfied" && projected === "satisfied") {
      conditional = true;
      continue;
    }
    if (confirmed === "unknown" || projected === "unknown") {
      unknown = true;
      continue;
    }
    return { eligibility: "ineligible", missing };
  }

  return { eligibility: unknown ? "unknown" : conditional ? "conditional" : "confirmed", missing };
}

function evaluateAvailability(code: string, options: SemesterPlannerOptions): PlannerAvailability {
  if (options.availabilityMode === "unknown") return "unknown";
  const branch = courseBranch(code);
  if (!options.knownBranchCodes?.has(branch)) return "unknown";
  return courseLanguageVariants(code).some((variant) => options.offeredCourseCodes?.has(variant))
    ? "available"
    : "unavailable";
}

function expressionCourseCodes(expression: PrerequisiteExpression | undefined): string[] {
  if (!expression || expression.kind === "unknown") return [];
  if (expression.kind === "course") return [normalizeCourseCode(expression.courseCode)];
  return [...new Set(expression.operands.flatMap(expressionCourseCodes))];
}

function remainingTargetCodes(programs: readonly SemesterPlannerProgram[]) {
  const result = new Set<string>();
  programs.forEach((program) => program.curriculum.semesters.forEach((semester) => semester.items.forEach((item) => {
    if (isRequirementCompleted(item, program)) return;
    if (item.kind === "course") result.add(normalizeCourseCode(item.code));
    else item.courses.forEach((course) => result.add(normalizeCourseCode(course.code)));
  })));
  return result;
}

function unlocksForCandidate(
  code: string,
  programs: readonly SemesterPlannerProgram[],
  progress: Record<string, CourseProgress>,
) {
  const simulated = { ...progress };
  addProgress(simulated, code, { state: "passed", grade: "AA" });
  const remaining = remainingTargetCodes(programs);
  const reverseEdges = new Map<string, Set<string>>();
  const immediate = new Set<string>();

  programs.forEach((program) => Object.values(program.curriculum.prerequisites).forEach((prerequisite) => {
    const target = normalizeCourseCode(prerequisite.courseCode);
    if (!remaining.has(target)) return;
    const dependencies = expressionCourseCodes(prerequisite.expression);
    dependencies.forEach((dependency) => {
      const targets = reverseEdges.get(dependency) ?? new Set<string>();
      targets.add(target);
      reverseEdges.set(dependency, targets);
    });
    if (!dependencies.includes(code) || !prerequisitesKnown(program, target)) return;
    const before = evaluatePrerequisite(prerequisite, progress, true);
    const after = evaluatePrerequisite(prerequisite, simulated, true);
    if (before !== "satisfied" && after === "satisfied") immediate.add(target);
  }));

  const downstream = new Set<string>();
  const queue = [code];
  const visited = new Set(queue);
  while (queue.length) {
    const current = queue.shift()!;
    (reverseEdges.get(current) ?? []).forEach((target) => {
      if (visited.has(target)) return;
      visited.add(target);
      if (remaining.has(target) && target !== code) downstream.add(target);
      queue.push(target);
    });
  }
  immediate.forEach((value) => downstream.delete(value));
  return { immediate: [...immediate].sort(), downstream: [...downstream].sort() };
}

function contributionKey(contribution: PlannerContribution) {
  return `${contribution.enrollmentId}:${contribution.requirementId}`;
}

function collectCandidates(programs: readonly SemesterPlannerProgram[]) {
  const candidates = new Map<string, MutableCandidate>();
  programs.forEach((program) => {
    const chosenForProgram = new Map<string, PlannerContribution>();
    program.curriculum.semesters.forEach((semester) => semester.items.forEach((item) => {
      if (isRequirementCompleted(item, program)) return;
      const choices = item.kind === "course" ? [{
        code: item.code,
        title: item.title,
        titleTr: item.nameTr,
        titleEn: item.nameEn,
        credits: firstCredit(item),
        ects: firstEcts(item),
        direct: true,
        kind: item.requirementType,
      }] : item.courses.map((course) => ({
        code: course.code,
        title: course.title,
        titleTr: course.nameTr,
        titleEn: course.nameEn,
        credits: course.creditOptions[0] ?? firstCredit(item),
        ects: course.ectsOptions[0] ?? firstEcts(item),
        direct: false,
        kind: "elective" as const,
      }));

      choices.forEach((choice) => {
        const code = normalizeCourseCode(choice.code);
        const contribution: PlannerContribution = {
          enrollmentId: program.enrollment.id,
          enrollmentType: program.enrollment.type,
          programName: program.enrollment.programName,
          programNameTr: program.enrollment.programNameTr,
          programNameEn: program.enrollment.programNameEn,
          requirementId: item.id,
          requirementName: item.title,
          requirementNameTr: item.nameTr,
          requirementNameEn: item.nameEn,
          requirementKind: choice.kind,
          directRequirement: choice.direct,
        };
        const previous = chosenForProgram.get(code);
        if (!previous || (!previous.directRequirement && contribution.directRequirement)) chosenForProgram.set(code, contribution);

        const existing = candidates.get(code) ?? {
          code,
          title: choice.title,
          titleTr: choice.titleTr,
          titleEn: choice.titleEn,
          credits: choice.credits,
          ects: choice.ects,
          contributions: [],
          prerequisiteSources: [],
        };
        existing.credits = Math.max(existing.credits, choice.credits);
        existing.ects = Math.max(existing.ects, choice.ects);
        const source = {
          prerequisite: prerequisiteForCode(program, code),
          prerequisiteKnown: prerequisitesKnown(program, code),
        };
        if (!existing.prerequisiteSources.some((candidate) => candidate.prerequisite === source.prerequisite && candidate.prerequisiteKnown === source.prerequisiteKnown)) {
          existing.prerequisiteSources.push(source);
        }
        candidates.set(code, existing);
      });
    }));
    chosenForProgram.forEach((contribution, code) => {
      const candidate = candidates.get(code);
      if (candidate && !candidate.contributions.some((value) => contributionKey(value) === contributionKey(contribution))) {
        candidate.contributions.push(contribution);
      }
    });
  });
  return candidates;
}

function remainingCreditsForProgram(program: SemesterPlannerProgram) {
  return program.curriculum.semesters.reduce((sum, semester) => sum + semester.items.reduce((semesterSum, item) =>
    semesterSum + (isRequirementCompleted(item, program) ? 0 : firstCredit(item)), 0), 0);
}

function combinedRemainingCredits(programs: readonly SemesterPlannerProgram[]) {
  const direct = new Map<string, number>();
  let nonShareable = 0;
  programs.forEach((program) => program.curriculum.semesters.forEach((semester) => semester.items.forEach((item) => {
    if (isRequirementCompleted(item, program)) return;
    if (item.kind === "course") {
      const code = normalizeCourseCode(item.code);
      direct.set(code, Math.max(direct.get(code) ?? 0, firstCredit(item)));
    } else {
      // Elective overlap is not assumed to be shareable without an explicit rule.
      nonShareable += firstCredit(item);
    }
  })));
  return [...direct.values()].reduce((sum, credit) => sum + credit, nonShareable);
}

function baseScore(candidate: Omit<SemesterCourseCandidate, "score">) {
  const compulsory = candidate.contributions.filter((value) => value.requirementKind === "compulsory").length;
  const directPrograms = new Set(candidate.contributions.filter((value) => value.directRequirement).map((value) => value.enrollmentId)).size;
  return compulsory * 60 +
    (directPrograms > 1 ? (directPrograms - 1) * 55 : 0) +
    candidate.immediateUnlocks.length * 28 +
    candidate.downstreamUnlocks.length * 9 +
    (candidate.availability === "available" ? 10 : candidate.availability === "unknown" ? -4 : -1000) +
    (candidate.eligibility === "confirmed" ? 8 : candidate.eligibility === "conditional" ? -5 : -10);
}

function candidateSelectionScore(
  selected: readonly SemesterCourseCandidate[],
  programSummaries: readonly PlannerProgramSummary[],
  options: SemesterPlannerOptions,
) {
  let score = selected.reduce((sum, candidate) => sum + candidate.score, 0);
  if (options.priority !== "balanced") {
    return score + selected.reduce((sum, candidate) => sum + (
      candidate.contributions.some((contribution) => contribution.enrollmentType === options.priority) ? 45 : 0
    ), 0);
  }

  const completionRatios = programSummaries.map((program) => {
    const selectedCredits = selected
      .filter((course) => course.contributions.some((contribution) => contribution.enrollmentId === program.enrollmentId))
      .reduce((sum, course) => sum + course.credits, 0);
    return program.remainingCredits > 0 ? selectedCredits / program.remainingCredits : 1;
  });
  const coveredPrograms = completionRatios.filter((ratio) => ratio > 0).length;
  const spread = completionRatios.length
    ? Math.max(...completionRatios) - Math.min(...completionRatios)
    : 0;
  score += coveredPrograms * 80 - spread * 60;
  return score;
}

function validateOptions(options: SemesterPlannerOptions) {
  if (!Number.isFinite(options.desiredCredits) || options.desiredCredits < 0 || options.desiredCredits > MAX_PLANNER_CREDITS) {
    throw new RangeError(`desiredCredits must be between 0 and ${MAX_PLANNER_CREDITS}.`);
  }
  if (options.maxCourses !== undefined && (
    !Number.isInteger(options.maxCourses) || options.maxCourses < 0 || options.maxCourses > MAX_PLANNER_COURSES
  )) {
    throw new RangeError(`maxCourses must be a whole number between 0 and ${MAX_PLANNER_COURSES}.`);
  }
}

function offeringForCode(code: string, offerings: readonly GeneratorCourse[] = []) {
  const variants = new Set(courseLanguageVariants(code));
  return offerings.find((offering) => variants.has(normalizeCourseCode(offering.courseCode)));
}

function scheduleForCourses(
  courses: readonly SemesterCourseCandidate[],
  options: SemesterPlannerOptions,
): GeneratedSchedule | null {
  if (!courses.length) return null;
  const generatorCourses: GeneratorCourse[] = [];
  for (const candidate of courses) {
    const offering = offeringForCode(candidate.code, options.courseOfferings);
    if (!offering) return null;
    generatorCourses.push({
      ...offering,
      courseCode: candidate.code,
      courseTitle: candidate.title,
    });
  }
  return generateConflictFreeSchedules(generatorCourses, {
    maxResults: 1,
    maxVisitedNodes: Number.MAX_SAFE_INTEGER,
    stopAfterFirst: true,
  }).schedules[0] ?? null;
}

function comparisonForSelection(
  selected: readonly SemesterCourseCandidate[],
  programSummaries: readonly PlannerProgramSummary[],
  options: SemesterPlannerOptions,
) {
  const credits = selected.reduce((sum, course) => sum + course.credits, 0);
  return {
    distance: Math.abs(options.desiredCredits - credits),
    overTarget: credits > options.desiredCredits ? 1 : 0,
    score: candidateSelectionScore(selected, programSummaries, options),
    courses: selected.length,
    codeKey: selected.map((course) => course.code).sort().join("|"),
  };
}

function isBetterSelection(
  candidate: ReturnType<typeof comparisonForSelection>,
  current: ReturnType<typeof comparisonForSelection>,
) {
  return candidate.distance < current.distance ||
    (candidate.distance === current.distance && candidate.overTarget < current.overTarget) ||
    (candidate.distance === current.distance && candidate.overTarget === current.overTarget && candidate.score > current.score) ||
    (candidate.distance === current.distance && candidate.overTarget === current.overTarget && candidate.score === current.score && candidate.courses < current.courses) ||
    (candidate.distance === current.distance && candidate.overTarget === current.overTarget && candidate.score === current.score && candidate.courses === current.courses && candidate.codeKey < current.codeKey);
}

export function semesterPlannerCandidateCodes(programs: readonly SemesterPlannerProgram[]) {
  return [...collectCandidates(programs).keys()].sort();
}

export function buildSemesterPlan(
  programs: readonly SemesterPlannerProgram[],
  options: SemesterPlannerOptions,
): SemesterPlan {
  validateOptions(options);
  const confirmedProgress = combinedProgress(programs);
  const notices: PlannerNotice[] = [];
  const candidateMap = collectCandidates(programs);
  const candidates: SemesterCourseCandidate[] = [];
  let hasUnknownEligibility = false;
  let hasUnknownAvailability = options.availabilityMode === "unknown";

  candidateMap.forEach((candidate, code) => {
    if (courseLanguageVariants(code).some((variant) => confirmedProgress[variant]?.state === "passed")) return;
    const { eligibility, missing } = evaluateCandidateEligibility(candidate.prerequisiteSources, confirmedProgress, confirmedProgress);
    if (eligibility === "unknown") hasUnknownEligibility = true;
    if (eligibility !== "confirmed") return;
    const availability = evaluateAvailability(code, options);
    if (availability === "unknown") hasUnknownAvailability = true;
    const offering = offeringForCode(code, options.courseOfferings);
    if (availability !== "available" || !offering?.sections.some((section) => section.meetings.length > 0)) return;
    const unlocks = unlocksForCandidate(code, programs, confirmedProgress);
    const value = {
      code: candidate.code,
      title: candidate.title,
      titleTr: candidate.titleTr,
      titleEn: candidate.titleEn,
      credits: candidate.credits,
      ects: candidate.ects,
      contributions: candidate.contributions,
      eligibility,
      availability,
      missingPrerequisites: missing,
      immediateUnlocks: unlocks.immediate,
      downstreamUnlocks: unlocks.downstream,
    };
    candidates.push({ ...value, score: baseScore(value) });
  });

  const programSummaries: PlannerProgramSummary[] = programs.map((program) => ({
    enrollmentId: program.enrollment.id,
    enrollmentType: program.enrollment.type,
    programName: program.enrollment.programName,
    programNameTr: program.enrollment.programNameTr,
    programNameEn: program.enrollment.programNameEn,
    remainingCredits: remainingCreditsForProgram(program),
    selectedCredits: 0,
    selectedCourses: 0,
  }));
  const available = candidates.sort((first, second) => second.score - first.score || first.code.localeCompare(second.code));
  const maximumCourses = options.maxCourses && options.maxCourses > 0
    ? Math.min(options.maxCourses, available.length)
    : available.length;
  const maximumSingleCredit = Math.max(0, ...available.map((candidate) => candidate.credits));
  const maximumUsefulCredits = options.desiredCredits + maximumSingleCredit;
  let selected: SemesterCourseCandidate[] = [];
  let compatibleSchedule: GeneratedSchedule | null = null;
  let bestComparison = comparisonForSelection(selected, programSummaries, options);

  function explore(startIndex: number, current: SemesterCourseCandidate[], usedRequirements: ReadonlySet<string>) {
    if (current.length >= maximumCourses) return;
    const currentCredits = current.reduce((sum, course) => sum + course.credits, 0);
    for (let index = startIndex; index < available.length; index += 1) {
      const candidate = available[index];
      if (candidate.credits < 0 || !Number.isFinite(candidate.credits)) continue;
      if (currentCredits >= options.desiredCredits && candidate.credits > 0) continue;
      if (currentCredits + candidate.credits > maximumUsefulCredits) continue;
      const requirementKeys = candidate.contributions.map(contributionKey);
      if (requirementKeys.every((key) => usedRequirements.has(key))) continue;
      const next = [...current, candidate];
      const schedule = scheduleForCourses(next, options);
      if (!schedule) continue;
      const comparison = comparisonForSelection(next, programSummaries, options);
      if (isBetterSelection(comparison, bestComparison)) {
        selected = next;
        compatibleSchedule = schedule;
        bestComparison = comparison;
      }
      const nextRequirements = new Set(usedRequirements);
      requirementKeys.forEach((key) => nextRequirements.add(key));
      explore(index + 1, next, nextRequirements);
    }
  }

  explore(0, [], new Set());

  const selectedCredits = selected.reduce((sum, course) => sum + course.credits, 0);
  const selectedEcts = selected.reduce((sum, course) => sum + course.ects, 0);
  programSummaries.forEach((summary) => {
    const contributing = selected.filter((candidate) => candidate.contributions.some((value) => value.enrollmentId === summary.enrollmentId));
    summary.selectedCredits = contributing.reduce((sum, candidate) => sum + candidate.credits, 0);
    summary.selectedCourses = contributing.length;
  });

  if (selectedCredits < options.desiredCredits) notices.push({ kind: "target-shortfall", credits: options.desiredCredits - selectedCredits });
  if (selectedCredits > options.desiredCredits) notices.push({ kind: "target-overage", credits: selectedCredits - options.desiredCredits });
  const collisionBlocked = available.some((candidate) => {
    if (selected.includes(candidate)) return false;
    if (options.maxCourses && options.maxCourses > 0 && selected.length >= options.maxCourses) return false;
    const differenceBefore = Math.abs(options.desiredCredits - selectedCredits);
    const differenceAfter = Math.abs(options.desiredCredits - selectedCredits - candidate.credits);
    return differenceAfter < differenceBefore && !scheduleForCourses([...selected, candidate], options);
  });
  if (selectedCredits !== options.desiredCredits && collisionBlocked) notices.push({ kind: "collision-shortfall" });
  if (options.maxCourses && selected.length >= options.maxCourses && available.some((candidate) => !selected.includes(candidate))) notices.push({ kind: "max-courses", count: options.maxCourses });
  if (hasUnknownAvailability) notices.push({ kind: "availability-unknown" });
  if (hasUnknownEligibility) notices.push({ kind: "eligibility-unknown" });
  notices.push({ kind: "registration-limit-unknown" }, { kind: "corequisites-unknown" });

  const selectedSchedule = compatibleSchedule as GeneratedSchedule | null;
  const compatibleSectionConstraints = selectedSchedule?.selections.map((selection) => ({
    courseCode: selection.courseCode,
    branchCode: selection.branchCode,
    courseId: selection.courseId,
    sectionId: selection.sectionId,
    crn: selection.crn,
  })) ?? [];

  return {
    recommendations: selected,
    alternatives: available.filter((candidate) => !selected.includes(candidate)).sort((first, second) => second.score - first.score || first.code.localeCompare(second.code)),
    programSummaries,
    selectedCredits,
    selectedEcts,
    combinedRemainingCredits: combinedRemainingCredits(programs),
    compatibleSectionConstraints,
    notices,
  };
}
