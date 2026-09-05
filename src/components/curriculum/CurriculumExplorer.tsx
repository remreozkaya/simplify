"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import CurriculumGraph from "@/components/curriculum/CurriculumGraph";
import ProgramTabs, { programPanelId, programTabId } from "@/components/curriculum/ProgramTabs";
import { useProfile } from "@/components/profile/ProfileProvider";
import { GRADES } from "@/lib/curriculum/grades";
import { useItuCourseCatalog } from "@/hooks/useItuCourseCatalog";
import {
  evaluateCourseEligibility,
  getCourseStatus,
  getMissingPrerequisites,
} from "@/lib/curriculum/eligibility";
import {
  availableCoursesForElectiveSlot,
  courseBranch,
  curriculumPrerequisitesKnown,
  isCurriculumItemAvailableThisSemester,
} from "@/lib/curriculum/availability";
import {
  buildCurriculumGraph,
  getAncestorNodeIds,
  getDependentNodeIds,
} from "@/lib/curriculum/graph";
import {
  CURRICULUM_PROGRESS_STORAGE_KEY,
  parseCurriculumProgress,
  persistCurriculumProgress,
} from "@/lib/curriculum/progress";
import { applyTranscriptImport, curriculumTotals, progressForRequirement, reconcileImportedProgress, resolvedCourseProgress } from "@/lib/curriculum/graduation";
import {
  parseSharedTranscript,
  persistSharedTranscript,
  SHARED_TRANSCRIPT_STORAGE_KEY,
  transcriptFromLegacyProgress,
  transcriptFromLegacyProgressStore,
  transcriptParseResult,
  sharedCourseProgress,
} from "@/lib/curriculum/transcriptStore";
import {
  parseSavedCurriculum,
  SAVED_CURRICULUM_STORAGE_KEY,
  serializeSavedCurriculum,
} from "@/lib/curriculum/selection";
import type {
  CourseDerivedStatus,
  CurriculumProgress,
  MissingRequirement,
} from "@/lib/curriculum/types";
import type {
  Grade,
  ItuCurriculum,
  ItuCurriculumPlan,
  ItuElectiveCourse,
  ItuElectiveSlot,
  ItuUndergraduateProgram,
} from "@/lib/itu/curriculum/types";
import { courseLanguageVariants, normalizeCourseCode } from "@/lib/itu/courseCode.mjs";
import { orderedEnrollments } from "@/lib/profile/validation";
import { groupCurriculum } from "@/lib/curriculum/grouping";
import { useLanguage } from "@/lib/i18n/client";
import { formatDate, formatNumber, localizedAcademicName, localizedCurriculumSection, localizeRuntimeMessage, offeringDisplayName } from "@/lib/i18n";

const STATUS_CLASS: Record<CourseDerivedStatus, string> = {
  "not-taken": "border-slate-500 bg-slate-200 text-black",
  passed: "border-emerald-600 bg-emerald-200 text-emerald-950",
  failed: "border-red-600 bg-red-200 text-red-950",
};
async function responseJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(value.error?.message ?? "The request failed.");
  return value;
}

function optionsText(values: number[], suffix: string) {
  return values.length ? `${values.join(" / ")} ${suffix}` : "—";
}

function MissingList({ requirements }: { requirements: MissingRequirement[] }) {
  const { t } = useLanguage();
  if (!requirements.length) return <p className="text-sm text-slate-500">{t("curriculum.noMissingPrerequisites")}</p>;
  return (
    <ul className="space-y-2 text-sm text-slate-700">
      {requirements.map((requirement, index) => (
        <li key={index} className="rounded-lg bg-slate-50 px-3 py-2">
          {requirement.kind === "course" && (
            <span>{t("curriculum.missingCourse", { code: requirement.courseCode, grade: requirement.minimumGrade ? t("curriculum.minimumGrade", { grade: requirement.minimumGrade }) : "" })}</span>
          )}
          {requirement.kind === "credits" && <span>{t("curriculum.minimumCredits", { credits: requirement.minimumCredits })}</span>}
          {requirement.kind === "unknown" && <span>{t("curriculum.unknownPrerequisite", { value: requirement.raw })}</span>}
          {(requirement.kind === "all" || requirement.kind === "one-of") && (
            <div>
              <p className="font-semibold">{t(requirement.kind === "all" ? "curriculum.allOf" : "curriculum.oneOf")}</p>
              <div className="mt-2 pl-2"><MissingList requirements={requirement.requirements} /></div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function CurriculumExplorer() {
  const { profile } = useProfile();
  const { language, t } = useLanguage();
  const statusLabel = (status: CourseDerivedStatus) => t(status === "not-taken" ? "curriculum.notTaken" : status === "passed" ? "curriculum.passed" : "curriculum.failed");
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedProgram = searchParams.get("program");
  const requestedPlan = Number(searchParams.get("plan"));
  const programCodeRef = useRef("");
  const enrolledPrograms = useMemo(() => orderedEnrollments(profile.programEnrollments), [profile.programEnrollments]);
  const defaultProfileProgram = enrolledPrograms[0]?.programCode ?? "";
  const [programs, setPrograms] = useState<ItuUndergraduateProgram[]>([]);
  const [plans, setPlans] = useState<ItuCurriculumPlan[]>([]);
  const [faculty, setFaculty] = useState("");
  const [major, setMajor] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(() => enrolledPrograms[0]?.id ?? "");
  const selectedEnrollment = enrolledPrograms.find((item) => item.id === selectedEnrollmentId);
  const profilePlanId = selectedEnrollment?.curriculumPlanId ?? enrolledPrograms.find((item) => item.programCode === programCode)?.curriculumPlanId ?? null;
  const [planId, setPlanId] = useState<number | null>(null);
  const [curriculum, setCurriculum] = useState<ItuCurriculum | null>(null);
  const [progress, setProgress] = useState<CurriculumProgress | null>(null);
  const [sharedCompletedCourses, setSharedCompletedCourses] = useState<ReturnType<typeof sharedCourseProgress>>({});
  const [programsLoading, setProgramsLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(false);
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const [filters, setFilters] = useState<Record<CourseDerivedStatus, boolean>>({
    "not-taken": true,
    passed: true,
    failed: true,
  });
  const [showTakeableCourses, setShowTakeableCourses] = useState(false);
  const [offeringLookupKey, setOfferingLookupKey] = useState("");
  const {
    branches: courseBranches,
    courseCatalog,
    loadedBranchCodes,
    isLoadingBranches: offeringsBranchesLoading,
    isBranchLoading,
    loadBranch,
    error: offeringsError,
  } = useItuCourseCatalog();

  useEffect(() => {
    if (enrolledPrograms.length) {
      const loaded = enrolledPrograms.map((item) => ({ id: `${item.facultyId}:${item.planType}:${item.programCode}`, baseProgramId: item.programCode.replace(/_(?:LS|YD)$/u, ""), officialProgramCode: item.programCode, code: item.programCode, name: item.programName, nameTr: item.programNameTr ?? item.programName, nameEn: item.programNameEn, major: item.programName, facultyId: item.facultyId, faculty: item.facultyName, planType: item.planType }));
      const desired = enrolledPrograms.find((item) => item.programCode === requestedProgram) ?? enrolledPrograms[0];
      const frame = requestAnimationFrame(() => {
        setPrograms(loaded);
        setProgramsLoading(false);
        setFaculty(desired.facultyName);
        setMajor(desired.programName);
        setSelectedEnrollmentId(desired.id);
        programCodeRef.current = desired.programCode;
        setProgramCode(desired.programCode);
        setPlanId(desired.curriculumPlanId);
      });
      return () => cancelAnimationFrame(frame);
    }
    const controller = new AbortController();
    void fetch("/api/itu/curriculum/programs?facultyId=10&planType=undergraduate", { signal: controller.signal })
      .then((response) => responseJson<{ programs: ItuUndergraduateProgram[] }>(response))
      .then(({ programs: loaded }) => {
        setProgramsLoading(false);
        setPrograms(loaded);
        const saved = parseSavedCurriculum(localStorage.getItem(SAVED_CURRICULUM_STORAGE_KEY));
        const programToRestore = requestedProgram ?? (defaultProfileProgram || saved?.programCode);
        const restoredProgram = loaded.find((program) => program.code === programToRestore) ?? loaded[0];
        const restored = restoredProgram?.code ?? "";
        setFaculty(restoredProgram?.faculty ?? "Other Faculty");
        setMajor(restoredProgram?.major ?? "");
        setSelectedEnrollmentId("");
        const programChanged = programCodeRef.current !== restored;
        programCodeRef.current = restored;
        setPlansLoading(Boolean(restored) && programChanged);
        setProgramCode(restored);
        setError(loaded.length ? "" : "No undergraduate programs were returned by İTÜ OBS.");
      })
      .catch((fetchError: unknown) => {
        if (!controller.signal.aborted) {
          setProgramsLoading(false);
          setError(fetchError instanceof Error ? fetchError.message : "Programs could not be loaded.");
        }
      });
    return () => controller.abort();
  }, [defaultProfileProgram, enrolledPrograms, requestedProgram]);

  useEffect(() => {
    if (!programCode) return;
    const enrollment = selectedEnrollment ?? enrolledPrograms.find((item) => item.programCode === programCode);
    const controller = new AbortController();
    void fetch(`/api/itu/curriculum/plans?programCode=${encodeURIComponent(programCode)}&planType=${enrollment?.planType ?? "undergraduate"}${enrollment?.primaryProgramCode ? `&primaryProgramCode=${encodeURIComponent(enrollment.primaryProgramCode)}` : ""}`, {
      signal: controller.signal,
    })
      .then((response) => responseJson<{ plans: ItuCurriculumPlan[] }>(response))
      .then(({ plans: loaded }) => {
        setPlansLoading(false);
        setPlans(loaded);
        const saved = parseSavedCurriculum(localStorage.getItem(SAVED_CURRICULUM_STORAGE_KEY));
        const planToRestore = requestedProgram === programCode && Number.isInteger(requestedPlan) && requestedPlan > 0
          ? requestedPlan
          : profilePlanId
            ? profilePlanId
          : saved?.programCode === programCode
            ? saved.planId
            : null;
        const restored = loaded.find((plan) => plan.id === planToRestore);
        const nextPlanId = restored?.id ?? loaded.find((plan) => plan.isCurrent)?.id ?? loaded[0]?.id ?? null;
        setCurriculumLoading(Boolean(nextPlanId));
        setPlanId(nextPlanId);
        setError(loaded.length ? "" : "No curriculum versions are available for this program.");
      })
      .catch((fetchError: unknown) => {
        if (!controller.signal.aborted) {
          setPlansLoading(false);
          setError(fetchError instanceof Error ? fetchError.message : "Curriculum versions could not be loaded.");
        }
      });
    return () => controller.abort();
    // `requestedPlan` restores the initial/direct URL. User selections update
    // `planId` directly, so reacting again to our own router.replace would
    // refetch the same plan list and leave a stale loading state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilePlanId, programCode, selectedEnrollment]);

  useEffect(() => {
    if (!programCode || !planId) return;
    const enrollment = selectedEnrollment ?? enrolledPrograms.find((item) => item.programCode === programCode && item.curriculumPlanId === planId) ?? enrolledPrograms.find((item) => item.programCode === programCode);
    router.replace(`/curriculum?program=${encodeURIComponent(programCode)}&plan=${planId}`, { scroll: false });
    const controller = new AbortController();
    void fetch(`/api/itu/curriculum/${planId}?programCode=${encodeURIComponent(programCode)}&planType=${enrollment?.planType ?? "undergraduate"}${enrollment?.primaryProgramCode ? `&primaryProgramCode=${encodeURIComponent(enrollment.primaryProgramCode)}` : ""}`, {
      signal: controller.signal,
    })
      .then((response) => responseJson<{ curriculum: ItuCurriculum }>(response))
      .then(({ curriculum: loaded }) => {
        setCurriculum(groupCurriculum(loaded));
        const storedProgress = parseCurriculumProgress(localStorage.getItem(CURRICULUM_PROGRESS_STORAGE_KEY), loaded.planId);
        let sharedTranscript = parseSharedTranscript(localStorage.getItem(SHARED_TRANSCRIPT_STORAGE_KEY));
        if (!sharedTranscript.length) {
          sharedTranscript = transcriptFromLegacyProgressStore(localStorage.getItem(CURRICULUM_PROGRESS_STORAGE_KEY));
          if (!sharedTranscript.length) sharedTranscript = transcriptFromLegacyProgress([storedProgress]);
          if (sharedTranscript.length) persistSharedTranscript(sharedTranscript);
        }
        setSharedCompletedCourses(sharedCourseProgress(sharedTranscript));
        const evaluated = sharedTranscript.length
          ? applyTranscriptImport(loaded, storedProgress, transcriptParseResult(sharedTranscript)).progress
          : reconcileImportedProgress(loaded, storedProgress);
        setProgress(sharedTranscript.length ? { ...evaluated, importedCourses: [] } : evaluated);
        const saved = parseSavedCurriculum(localStorage.getItem(SAVED_CURRICULUM_STORAGE_KEY));
        setSaveConfirmed(saved?.programCode === programCode && saved.planId === loaded.planId);
        setCurriculumLoading(false);
        setError("");
      })
      .catch((fetchError: unknown) => {
        if (!controller.signal.aborted) {
          setCurriculumLoading(false);
          setError(fetchError instanceof Error ? fetchError.message : "Curriculum could not be loaded from İTÜ OBS.");
        }
      });
    return () => controller.abort();
  }, [enrolledPrograms, planId, programCode, router, selectedEnrollment]);

  useEffect(() => {
    if (!progress) return;
    persistCurriculumProgress(progress);
  }, [progress]);

  const graph = useMemo(() => (curriculum ? buildCurriculumGraph(curriculum) : null), [curriculum]);
  const faculties = useMemo(
    () => [...new Set(programs.map((program) => program.faculty ?? "Other Faculty"))].sort((a, b) => a.localeCompare(b, "tr")),
    [programs],
  );
  const majors = useMemo(
    () => [...new Set(programs.filter((program) => (program.faculty ?? "Other Faculty") === faculty).map((program) => program.major))].sort((a, b) => a.localeCompare(b, "tr")),
    [faculty, programs],
  );
  const degreePrograms = useMemo(
    () => programs.filter((program) => (program.faculty ?? "Other Faculty") === faculty && program.major === major),
    [faculty, major, programs],
  );
  const items = useMemo(
    () => curriculum?.semesters.flatMap((semester) => semester.items) ?? [],
    [curriculum],
  );
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const relevantBranchCodes = useMemo(
    () => [
      ...new Set(
        items.flatMap((item) =>
          item.kind === "course"
            ? [courseBranch(item.code)]
            : item.courses.map((course) => courseBranch(course.code)),
        ),
      ),
    ].sort(),
    [items],
  );
  const relevantBranchesKey = relevantBranchCodes.join(",");
  const resolvedProgress = useMemo(
    () => ({ ...sharedCompletedCourses, ...(curriculum && progress ? resolvedCourseProgress(curriculum, progress) : progress?.courses ?? {}) }),
    [curriculum, progress, sharedCompletedCourses],
  );

  useEffect(() => {
    if (
      !showTakeableCourses ||
      offeringsBranchesLoading ||
      !relevantBranchCodes.length ||
      !courseBranches.length
    ) return;

    let active = true;
    void Promise.all(relevantBranchCodes.map((code) => loadBranch(code))).then(() => {
      if (active) setOfferingLookupKey(relevantBranchesKey);
    });
    return () => {
      active = false;
    };
  }, [
    courseBranches.length,
    loadBranch,
    offeringsBranchesLoading,
    relevantBranchCodes,
    relevantBranchesKey,
    showTakeableCourses,
  ]);

  const nodeStatuses = useMemo(() => {
    const statuses: Record<string, CourseDerivedStatus> = {};
    if (!curriculum || !graph || !progress) return statuses;
    graph.nodes.forEach((node) => {
      if (node.courseCode) {
        if (node.kind === "external") {
          statuses[node.id] = progress.courses[node.courseCode]?.state === "passed"
            ? "passed"
            : progress.courses[node.courseCode]?.state === "failed"
              ? "failed"
              : "not-taken";
        } else {
          const item = itemById.get(node.id);
          const completion = item ? progressForRequirement(item, progress) : null;
          statuses[node.id] = completion?.course.state === "passed" ? "passed" : getCourseStatus(
            node.courseCode,
            curriculum.prerequisites[node.courseCode],
            resolvedProgress,
            curriculumPrerequisitesKnown(curriculum, node.courseCode),
          ).status;
        }
      } else if (node.kind === "elective-slot") {
        const item = itemById.get(node.id);
        const resolved = item ? progressForRequirement(item, progress)?.course : undefined;
        statuses[node.id] = resolved?.state === "passed" ? "passed" : resolved?.state === "failed" ? "failed" : "not-taken";
      }
    });
    return statuses;
  }, [curriculum, graph, itemById, progress, resolvedProgress]);

  const availableCourseCodes = useMemo(
    () => new Set(
      courseCatalog
        .filter((catalog) => loadedBranchCodes.has(catalog.facultyCode))
        .flatMap((catalog) => catalog.courses.map((course) => course.code)),
    ),
    [courseCatalog, loadedBranchCodes],
  );
  const offeringsLoading = showTakeableCourses && (
    offeringsBranchesLoading ||
    offeringLookupKey !== relevantBranchesKey ||
    relevantBranchCodes.some((code) => isBranchLoading(code))
  );
  const takeableNodeIds = useMemo(() => {
    const takeable = new Set<string>();
    if (!curriculum || !graph || !progress || offeringsLoading) return takeable;

    graph.nodes.forEach((node) => {
      const item = itemById.get(node.id);
      if (item && isCurriculumItemAvailableThisSemester(
        item,
        curriculum,
        progress,
        resolvedProgress,
        availableCourseCodes,
      )) takeable.add(node.id);
    });
    return takeable;
  }, [availableCourseCodes, curriculum, graph, itemById, offeringsLoading, progress, resolvedProgress]);

  const visibleNodeIds = useMemo(() => {
    if (!graph) return new Set<string>();
    const visible = new Set<string>();
    graph.nodes.forEach((node) => {
      if (node.kind === "elective-slot") {
        if (!showTakeableCourses || offeringsLoading || takeableNodeIds.has(node.id)) visible.add(node.id);
      } else if (
        node.kind === "course" &&
        filters[nodeStatuses[node.id] ?? "not-taken"] &&
        (!showTakeableCourses || offeringsLoading || takeableNodeIds.has(node.id))
      ) {
        visible.add(node.id);
      }
    });
    return visible;
  }, [filters, graph, nodeStatuses, offeringsLoading, showTakeableCourses, takeableNodeIds]);

  const summary = useMemo(() => {
    const counts: Record<CourseDerivedStatus, number> = {
      "not-taken": 0,
      passed: 0,
      failed: 0,
    };
    graph?.nodes.forEach((node) => {
      if (node.kind === "course" || node.kind === "elective-slot") counts[nodeStatuses[node.id] ?? "not-taken"] += 1;
    });
    return counts;
  }, [graph, nodeStatuses]);
  const auditTotals = useMemo(() => curriculum && progress ? curriculumTotals(curriculum, progress) : null, [curriculum, progress]);
  const completionPercentage = auditTotals?.requiredCourses
    ? Math.min(100, Math.round((auditTotals.earnedCourses / auditTotals.requiredCourses) * 100))
    : 0;
  const currentEnrollment = selectedEnrollment ?? enrolledPrograms.find((item) => item.programCode === programCode && item.curriculumPlanId === planId);

  const selectedItem = selectedNodeId ? itemById.get(selectedNodeId) : undefined;
  const selectedNode = graph?.nodes.find((node) => node.id === selectedNodeId);
  const selectedCode = selectedItem?.kind === "course" ? selectedItem.code : selectedNode?.courseCode;
  const selectedPrerequisite = selectedCode ? curriculum?.prerequisites[selectedCode] : undefined;
  const selectedStatus = selectedNodeId ? nodeStatuses[selectedNodeId] : undefined;
  const selectedCompletion = selectedItem && progress ? progressForRequirement(selectedItem, progress) : null;
  const prerequisiteNodeIds = useMemo(() => {
    if (!graph || !selectedNodeId) return undefined;
    const ids = getAncestorNodeIds(graph, selectedNodeId);
    ids.delete(selectedNodeId);
    return ids;
  }, [graph, selectedNodeId]);
  const dependentNodeIds = useMemo(() => {
    if (!graph || !selectedNodeId) return undefined;
    const ids = getDependentNodeIds(graph, selectedNodeId);
    ids.delete(selectedNodeId);
    return ids;
  }, [graph, selectedNodeId]);
  const unlocks = useMemo(() => {
    if (!graph || !selectedNodeId) return [];
    const dependentIds = getDependentNodeIds(graph, selectedNodeId);
    return graph.nodes.filter(
      (node) => node.id !== selectedNodeId && dependentIds.has(node.id) && node.kind === "course",
    );
  }, [graph, selectedNodeId]);

  function setCourseProgress(code: string, state: "passed" | "failed" | "none", grade?: Grade) {
    setSaveConfirmed(false);
    setProgress((current) => {
      if (!current) return current;
      const courses = { ...current.courses };
      if (state === "none") delete courses[code];
      else {
        const existing = courses[code];
        courses[code] = {
          ...existing,
          state,
          completionStatus: state,
          source: existing?.source ?? "manual",
          ...(state === "passed" && grade ? { grade } : state === "failed" ? { grade: existing?.grade } : {}),
        };
      }
      return { ...current, courses };
    });
  }

  function changeProgram(nextProgramCode: string, enrollmentId = "") {
    setError("");
    setPlans([]);
    setPlanId(null);
    setCurriculum(null);
    setSelectedNodeId(null);
    setSaveConfirmed(false);
    setPlansLoading(true);
    setCurriculumLoading(false);
    setSelectedEnrollmentId(enrollmentId);
    programCodeRef.current = nextProgramCode;
    setProgramCode(nextProgramCode);
  }

  function selectEnrollment(enrollmentId: string) {
    const enrollment = enrolledPrograms.find((item) => item.id === enrollmentId);
    if (!enrollment) return;
    setFaculty(enrollment.facultyName);
    setMajor(enrollment.programName);
    changeProgram(enrollment.programCode, enrollment.id);
  }

  function changeFaculty(nextFaculty: string) {
    const nextPrograms = programs.filter(
      (program) => (program.faculty ?? "Other Faculty") === nextFaculty,
    );
    const nextMajor = [...new Set(nextPrograms.map((program) => program.major))].sort((a, b) => a.localeCompare(b, "tr"))[0] ?? "";
    const nextProgram = nextPrograms.find((program) => program.major === nextMajor);
    setFaculty(nextFaculty);
    setMajor(nextMajor);
    if (nextProgram) changeProgram(nextProgram.code);
  }

  function changeMajor(nextMajor: string) {
    const nextProgram = programs.find(
      (program) => (program.faculty ?? "Other Faculty") === faculty && program.major === nextMajor,
    );
    setMajor(nextMajor);
    if (nextProgram) changeProgram(nextProgram.code);
  }

  function changePlan(nextPlanId: number) {
    setError("");
    setCurriculum(null);
    setSelectedNodeId(null);
    setSaveConfirmed(false);
    setCurriculumLoading(true);
    setPlanId(nextPlanId);
  }

  function saveCurriculum() {
    if (!programCode || !planId || !progress) return;
    localStorage.setItem(
      SAVED_CURRICULUM_STORAGE_KEY,
      serializeSavedCurriculum(programCode, planId),
    );
    persistCurriculumProgress(progress);
    setSaveConfirmed(true);
  }

  const loadingStage = programsLoading
    ? t("curriculum.loadingUndergraduate")
    : plansLoading
      ? t("curriculum.loadingVersions")
      : curriculumLoading
        ? t("curriculum.loadingRequirements")
        : "";

  return (
    <div className="space-y-5">
      {enrolledPrograms.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-blue-700 dark:text-blue-300">{t("curriculum.yourPrograms")}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("curriculum.independentAudit")}</p></div>
            <a href="/profile" className="text-sm font-black text-blue-700 hover:underline dark:text-blue-300">{t("curriculum.manageProfile")}</a>
          </div>
          <div className="mt-4">
            <ProgramTabs enrollments={enrolledPrograms} activeEnrollmentId={currentEnrollment?.id ?? selectedEnrollmentId} onSelect={selectEnrollment} />
          </div>
        </section>
      ) : null}
      {!enrolledPrograms.length ? <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">{t("curriculum.chooseProgram")}</p>
          <p className="mt-1 text-sm text-slate-500">{t("curriculum.chooseDescription")}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            {t("common.faculty")}
            <select value={faculty} onChange={(event) => changeFaculty(event.target.value)} disabled={!faculties.length} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              {faculties.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {t("curriculum.major")}
            <select value={major} onChange={(event) => changeMajor(event.target.value)} disabled={!majors.length} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              {majors.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            {t("curriculum.degreeProgram")}
            <select value={programCode} onChange={(event) => changeProgram(event.target.value)} disabled={!degreePrograms.length} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              {degreePrograms.map((program) => <option key={program.id} value={program.code}>{offeringDisplayName(program, language)} · {program.code}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="text-sm font-semibold text-slate-700">
            {t("curriculum.curriculumVersion")}
            <select value={planId ?? ""} onChange={(event) => changePlan(Number(event.target.value))} disabled={!plans.length} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              {plans.map((plan) => <option key={`${plan.planType}:${plan.programCode}:${plan.id}`} value={plan.id}>{localizedAcademicName(plan, language)}{plan.isCurrent ? ` · ${t("common.current")}` : ""}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveCurriculum}
              disabled={!curriculum || !progress}
              className="min-w-36 rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t(saveConfirmed ? "curriculum.saved" : "curriculum.saveCurriculum")}
            </button>
          </div>
        </div>
      </section> : null}

      {(loadingStage || error) && (
        <div role={error ? "alert" : "status"} aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>
          {error ? localizeRuntimeMessage(language, error) : loadingStage}
        </div>
      )}

      {curriculum && graph && progress && (
        <div
          className="space-y-5"
          {...(currentEnrollment && enrolledPrograms.length > 1 ? {
            role: "tabpanel",
            id: programPanelId(currentEnrollment.id),
            "aria-labelledby": programTabId(currentEnrollment.id),
          } : {})}
        >
          <section className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">{currentEnrollment ? t(currentEnrollment.type === "main" ? "academicPrograms.main" : currentEnrollment.type === "double-major" ? "academicPrograms.doubleMajor" : "academicPrograms.minor") : curriculum.programCode}</p>
              <h2 className="mt-2 text-2xl font-black">{curriculum.title}</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-300">{curriculum.planTitle}</p>
              <p className="mt-3 text-sm text-slate-300">
                {currentEnrollment?.facultyName ? `${currentEnrollment.facultyName} · ` : ""}{t(curriculum.planType === "undergraduate" ? "curriculum.semesters" : "curriculum.courseGroups", { count: curriculum.semesters.length })} · {curriculum.totalCredit === undefined ? "—" : formatNumber(language, curriculum.totalCredit)} {t("common.credit")} · {curriculum.totalEcts === undefined ? "—" : formatNumber(language, curriculum.totalEcts)} {t("curriculum.ects")}
              </p>
              {auditTotals ? <p className="mt-2 text-sm font-bold text-white">{auditTotals.earnedCourses} / {auditTotals.requiredCourses} {t("graduationCalculator.requirements")} · {formatNumber(language, auditTotals.earnedCredit)} / {formatNumber(language, auditTotals.requiredCredit)} {t("common.credit")} · {t("curriculum.completeSummary", { percent: formatNumber(language, completionPercentage) })}</p> : null}
            </div>
            <div className="grid grid-cols-3 gap-2 self-center text-center">
              {(Object.keys(summary) as CourseDerivedStatus[]).map((status) => (
                <div key={status} className={`rounded-xl border-2 px-3 py-2 ${STATUS_CLASS[status]}`}>
                  <div className="text-xl font-black">{summary[status]}</div>
                  <div className="text-[10px] font-black uppercase tracking-wide">{statusLabel(status)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[.16em] text-slate-500">{t("curriculum.courseStatus")}</p>
                <div className="flex flex-wrap gap-2" aria-label={t("curriculum.statusFilters")}>
                  {(Object.keys(filters) as CourseDerivedStatus[]).map((filter) => (
                    <label key={filter} className={`flex cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-black ${STATUS_CLASS[filter]}`}>
                      <input type="checkbox" checked={filters[filter]} onChange={(event) => setFilters((current) => ({ ...current, [filter]: event.target.checked }))} className="size-4 accent-slate-900" />
                      {statusLabel(filter)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-blue-300 bg-blue-50 px-4 py-3 text-sm font-black text-blue-950 shadow-sm">
                  <input
                    type="checkbox"
                    checked={showTakeableCourses}
                    onChange={(event) => setShowTakeableCourses(event.target.checked)}
                    className="size-5 accent-blue-700"
                  />
                  {t("curriculum.showAvailable")}
                </label>
                {selectedNodeId && <button type="button" onClick={() => setSelectedNodeId(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">{t("curriculum.clearFocus")}</button>}
              </div>
            </div>

            {showTakeableCourses && offeringsLoading && (
              <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900" role="status">
                {t("curriculum.checkingOfferings")}
              </div>
            )}
            {showTakeableCourses && !offeringsLoading && offeringsError && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950" role="status">
                {t("curriculum.offeringsError", { error: offeringsError })}
              </div>
            )}

            <div className="space-y-4">
              <div className="min-w-0">
                <CurriculumGraph graph={graph} planType={curriculum.planType} statuses={nodeStatuses} visibleNodeIds={visibleNodeIds} selectedNodeId={selectedNodeId ?? undefined} prerequisiteNodeIds={prerequisiteNodeIds} dependentNodeIds={dependentNodeIds} takeableNodeIds={!offeringsLoading ? takeableNodeIds : undefined} onSelectNode={setSelectedNodeId} />
              </div>

              {selectedNodeId && (
                <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-lg" aria-label={t("curriculum.courseDetails")}>
                  {selectedItem?.kind === "elective-slot" ? (
                    <ElectiveDetails slot={selectedItem} curriculum={curriculum} progress={progress} onlyTakeable={showTakeableCourses && !offeringsLoading} availableCourseCodes={availableCourseCodes} onSelectCourse={(course) => {
                      const node = graph.nodes.find((candidate) => candidate.courseCode === course.code);
                      if (node) setSelectedNodeId(node.id);
                    }} />
                  ) : selectedCode ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-xl font-black text-slate-950">{selectedCode}</p><p className="mt-1 text-sm text-slate-600">{selectedItem?.kind === "course" ? localizedAcademicName(selectedItem, language) : t("curriculum.externalPrerequisite")}</p></div>
                        {selectedStatus && <span className={`rounded-full border px-2 py-1 text-xs font-bold ${STATUS_CLASS[selectedStatus]}`}>{statusLabel(selectedStatus)}</span>}
                      </div>
                      {selectedItem?.kind === "course" && <p className="mt-3 text-xs text-slate-500">{localizedCurriculumSection(language, curriculum.planType, selectedItem.semester)} · {t(selectedItem.requirementType === "elective" ? "common.elective" : "curriculum.compulsory")} · {optionsText(selectedItem.creditOptions, t("common.credit"))} · {optionsText(selectedItem.ectsOptions, t("curriculum.ects"))}{selectedItem.category ? ` · ${selectedItem.category}` : ""}</p>}
                      {selectedCompletion?.course.source === "transcript" && (
                        <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                          {(selectedCompletion.satisfaction.satisfactionType === "equivalence" || selectedCompletion.satisfaction.satisfactionType === "language-equivalence") && <span className="mr-2 rounded-full bg-blue-100 px-2 py-1 font-black text-blue-800">{t(selectedCompletion.satisfaction.satisfactionType === "language-equivalence" ? "curriculum.languageEquivalentBadge" : "curriculum.equivalentCourse")}</span>}
                          {(selectedCompletion.satisfaction.satisfactionType === "equivalence" || selectedCompletion.satisfaction.satisfactionType === "language-equivalence") && <>{t("curriculum.requirementLabel")}: {selectedCompletion.requirementCode} · {t("curriculum.satisfiedByLabel")}: {selectedCompletion.satisfaction.satisfiedByCourseCodes.join(" + ")} · </>}
                          {t("curriculum.termDetail", { term: selectedCompletion.course.term ?? "", crn: selectedCompletion.course.crn ?? "", grade: selectedCompletion.course.grade ?? "" })}
                          {selectedCompletion.satisfaction.sourceUrl && <> · <a href={selectedCompletion.satisfaction.sourceUrl} target="_blank" rel="noreferrer" className="underline">{t("curriculum.officialSource")}</a></>}
                        </p>
                      )}
                      {selectedNode?.kind === "external" && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">{t("curriculum.outsidePlan")}</p>}

                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <h4 className="text-sm font-black text-slate-900">{t("common.status")}</h4>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <button type="button" onClick={() => setCourseProgress(selectedCode, "none")} aria-pressed={!progress.courses[selectedCode]} className={`rounded-lg border-2 border-slate-500 bg-slate-200 px-2 py-2 text-xs font-black text-black hover:bg-slate-300 ${!progress.courses[selectedCode] ? "ring-2 ring-slate-700 ring-offset-2" : "opacity-65"}`}>{t("curriculum.notTaken")}</button>
                          <button type="button" onClick={() => setCourseProgress(selectedCode, "passed", progress.courses[selectedCode]?.grade)} aria-pressed={progress.courses[selectedCode]?.state === "passed"} className={`rounded-lg border-2 border-emerald-600 bg-emerald-200 px-2 py-2 text-xs font-black text-emerald-950 hover:bg-emerald-300 ${progress.courses[selectedCode]?.state === "passed" ? "ring-2 ring-emerald-700 ring-offset-2" : "opacity-65"}`}>{t("curriculum.passed")}</button>
                          <button type="button" onClick={() => setCourseProgress(selectedCode, "failed")} aria-pressed={progress.courses[selectedCode]?.state === "failed"} className={`rounded-lg border-2 border-red-600 bg-red-200 px-2 py-2 text-xs font-black text-red-950 hover:bg-red-300 ${progress.courses[selectedCode]?.state === "failed" ? "ring-2 ring-red-700 ring-offset-2" : "opacity-65"}`}>{t("curriculum.failed")}</button>
                        </div>
                        {progress.courses[selectedCode]?.state === "passed" && (
                          <label className="mt-3 block text-xs font-semibold text-slate-600">{t("curriculum.gradeRules")}
                            <select value={progress.courses[selectedCode]?.grade ?? ""} onChange={(event) => setCourseProgress(selectedCode, "passed", event.target.value ? event.target.value as Grade : undefined)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2">
                              <option value="">{t("curriculum.notProvided")}</option>{GRADES.map((grade) => <option key={grade}>{grade}</option>)}
                            </select>
                          </label>
                        )}
                      </div>

                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <h4 className="text-sm font-black text-slate-900">{t("curriculum.prerequisites")}</h4>
                        {selectedPrerequisite?.rawExpression ? <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">{selectedPrerequisite.rawExpression}</p> : <p className="mt-2 text-sm text-slate-500">{t("curriculum.noPrerequisite")}</p>}
                        {selectedPrerequisite && <div className="mt-3"><MissingList requirements={getMissingPrerequisites(selectedPrerequisite, resolvedProgress)} /></div>}
                      </div>
                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <h4 className="text-sm font-black text-slate-900">{t("curriculum.unlocks")}</h4>
                        {unlocks.length ? <ul className="mt-2 space-y-1 text-sm text-slate-700">{unlocks.map((node) => <li key={node.id}>→ {node.courseCode} · {node.label.split("\n")[1]}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">{t("curriculum.noDownstream")}</p>}
                      </div>
                    </>
                  ) : selectedNode?.kind === "and" ? (
                    <div><p className="text-xl font-black">{t("curriculum.andRequirement")}</p><p className="mt-2 text-sm text-slate-600">{t("curriculum.everyBranch")}</p></div>
                  ) : null}
                </aside>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600" aria-label={t("curriculum.legend")}>
              {(["not-taken", "passed", "failed"] as CourseDerivedStatus[]).map((status) => <span key={status} className={`rounded-full border px-2 py-1 font-bold ${STATUS_CLASS[status]}`}>{statusLabel(status)}</span>)}
              <span className="rounded-full border border-violet-500 bg-violet-100 px-2 py-1 font-bold text-violet-950">{t("curriculum.electiveRequirement")}</span>
              <span className="rounded-full border border-amber-500 bg-amber-50 px-2 py-1 font-bold text-amber-900">{t("curriculum.selectedPrerequisite")}</span>
              <span className="rounded-full border border-sky-500 bg-sky-50 px-2 py-1 font-bold text-sky-900">{t("curriculum.usesCourse")}</span>
            </div>
          </section>

          <footer className="rounded-xl bg-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-600">
            {t("curriculum.source")}: <a href="https://obs.itu.edu.tr/public/DersPlan/" target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline">İTÜ OBS</a> · {t("curriculum.fetched", { date: formatDate(language, curriculum.fetchedAt, { dateStyle: "short", timeStyle: "short" }) })} {t("curriculum.disclaimer")}
          </footer>
        </div>
      )}
    </div>
  );
}

function ElectiveDetails({
  slot,
  curriculum,
  progress,
  onlyTakeable,
  availableCourseCodes,
  onSelectCourse,
}: {
  slot: ItuElectiveSlot;
  curriculum: ItuCurriculum;
  progress: CurriculumProgress;
  onlyTakeable: boolean;
  availableCourseCodes: Set<string>;
  onSelectCourse: (course: ItuElectiveCourse) => void;
}) {
  const { language, t } = useLanguage();
  const effectiveProgress = resolvedCourseProgress(curriculum, progress);
  const displayedCourses = onlyTakeable
    ? availableCoursesForElectiveSlot(
        slot,
        curriculum,
        progress,
        effectiveProgress,
        availableCourseCodes,
      )
    : slot.courses;

  return (
    <div>
      <p className="text-xl font-black text-slate-950">{localizedAcademicName(slot, language)}</p>
      <p className="mt-2 text-xs text-slate-500">{localizedCurriculumSection(language, curriculum.planType, slot.semester)} · {t("curriculum.electiveRequirement")} · {optionsText(slot.creditOptions, t("common.credit"))} · {optionsText(slot.ectsOptions, t("curriculum.ects"))}</p>
      <h4 className="mt-5 border-t border-slate-100 pt-4 text-sm font-black">{t(onlyTakeable ? "curriculum.availableThisSemester" : "curriculum.courseOptions")} ({displayedCourses.length})</h4>
      {displayedCourses.length ? (
        <div className="mt-2 max-h-[55vh] space-y-2 overflow-auto pr-1">
          {displayedCourses.map((course) => {
            const expectedCode = normalizeCourseCode(course.code);
            const actualCode = courseLanguageVariants(expectedCode).find((code) => progress.courses[code]);
            const courseProgress = actualCode ? progress.courses[actualCode] : undefined;
            const languageEquivalent = Boolean(actualCode && actualCode !== expectedCode);
            const eligibility = evaluateCourseEligibility(
              curriculum.prerequisites[course.code],
              effectiveProgress,
              curriculumPrerequisitesKnown(curriculum, course.code),
            );
            return (
              <button key={course.code} type="button" onClick={() => onSelectCourse(course)} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50">
                <div className="flex justify-between gap-2"><span className="font-bold text-slate-900">{course.code}</span><span className={`text-[10px] font-bold uppercase ${courseProgress?.state === "passed" ? "text-emerald-700" : courseProgress?.state === "failed" ? "text-red-700" : "text-slate-500"}`}>{courseProgress?.state ?? eligibility}{courseProgress?.grade ? ` · ${courseProgress.grade}` : ""}</span></div>
                <p className="mt-1 text-xs text-slate-600">{localizedAcademicName(course, language)}</p>
                {languageEquivalent && <p className="mt-1 text-[10px] font-black text-blue-700">{t("curriculum.languageEquivalent", { code: actualCode ?? "" })}</p>}
                {courseProgress?.source === "transcript" && <p className="mt-1 text-[10px] font-semibold text-emerald-700">{t("curriculum.termDetail", { term: courseProgress.term ?? "", crn: courseProgress.crn ?? "", grade: courseProgress.grade ?? "" })}</p>}
              </button>
            );
          })}
        </div>
      ) : <p className="mt-2 text-sm text-slate-500">{t(onlyTakeable ? "curriculum.noTakeableOption" : "curriculum.poolUnavailable")}</p>}
    </div>
  );
}
