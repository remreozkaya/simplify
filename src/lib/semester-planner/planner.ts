import { mergePrerequisiteProgress } from "@/lib/curriculum/progress";
import { evaluateProgramEligibility, resolveProgramMemberships } from "@/lib/program-restrictions/eligibility";
import {
  evaluateCourseEligibility,
  getMissingPrerequisites,
} from "@/lib/curriculum/eligibility";
import {
  progressForRequirement,
  requirementCredit,
  resolvedCourseProgress,
} from "@/lib/curriculum/graduation";
import type { CourseProgress } from "@/lib/curriculum/types";
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
  SemesterWeeklyProgram,
  SemesterPlannerOptions,
  SemesterPlannerProgram,
} from "@/lib/semester-planner/types";

export const MAX_PLANNER_CREDITS = 60;
export const MAX_PLANNER_COURSES = 30;
export const MAX_RECOMMENDED_PROGRAMS = 6;
// Operational work limits, independent of academic registration policy.
export const MAX_PLANNER_CANDIDATE_VISITS = 2_000;
export const MAX_PLANNER_SCHEDULE_NODES = 20_000;
const MAX_PLANNER_SCHEDULE_CALL_NODES = 500;

type MutableCandidate = Omit<SemesterCourseCandidate, "programEligibility" | "eligibility" | "availability" | "missingPrerequisites" | "immediateUnlocks" | "downstreamUnlocks" | "score"> & {
  prerequisiteSources: Array<{ prerequisite?: ItuCoursePrerequisite; prerequisiteKnown: boolean }>;
};

function uniqueOption(options: readonly number[]): number | null {
  const values = [...new Set(options)];
  return values.length === 1 ? values[0] : null;
}

function requirementEcts(item: ItuCurriculumItem) {
  return uniqueOption(item.ectsOptions);
}

function isRequirementCompleted(item: ItuCurriculumItem, program: SemesterPlannerProgram) {
  return progressForRequirement(item, program.progress, program.curriculum)?.course.state === "passed";
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
  // Shared transcript attempts take precedence over every program's local
  // manual/stale progress, including failed attempts and language aliases.
  const canonical = new Map(programs.flatMap((program) =>
    Object.entries(program.prerequisiteProgress ?? {}).map(([code, progress]) => [normalizeCourseCode(code), progress] as const),
  ));
  return mergePrerequisiteProgress(result, Object.fromEntries(canonical));
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
    const confirmed = evaluateCourseEligibility(prerequisite, confirmedProgress, prerequisiteKnown);
    if (confirmed === "satisfied") continue;
    const projected = evaluateCourseEligibility(prerequisite, projectedProgress, prerequisiteKnown);
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
    const before = evaluateCourseEligibility(prerequisite, progress, true);
    const after = evaluateCourseEligibility(prerequisite, simulated, true);
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
  let unknownCredits = false;
  programs.forEach((program) => {
    const chosenForProgram = new Map<string, PlannerContribution>();
    program.curriculum.semesters.forEach((semester) => semester.items.forEach((item) => {
      if (isRequirementCompleted(item, program)) return;
      const choices = item.kind === "course" ? [{
        code: item.code,
        title: item.title,
        titleTr: item.nameTr,
        titleEn: item.nameEn,
        credits: requirementCredit(item),
        ects: requirementEcts(item),
        direct: true,
        kind: item.requirementType,
      }] : item.courses.map((course) => ({
        code: course.code,
        title: course.title,
        titleTr: course.nameTr,
        titleEn: course.nameEn,
        credits: course.creditOptions.length ? uniqueOption(course.creditOptions) : requirementCredit(item),
        ects: course.ectsOptions.length ? uniqueOption(course.ectsOptions) : requirementEcts(item),
        direct: false,
        kind: "elective" as const,
      }));

      choices.forEach((choice) => {
        if (choice.ects === null) unknownCredits = true;
        if (choice.credits === null) {
          unknownCredits = true;
          return;
        }
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
        existing.ects = existing.ects === null || choice.ects === null ? null : Math.max(existing.ects, choice.ects);
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
  return { candidates, unknownCredits };
}

function remainingCreditsForProgram(program: SemesterPlannerProgram): number | null {
  let total = 0;
  for (const semester of program.curriculum.semesters) for (const item of semester.items) {
    if (isRequirementCompleted(item, program)) continue;
    const credit = requirementCredit(item);
    if (credit === null) return null;
    total += credit;
  }
  return total;
}

function combinedRemainingCredits(programs: readonly SemesterPlannerProgram[]): number | null {
  const direct = new Map<string, number>();
  let nonShareable = 0;
  for (const program of programs) for (const semester of program.curriculum.semesters) for (const item of semester.items) {
    if (isRequirementCompleted(item, program)) continue;
    const credit = requirementCredit(item);
    if (credit === null) return null;
    if (item.kind === "course") {
      const code = normalizeCourseCode(item.code);
      direct.set(code, Math.max(direct.get(code) ?? 0, credit));
    } else nonShareable += credit;
  }
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
    (candidate.eligibility === "confirmed" ? 8 : candidate.eligibility === "conditional" ? -5 : -10) +
    (candidate.programEligibility === "eligible" ? 20 : 0);
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

  const completionRatios = programSummaries.filter((program) => program.remainingCredits !== null).map((program) => {
    const selectedCredits = selected
      .filter((course) => course.contributions.some((contribution) => contribution.enrollmentId === program.enrollmentId))
      .reduce((sum, course) => sum + course.credits, 0);
    return program.remainingCredits !== null && program.remainingCredits > 0 ? selectedCredits / program.remainingCredits : 1;
  });
  const coveredPrograms = completionRatios.filter((ratio) => ratio > 0).length;
  const spread = completionRatios.length
    ? Math.max(...completionRatios) - Math.min(...completionRatios)
    : 0;
  score += coveredPrograms * 80 - spread * 60;
  return score;
}

function validateOptions(options: SemesterPlannerOptions) {
  if (options.desiredCredits === undefined && !(options.maxCourses !== undefined && options.maxCourses > 0)) {
    throw new RangeError("Provide a credit target or a positive course maximum.");
  }
  if (options.desiredCredits !== undefined && (!Number.isFinite(options.desiredCredits) || options.desiredCredits < 0 || options.desiredCredits > MAX_PLANNER_CREDITS)) {
    throw new RangeError(`desiredCredits must be between 0 and ${MAX_PLANNER_CREDITS}.`);
  }
  if (options.maxCourses !== undefined && (
    !Number.isInteger(options.maxCourses) || options.maxCourses < 0 || options.maxCourses > MAX_PLANNER_COURSES
  )) {
    throw new RangeError(`maxCourses must be a whole number between 0 and ${MAX_PLANNER_COURSES}.`);
  }
}

function offeringsForCode(code: string, offerings: readonly GeneratorCourse[] = []) {
  const variants = new Set(courseLanguageVariants(code));
  return offerings.filter((offering) => variants.has(normalizeCourseCode(offering.courseCode)))
    .sort((a, b) => a.courseCode.localeCompare(b.courseCode) || a.courseId.localeCompare(b.courseId));
}

type OfferingIdentity = { offering: GeneratorCourse; sectionId: string };
type ScheduleSearch = { schedule: GeneratedSchedule | null; visitedNodes: number; limited: boolean };

function scheduleForCourses(
  courses: readonly SemesterCourseCandidate[],
  options: SemesterPlannerOptions,
  maxVisitedNodes: number,
  preparedCourses: Map<string, GeneratorCourse>,
  identities: Map<string, OfferingIdentity>,
): ScheduleSearch {
  if (!courses.length) return { schedule: null, visitedNodes: 0, limited: false };
  // Each language offering retains its native course/section identity. Search
  // their sections together, then restore that identity on the chosen schedule.
  const generatorCourses = courses.map((candidate) => {
    const prepared = preparedCourses.get(candidate.code);
    if (prepared) return prepared;
    const offerings = offeringsForCode(candidate.code, options.courseOfferings);
    const value = {
      branchCode: offerings[0]?.branchCode ?? courseBranch(candidate.code),
      courseId: candidate.code,
      courseCode: candidate.code,
      courseTitle: candidate.title,
      sections: offerings.flatMap((offering) => offering.sections
        .filter((section) => !offering.pinnedSectionId || section.id === offering.pinnedSectionId)
        .map((section) => {
          const id = JSON.stringify([candidate.code, offering.branchCode, offering.courseId, section.id]);
          identities.set(id, { offering, sectionId: section.id });
          return { ...section, id };
        })),
    };
    preparedCourses.set(candidate.code, value);
    return value;
  });
  const generated = generateConflictFreeSchedules(generatorCourses, {
    maxResults: 1,
    maxVisitedNodes,
    stopAfterFirst: true,
    programMemberships: options.programMemberships,
  });
  const diagnostics = { visitedNodes: generated.visitedNodes, limited: Boolean(generated.searchLimitReached || generated.truncated) };
  function restoreIdentity<T extends { sectionId: string; branchCode: string; courseId: string }>(value: T): T {
    const identity = identities.get(value.sectionId)!;
    return { ...value, branchCode: identity.offering.branchCode, courseId: identity.offering.courseId, sectionId: identity.sectionId };
  }
  const schedule = generated.schedules[0];
  if (!schedule) return { schedule: null, ...diagnostics };
  const selections = schedule.selections.map(restoreIdentity);
  return {
    schedule: {
      ...schedule,
      id: JSON.stringify(selections.map(({ courseCode, branchCode, courseId, sectionId }) => [courseCode, branchCode, courseId, sectionId]).sort()),
      selections,
      meetings: schedule.meetings.map(restoreIdentity),
    },
    ...diagnostics,
  };
}

function comparisonForSelection(
  selected: readonly SemesterCourseCandidate[],
  programSummaries: readonly PlannerProgramSummary[],
  options: SemesterPlannerOptions,
) {
  const credits = selected.reduce((sum, course) => sum + course.credits, 0);
  return {
    distance: options.desiredCredits === undefined ? 0 : Math.abs(options.desiredCredits - credits),
    overTarget: options.desiredCredits !== undefined && credits > options.desiredCredits ? 1 : 0,
    score: candidateSelectionScore(selected, programSummaries, options),
    courseCountDistance: options.maxCourses && options.maxCourses > 0 ? options.maxCourses - selected.length : 0,
    courses: selected.length,
    codeKey: selected.map((course) => course.code).sort().join("|"),
  };
}

function isBetterSelection(
  candidate: ReturnType<typeof comparisonForSelection>,
  current: ReturnType<typeof comparisonForSelection>,
) {
  if (candidate.distance !== current.distance) return candidate.distance < current.distance;
  if (candidate.overTarget !== current.overTarget) return candidate.overTarget < current.overTarget;
  if (candidate.courseCountDistance !== current.courseCountDistance) return candidate.courseCountDistance < current.courseCountDistance;
  if (candidate.score !== current.score) return candidate.score > current.score;
  if (candidate.courses !== current.courses) return candidate.courses < current.courses;
  return candidate.codeKey < current.codeKey;
}

export function semesterPlannerCandidateCodes(programs: readonly SemesterPlannerProgram[]) {
  return [...collectCandidates(programs).candidates.keys()].sort();
}

export function buildSemesterPlan(
  programs: readonly SemesterPlannerProgram[],
  options: SemesterPlannerOptions,
): SemesterPlan {
  validateOptions(options);
  options = { ...options, programMemberships: options.programMemberships ?? resolveProgramMemberships(programs.map((program) => program.enrollment)) };
  const memberships = options.programMemberships ?? [];
  const sectionStatus = (section: GeneratorCourse["sections"][number]) => evaluateProgramEligibility(section.programRestriction ?? section.majorRestriction, memberships).status;
  // Section openness never creates a curriculum contribution: collectCandidates
  // continues to draw solely from each selected program's own requirements.
  const sourceOfferings = options.courseOfferings ?? [];
  options = { ...options, courseOfferings: sourceOfferings.map((offering) => ({ ...offering,
    sections: offering.sections.filter((section) => !memberships.length || sectionStatus(section) !== "ineligible"),
  })) };
  let restrictedCourseCount = 0;
  const confirmedProgress = combinedProgress(programs);
  const notices: PlannerNotice[] = [];
  const { candidates: candidateMap, unknownCredits } = collectCandidates(programs);
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
    const offerings = offeringsForCode(code, options.courseOfferings);
    const beforeRestrictions = offeringsForCode(code, sourceOfferings).flatMap((offering) => offering.sections.filter((section) => (!offering.pinnedSectionId || section.id === offering.pinnedSectionId) && section.meetings.length > 0));
    if (memberships.length && beforeRestrictions.length && beforeRestrictions.every((section) => sectionStatus(section) === "ineligible")) restrictedCourseCount += 1;
    const permittedSections = offerings.flatMap((offering) => offering.sections.filter((section) => (!offering.pinnedSectionId || section.id === offering.pinnedSectionId) && section.meetings.length > 0));
    const programEligibility = memberships.length ? (permittedSections.some((section) => sectionStatus(section) === "eligible") ? "eligible" as const : "unknown" as const) : undefined;
    if (availability !== "available" || !offerings.some((offering) => offering.sections.some((section) => section.meetings.length > 0))) return;
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
      programEligibility,
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
  if (unknownCredits || programSummaries.some((program) => program.remainingCredits === null)) notices.push({ kind: "credit-data-unknown" });
  const available = candidates.sort((first, second) => second.score - first.score || first.code.localeCompare(second.code));
  const maximumCourses = options.maxCourses && options.maxCourses > 0
    ? Math.min(options.maxCourses, available.length)
    : available.length;
  const maximumSingleCredit = Math.max(0, ...available.map((candidate) => candidate.credits));
  const maximumUsefulCredits = options.desiredCredits === undefined ? Infinity : options.desiredCredits + maximumSingleCredit;
  let selected: SemesterCourseCandidate[] = [];
  let compatibleSchedule: GeneratedSchedule | null = null;
  let bestComparison = comparisonForSelection(selected, programSummaries, options);
  let searchLimited = false;
  const searchStats = { candidateVisits: 0, scheduleVisitedNodes: 0 };
  const preparedCourses = new Map<string, GeneratorCourse>();
  const identities = new Map<string, OfferingIdentity>();
  const scheduleCache = new Map<string, ScheduleSearch>();
  const feasibleSelections: Array<{
    courses: SemesterCourseCandidate[];
    schedule: GeneratedSchedule;
    comparison: ReturnType<typeof comparisonForSelection>;
  }> = [];

  function scheduleForSelection(courses: readonly SemesterCourseCandidate[]): ScheduleSearch {
    const key = courses.map((course) => course.code).sort().join("|");
    const cached = scheduleCache.get(key);
    if (cached) return cached;
    const remainingNodes = MAX_PLANNER_SCHEDULE_NODES - searchStats.scheduleVisitedNodes;
    if (remainingNodes <= 0) {
      searchLimited = true;
      return { schedule: null, visitedNodes: 0, limited: true };
    }
    const result = scheduleForCourses(courses, options, Math.min(MAX_PLANNER_SCHEDULE_CALL_NODES, remainingNodes), preparedCourses, identities);
    searchStats.scheduleVisitedNodes += result.visitedNodes;
    if (result.limited) searchLimited = true;
    scheduleCache.set(key, result);
    return result;
  }

  function visitCandidate() {
    if (searchStats.candidateVisits >= MAX_PLANNER_CANDIDATE_VISITS) {
      searchLimited = true;
      return false;
    }
    searchStats.candidateVisits += 1;
    return true;
  }

  function explore(startIndex: number, current: SemesterCourseCandidate[], usedRequirements: ReadonlySet<string>) {
    if (current.length >= maximumCourses) return;
    const currentCredits = current.reduce((sum, course) => sum + course.credits, 0);
    for (let index = startIndex; index < available.length; index += 1) {
      if (!visitCandidate()) return;
      const candidate = available[index];
      if (candidate.credits < 0 || !Number.isFinite(candidate.credits)) continue;
      if (options.desiredCredits !== undefined && currentCredits >= options.desiredCredits && candidate.credits > 0 &&
        (!options.maxCourses || options.desiredCredits === 0)) continue;
      if (currentCredits + candidate.credits > maximumUsefulCredits) continue;
      const requirementKeys = candidate.contributions.map(contributionKey);
      if (requirementKeys.every((key) => usedRequirements.has(key))) continue;
      const next = [...current, candidate];
      const { schedule } = scheduleForSelection(next);
      if (!schedule) continue;
      const comparison = comparisonForSelection(next, programSummaries, options);
      feasibleSelections.push({ courses: next, schedule, comparison });
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

  // Keep complete course sets: a subset adds no alternative when a valid
  // superset meets the credit target at least as closely.
  const completeSelections = feasibleSelections.filter((selection) =>
    !feasibleSelections.some((other) =>
      other.courses.length > selection.courses.length &&
      isBetterSelection(other.comparison, selection.comparison) &&
      selection.courses.every((course) => other.courses.includes(course)),
    ),
  ).sort((a, b) => isBetterSelection(a.comparison, b.comparison) ? -1 : isBetterSelection(b.comparison, a.comparison) ? 1 : 0);
  // Exclude weaker matches on both targets. Equal matches remain available
  // for academic-priority ranking; section-only variants never become programs.
  const rankedAssignments = completeSelections.filter((selection) =>
    !completeSelections.some((other) => {
      const first = other.comparison;
      const second = selection.comparison;
      const creditsAtLeastAsClose = first.distance < second.distance ||
        (first.distance === second.distance && first.overTarget <= second.overTarget);
      const closerCredits = first.distance < second.distance ||
        (first.distance === second.distance && first.overTarget < second.overTarget);
      return creditsAtLeastAsClose && first.courseCountDistance <= second.courseCountDistance &&
        (closerCredits || first.courseCountDistance < second.courseCountDistance);
    }),
  ).slice(0, MAX_RECOMMENDED_PROGRAMS);
  if (rankedAssignments.length) {
    selected = rankedAssignments[0].courses;
    compatibleSchedule = rankedAssignments[0].schedule;
  }
  const selectedCredits = selected.reduce((sum, course) => sum + course.credits, 0);
  if (options.desiredCredits !== undefined && selectedCredits < options.desiredCredits) notices.push({ kind: "target-shortfall", credits: options.desiredCredits - selectedCredits });
  if (options.desiredCredits !== undefined && selectedCredits > options.desiredCredits) notices.push({ kind: "target-overage", credits: selectedCredits - options.desiredCredits });
  const collisionBlocked = options.desiredCredits !== undefined && available.some((candidate) => {
    if (options.desiredCredits === undefined) return false;
    if (!visitCandidate()) return false;
    if (selected.includes(candidate)) return false;
    if (options.maxCourses && options.maxCourses > 0 && selected.length >= options.maxCourses) return false;
    const differenceBefore = Math.abs(options.desiredCredits - selectedCredits);
    const differenceAfter = Math.abs(options.desiredCredits - selectedCredits - candidate.credits);
    if (differenceAfter >= differenceBefore) return false;
    const result = scheduleForSelection([...selected, candidate]);
    return !result.schedule && !result.limited;
  });
  if (selectedCredits !== options.desiredCredits && collisionBlocked) notices.push({ kind: "collision-shortfall" });
  if (options.maxCourses && selected.length >= options.maxCourses && available.some((candidate) => !selected.includes(candidate))) notices.push({ kind: "max-courses", count: options.maxCourses });
  if (searchLimited) notices.push({ kind: "search-limited" });
  if (hasUnknownAvailability) notices.push({ kind: "availability-unknown" });
  if (hasUnknownEligibility) notices.push({ kind: "eligibility-unknown" });
  if (restrictedCourseCount) notices.push({ kind: "program-restriction-blocked", count: restrictedCourseCount });
  if (selected.some((course) => course.programEligibility === "unknown")) notices.push({ kind: "program-restriction-unknown" });
  notices.push({ kind: "registration-limit-unknown" }, { kind: "corequisites-unknown" });

  const sharedNotices = notices.filter((notice) =>
    notice.kind !== "target-shortfall" && notice.kind !== "target-overage" &&
    notice.kind !== "collision-shortfall" && notice.kind !== "max-courses" &&
    notice.kind !== "program-restriction-unknown",
  );
  const weeklyPrograms: SemesterWeeklyProgram[] = rankedAssignments.map(({ courses, schedule }) => {
    const recommendations = courses.map((course) => {
      const chosen = schedule.selections.find((selection) => selection.courseCode === course.code);
      return { ...course, ...(chosen?.programEligibility ? {
        programEligibility: chosen.programEligibility === "eligible" ? "eligible" as const : "unknown" as const,
      } : {}) };
    });
    const credits = recommendations.reduce((sum, course) => sum + course.credits, 0);
    const programNotices: PlannerNotice[] = [...sharedNotices];
    if (options.desiredCredits !== undefined && credits < options.desiredCredits) programNotices.push({ kind: "target-shortfall", credits: options.desiredCredits - credits });
    if (options.desiredCredits !== undefined && credits > options.desiredCredits) programNotices.push({ kind: "target-overage", credits: credits - options.desiredCredits });
    if (options.maxCourses && recommendations.length >= options.maxCourses && available.length > recommendations.length) {
      programNotices.push({ kind: "max-courses", count: options.maxCourses });
    }
    if (recommendations.some((course) => course.programEligibility === "unknown")) programNotices.push({ kind: "program-restriction-unknown" });
    if (schedule.id === compatibleSchedule?.id && notices.some((notice) => notice.kind === "collision-shortfall")) programNotices.push({ kind: "collision-shortfall" });
    return {
      recommendations,
      schedule,
      selectedCredits: credits,
      selectedEcts: recommendations.reduce<number | null>((sum, course) => sum === null || course.ects === null ? null : sum + course.ects, 0),
      compatibleSectionConstraints: schedule.selections,
      programSummaries: programSummaries.map((summary) => {
        const contributing = recommendations.filter((course) => course.contributions.some((value) => value.enrollmentId === summary.enrollmentId));
        return { ...summary, selectedCredits: contributing.reduce((sum, course) => sum + course.credits, 0), selectedCourses: contributing.length };
      }),
      notices: programNotices,
    };
  });

  const primaryProgram = weeklyPrograms[0] ?? {
    recommendations: [],
    schedule: null,
    programSummaries,
    selectedCredits: 0,
    selectedEcts: 0,
    compatibleSectionConstraints: [],
    notices,
  };
  return {
    ...primaryProgram,
    weeklyPrograms,
    searchLimited,
    searchStats,
    combinedRemainingCredits: combinedRemainingCredits(programs),
  };
}
