import { GRADE_POINTS, gradePoint } from "@/lib/curriculum/grades";
import type { EquivalenceRule } from "@/lib/curriculum/equivalence";
import type { CourseProgress, CurriculumProgress, RequirementSatisfaction, TranscriptCourseRecord } from "@/lib/curriculum/types";
import type { TranscriptParseResult } from "@/lib/curriculum/transcript";
import type { ItuCurriculum, ItuCurriculumItem } from "@/lib/itu/curriculum/types";
import { courseLanguageFromCode, courseLanguageVariants, normalizeCourseCode } from "@/lib/itu/courseCode.mjs";

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

  // 4. Existing elective matching runs after exact/language/official equivalence.
  records.forEach((record, code) => {
    if (handled.has(code) || used.has(code) || ambiguousCodes.has(code) || record.completionStatus !== "passed") return;
    const candidates = (elective.get(code) ?? []).filter((item) => !occupied.has(item.id));
    const requirement = earliestRequirement(candidates);
    if (requirement) assign(requirement, [record], "elective");
  });
  records.forEach((record, code) => {
    if (handled.has(code) || used.has(code) || ambiguousCodes.has(code) || record.completionStatus !== "passed") return;
    const candidates = (electiveLanguage.get(code) ?? []).filter((item) => !occupied.has(item.id));
    const requirement = earliestRequirement(candidates);
    if (requirement) assign(requirement, [record], "language-equivalence");
  });
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

export function progressForRequirement(item: ItuCurriculumItem, progress: CurriculumProgress): RequirementProgress | null {
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
    const actualCode = courseLanguageVariants(targetCode).find((code) => progress.courses[code]);
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
  const assigned = Object.values(progress.courses).find((course) => course.matchedRequirementId === item.id);
  if (assigned) {
    const choice = item.courses.find((course) => normalizeCourseCode(course.code) === normalizeCourseCode(assigned.courseCode ?? ""));
    return {
      course: assigned, courses: [assigned], code: assigned.courseCode ?? choice?.code ?? item.title,
      name: assigned.courseName ?? choice?.title ?? item.title, language: assigned.courseLanguage ?? choice?.language,
      requirementCode: item.title, requirementName: item.title,
      satisfaction: { requirementId: item.id, requirementCourseCode: item.title, satisfiedByCourseCodes: [normalizeCourseCode(assigned.courseCode ?? choice?.code ?? "")], satisfactionType: "elective" },
    };
  }
  const manuallyCompleted = [...new Map(item.courses.flatMap((choice) => {
    const expected = normalizeCourseCode(choice.code);
    const actualCode = courseLanguageVariants(expected).find((code) => progress.courses[code]?.state === "passed");
    const course = actualCode ? progress.courses[actualCode] : undefined;
    return course && actualCode ? [[actualCode, { choice, course, actualCode, languageEquivalent: actualCode !== expected }] as const] : [];
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
    const completion = progressForRequirement(item, progress);
    if (completion?.course.state === "passed") resolved[normalizeCourseCode(item.code)] = completion.course;
  });
  return resolved;
}

export function curriculumTotals(curriculum: ItuCurriculum, progress: CurriculumProgress) {
  const items = allItems(curriculum);
  let earnedCourses = 0, earnedCredit = 0, earnedEnglishCredit = 0, requiredEnglishCredit = 0;
  items.forEach((item) => {
    const requiredCredit = item.creditOptions[0] ?? 0;
    const requiredLanguage = item.kind === "course" ? item.language : item.courses.length && item.courses.every((course) => course.language === "EN") ? "EN" : undefined;
    if (requiredLanguage === "EN") requiredEnglishCredit += requiredCredit;
    const completed = progressForRequirement(item, progress);
    if (completed?.course.state !== "passed") return;
    earnedCourses += 1;
    // Degree audits count the target requirement's credit. Transcript credit is
    // retained separately for GPA and transcript reporting.
    const credit = requiredCredit;
    earnedCredit += credit;
    if ((requiredLanguage ?? completed.course.courseLanguage ?? completed.language) === "EN") earnedEnglishCredit += credit;
  });
  return {
    requiredCourses: items.length,
    requiredCredit: curriculum.totalCredit ?? items.reduce((sum, item) => sum + (item.creditOptions[0] ?? 0), 0),
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

  allItems(curriculum).forEach((item) => {
    const matched = progressForRequirement(item, progress);
    matched?.courses.forEach((course) => {
      if (!course.grade) return;
      const points = gradePoint(course.grade);
      if (points === null) return;
      const courseCode = normalizeCourseCode(course.courseCode ?? matched.code);
      const identity = `${courseCode}:${course.term ?? ""}:${course.crn ?? ""}`;
      if (seen.has(identity)) return;
      const courseCredits = course.transcriptCredit ?? course.countedCredit ?? item.creditOptions[0] ?? 0;
      if (courseCredits <= 0) return;
      seen.add(identity);
      weightedPoints += points * courseCredits;
      credits += courseCredits;
    });
  });

  return credits > 0 ? weightedPoints / credits : null;
}
