"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useProfile } from "@/components/profile/ProfileProvider";
import { applyTranscriptImport } from "@/lib/curriculum/graduation";
import { groupCurriculum } from "@/lib/curriculum/grouping";
import {
  CURRICULUM_PROGRESS_STORAGE_KEY,
  parseCurriculumProgress,
} from "@/lib/curriculum/progress";
import {
  parseSharedTranscript,
  SHARED_TRANSCRIPT_STORAGE_KEY,
  transcriptParseResult,
} from "@/lib/curriculum/transcriptStore";
import { useItuCourseCatalog } from "@/hooks/useItuCourseCatalog";
import { formatNumber, localizedAcademicName, localizeRuntimeMessage } from "@/lib/i18n";
import { useLanguage } from "@/lib/i18n/client";
import type { ItuCurriculum } from "@/lib/itu/curriculum/types";
import { courseLanguageVariants, normalizeCourseCode } from "@/lib/itu/courseCode.mjs";
import { orderedEnrollments } from "@/lib/profile/validation";
import { GENERATOR_SESSION_STORAGE_KEY, parseGeneratorSession } from "@/lib/schedule/session";
import {
  buildSemesterPlan,
  estimateSemestersUntil,
} from "@/lib/semester-planner/planner";
import type {
  PlannerNotice,
  ProgramPriority,
  SemesterCourseCandidate,
  SemesterPlan,
  SemesterPlannerProgram,
} from "@/lib/semester-planner/types";

async function responseJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(value.error?.message ?? "The request failed.");
  return value;
}

function parseCodeList(value: string) {
  return [...new Set(value.split(/[,;\n]+/u).map(normalizeCourseCode).filter(Boolean))];
}

function branchForCode(code: string) {
  return code.split(" ")[0];
}

function missingCourseCodes(candidate: SemesterCourseCandidate, creditLabel: string) {
  const codes: string[] = [];
  const visit = (value: SemesterCourseCandidate["missingPrerequisites"][number]) => {
    if (value.kind === "course") codes.push(value.minimumGrade ? `${value.courseCode} (${value.minimumGrade})` : value.courseCode);
    if (value.kind === "all" || value.kind === "one-of") value.requirements.forEach(visit);
    if (value.kind === "credits") codes.push(`${value.minimumCredits} ${creditLabel}`);
    if (value.kind === "unknown") codes.push(value.raw);
  };
  candidate.missingPrerequisites.forEach(visit);
  return [...new Set(codes)];
}

export default function SmartSemesterPlanner() {
  const router = useRouter();
  const { profile } = useProfile();
  const { language, t } = useLanguage();
  const enrollments = useMemo(() => orderedEnrollments(profile.programEnrollments), [profile.programEnrollments]);
  const [programs, setPrograms] = useState<SemesterPlannerProgram[]>([]);
  const [loading, setLoading] = useState(enrollments.length > 0);
  const [error, setError] = useState("");
  const [targetSemester, setTargetSemester] = useState("published");
  const [desiredCredits, setDesiredCredits] = useState(18);
  const [maxCourses, setMaxCourses] = useState(6);
  const [priority, setPriority] = useState<ProgramPriority>("balanced");
  const [includeInput, setIncludeInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");
  const [inProgressInput, setInProgressInput] = useState("");
  const [graduationDate, setGraduationDate] = useState("");
  const [lockedCodes, setLockedCodes] = useState<Set<string>>(new Set());
  const [removedCodes, setRemovedCodes] = useState<Set<string>>(new Set());
  const [hasGenerated, setHasGenerated] = useState(false);
  const [checkingOfferings, setCheckingOfferings] = useState(false);
  const {
    courseCatalog,
    loadedBranchCodes,
    isLoadingBranches,
    loadBranch,
    error: offeringsError,
  } = useItuCourseCatalog();

  useEffect(() => {
    if (!enrollments.length) return;
    const controller = new AbortController();
    const transcript = parseSharedTranscript(localStorage.getItem(SHARED_TRANSCRIPT_STORAGE_KEY));
    void Promise.all(enrollments.map(async (enrollment) => {
      const parameters = new URLSearchParams({
        programCode: enrollment.programCode,
        planType: enrollment.planType,
      });
      if (enrollment.primaryProgramCode) parameters.set("primaryProgramCode", enrollment.primaryProgramCode);
      const response = await fetch(`/api/itu/curriculum/${enrollment.curriculumPlanId}?${parameters.toString()}`, { signal: controller.signal });
      const { curriculum: raw } = await responseJson<{ curriculum: ItuCurriculum }>(response);
      const curriculum = groupCurriculum(raw);
      const stored = parseCurriculumProgress(localStorage.getItem(CURRICULUM_PROGRESS_STORAGE_KEY), curriculum.planId);
      const evaluated = transcript.length ? applyTranscriptImport(curriculum, stored, transcriptParseResult(transcript)).progress : stored;
      return { enrollment, curriculum, progress: { ...evaluated, importedCourses: [] } };
    })).then((loaded) => {
      setPrograms(loaded);
      setLoading(false);
      setError("");
    }).catch((reason: unknown) => {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : "Academic programs could not be loaded.");
      setLoading(false);
    });
    return () => controller.abort();
  }, [enrollments]);

  function plannerOptions(knownBranches = loadedBranchCodes) {
    return {
      desiredCredits,
      maxCourses: maxCourses || undefined,
      priority,
      includedCourseCodes: parseCodeList(includeInput),
      excludedCourseCodes: [...parseCodeList(excludeInput), ...removedCodes],
      lockedCourseCodes: [...lockedCodes],
      inProgressCourseCodes: parseCodeList(inProgressInput),
      availabilityMode: targetSemester === "published" ? "published" as const : "unknown" as const,
      knownBranchCodes: knownBranches,
      offeredCourseCodes: new Set(courseCatalog.flatMap((branch) => branch.courses.map((course) => normalizeCourseCode(course.code)))),
    };
  }

  const plan: SemesterPlan | null = hasGenerated
    ? buildSemesterPlan(programs, plannerOptions())
    : null;

  async function generateRecommendations() {
    setError("");
    if (targetSemester !== "published") {
      setHasGenerated(true);
      return;
    }
    setCheckingOfferings(true);
    const preliminary = buildSemesterPlan(programs, { ...plannerOptions(new Set()), availabilityMode: "unknown" });
    const branches = [...new Set([...preliminary.recommendations, ...preliminary.alternatives].map((course) => branchForCode(course.code)))];
    await Promise.all(branches.map((branch) => loadBranch(branch)));
    // Catalog updates are committed by the hook; a following render refreshes
    // this result with the newly known branch set.
    setCheckingOfferings(false);
    setHasGenerated(true);
  }

  function removeAndReplace(code: string) {
    setRemovedCodes((current) => new Set(current).add(code));
    setLockedCodes((current) => {
      const next = new Set(current);
      next.delete(code);
      return next;
    });
  }

  function toggleLock(code: string) {
    setLockedCodes((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function restoreRemoved(code: string) {
    const next = new Set(removedCodes);
    next.delete(code);
    setRemovedCodes(next);
  }

  function sendToGenerator() {
    if (!plan?.recommendations.length) return;
    let previous = null;
    try {
      const value = localStorage.getItem(GENERATOR_SESSION_STORAGE_KEY);
      previous = value ? parseGeneratorSession(JSON.parse(value) as unknown) : null;
    } catch {
      previous = null;
    }
    const courses = plan.recommendations.map((recommendation, index) => {
      const branchCode = branchForCode(recommendation.code);
      const variants = new Set(courseLanguageVariants(recommendation.code));
      const course = courseCatalog.find((branch) => branch.facultyCode === branchCode)?.courses.find((candidate) => variants.has(candidate.code));
      return {
        id: `semester-plan-${Date.now()}-${index}`,
        branchCode,
        courseId: course?.id ?? "",
        courseCode: recommendation.code,
        pinnedSectionId: "",
      };
    });
    localStorage.setItem(GENERATOR_SESSION_STORAGE_KEY, JSON.stringify({
      version: 2,
      courses,
      earliestStartTime: previous?.earliestStartTime ?? "",
      latestEndTime: previous?.latestEndTime ?? "",
      excludedDays: previous?.excludedDays ?? [],
      source: "semester-planner",
      targetSemester,
      plannerLockedCourseCodes: [...lockedCodes],
      plannerAlternatives: plan.alternatives.slice(0, 8).map((course) => course.code),
    }));
    router.push("/generator#schedule-generator");
  }

  const semestersUntilGraduation = estimateSemestersUntil(graduationDate);
  const paceCredits = plan && semestersUntilGraduation ? plan.combinedRemainingCredits / semestersUntilGraduation : null;
  const number = (value: number, digits = 1) => formatNumber(language, value, { maximumFractionDigits: digits });

  if (loading || isLoadingBranches) return <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">{t("semesterPlanner.loading")}</div>;
  if (error) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{localizeRuntimeMessage(language, error)}</div>;
  if (!programs.length) return <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950"><h2 className="text-xl font-black">{t("semesterPlanner.completeProfile")}</h2><p className="mt-2 text-sm">{t("semesterPlanner.completeProfileDescription")}</p><Link href="/profile" className="mt-4 inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white">{t("graduationCalculator.openProfile")}</Link></section>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("semesterPlanner.targetSemester")}<select value={targetSemester} onChange={(event) => setTargetSemester(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950"><option value="published">{t("semesterPlanner.publishedSemester")}</option><option value="next-fall">{t("semesterPlanner.nextFall")}</option><option value="next-spring">{t("semesterPlanner.nextSpring")}</option></select></label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("semesterPlanner.desiredCredits")}<input type="number" min={1} step={0.5} value={desiredCredits} onChange={(event) => setDesiredCredits(Math.max(1, Number(event.target.value) || 1))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950" /><span className="mt-1 block text-xs font-normal text-slate-500">{t("semesterPlanner.localCreditHint")}</span></label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("semesterPlanner.maximumCourses")}<input type="number" min={0} max={20} value={maxCourses} onChange={(event) => setMaxCourses(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950" /></label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("semesterPlanner.programPriority")}<select value={priority} onChange={(event) => setPriority(event.target.value as ProgramPriority)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950"><option value="balanced">{t("semesterPlanner.balanced")}</option>{enrollments.map((enrollment) => <option key={enrollment.id} value={enrollment.type}>{t(enrollment.type === "main" ? "academicPrograms.main" : enrollment.type === "double-major" ? "academicPrograms.doubleMajor" : "academicPrograms.minor")}</option>)}</select></label>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("semesterPlanner.includeCourses")}<input value={includeInput} onChange={(event) => setIncludeInput(event.target.value)} placeholder="BLG 335E, MAT 271E" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950" /></label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("semesterPlanner.excludeCourses")}<input value={excludeInput} onChange={(event) => setExcludeInput(event.target.value)} placeholder="FIZ 101E" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950" /></label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">{t("semesterPlanner.inProgressCourses")}<input value={inProgressInput} onChange={(event) => setInProgressInput(event.target.value)} placeholder="BLG 223E" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950" /><span className="mt-1 block text-xs font-normal text-slate-500">{t("semesterPlanner.inProgressHint")}</span></label>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="min-w-56 text-sm font-bold text-slate-700 dark:text-slate-200">{t("semesterPlanner.targetGraduationDate")}<input type="month" value={graduationDate} onChange={(event) => setGraduationDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950" /></label>
          <button type="button" onClick={() => void generateRecommendations()} disabled={checkingOfferings} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50">{t(checkingOfferings ? "semesterPlanner.checkingOfferings" : "semesterPlanner.generate")}</button>
          {plan ? <button type="button" onClick={() => setDesiredCredits(plan.suggestedCredits)} className="rounded-xl border border-blue-300 px-4 py-2.5 text-sm font-black text-blue-700 dark:text-blue-300">{t("semesterPlanner.useSuggested", { credits: plan.suggestedCredits })}</button> : null}
        </div>
        {offeringsError ? <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{t("semesterPlanner.offeringsWarning", { error: offeringsError })}</p> : null}
      </section>

      {plan ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Summary label={t("semesterPlanner.selectedCredits")} value={number(plan.selectedCredits)} detail={t("semesterPlanner.localCreditsNotEcts", { ects: number(plan.selectedEcts) })} />
            <Summary label={t("semesterPlanner.courseCount")} value={String(plan.recommendations.length)} detail={t("semesterPlanner.targetCount", { credits: number(desiredCredits) })} />
            <Summary label={t("semesterPlanner.combinedRemaining")} value={number(plan.combinedRemainingCredits)} detail={t("semesterPlanner.sharedOnce")} />
            <Summary label={t("semesterPlanner.provisionalPace")} value={paceCredits === null ? "—" : number(paceCredits)} detail={paceCredits === null ? t("semesterPlanner.chooseGraduationDate") : t("semesterPlanner.perRemainingSemester", { count: semestersUntilGraduation ?? 0 })} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <h2 className="text-xl font-black text-slate-950 dark:text-white">{t("semesterPlanner.programContributions")}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">{plan.programSummaries.map((summary) => <div key={summary.enrollmentId} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">{t(summary.enrollmentType === "main" ? "academicPrograms.main" : summary.enrollmentType === "double-major" ? "academicPrograms.doubleMajor" : "academicPrograms.minor")}</p><p className="mt-1 font-black text-slate-950 dark:text-white">{localizedAcademicName({ name: summary.programName, nameTr: summary.programNameTr, nameEn: summary.programNameEn }, language)}</p><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t("semesterPlanner.programContribution", { courses: summary.selectedCourses, credits: number(summary.selectedCredits), remaining: number(summary.remainingCredits) })}</p></div>)}</div>
          </section>

          {plan.notices.length ? <section className="space-y-2">{plan.notices.map((notice, index) => <Notice key={`${notice.kind}-${index}`} notice={notice} />)}</section> : null}

          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black text-slate-950 dark:text-white">{t("semesterPlanner.recommendations")}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("semesterPlanner.recommendationsDescription")}</p></div><button type="button" onClick={sendToGenerator} disabled={!plan.recommendations.length} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">{t("semesterPlanner.sendToGenerator")}</button></div>
            {plan.recommendations.length ? <div className="grid gap-4 xl:grid-cols-2">{plan.recommendations.map((course) => <CourseCard key={course.code} course={course} locked={lockedCodes.has(course.code)} onLock={() => toggleLock(course.code)} onReplace={() => removeAndReplace(course.code)} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">{t("semesterPlanner.noRecommendations")}</div>}
          </section>

          {removedCodes.size ? <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-sm font-black">{t("semesterPlanner.removedCourses")}</p><div className="mt-2 flex flex-wrap gap-2">{[...removedCodes].map((code) => <button key={code} type="button" onClick={() => restoreRemoved(code)} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-bold dark:border-slate-700">{code} · {t("semesterPlanner.restore")}</button>)}</div></section> : null}

          {plan.alternatives.length ? <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><summary className="cursor-pointer font-black">{t("semesterPlanner.alternatives", { count: plan.alternatives.length })}</summary><div className="mt-4 grid gap-3 md:grid-cols-2">{plan.alternatives.slice(0, 12).map((course) => <div key={course.code} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="font-black">{course.code} · {localizedAcademicName({ name: course.title, nameTr: course.titleTr, nameEn: course.titleEn }, language)}</p><p className="mt-1 text-xs text-slate-500">{course.credits} {t("common.credit")} · {course.contributions.map((value) => localizedAcademicName({ name: value.programName, nameTr: value.programNameTr, nameEn: value.programNameEn }, language)).join(" / ")}</p></div>)}</div></details> : null}
        </>
      ) : <section className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">{t("semesterPlanner.emptyState")}</section>}
    </div>
  );
}

function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-3xl font-black text-slate-950 dark:text-white">{value}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p></div>;
}

function Notice({ notice }: { notice: PlannerNotice }) {
  const { t } = useLanguage();
  let parameters: Record<string, string | number> | undefined;
  if ("courseCode" in notice) parameters = { code: notice.courseCode };
  else if ("credits" in notice) parameters = { credits: notice.credits };
  else if ("count" in notice) parameters = { count: notice.count };
  return <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">{t(`semesterPlanner.notice_${notice.kind.replaceAll("-", "_")}`, parameters)}</div>;
}

function CourseCard({ course, locked, onLock, onReplace }: { course: SemesterCourseCandidate; locked: boolean; onLock: () => void; onReplace: () => void }) {
  const { language, t } = useLanguage();
  const contributions = course.contributions.map((value) => `${localizedAcademicName({ name: value.programName, nameTr: value.programNameTr, nameEn: value.programNameEn }, language)}: ${localizedAcademicName({ name: value.requirementName, nameTr: value.requirementNameTr, nameEn: value.requirementNameEn }, language)}`);
  const missing = missingCourseCodes(course, t("common.credit"));
  const explanation = course.contributions.length > 1 && course.contributions.every((value) => value.directRequirement)
    ? t("semesterPlanner.reasonShared", { count: course.contributions.length })
    : course.immediateUnlocks.length
      ? t("semesterPlanner.reasonUnlocks", { count: course.immediateUnlocks.length })
      : course.contributions.some((value) => value.requirementKind === "compulsory")
        ? t("semesterPlanner.reasonCompulsory")
        : t("semesterPlanner.reasonElective");
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-700 dark:text-blue-300">{course.code}</p><h3 className="mt-1 text-lg font-black text-slate-950 dark:text-white">{localizedAcademicName({ name: course.title, nameTr: course.titleTr, nameEn: course.titleEn }, language)}</h3></div><div className="text-right"><p className="text-lg font-black">{formatNumber(language, course.credits)}</p><p className="text-xs text-slate-500">{t("common.credit")} · {formatNumber(language, course.ects)} {t("curriculum.ects")}</p></div></div>
      <div className="mt-3 flex flex-wrap gap-2"><Badge tone={course.eligibility === "confirmed" ? "green" : "amber"}>{t(`semesterPlanner.eligibility_${course.eligibility}`)}</Badge><Badge tone={course.availability === "available" ? "green" : "amber"}>{t(`semesterPlanner.availability_${course.availability}`)}</Badge>{course.contributions.map((value) => <Badge key={`${value.enrollmentId}-${value.requirementId}`} tone="blue">{t(value.enrollmentType === "main" ? "academicPrograms.main" : value.enrollmentType === "double-major" ? "academicPrograms.doubleMajor" : "academicPrograms.minor")}</Badge>)}</div>
      <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-200">{explanation}</p>
      <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">{contributions.map((value, index) => <li key={`${value}-${index}`}>• {value}</li>)}{course.immediateUnlocks.length ? <li>• {t("semesterPlanner.immediateUnlocks", { courses: course.immediateUnlocks.join(", ") })}</li> : null}{course.downstreamUnlocks.length ? <li>• {t("semesterPlanner.downstreamUnlocks", { courses: course.downstreamUnlocks.join(", ") })}</li> : null}{missing.length ? <li>• {t(course.eligibility === "conditional" ? "semesterPlanner.conditionalOn" : "semesterPlanner.rulesNeedReview", { courses: missing.join(", ") })}</li> : null}</ul>
      <div className="mt-4 flex gap-2"><button type="button" onClick={onLock} className={`rounded-xl px-3 py-2 text-sm font-black ${locked ? "bg-blue-700 text-white" : "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200"}`}>{t(locked ? "semesterPlanner.locked" : "semesterPlanner.lock")}</button><button type="button" onClick={onReplace} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">{t("semesterPlanner.replace")}</button></div>
    </article>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "green" | "amber" | "blue" }) {
  const classes = tone === "green" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : tone === "amber" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${classes}`}>{children}</span>;
}
