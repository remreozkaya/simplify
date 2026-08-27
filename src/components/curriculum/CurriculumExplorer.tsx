"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import CurriculumGraph from "@/components/curriculum/CurriculumGraph";
import {
  evaluateCourseEligibility,
  getCourseStatus,
  getMissingPrerequisites,
} from "@/lib/curriculum/eligibility";
import {
  buildCurriculumGraph,
  getAncestorNodeIds,
  getDependentNodeIds,
} from "@/lib/curriculum/graph";
import {
  CURRICULUM_PROGRESS_STORAGE_KEY,
  parseCurriculumProgress,
  updateStoredCurriculumProgress,
} from "@/lib/curriculum/progress";
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

const STATUS_LABEL: Record<CourseDerivedStatus, string> = {
  passed: "Passed",
  eligible: "Eligible",
  planned: "Planned",
  blocked: "Blocked",
  unknown: "Unknown",
};
const STATUS_CLASS: Record<CourseDerivedStatus, string> = {
  passed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  eligible: "border-cyan-200 bg-cyan-50 text-cyan-800",
  planned: "border-violet-200 bg-violet-50 text-violet-800",
  blocked: "border-orange-200 bg-orange-50 text-orange-800",
  unknown: "border-amber-200 bg-amber-50 text-amber-800",
};
const GRADES: Grade[] = ["AA", "BA", "BB", "CB", "CC", "DC", "DD", "FD", "FF"];

type SearchResult = {
  id: string;
  nodeId: string;
  code?: string;
  title: string;
  subtitle: string;
};

async function responseJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(value.error?.message ?? "The request failed.");
  return value;
}

function optionsText(values: number[], suffix: string) {
  return values.length ? `${values.join(" / ")} ${suffix}` : "—";
}

function branchOf(code: string) {
  return code.split(" ")[0];
}

function requirementKnown(curriculum: ItuCurriculum, courseCode: string) {
  return (
    curriculum.prerequisiteDataAvailable &&
    curriculum.prerequisiteBranchesLoaded.includes(branchOf(courseCode))
  );
}

function MissingList({ requirements }: { requirements: MissingRequirement[] }) {
  if (!requirements.length) return <p className="text-sm text-slate-500">No missing prerequisites.</p>;
  return (
    <ul className="space-y-2 text-sm text-slate-700">
      {requirements.map((requirement, index) => (
        <li key={index} className="rounded-lg bg-slate-50 px-3 py-2">
          {requirement.kind === "course" && (
            <span>Missing {requirement.courseCode}{requirement.minimumGrade ? ` with at least ${requirement.minimumGrade}` : ""}</span>
          )}
          {requirement.kind === "credits" && <span>Requires at least {requirement.minimumCredits} earned credits; enterable credit totals are not supported yet.</span>}
          {requirement.kind === "unknown" && <span>Unknown prerequisite: {requirement.raw}</span>}
          {(requirement.kind === "all" || requirement.kind === "one-of") && (
            <div>
              <p className="font-semibold">{requirement.kind === "all" ? "All of:" : "One of:"}</p>
              <div className="mt-2 pl-2"><MissingList requirements={requirement.requirements} /></div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function CurriculumExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedProgram = searchParams.get("program");
  const requestedPlan = Number(searchParams.get("plan"));
  const programCodeRef = useRef("");
  const [programs, setPrograms] = useState<ItuUndergraduateProgram[]>([]);
  const [plans, setPlans] = useState<ItuCurriculumPlan[]>([]);
  const [faculty, setFaculty] = useState("");
  const [major, setMajor] = useState("");
  const [programCode, setProgramCode] = useState("");
  const [planId, setPlanId] = useState<number | null>(null);
  const [curriculum, setCurriculum] = useState<ItuCurriculum | null>(null);
  const [progress, setProgress] = useState<CurriculumProgress | null>(null);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(false);
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<"graph" | "list">("graph");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<CourseDerivedStatus | "elective", boolean>>({
    passed: true,
    eligible: true,
    planned: true,
    blocked: true,
    unknown: true,
    elective: true,
  });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/itu/curriculum/programs", { signal: controller.signal })
      .then((response) => responseJson<{ programs: ItuUndergraduateProgram[] }>(response))
      .then(({ programs: loaded }) => {
        setProgramsLoading(false);
        setPrograms(loaded);
        const restoredProgram = loaded.find((program) => program.code === requestedProgram) ?? loaded[0];
        const restored = restoredProgram?.code ?? "";
        setFaculty(restoredProgram?.faculty ?? "Other Faculty");
        setMajor(restoredProgram?.major ?? "");
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
  }, [requestedProgram]);

  useEffect(() => {
    if (!programCode) return;
    const controller = new AbortController();
    void fetch(`/api/itu/curriculum/plans?programCode=${encodeURIComponent(programCode)}`, {
      signal: controller.signal,
    })
      .then((response) => responseJson<{ plans: ItuCurriculumPlan[] }>(response))
      .then(({ plans: loaded }) => {
        setPlansLoading(false);
        setPlans(loaded);
        const restored = loaded.find((plan) => plan.id === requestedPlan);
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
  }, [programCode]);

  useEffect(() => {
    if (!programCode || !planId) return;
    router.replace(`/curriculum?program=${encodeURIComponent(programCode)}&plan=${planId}`, { scroll: false });
    const controller = new AbortController();
    void fetch(`/api/itu/curriculum/${planId}?programCode=${encodeURIComponent(programCode)}`, {
      signal: controller.signal,
    })
      .then((response) => responseJson<{ curriculum: ItuCurriculum }>(response))
      .then(({ curriculum: loaded }) => {
        setCurriculum(loaded);
        setProgress(parseCurriculumProgress(localStorage.getItem(CURRICULUM_PROGRESS_STORAGE_KEY), loaded.planId));
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
  }, [planId, programCode, router]);

  useEffect(() => {
    if (!progress) return;
    localStorage.setItem(
      CURRICULUM_PROGRESS_STORAGE_KEY,
      updateStoredCurriculumProgress(localStorage.getItem(CURRICULUM_PROGRESS_STORAGE_KEY), progress),
    );
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
  const nodeStatuses = useMemo(() => {
    const statuses: Record<string, CourseDerivedStatus> = {};
    if (!curriculum || !graph || !progress) return statuses;
    graph.nodes.forEach((node) => {
      if (node.courseCode) {
        if (node.kind === "external") {
          statuses[node.id] = progress.courses[node.courseCode]?.state === "passed" ? "passed" : "blocked";
        } else {
          statuses[node.id] = getCourseStatus(
            node.courseCode,
            curriculum.prerequisites[node.courseCode],
            progress.courses,
            requirementKnown(curriculum, node.courseCode),
          ).status;
        }
      }
    });
    return statuses;
  }, [curriculum, graph, progress]);

  const visibleNodeIds = useMemo(() => {
    if (!graph) return new Set<string>();
    const visible = new Set<string>();
    graph.nodes.forEach((node) => {
      if (node.kind === "semester-label") {
        visible.add(node.id);
      } else if (node.kind === "elective-slot") {
        if (filters.elective) visible.add(node.id);
      } else if (node.kind === "and" || node.kind === "or") {
        visible.add(node.id);
      } else if (filters[nodeStatuses[node.id] ?? "unknown"]) {
        visible.add(node.id);
      }
    });
    return visible;
  }, [filters, graph, nodeStatuses]);

  const focusedNodeIds = useMemo(() => {
    if (!graph || !selectedNodeId) return undefined;
    return new Set([
      ...getAncestorNodeIds(graph, selectedNodeId),
      ...getDependentNodeIds(graph, selectedNodeId),
    ]);
  }, [graph, selectedNodeId]);

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!curriculum || !graph || search.trim().length < 2) return [];
    const query = search.toLocaleLowerCase("tr-TR");
    const results: SearchResult[] = [];
    graph.nodes.forEach((node) => {
      if (node.kind === "semester-label") return;
      if ((node.courseCode ?? "").toLocaleLowerCase("tr-TR").includes(query) || node.label.toLocaleLowerCase("tr-TR").includes(query)) {
        results.push({ id: node.id, nodeId: node.id, code: node.courseCode, title: node.label.split("\n")[1] ?? node.label, subtitle: node.kind === "external" ? "External prerequisite" : node.semester ? `Semester ${node.semester}` : node.kind.toUpperCase() });
      }
    });
    items.forEach((item) => {
      if (item.kind !== "elective-slot") return;
      item.courses.forEach((course) => {
        if (`${course.code} ${course.title}`.toLocaleLowerCase("tr-TR").includes(query)) {
          results.push({ id: `${item.id}:${course.code}`, nodeId: item.id, code: course.code, title: course.title, subtitle: `Choice for ${item.title}` });
        }
      });
    });
    return results.slice(0, 12);
  }, [curriculum, graph, items, search]);

  const summary = useMemo(() => {
    const counts = { passed: 0, eligible: 0, planned: 0, blocked: 0, unknown: 0 };
    graph?.nodes.forEach((node) => {
      if (node.kind === "course") counts[nodeStatuses[node.id] ?? "unknown"] += 1;
    });
    return counts;
  }, [graph, nodeStatuses]);

  const selectedItem = selectedNodeId ? itemById.get(selectedNodeId) : undefined;
  const selectedNode = graph?.nodes.find((node) => node.id === selectedNodeId);
  const selectedCode = selectedItem?.kind === "course" ? selectedItem.code : selectedNode?.courseCode;
  const selectedPrerequisite = selectedCode ? curriculum?.prerequisites[selectedCode] : undefined;
  const selectedStatus = selectedNodeId ? nodeStatuses[selectedNodeId] : undefined;
  const unlocks = useMemo(() => {
    if (!graph || !selectedNodeId) return [];
    const dependentIds = getDependentNodeIds(graph, selectedNodeId);
    return graph.nodes.filter(
      (node) => node.id !== selectedNodeId && dependentIds.has(node.id) && node.kind === "course",
    );
  }, [graph, selectedNodeId]);

  function setCourseProgress(code: string, state: "passed" | "planned" | "none", grade?: Grade) {
    setProgress((current) => {
      if (!current) return current;
      const courses = { ...current.courses };
      if (state === "none") delete courses[code];
      else courses[code] = { state, ...(state === "passed" && grade ? { grade } : {}) };
      return { ...current, courses };
    });
  }

  function selectSearchResult(result: SearchResult) {
    setSelectedNodeId(result.nodeId);
    setSearch("");
  }

  function changeProgram(nextProgramCode: string) {
    setError("");
    setPlans([]);
    setPlanId(null);
    setCurriculum(null);
    setSelectedNodeId(null);
    setPlansLoading(true);
    setCurriculumLoading(false);
    programCodeRef.current = nextProgramCode;
    setProgramCode(nextProgramCode);
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
    setCurriculumLoading(true);
    setPlanId(nextPlanId);
  }

  const loadingStage = programsLoading
    ? "Loading undergraduate programs…"
    : plansLoading
      ? "Loading curriculum versions…"
      : curriculumLoading
        ? "Loading curriculum and prerequisites…"
        : "";

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Choose your program</p>
          <p className="mt-1 text-sm text-slate-500">Selections narrow from faculty to major, then to the exact degree program.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            Faculty
            <select value={faculty} onChange={(event) => changeFaculty(event.target.value)} disabled={!faculties.length} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              {faculties.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Major
            <select value={major} onChange={(event) => changeMajor(event.target.value)} disabled={!majors.length} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              {majors.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Degree Program
            <select value={programCode} onChange={(event) => changeProgram(event.target.value)} disabled={!degreePrograms.length} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              {degreePrograms.map((program) => <option key={program.code} value={program.code}>{program.name} · {program.code}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.9fr)]">
          <label className="text-sm font-semibold text-slate-700">
            Curriculum Version
            <select value={planId ?? ""} onChange={(event) => changePlan(Number(event.target.value))} disabled={!plans.length} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100">
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}{plan.isCurrent ? " · Current" : ""}</option>)}
            </select>
          </label>
          <div className="relative">
            <label className="text-sm font-semibold text-slate-700" htmlFor="curriculum-search">Search</label>
            <input id="curriculum-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Course code or name…" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            {searchResults.length > 0 && (
              <div className="absolute z-40 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                {searchResults.map((result) => (
                  <button key={result.id} type="button" onClick={() => selectSearchResult(result)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50 focus:bg-blue-50 focus:outline-none">
                    <span className="block text-sm font-bold text-slate-900">{result.code ? `${result.code} · ` : ""}{result.title}</span>
                    <span className="text-xs text-slate-500">{result.subtitle}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {(loadingStage || error) && (
        <div role={error ? "alert" : "status"} aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>
          {error || loadingStage}
        </div>
      )}

      {curriculum && graph && progress && (
        <>
          <section className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm lg:grid-cols-[1fr_auto]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">{curriculum.programCode}</p>
              <h2 className="mt-2 text-2xl font-black">{curriculum.title}</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-300">{curriculum.planTitle}</p>
              <p className="mt-3 text-sm text-slate-300">
                {curriculum.semesters.length} semesters · {curriculum.totalCredit ?? "—"} credits · {curriculum.totalEcts ?? "—"} ECTS
              </p>
            </div>
            <div className="grid grid-cols-5 gap-2 self-center text-center">
              {(Object.keys(summary) as CourseDerivedStatus[]).map((status) => (
                <div key={status} className="rounded-xl bg-white/10 px-3 py-2">
                  <div className="text-xl font-black">{summary[status]}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-300">{STATUS_LABEL[status]}</div>
                </div>
              ))}
            </div>
          </section>

          {curriculum.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
              <p className="font-bold">Some OBS data is incomplete</p>
              <ul className="mt-1 list-disc pl-5">{curriculum.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex rounded-xl bg-slate-100 p-1" aria-label="Curriculum view">
                {(["graph", "list"] as const).map((candidate) => (
                  <button key={candidate} type="button" onClick={() => setView(candidate)} aria-pressed={view === candidate} className={`rounded-lg px-4 py-2 text-sm font-bold ${view === candidate ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"}`}>
                    {candidate === "graph" ? "Graph View" : "List View"}
                  </button>
                ))}
              </div>
              {selectedNodeId && <button type="button" onClick={() => setSelectedNodeId(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">Clear focus</button>}
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {(Object.keys(filters) as Array<keyof typeof filters>).map((filter) => (
                <label key={filter} className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                  <input type="checkbox" checked={filters[filter]} onChange={(event) => setFilters((current) => ({ ...current, [filter]: event.target.checked }))} className="accent-blue-600" />
                  {filter === "elective" ? "Elective requirements" : STATUS_LABEL[filter]}
                </label>
              ))}
            </div>

            <div className={`grid gap-4 ${selectedNodeId ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
              <div className="min-w-0">
                {view === "graph" ? (
                  <CurriculumGraph graph={graph} statuses={nodeStatuses} visibleNodeIds={visibleNodeIds} focusedNodeIds={focusedNodeIds} selectedNodeId={selectedNodeId ?? undefined} onSelectNode={setSelectedNodeId} />
                ) : (
                  <div className="space-y-6">
                    {curriculum.semesters.map((semester) => (
                      <section key={semester.semester}>
                        <h3 className="mb-3 text-lg font-black text-slate-900">Semester {semester.semester}</h3>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {semester.items.filter((item) => item.kind !== "elective-slot" || filters.elective).map((item) => {
                            const status = item.kind === "course" ? nodeStatuses[item.id] ?? "unknown" : undefined;
                            return (
                              <button key={item.id} type="button" onClick={() => setSelectedNodeId(item.id)} className="rounded-xl border border-slate-200 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <div className="flex items-start justify-between gap-2">
                                  <div><p className="font-black text-slate-900">{item.kind === "course" ? item.code : item.title}</p><p className="mt-1 text-sm text-slate-600">{item.kind === "course" ? item.title : `${item.courses.length} available courses`}</p></div>
                                  {status && <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>}
                                </div>
                                <p className="mt-3 text-xs text-slate-500">{item.kind === "course" ? item.requirementType === "elective" ? "Elective course" : "Compulsory" : "Elective requirement"} · {optionsText(item.creditOptions, "cr")} · {optionsText(item.ectsOptions, "ECTS")}</p>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>

              {selectedNodeId && (
                <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-lg xl:sticky xl:top-24" aria-label="Course details">
                  {selectedItem?.kind === "elective-slot" ? (
                    <ElectiveDetails slot={selectedItem} curriculum={curriculum} progress={progress} onSelectCourse={(course) => {
                      const node = graph.nodes.find((candidate) => candidate.courseCode === course.code);
                      if (node) setSelectedNodeId(node.id);
                    }} />
                  ) : selectedCode ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-xl font-black text-slate-950">{selectedCode}</p><p className="mt-1 text-sm text-slate-600">{selectedItem?.kind === "course" ? selectedItem.title : "External prerequisite"}</p></div>
                        {selectedStatus && <span className={`rounded-full border px-2 py-1 text-xs font-bold ${STATUS_CLASS[selectedStatus]}`}>{STATUS_LABEL[selectedStatus]}</span>}
                      </div>
                      {selectedItem?.kind === "course" && <p className="mt-3 text-xs text-slate-500">Semester {selectedItem.semester} · {selectedItem.requirementType === "elective" ? "Elective" : "Compulsory"} · {optionsText(selectedItem.creditOptions, "cr")} · {optionsText(selectedItem.ectsOptions, "ECTS")}{selectedItem.category ? ` · ${selectedItem.category}` : ""}</p>}
                      {selectedNode?.kind === "external" && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">This course is outside the selected curriculum and does not count as a plan requirement.</p>}

                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <h4 className="text-sm font-black text-slate-900">Status</h4>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => setCourseProgress(selectedCode, "passed", progress.courses[selectedCode]?.grade)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Mark Passed</button>
                          <button type="button" onClick={() => setCourseProgress(selectedCode, "planned")} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700">Plan Course</button>
                          <button type="button" onClick={() => setCourseProgress(selectedCode, "none")} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Clear</button>
                        </div>
                        {progress.courses[selectedCode]?.state === "passed" && (
                          <label className="mt-3 block text-xs font-semibold text-slate-600">Grade (required for minimum-grade rules)
                            <select value={progress.courses[selectedCode]?.grade ?? ""} onChange={(event) => setCourseProgress(selectedCode, "passed", event.target.value ? event.target.value as Grade : undefined)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2">
                              <option value="">Not provided</option>{GRADES.map((grade) => <option key={grade}>{grade}</option>)}
                            </select>
                          </label>
                        )}
                      </div>

                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <h4 className="text-sm font-black text-slate-900">Prerequisites</h4>
                        {selectedPrerequisite?.rawExpression ? <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">{selectedPrerequisite.rawExpression}</p> : <p className="mt-2 text-sm text-slate-500">No course prerequisite listed.</p>}
                        {selectedPrerequisite && <div className="mt-3"><MissingList requirements={getMissingPrerequisites(selectedPrerequisite, progress.courses)} /></div>}
                      </div>
                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <h4 className="text-sm font-black text-slate-900">Unlocks</h4>
                        {unlocks.length ? <ul className="mt-2 space-y-1 text-sm text-slate-700">{unlocks.map((node) => <li key={node.id}>→ {node.courseCode} · {node.label.split("\n")[1]}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No downstream curriculum course.</p>}
                      </div>
                    </>
                  ) : selectedNode?.kind === "and" || selectedNode?.kind === "or" ? (
                    <div><p className="text-xl font-black">{selectedNode.kind.toUpperCase()} requirement</p><p className="mt-2 text-sm text-slate-600">This junction preserves the prerequisite logic reported by OBS. {selectedNode.kind === "and" ? "Every incoming branch is required." : "Any one incoming branch can satisfy this choice."}</p></div>
                  ) : null}
                </aside>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600" aria-label="Graph legend">
              {(Object.keys(STATUS_LABEL) as CourseDerivedStatus[]).map((status) => <span key={status} className={`rounded-full border px-2 py-1 font-bold ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>)}
              <span>◇ Elective requirement</span><span>── Required</span><span className="text-violet-700">- - Alternative / OR</span>
            </div>
          </section>

          <footer className="rounded-xl bg-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-600">
            Source: <a href="https://obs.itu.edu.tr/public/DersPlan/" target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline">İTÜ OBS</a> · Fetched {new Date(curriculum.fetchedAt).toLocaleString("en-GB")}. Eligibility is derived from public OBS prerequisite data and is not an official registration decision. Verify requirements in OBS before registration.
          </footer>
        </>
      )}
    </div>
  );
}

function ElectiveDetails({
  slot,
  curriculum,
  progress,
  onSelectCourse,
}: {
  slot: ItuElectiveSlot;
  curriculum: ItuCurriculum;
  progress: CurriculumProgress;
  onSelectCourse: (course: ItuElectiveCourse) => void;
}) {
  return (
    <div>
      <p className="text-xl font-black text-slate-950">{slot.title}</p>
      <p className="mt-2 text-xs text-slate-500">Semester {slot.semester} · Elective requirement · {optionsText(slot.creditOptions, "cr")} · {optionsText(slot.ectsOptions, "ECTS")}</p>
      <h4 className="mt-5 border-t border-slate-100 pt-4 text-sm font-black">Available courses ({slot.courses.length})</h4>
      {slot.courses.length ? (
        <div className="mt-2 max-h-[55vh] space-y-2 overflow-auto pr-1">
          {slot.courses.map((course) => {
            const eligibility = evaluateCourseEligibility(
              curriculum.prerequisites[course.code],
              progress.courses,
              requirementKnown(curriculum, course.code),
            );
            return (
              <button key={course.code} type="button" onClick={() => onSelectCourse(course)} className="w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50">
                <div className="flex justify-between gap-2"><span className="font-bold text-slate-900">{course.code}</span><span className="text-[10px] font-bold uppercase text-slate-500">{eligibility}</span></div>
                <p className="mt-1 text-xs text-slate-600">{course.title}</p>
              </button>
            );
          })}
        </div>
      ) : <p className="mt-2 text-sm text-slate-500">This elective pool could not be loaded.</p>}
    </div>
  );
}
