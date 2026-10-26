import { GRADE_POINTS, gradePoint } from "@/lib/curriculum/grades";
import type { EquivalenceRule } from "@/lib/curriculum/equivalence";
import type { CourseProgress, CurriculumProgress, RequirementSatisfaction, TranscriptCourseRecord } from "@/lib/curriculum/types";
import type { TranscriptParseResult } from "@/lib/curriculum/transcript";
import type { ItuCurriculum, ItuCurriculumItem } from "@/lib/itu/curriculum/types";
import { courseLanguageFromCode, courseLanguageVariants, normalizeCourseCode } from "@/lib/itu/courseCode.mjs";
import { normalizeCourseLanguage } from "@/lib/itu/curriculum/language";

export type CourseMatchIssue = { record: TranscriptCourseRecord; reason: string; requirementId?: string };
export type ImportResult = { progress: CurriculumProgress; matched: TranscriptCourseRecord[]; unmatched: CourseMatchIssue[]; ambiguous: CourseMatchIssue[] };
export type RequirementProgress = {
  course: CourseProgress;
  courses: CourseProgress[];
  code: string;
  name: string;
  language?: string;
  requirementCode: string;
  requirementName: string;
  satisfaction: RequirementSatisfaction;
};

function allItems(curriculum: ItuCurriculum) {
  return curriculum.semesters.flatMap((semester) => semester.items);
}

function requirementCode(item: ItuCurriculumItem) {
  return item.kind === "course" ? normalizeCourseCode(item.code) : item.title;
}

function progressFromRecord(record: TranscriptCourseRecord, requirementId: string, satisfactionType: CourseProgress["satisfactionType"], equivalenceRuleId?: string): CourseProgress {
  return {
    state: record.completionStatus, grade: record.grade, term: record.term, crn: record.crn,
    courseCode: record.courseCode, courseName: record.courseName, courseLanguage: record.courseLanguage ?? courseLanguageFromCode(record.courseCode),
    countedCredit: record.countedCredit, transcriptCredit: record.transcriptCredit,
    completionStatus: record.completionStatus, source: "transcript", matchedRequirementId: requirementId,
    satisfactionType, ...(equivalenceRuleId ? { equivalenceRuleId } : {}),
  };
}

function meetsMinimumGrade(record: TranscriptCourseRecord, minimumGrade?: EquivalenceRule["minimumGrade"]) {
  if (record.completionStatus !== "passed") return false;
  if (!minimumGrade || minimumGrade === "BL") return true;
  if (record.grade === "BL") return false;
  return GRADE_POINTS[record.grade] >= GRADE_POINTS[minimumGrade];
}

function applicableRules(curriculum: ItuCurriculum) {
  return (curriculum.equivalenceRules ?? []).filter((rule) =>
    rule.verified && rule.active && rule.relationshipType === "directional" &&
    rule.programCode === curriculum.programCode && rule.planId === curriculum.planId,
  );
}

/** Maximize occupied slots, then exact-code matches, using residual augmenting paths. */
function matchElectiveRequirements<T>(rows: T[], candidates: (row: T) => Array<{ item: ItuCurriculumItem; exact: boolean }>) {
  const available = rows.map(candidates);
  const items = [...new Map(available.flat().map(({ item }) => [item.id, item])).values()];
  const source = 0, rowStart = 1, itemStart = rowStart + rows.length, sink = itemStart + items.length;
  type Edge = { to: number; reverse: number; capacity: number; cost: number };
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
  function edge(from: number, to: number, cost: number) {
    const forward = { to, reverse: graph[to].length, capacity: 1, cost };
    graph[from].push(forward);
    graph[to].push({ to: from, reverse: graph[from].length - 1, capacity: 0, cost: -cost });
    return forward;
  }
  const itemNodes = new Map(items.map((item, index) => [item.id, itemStart + index]));
  items.forEach((_, index) => edge(itemStart + index, sink, 0));
  const assignments = rows.map((_, index) => {
    edge(source, rowStart + index, 0);
    return available[index].map(({ item, exact }) => ({ item, exact, edge: edge(rowStart + index, itemNodes.get(item.id)!, exact ? -1 : 0) }));
  });
  // A shortest residual path can move an earlier exact assignment to another
  // exact slot while admitting a counterpart, rather than locking a greedy tier.
  while (true) {
    const distance = Array<number>(graph.length).fill(Infinity);
    const previous = Array<{ from: number; index: number } | undefined>(graph.length);
    distance[source] = 0;
    for (let pass = 1; pass < graph.length; pass += 1) {
      let changed = false;
      graph.forEach((edges, from) => edges.forEach((candidate, index) => {
        if (candidate.capacity && distance[from] + candidate.cost < distance[candidate.to]) {
          distance[candidate.to] = distance[from] + candidate.cost;
          previous[candidate.to] = { from, index };
          changed = true;
        }
      }));
      if (!changed) break;
    }
    if (!previous[sink]) break;
    let node = sink;
    while (node !== source) {
      const step = previous[node]!;
      const selected = graph[step.from][step.index];
      selected.capacity = 0;
      graph[node][selected.reverse].capacity = 1;
      node = step.from;
    }
  }
  return rows.flatMap((row, index) => {
    const assigned = assignments[index].find((candidate) => candidate.edge.capacity === 0);
    return assigned ? [{ row, item: assigned.item, exact: assigned.exact }] : [];
  });
}

/** Shared resolution order: exact, language counterpart, official plan equivalence, then elective. */
export function applyTranscriptImport(curriculum: ItuCurriculum, current: CurriculumProgress, parsed: TranscriptParseResult): ImportResult {
  const items = allItems(curriculum);
  const itemOrder = new Map(items.map((item, index) => [item.id, index]));
  const direct = new Map<string, ItuCurriculumItem[]>();
  const directLanguage = new Map<string, ItuCurriculumItem[]>();
  const elective = new Map<string, ItuCurriculumItem[]>();
  const electiveLanguage = new Map<string, ItuCurriculumItem[]>();
  items.forEach((item) => {
    if (item.kind === "course") {
      const code = normalizeCourseCode(item.code);
      direct.set(code, [...(direct.get(code) ?? []), item]);
      courseLanguageVariants(code).slice(1).forEach((variant) => directLanguage.set(variant, [...(directLanguage.get(variant) ?? []), item]));
    } else item.courses.forEach((course) => {
      const code = normalizeCourseCode(course.code);
      elective.set(code, [...(elective.get(code) ?? []), item]);
      courseLanguageVariants(code).slice(1).forEach((variant) => electiveLanguage.set(variant, [...(electiveLanguage.get(variant) ?? []), item]));
    });
  });
  const courses = Object.fromEntries(Object.entries(current.courses).filter(([, course]) => course.source !== "transcript"));
  const satisfactions: Record<string, RequirementSatisfaction> = {};
  const records = new Map(parsed.calculatedCourses.map((record) => [normalizeCourseCode(record.courseCode), record]));
  const occupied = new Set<string>();
  const used = new Set<string>();
  const handled = new Set<string>();
  const matchedByCode = new Map<string, TranscriptCourseRecord>();
  const ambiguous: CourseMatchIssue[] = [];
  const ambiguousCodes = new Set<string>();

  function earliestRequirement(candidates: ItuCurriculumItem[]) {
    return [...candidates].sort((first, second) => first.semester - second.semester || (itemOrder.get(first.id) ?? 0) - (itemOrder.get(second.id) ?? 0))[0];
  }

  function assign(item: ItuCurriculumItem, assignedRecords: TranscriptCourseRecord[], satisfactionType: RequirementSatisfaction["satisfactionType"], rule?: EquivalenceRule) {
    const normalizedCodes = assignedRecords.map((record) => normalizeCourseCode(record.courseCode));
    assignedRecords.forEach((record, index) => {
      const code = normalizedCodes[index];
      courses[code] = progressFromRecord(record, item.id, satisfactionType, rule?.id);
      handled.add(code); matchedByCode.set(code, record);
      if (record.completionStatus === "passed") used.add(code);
    });
    if (assignedRecords.every((record) => record.completionStatus === "passed")) {
      occupied.add(item.id);
      satisfactions[item.id] = {
        requirementId: item.id, requirementCourseCode: requirementCode(item), satisfiedByCourseCodes: normalizedCodes,
        satisfactionType, ...(rule ? { equivalenceRuleId: rule.id, sourceUrl: rule.sourceUrl } : {}),
      };
    }
  }

  // 1. Exact matches take precedence. Failed attempts remain visible but do not occupy a requirement.
  records.forEach((record, code) => {
    const candidates = direct.get(code) ?? [];
    if (candidates.length > 1) {
      ambiguous.push({ record, reason: "The exact course code appears in multiple curriculum requirements." });
      ambiguousCodes.add(code);
    } else if (candidates.length === 1) assign(candidates[0], [record], "direct");
  });

  // 2. Turkish and English offerings of the same course satisfy one another.
  records.forEach((record, code) => {
    if (handled.has(code) || ambiguousCodes.has(code)) return;
    const candidates = (directLanguage.get(code) ?? []).filter((item) => !occupied.has(item.id));
    if (candidates.length > 1) {
      ambiguous.push({ record, reason: "The Turkish/English course counterpart maps to multiple curriculum requirements." });
      ambiguousCodes.add(code);
    } else if (candidates.length === 1) assign(candidates[0], [record], "language-equivalence");
  });

  // 3. Evaluate verified directional rules, expanding only their language counterparts.
  const passingAvailable = new Map([...records].filter(([code, record]) => record.completionStatus === "passed" && !used.has(code) && !ambiguousCodes.has(code)));
  const rulesByTarget = new Map<string, EquivalenceRule[]>();
  applicableRules(curriculum).forEach((rule) => {
    courseLanguageVariants(rule.targetCourseCode).forEach((target) => {
      rulesByTarget.set(target, [...(rulesByTarget.get(target) ?? []), rule]);
    });
  });
  type CourseItem = Extract<ItuCurriculumItem, { kind: "course" }>;
  type Candidate = { item: CourseItem; rule: EquivalenceRule; records: TranscriptCourseRecord[] };
  const candidatesByRequirement = new Map<string, Candidate[]>();
  items.filter((item): item is CourseItem => item.kind === "course" && !occupied.has(item.id)).forEach((item) => {
    const candidates = new Map<string, Candidate>();
    (rulesByTarget.get(normalizeCourseCode(item.code)) ?? []).forEach((rule) => rule.alternatives.forEach((alternative) => {
      const alternativeRecords = alternative.allOf.map((code) =>
        courseLanguageVariants(code).map((variant) => passingAvailable.get(variant)).find((record): record is TranscriptCourseRecord => Boolean(record)),
      );
      const present = alternativeRecords.filter((record): record is TranscriptCourseRecord => Boolean(record));
      const distinctCodes = new Set(present.map((record) => normalizeCourseCode(record.courseCode)));
      if (present.length === alternative.allOf.length && distinctCodes.size === present.length && present.every((record) => meetsMinimumGrade(record, rule.minimumGrade))) {
        const candidate = { item, rule, records: present };
        const key = `${rule.id}:${[...distinctCodes].sort().join("+")}`;
        candidates.set(key, candidate);
      } else if (alternative.allOf.length > 1 && present.length > 0) {
        ambiguous.push({ record: present[0], requirementId: item.id, reason: `Official equivalence for ${item.code} requires all of: ${alternative.allOf.join(" + ")}.` });
        present.forEach((record) => ambiguousCodes.add(normalizeCourseCode(record.courseCode)));
      }
    }));
    if (candidates.size) candidatesByRequirement.set(item.id, [...candidates.values()]);
  });
  const singleCandidates: Candidate[] = [];
  candidatesByRequirement.forEach((candidates, requirementId) => {
    if (candidates.length === 1) singleCandidates.push(candidates[0]);
    else new Map(candidates.flatMap((candidate) => candidate.records.map((record) => [normalizeCourseCode(record.courseCode), record]))).forEach((record, code) => {
      ambiguous.push({ record, requirementId, reason: "Multiple official equivalence matches have equal priority; review is required." });
      ambiguousCodes.add(code);
    });
  });
  const requirementsByCourse = new Map<string, Candidate[]>();
  singleCandidates.forEach((candidate) => candidate.records.forEach((record) => {
    const code = normalizeCourseCode(record.courseCode);
    requirementsByCourse.set(code, [...(requirementsByCourse.get(code) ?? []), candidate]);
  }));
  const conflictedRequirements = new Set<string>();
  requirementsByCourse.forEach((candidates, code) => {
    const requirementIds = new Set(candidates.map((candidate) => candidate.item.id));
    if (requirementIds.size <= 1) return;
    requirementIds.forEach((id) => conflictedRequirements.add(id));
    ambiguous.push({ record: records.get(code)!, reason: `This course could satisfy ${requirementIds.size} curriculum requirements through equivalence.` });
    ambiguousCodes.add(code);
  });
  singleCandidates.forEach((candidate) => {
    if (!conflictedRequirements.has(candidate.item.id) && candidate.records.every((record) => !ambiguousCodes.has(normalizeCourseCode(record.courseCode)))) assign(candidate.item, candidate.records, "equivalence", candidate.rule);
  });

  // 4. Maximize elective completion, then prefer exact-code assignments.
  const availableElectives = [...records].filter(([code, record]) =>
    !handled.has(code) && !used.has(code) && !ambiguousCodes.has(code) && record.completionStatus === "passed",
  );
  matchElectiveRequirements(availableElectives, ([code]) => {
    const exact = elective.get(code) ?? [];
    const counterparts = electiveLanguage.get(code) ?? [];
    return [...new Map([...exact, ...counterparts].map((item) => [item.id, item])).values()]
      .filter((item) => !occupied.has(item.id))
      .sort((a, b) => a.semester - b.semester || (itemOrder.get(a.id) ?? 0) - (itemOrder.get(b.id) ?? 0))
      .map((item) => ({ item, exact: exact.some((candidate) => candidate.id === item.id) }));
  }).forEach(({ row: [, record], item, exact }) => assign(item, [record], exact ? "elective" : "language-equivalence"));
  // Preserve the prior failed-elective display behavior without treating it as completion.
  records.forEach((record, code) => {
    if (handled.has(code) || ambiguousCodes.has(code) || record.completionStatus !== "failed") return;
    const exactCandidates = (elective.get(code) ?? []).filter((item) => !occupied.has(item.id));
    const languageCandidates = (electiveLanguage.get(code) ?? []).filter((item) => !occupied.has(item.id));
    const candidates = exactCandidates.length ? exactCandidates : languageCandidates;
    const requirement = earliestRequirement(candidates);
    if (requirement) assign(requirement, [record], exactCandidates.length ? "elective" : "language-equivalence");
  });
  const unmatched: CourseMatchIssue[] = [];
  records.forEach((record, code) => {
    if (handled.has(code) || ambiguousCodes.has(code)) return;
    unmatched.push({ record, reason: record.completionStatus === "failed" ? "A failed course cannot satisfy a curriculum requirement." : "No eligible direct, equivalent, or elective requirement uses this course code." });
  });
  return {
    progress: { version: 3, planId: current.planId, courses, importedCourses: [...parsed.calculatedCourses, ...parsed.nonCalculatedCourses], requirementSatisfactions: satisfactions },
    matched: [...matchedByCode.values()], unmatched, ambiguous,
  };
}

/** Re-run stored transcript rows when curriculum/equivalence data changes. */
export function reconcileImportedProgress(curriculum: ItuCurriculum, current: CurriculumProgress): CurriculumProgress {
  const imported = current.importedCourses ?? [];
  if (!imported.length) return current;
  return applyTranscriptImport(curriculum, current, {
    calculatedCourses: imported.filter((course) => course.calculated),
    nonCalculatedCourses: imported.filter((course) => !course.calculated),
    invalidRows: [],
    duplicateRows: [],
  }).progress;
}

/** Allocate unassigned manual completions once within this curriculum. */
function allocateManualProgress(curriculum: ItuCurriculum, progress: CurriculumProgress): CurriculumProgress {
  const courses = { ...progress.courses };
  const items = [...allItems(curriculum)].sort((a, b) => a.semester - b.semester);
  const occupied = new Set(Object.values(progress.requirementSatisfactions ?? {}).map((value) => value.requirementId));
  const used = new Set(Object.values(progress.requirementSatisfactions ?? {}).flatMap((value) => value.satisfiedByCourseCodes.map(normalizeCourseCode)));
  Object.entries(courses).forEach(([code, course]) => {
    if (!course.matchedRequirementId) return;
    used.add(normalizeCourseCode(code));
    if (course.state === "passed") occupied.add(course.matchedRequirementId);
  });
  const manual = Object.entries(courses).filter(([code, course]) =>
    course.source !== "transcript" && course.state === "passed" && !used.has(normalizeCourseCode(code)),
  ).sort(([a], [b]) => a.localeCompare(b));

  function assign(item: ItuCurriculumItem, code: string, course: CourseProgress) {
    courses[code] = { ...course, courseCode: course.courseCode ?? code, matchedRequirementId: item.id };
    occupied.add(item.id);
    used.add(normalizeCourseCode(code));
  }
  // Compulsory/direct requirements keep priority over elective choices.
  [true, false].forEach((exact) => manual.forEach(([code, course]) => {
    if (used.has(normalizeCourseCode(code))) return;
    const item = items.find((item) => item.kind === "course" && !occupied.has(item.id) && (
      exact ? normalizeCourseCode(item.code) === normalizeCourseCode(code) : courseLanguageVariants(item.code).includes(normalizeCourseCode(code))
    ));
    if (item) assign(item, code, course);
  }));
  const availableElectives = manual.filter(([code]) => !used.has(normalizeCourseCode(code)));
  matchElectiveRequirements(availableElectives, ([code]) => items.flatMap((item) => {
    if (item.kind !== "elective-slot" || occupied.has(item.id)) return [];
    if (!item.courses.some((choice) => courseLanguageVariants(choice.code).includes(normalizeCourseCode(code)))) return [];
    return [{ item, exact: item.courses.some((choice) => normalizeCourseCode(choice.code) === normalizeCourseCode(code)) }];
  })).forEach(({ row: [code, course], item }) => assign(item, code, course));
  return { ...progress, courses };
}

export function progressForRequirement(item: ItuCurriculumItem, progress: CurriculumProgress, curriculum?: ItuCurriculum): RequirementProgress | null {
  if (curriculum) progress = allocateManualProgress(curriculum, progress);
  const satisfaction = progress.requirementSatisfactions?.[item.id];
  if (satisfaction) {
    const resolvedCourses = satisfaction.satisfiedByCourseCodes.map((code) => progress.courses[normalizeCourseCode(code)]).filter((course): course is CourseProgress => Boolean(course));
    const first = resolvedCourses[0];
    if (first) {
      const choice = item.kind === "elective-slot" ? item.courses.find((course) => normalizeCourseCode(course.code) === normalizeCourseCode(first.courseCode ?? "")) : undefined;
      return {
        course: first, courses: resolvedCourses, code: first.courseCode ?? choice?.code ?? requirementCode(item),
        name: first.courseName ?? choice?.title ?? item.title,
        language: first.courseLanguage ?? choice?.language ?? (item.kind === "course" ? item.language : undefined),
        requirementCode: requirementCode(item), requirementName: item.title, satisfaction,
      };
    }
  }
  if (item.kind === "course") {
    const targetCode = normalizeCourseCode(item.code);
    const eligibleCodes = courseLanguageVariants(targetCode).filter((code) => {
      const course = progress.courses[code];
      return course && (!course.matchedRequirementId || course.matchedRequirementId === item.id);
    });
    const actualCode = eligibleCodes.find((code) => progress.courses[code].state === "passed") ?? eligibleCodes[0];
    const course = actualCode ? progress.courses[actualCode] : undefined;
    if (!course || !actualCode) return null;
    const languageEquivalent = actualCode !== targetCode;
    return {
      course, courses: [course], code: course.courseCode ?? actualCode, name: course.courseName ?? item.title,
      language: course.courseLanguage ?? item.language, requirementCode: item.code, requirementName: item.title,
      satisfaction: {
        requirementId: item.id, requirementCourseCode: item.code,
        satisfiedByCourseCodes: [normalizeCourseCode(course.courseCode ?? actualCode)],
        satisfactionType: languageEquivalent ? "language-equivalence" : course.source === "transcript" ? "direct" : "manual",
      },
    };
  }
  const assignedCourses = Object.values(progress.courses).filter((course) => course.matchedRequirementId === item.id);
  const assigned = assignedCourses.find((course) => course.state === "passed") ?? assignedCourses[0];
  if (assigned) {
    const choice = item.courses.find((course) => normalizeCourseCode(course.code) === normalizeCourseCode(assigned.courseCode ?? ""));
    return {
      course: assigned, courses: [assigned], code: assigned.courseCode ?? choice?.code ?? item.title,
      name: assigned.courseName ?? choice?.title ?? item.title, language: assigned.courseLanguage ?? choice?.language,
      requirementCode: item.title, requirementName: item.title,
      satisfaction: { requirementId: item.id, requirementCourseCode: item.title, satisfiedByCourseCodes: [normalizeCourseCode(assigned.courseCode ?? choice?.code ?? "")], satisfactionType: "elective" },
    };
  }
  if (curriculum) return null;
  const manuallyCompleted = [...new Map(item.courses.flatMap((choice) => {
    const expected = normalizeCourseCode(choice.code);
    const actualCode = courseLanguageVariants(expected).find((code) => progress.courses[code]?.state === "passed");
    const course = actualCode ? progress.courses[actualCode] : undefined;
    return course && actualCode && course.source !== "transcript" && !course.matchedRequirementId ? [[actualCode, { choice, course, actualCode, languageEquivalent: actualCode !== expected }] as const] : [];
  })).values()];
  if (manuallyCompleted.length !== 1) return null;
  const { choice, course, actualCode, languageEquivalent } = manuallyCompleted[0];
  return {
    course, courses: [course], code: course.courseCode ?? actualCode, name: course.courseName ?? choice.title, language: course.courseLanguage ?? choice.language, requirementCode: item.title, requirementName: item.title,
    satisfaction: { requirementId: item.id, requirementCourseCode: item.title, satisfiedByCourseCodes: [actualCode], satisfactionType: languageEquivalent ? "language-equivalence" : "manual" },
  };
}

export function resolvedCourseProgress(curriculum: ItuCurriculum, progress: CurriculumProgress): Record<string, CourseProgress> {
  const resolved = { ...progress.courses };
  Object.entries(progress.courses).forEach(([code, course]) => {
    if (course.state !== "passed") return;
    courseLanguageVariants(code).slice(1).forEach((variant) => {
      if (!resolved[variant]) resolved[variant] = course;
    });
  });
  allItems(curriculum).forEach((item) => {
    if (item.kind !== "course") return;
    const completion = progressForRequirement(item, progress, curriculum);
    if (completion?.course.state === "passed") resolved[normalizeCourseCode(item.code)] = completion.course;
  });
  return resolved;
}

/** Elective alternatives count their lowest official credit option. */
export function minimumCreditOption(options: readonly number[]): number | null {
  return options.length && options.every(credit => Number.isFinite(credit) && credit >= 0)
    ? Math.min(...options)
    : null;
}

export function requirementCredit(item: ItuCurriculumItem): number | null {
  const options = [...new Set(item.creditOptions)];
  return options.length === 1 || item.kind === "elective-slot" || item.requirementType === "elective"
    ? minimumCreditOption(options)
    : null;
}

export function curriculumTotals(curriculum: ItuCurriculum, progress: CurriculumProgress): {
  requiredCourses: number;
  requiredCredit: number | null;
  requiredEnglishCredit: number | null;
  earnedCourses: number;
  earnedCredit: number | null;
  earnedEnglishCredit: number | null;
} {
  const items = allItems(curriculum);
  let earnedCourses = 0;
  let earnedCredit: number | null = 0, earnedEnglishCredit: number | null = 0;
  let requiredCredit: number | null = 0, requiredEnglishCredit: number | null = 0;
  const add = (total: number | null, credit: number | null) => total === null || credit === null ? null : total + credit;
  items.forEach((item) => {
    const completed = progressForRequirement(item, progress, curriculum);
    const credit = requirementCredit(item);
    requiredCredit = add(requiredCredit, credit);
    const elective = item.kind === "elective-slot" || item.requirementType === "elective";
    const requiredLanguage = item.kind === "course" ? normalizeCourseLanguage(item.language) : undefined;
    // Electives count their minimum plan credit toward English credits,
    // including Spanish/German choices, without changing their language metadata.
    if (elective || requiredLanguage === "EN") requiredEnglishCredit = add(requiredEnglishCredit, credit);
    if (completed?.course.state !== "passed") return;
    earnedCourses += 1;
    // Elective requirements count their minimum official credit option.
    // Transcript weights remain separate for GPA.
    earnedCredit = add(earnedCredit, credit);
    if (elective || normalizeCourseLanguage(completed.course.courseLanguage ?? completed.language ?? requiredLanguage) === "EN") earnedEnglishCredit = add(earnedEnglishCredit, credit);
  });
  return {
    requiredCourses: items.length,
    requiredCredit: requiredCredit ?? curriculum.totalCredit ?? null,
    requiredEnglishCredit, earnedCourses, earnedCredit, earnedEnglishCredit,
  };
}

/**
 * Calculates a curriculum-specific GPA from the graded courses matched to its
 * requirements. A course satisfying more than one requirement is counted once.
 */
export function calculateProgramGpa(curriculum: ItuCurriculum, progress: CurriculumProgress): number | null {
  const seen = new Set<string>();
  let weightedPoints = 0;
  let credits = 0;
  let unknownCredits = false;

  allItems(curriculum).forEach((item) => {
    const matched = progressForRequirement(item, progress, curriculum);
    matched?.courses.forEach((course) => {
      if (!course.grade) return;
      const points = gradePoint(course.grade);
      if (points === null) return;
      const courseCode = normalizeCourseCode(course.courseCode ?? matched.code);
      const identity = `${courseCode}:${course.term ?? ""}:${course.crn ?? ""}`;
      if (seen.has(identity)) return;
      const courseCredits = course.transcriptCredit ?? course.countedCredit ?? requirementCredit(item);
      if (courseCredits === null) { unknownCredits = true; return; }
      if (courseCredits <= 0) return;
      seen.add(identity);
      weightedPoints += points * courseCredits;
      credits += courseCredits;
    });
  });

  return !unknownCredits && credits > 0 ? weightedPoints / credits : null;
}
