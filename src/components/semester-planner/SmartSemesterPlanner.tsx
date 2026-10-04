"use client";

import { responseJson } from "@/lib/http/responseJson";

import { recordPlanningMilestone } from "@/lib/planning/checklist";

import OptionalHelp from "@/components/OptionalHelp";
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
  loadSharedTranscript,
  persistSharedTranscript,
  sharedCourseProgress,
  SHARED_TRANSCRIPT_STORAGE_KEY,
  transcriptParseResult,
} from "@/lib/curriculum/transcriptStore";
import { useItuCourseCatalog } from "@/hooks/useItuCourseCatalog";
import {
  formatNumber,
  localizedAcademicName,
  localizeRuntimeMessage,
} from "@/lib/i18n";
import { useLanguage } from "@/lib/i18n/client";
import type { ItuCurriculum } from "@/lib/itu/curriculum/types";
import {
  courseLanguageVariants,
  normalizeCourseCode,
} from "@/lib/itu/courseCode.mjs";
import { orderedEnrollments } from "@/lib/profile/validation";
import {
  GENERATOR_SESSION_STORAGE_KEY,
  parseGeneratorSession,
  persistGeneratorSession,
} from "@/lib/schedule/session";
import {
  MAX_PLANNER_COURSES,
  MAX_PLANNER_CREDITS,
  buildSemesterPlan,
  semesterPlannerCandidateCodes,
} from "@/lib/semester-planner/planner";
import type {
  PlannerNotice,
  ProgramPriority,
  SemesterCourseCandidate,
  SemesterPlan,
  SemesterPlannerProgram,
} from "@/lib/semester-planner/types";

function branchForCode(code: string) {
  return code.split(" ")[0];
}

function missingCourseCodes(
  candidate: SemesterCourseCandidate,
  creditLabel: string,
) {
  const codes: string[] = [];
  const visit = (
    value: SemesterCourseCandidate["missingPrerequisites"][number],
  ) => {
    if (value.kind === "course")
      codes.push(
        value.minimumGrade
          ? `${value.courseCode} (${value.minimumGrade})`
          : value.courseCode,
      );
    if (value.kind === "all" || value.kind === "one-of")
      value.requirements.forEach(visit);
    if (value.kind === "credits")
      codes.push(`${value.minimumCredits} ${creditLabel}`);
    if (value.kind === "unknown") codes.push(value.raw);
  };
  candidate.missingPrerequisites.forEach(visit);
  return [...new Set(codes)];
}

export default function SmartSemesterPlanner() {
  const router = useRouter();
  const { profile } = useProfile();
  const { language, t } = useLanguage();
  const enrollments = useMemo(
    () => orderedEnrollments(profile.programEnrollments),
    [profile.programEnrollments],
  );
  const [programs, setPrograms] = useState<SemesterPlannerProgram[]>([]);
  const [loading, setLoading] = useState(enrollments.length > 0);
  const [error, setError] = useState("");
  const [targetSemester, setTargetSemester] = useState("published");
  const [desiredCreditsInput, setDesiredCreditsInput] = useState("18");
  const [maxCoursesInput, setMaxCoursesInput] = useState("6");
  const [priority, setPriority] = useState<ProgramPriority>("balanced");
  const [request, setRequest] = useState<{
    desiredCredits: number;
    maxCourses: number;
    priority: ProgramPriority;
  } | null>(null);
  const [validationError, setValidationError] = useState("");
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
    const loadedTranscript = loadSharedTranscript(
      localStorage.getItem(SHARED_TRANSCRIPT_STORAGE_KEY),
      localStorage.getItem(CURRICULUM_PROGRESS_STORAGE_KEY),
    );
    const transcript = loadedTranscript.courses;
    if (loadedTranscript.migrated) persistSharedTranscript(transcript);
    void Promise.all(
      enrollments.map(async (enrollment) => {
        const parameters = new URLSearchParams({
          programCode: enrollment.programCode,
          planType: enrollment.planType,
        });
        if (enrollment.primaryProgramCode)
          parameters.set("primaryProgramCode", enrollment.primaryProgramCode);
        const response = await fetch(
          `/api/itu/curriculum/${enrollment.curriculumPlanId}?${parameters.toString()}`,
          { signal: controller.signal },
        );
        const { curriculum: raw } = await responseJson<{
          curriculum: ItuCurriculum;
        }>(response);
        const curriculum = groupCurriculum(raw);
        const stored = parseCurriculumProgress(
          localStorage.getItem(CURRICULUM_PROGRESS_STORAGE_KEY),
          curriculum.planId,
        );
        const evaluated = transcript.length
          ? applyTranscriptImport(
              curriculum,
              stored,
              transcriptParseResult(transcript),
            ).progress
          : stored;
        return {
          enrollment,
          curriculum,
          progress: { ...evaluated, importedCourses: [] },
          prerequisiteProgress: sharedCourseProgress(transcript),
        };
      }),
    )
      .then((loaded) => {
        setPrograms(loaded);
        setLoading(false);
        setError("");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Academic programs could not be loaded.",
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [enrollments]);

  const courseOfferings = useMemo(
    () =>
      courseCatalog.flatMap((branch) =>
        branch.courses.map((course) => ({
          branchCode: branch.facultyCode,
          courseId: course.id,
          courseCode: normalizeCourseCode(course.code),
          courseTitle: course.title,
          sections: course.sections,
        })),
      ),
    [courseCatalog],
  );

  const plan = useMemo<SemesterPlan | null>(() => {
    if (!request) return null;
    return buildSemesterPlan(programs, {
      desiredCredits: request.desiredCredits,
      maxCourses: request.maxCourses,
      priority: request.priority,
      availabilityMode: "published",
      knownBranchCodes: loadedBranchCodes,
      offeredCourseCodes: new Set(
        courseCatalog.flatMap((branch) =>
          branch.courses.map((course) => normalizeCourseCode(course.code)),
        ),
      ),
      courseOfferings,
    });
  }, [request, programs, loadedBranchCodes, courseCatalog, courseOfferings]);

  useEffect(() => {
    if (plan?.recommendations.length) recordPlanningMilestone("semester");
  }, [plan]);

  async function generateRecommendations() {
    setError("");
    setValidationError("");
    const desiredCredits = Number(desiredCreditsInput);
    const maxCourses = Number(maxCoursesInput);
    if (
      !desiredCreditsInput.trim() ||
      !Number.isFinite(desiredCredits) ||
      desiredCredits < 0 ||
      desiredCredits > MAX_PLANNER_CREDITS
    ) {
      setValidationError(
        t("semesterPlanner.invalidCredits", { max: MAX_PLANNER_CREDITS }),
      );
      return;
    }
    if (
      !maxCoursesInput.trim() ||
      !Number.isInteger(maxCourses) ||
      maxCourses < 0 ||
      maxCourses > MAX_PLANNER_COURSES
    ) {
      setValidationError(
        t("semesterPlanner.invalidMaximumCourses", {
          max: MAX_PLANNER_COURSES,
        }),
      );
      return;
    }
    const nextRequest = { desiredCredits, maxCourses, priority };
    setCheckingOfferings(true);
    try {
      const branches = [
        ...new Set(semesterPlannerCandidateCodes(programs).map(branchForCode)),
      ];
      await Promise.all(branches.map((branch) => loadBranch(branch)));
      setRequest(nextRequest);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Course offerings could not be loaded.",
      );
    } finally {
      setCheckingOfferings(false);
    }
  }

  function sendToGenerator() {
    if (!plan?.recommendations.length) return;
    let previous = null;
    try {
      const value = localStorage.getItem(GENERATOR_SESSION_STORAGE_KEY);
      previous = value
        ? parseGeneratorSession(JSON.parse(value) as unknown)
        : null;
    } catch {
      previous = null;
    }
    const courses = plan.recommendations.map((recommendation, index) => {
      const constraint = plan.compatibleSectionConstraints.find(
        (value) => value.courseCode === recommendation.code,
      );
      const branchCode =
        constraint?.branchCode ?? branchForCode(recommendation.code);
      const variants = new Set(courseLanguageVariants(recommendation.code));
      const course = courseCatalog
        .find((branch) => branch.facultyCode === branchCode)
        ?.courses.find((candidate) =>
          variants.has(normalizeCourseCode(candidate.code)),
        );
      return {
        id: `semester-plan-${Date.now()}-${index}`,
        branchCode,
        courseId: constraint?.courseId ?? course?.id ?? "",
        courseCode: recommendation.code,
        pinnedSectionId: constraint?.sectionId ?? "",
      };
    });
    const saved = persistGeneratorSession({
      version: 2,
      courses,
      earliestStartTime: previous?.earliestStartTime ?? "",
      latestEndTime: previous?.latestEndTime ?? "",
      excludedDays: previous?.excludedDays ?? [],
      source: "semester-planner",
      targetSemester,
      plannerAlternatives: plan.alternatives
        .slice(0, 8)
        .map((course) => course.code),
    });
    if (!saved) {
      setError(t("home.planningStorageError"));
      return;
    }
    router.push("/generator#schedule-generator");
  }

  const number = (value: number, digits = 1) =>
    formatNumber(language, value, { maximumFractionDigits: digits });

  if (loading || isLoadingBranches)
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
        {t("semesterPlanner.loading")}
      </div>
    );
  if (error)
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      >
        {localizeRuntimeMessage(language, error)}
      </div>
    );
  if (!programs.length)
    return (
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
        <h2 className="text-xl font-black">
          {t("semesterPlanner.completeProfile")}
        </h2>
        <p className="mt-2 text-sm">
          {t("semesterPlanner.completeProfileDescription")}
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white"
        >
          {t("graduationCalculator.openProfile")}
        </Link>
      </section>
    );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div
          data-testid="planner-config-fields"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {t("semesterPlanner.targetSemester")}
            <select
              value={targetSemester}
              onChange={(event) => setTargetSemester(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="published">
                {t("semesterPlanner.publishedSemester")}
              </option>
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {t("semesterPlanner.desiredCredits")}
            <input
              aria-describedby="planner-credit-hint"
              type="number"
              min={0}
              max={MAX_PLANNER_CREDITS}
              step={0.5}
              value={desiredCreditsInput}
              onChange={(event) => setDesiredCreditsInput(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
            <span
              id="planner-credit-hint"
              className="mt-1 block text-xs font-normal text-slate-500"
            >
              {t("semesterPlanner.localCreditHint")}
            </span>
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {t("semesterPlanner.maximumCourses")}
            <input
              aria-describedby="planner-max-hint"
              type="number"
              min={0}
              max={MAX_PLANNER_COURSES}
              step={1}
              value={maxCoursesInput}
              onChange={(event) => setMaxCoursesInput(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
            <span
              id="planner-max-hint"
              className="mt-1 block text-xs font-normal text-slate-500"
            >
              {t("semesterPlanner.unlimitedHint")}
            </span>
          </label>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {t("semesterPlanner.programPriority")}
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as ProgramPriority)
              }
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="balanced">{t("semesterPlanner.balanced")}</option>
              {[
                ...new Set(enrollments.map((enrollment) => enrollment.type)),
              ].map((type) => (
                <option key={type} value={type}>
                  {t(
                    type === "main"
                      ? "academicPrograms.main"
                      : type === "double-major"
                        ? "academicPrograms.doubleMajor"
                        : "academicPrograms.minor",
                  )}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => void generateRecommendations()}
            disabled={checkingOfferings}
            className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {t(
              checkingOfferings
                ? "semesterPlanner.checkingOfferings"
                : "semesterPlanner.generate",
            )}
          </button>
          {validationError ? (
            <p
              role="alert"
              className="text-sm font-semibold text-red-700 dark:text-red-300"
            >
              {localizeRuntimeMessage(language, validationError)}
            </p>
          ) : null}
        </div>
        {offeringsError ? (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            {t("semesterPlanner.offeringsWarning", {
              error: localizeRuntimeMessage(language, offeringsError) ?? "",
            })}
          </p>
        ) : null}
      </section>

      {plan ? (
        <>
          <section className="grid gap-6 rounded-xl bg-white p-5 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-4">
            <Summary
              label={t("semesterPlanner.selectedCredits")}
              value={number(plan.selectedCredits)}
              detail={t("semesterPlanner.localCreditsNotEcts", {
                ects: number(plan.selectedEcts),
              })}
            />
            <Summary
              label={t("semesterPlanner.courseCount")}
              value={String(plan.recommendations.length)}
              detail={t("semesterPlanner.targetCount", {
                credits: number(request?.desiredCredits ?? 0),
              })}
            />
            <Summary
              label={t("semesterPlanner.combinedRemaining")}
              value={number(plan.combinedRemainingCredits)}
            />
            <Summary
              label={t("semesterPlanner.scheduleStatus")}
              value={
                plan.recommendations.length > 0 &&
                plan.compatibleSectionConstraints.length ===
                  plan.recommendations.length
                  ? t("semesterPlanner.collisionFree")
                  : "—"
              }
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <h2 className="text-xl font-black text-slate-950 dark:text-white">
              {t("semesterPlanner.programContributions")}
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {plan.programSummaries.map((summary) => (
                <div
                  key={summary.enrollmentId}
                  className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950"
                >
                  <p className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    {t(
                      summary.enrollmentType === "main"
                        ? "academicPrograms.main"
                        : summary.enrollmentType === "double-major"
                          ? "academicPrograms.doubleMajor"
                          : "academicPrograms.minor",
                    )}
                  </p>
                  <p className="mt-1 font-black text-slate-950 dark:text-white">
                    {localizedAcademicName(
                      {
                        name: summary.programName,
                        nameTr: summary.programNameTr,
                        nameEn: summary.programNameEn,
                      },
                      language,
                    )}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {t("semesterPlanner.programContribution", {
                      courses: summary.selectedCourses,
                      credits: number(summary.selectedCredits),
                      remaining: number(summary.remainingCredits),
                    })}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {plan.notices.length ? (
            <section
              aria-label={t("semesterPlanner.planNotices")}
              className="space-y-2 rounded-xl bg-amber-50 p-4 dark:bg-amber-950"
            >
              {plan.notices.map((notice, index) => (
                <Notice key={`${notice.kind}-${index}`} notice={notice} />
              ))}
            </section>
          ) : null}

          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">
                  {t("semesterPlanner.recommendations")}
                </h2>
              </div>
              <button
                type="button"
                onClick={sendToGenerator}
                disabled={!plan.recommendations.length}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {t("semesterPlanner.sendToGenerator")}
              </button>
            </div>
            {plan.recommendations.length ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {plan.recommendations.map((course) => (
                  <CourseCard key={course.code} course={course} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
                {t(plan.searchLimited ? "semesterPlanner.searchLimited" : "semesterPlanner.noRecommendations")}
              </div>
            )}
          </section>

          {plan.alternatives.length ? (
            <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <summary className="cursor-pointer font-black">
                {t("semesterPlanner.alternatives", {
                  count: plan.alternatives.length,
                })}
              </summary>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {plan.alternatives.slice(0, 12).map((course) => (
                  <div
                    key={course.code}
                    className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"
                  >
                    <p className="font-black">
                      {course.code} ·{" "}
                      {localizedAcademicName(
                        {
                          name: course.title,
                          nameTr: course.titleTr,
                          nameEn: course.titleEn,
                        },
                        language,
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {course.credits} {t("common.credit")} ·{" "}
                      {course.contributions
                        .map((value) =>
                          localizedAcademicName(
                            {
                              name: value.programName,
                              nameTr: value.programNameTr,
                              nameEn: value.programNameEn,
                            },
                            language,
                          ),
                        )
                        .join(" / ")}
                    </p>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          {t("semesterPlanner.emptyState")}
        </section>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-3xl font-black text-slate-950 dark:text-white">
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function Notice({ notice }: { notice: PlannerNotice }) {
  const { t } = useLanguage();
  let parameters: Record<string, string | number> | undefined;
  if ("credits" in notice) parameters = { credits: notice.credits };
  else if ("count" in notice) parameters = { count: notice.count };
  return (
    <div className="text-sm text-amber-900 dark:text-amber-200">
      {t(
        notice.kind === "search-limited"
          ? "semesterPlanner.searchLimited"
          : `semesterPlanner.notice_${notice.kind.replaceAll("-", "_")}`,
        parameters,
      )}
    </div>
  );
}

function CourseCard({ course }: { course: SemesterCourseCandidate }) {
  const { language, t } = useLanguage();
  const contributions = course.contributions.map(
    (value) =>
      `${localizedAcademicName({ name: value.programName, nameTr: value.programNameTr, nameEn: value.programNameEn }, language)}: ${localizedAcademicName({ name: value.requirementName, nameTr: value.requirementNameTr, nameEn: value.requirementNameEn }, language)}`,
  );
  const missing = missingCourseCodes(course, t("common.credit"));
  const explanation =
    course.contributions.length > 1 &&
    course.contributions.every((value) => value.directRequirement)
      ? t("semesterPlanner.reasonShared", {
          count: course.contributions.length,
        })
      : course.immediateUnlocks.length
        ? t("semesterPlanner.reasonUnlocks", {
            count: course.immediateUnlocks.length,
          })
        : course.contributions.some(
              (value) => value.requirementKind === "compulsory",
            )
          ? t("semesterPlanner.reasonCompulsory")
          : t("semesterPlanner.reasonElective");
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-blue-700 dark:text-blue-300">
            {course.code}
          </p>
          <h3 className="mt-1 text-lg font-black text-slate-950 dark:text-white">
            {localizedAcademicName(
              {
                name: course.title,
                nameTr: course.titleTr,
                nameEn: course.titleEn,
              },
              language,
            )}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-lg font-black">
            {formatNumber(language, course.credits)}
          </p>
          <p className="text-xs text-slate-500">
            {t("common.credit")} · {formatNumber(language, course.ects)}{" "}
            {t("curriculum.ects")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {course.contributions.map((value) => (
          <span
            key={`${value.enrollmentId}-${value.requirementId}`}
            className="text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            {t(
              value.enrollmentType === "main"
                ? "academicPrograms.main"
                : value.enrollmentType === "double-major"
                  ? "academicPrograms.doubleMajor"
                  : "academicPrograms.minor",
            )}
          </span>
        ))}
      </div>
      {course.eligibility !== "confirmed" ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          {t(`semesterPlanner.eligibility_${course.eligibility}`)}
        </p>
      ) : null}
      {course.availability !== "available" ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          {t(`semesterPlanner.availability_${course.availability}`)}
        </p>
      ) : null}
      {missing.length ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          {t(
            course.eligibility === "conditional"
              ? "semesterPlanner.conditionalOn"
              : "semesterPlanner.rulesNeedReview",
            { courses: missing.join(", ") },
          )}
        </p>
      ) : null}
      <OptionalHelp summary={t("semesterPlanner.whyCourse")}>
        <p>{explanation}</p>
        <ul className="list-disc space-y-1 pl-5">
          {contributions.map((value, index) => (
            <li key={`${value}-${index}`}>{value}</li>
          ))}
          {course.immediateUnlocks.length ? (
            <li>
              {t("semesterPlanner.immediateUnlocks", {
                courses: course.immediateUnlocks.join(", "),
              })}
            </li>
          ) : null}
          {course.downstreamUnlocks.length ? (
            <li>
              {t("semesterPlanner.downstreamUnlocks", {
                courses: course.downstreamUnlocks.join(", "),
              })}
            </li>
          ) : null}
        </ul>
      </OptionalHelp>
    </article>
  );
}
