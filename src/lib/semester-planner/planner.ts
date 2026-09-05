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

type MutableCandidate = Omit<SemesterCourseCandidate, "eligibility" | "availability" | "missingPrerequisites" | "immediateUnlocks" | "downstreamUnlocks" | "score"> & {
  prerequisiteSources: Array<{ prerequisite?: ItuCoursePrerequisite; prerequisiteKnown: boolean }>;
};

function uniqueCodes(values: readonly string[] = []) {
  return new Set(values.map(normalizeCourseCode).filter(Boolean));
}

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
  candidate: SemesterCourseCandidate,
  selected: readonly SemesterCourseCandidate[],
  programSummaries: readonly PlannerProgramSummary[],
  options: SemesterPlannerOptions,
) {
  let score = candidate.score;
  const totalNeed = programSummaries.reduce((sum, program) => sum + program.remainingCredits, 0) || 1;
  const selectedByProgram = new Map(programSummaries.map((program) => [program.enrollmentId, selected
    .filter((course) => course.contributions.some((contribution) => contribution.enrollmentId === program.enrollmentId))
    .reduce((sum, course) => sum + course.credits, 0)]));
  const selectedTotal = Math.max(1, selected.reduce((sum, course) => sum + course.credits, 0));

  candidate.contributions.forEach((contribution) => {
    const program = programSummaries.find((value) => value.enrollmentId === contribution.enrollmentId);
    if (!program) return;
    if (options.priority === "balanced") {
      const needShare = program.remainingCredits / totalNeed;
      const currentShare = (selectedByProgram.get(program.enrollmentId) ?? 0) / selectedTotal;
      score += (needShare - currentShare) * 35;
    } else if (options.priority === contribution.enrollmentType) {
      score += 45;
    }
  });
  return score;
}

function suggestedCredits(remaining: number) {
  if (remaining <= 0) return 0;
  return Math.min(18, Math.max(3, Math.ceil(Math.min(remaining, 18) / 3) * 3));
}

export function buildSemesterPlan(
  programs: readonly SemesterPlannerProgram[],
  options: SemesterPlannerOptions,
): SemesterPlan {
  const confirmedProgress = combinedProgress(programs);
  const projectedProgress = { ...confirmedProgress };
  uniqueCodes(options.inProgressCourseCodes).forEach((code) => addProgress(projectedProgress, code, { state: "passed", grade: "AA" }));
  const included = uniqueCodes([...(options.includedCourseCodes ?? []), ...(options.lockedCourseCodes ?? [])]);
  const excluded = uniqueCodes(options.excludedCourseCodes);
  const notices: PlannerNotice[] = [];
  const candidateMap = collectCandidates(programs);
  const candidates: SemesterCourseCandidate[] = [];

  candidateMap.forEach((candidate, code) => {
    if (courseLanguageVariants(code).some((variant) => confirmedProgress[variant]?.state === "passed")) return;
    const { eligibility, missing } = evaluateCandidateEligibility(candidate.prerequisiteSources, confirmedProgress, projectedProgress);
    if (eligibility === "ineligible") return;
    const availability = evaluateAvailability(code, options);
    if (availability === "unavailable") return;
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

  included.forEach((code) => {
    if (candidates.some((candidate) => candidate.code === code)) return;
    const raw = candidateMap.get(code);
    if (!raw) notices.push({ kind: "included-not-found", courseCode: code });
    else {
      const availability = evaluateAvailability(code, options);
      notices.push({ kind: availability === "unavailable" ? "included-unavailable" : "included-ineligible", courseCode: code });
    }
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
  const available = candidates.filter((candidate) => !excluded.has(candidate.code));
  const selected: SemesterCourseCandidate[] = [];
  const forced = available.filter((candidate) => included.has(candidate.code));
  forced.sort((first, second) => second.score - first.score || first.code.localeCompare(second.code));
  forced.forEach((candidate) => {
    if (options.maxCourses && selected.length >= options.maxCourses) return;
    selected.push(candidate);
  });

  while (!options.maxCourses || selected.length < options.maxCourses) {
    const selectedCredits = selected.reduce((sum, course) => sum + course.credits, 0);
    const choices = available
      .filter((candidate) => !selected.includes(candidate) && selectedCredits + candidate.credits <= options.desiredCredits)
      .sort((first, second) =>
        candidateSelectionScore(second, selected, programSummaries, options) - candidateSelectionScore(first, selected, programSummaries, options) ||
        second.credits - first.credits || first.code.localeCompare(second.code));
    if (!choices.length) break;
    selected.push(choices[0]);
  }

  const selectedCredits = selected.reduce((sum, course) => sum + course.credits, 0);
  const selectedEcts = selected.reduce((sum, course) => sum + course.ects, 0);
  programSummaries.forEach((summary) => {
    const contributing = selected.filter((candidate) => candidate.contributions.some((value) => value.enrollmentId === summary.enrollmentId));
    summary.selectedCredits = contributing.reduce((sum, candidate) => sum + candidate.credits, 0);
    summary.selectedCourses = contributing.length;
  });

  if (selectedCredits < options.desiredCredits) notices.push({ kind: "target-shortfall", credits: options.desiredCredits - selectedCredits });
  if (selectedCredits > options.desiredCredits) notices.push({ kind: "forced-over-target", credits: selectedCredits - options.desiredCredits });
  if (options.maxCourses && selected.length >= options.maxCourses && available.some((candidate) => !selected.includes(candidate))) notices.push({ kind: "max-courses", count: options.maxCourses });
  if (options.availabilityMode === "unknown" || candidates.some((candidate) => candidate.availability === "unknown")) notices.push({ kind: "availability-unknown" });
  notices.push({ kind: "registration-limit-unknown" }, { kind: "corequisites-unknown" });

  return {
    recommendations: selected,
    alternatives: available.filter((candidate) => !selected.includes(candidate)).sort((first, second) => second.score - first.score || first.code.localeCompare(second.code)),
    programSummaries,
    selectedCredits,
    selectedEcts,
    combinedRemainingCredits: combinedRemainingCredits(programs),
    suggestedCredits: suggestedCredits(combinedRemainingCredits(programs)),
    notices,
  };
}

export function estimateSemestersUntil(targetDate: string, from = new Date()) {
  if (!targetDate) return null;
  const target = new Date(`${targetDate}T00:00:00`);
  if (Number.isNaN(target.getTime()) || target <= from) return null;
  const months = (target.getFullYear() - from.getFullYear()) * 12 + target.getMonth() - from.getMonth();
  return Math.max(1, Math.ceil(months / 6));
}
