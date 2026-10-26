import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { EMPTY_PROFILE } from "@/lib/profile/types";
import { translate } from "@/lib/i18n";

const state = vi.hoisted(() => ({ effects: [] as Array<() => unknown>, updates: [] as unknown[], query: "", initialValues: new Map<number, unknown>(), currentValues: new Map<number, unknown>(), hookIndex: 0, profile: null as unknown }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useEffect: (effect: () => unknown) => state.effects.push(effect), useState: (initial: unknown) => {
    const index = state.hookIndex++;
    const [value] = actual.useState(state.currentValues.has(index) ? state.currentValues.get(index) : state.initialValues.has(index) ? state.initialValues.get(index) : initial);
    return [value, (next: unknown) => {
      state.updates.push(next);
      state.currentValues.set(index, typeof next === "function" ? next(value) : next);
    }];
  } };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams(state.query) }));
vi.mock("@/components/profile/ProfileProvider", () => ({ useProfile: () => ({ profile: state.profile ?? EMPTY_PROFILE }) }));
vi.mock("@/hooks/useItuCourseCatalog", () => ({ useItuCourseCatalog: () => ({ branches: [], courseCatalog: [], loadedBranchCodes: new Set(), isLoadingBranches: false }) }));
vi.mock("@/lib/i18n/client", () => ({ useLanguage: () => ({ language: "en", t: (key: string) => translate("en", key) }) }));
import CurriculumExplorer from "@/components/curriculum/CurriculumExplorer";

afterEach(() => { state.effects = []; state.updates = []; state.query = ""; state.initialValues.clear(); state.currentValues.clear(); state.hookIndex = 0; state.profile = null; vi.unstubAllGlobals(); });

it("restores an explicit program outside Business from the complete faculty catalog", async () => {
  state.query = "program=BLGE_LS&plan=2340";
  vi.stubGlobal("localStorage", { getItem: () => null });
  const requests: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    requests.push(url);
    const payload = url.endsWith("/faculties")
      ? { faculties: [{ id: "10", name: "Business" }, { id: "28", name: "Computing" }] }
      : { programs: url.includes("facultyId=28")
        ? [{ code: "BLGE_LS", faculty: "Computing", major: "Computer Engineering" }]
        : [{ code: "ISL_LS", faculty: "Business", major: "Business" }] };
    return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
  });
  renderToStaticMarkup(createElement(CurriculumExplorer));
  state.effects[0]();
  await vi.waitFor(() => expect(state.updates).toContain("BLGE_LS"));
  expect(requests.some(url => url.includes("facultyId=28"))).toBe(true);
  expect(state.updates).toContain("Computing");
});

it("does not substitute an unrelated program when an explicit program is unavailable", async () => {
  state.query = "program=REMOVED_LS";
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("fetch", async (url: string) => new Response(JSON.stringify(url.endsWith("/faculties")
    ? { faculties: [{ id: "10", name: "Business" }] }
    : { programs: [{ code: "ISL_LS", faculty: "Business", major: "Business" }] })));
  renderToStaticMarkup(createElement(CurriculumExplorer));
  state.effects[0]();
  await vi.waitFor(() => expect(state.updates).toContain(false));
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(state.updates).not.toContain("ISL_LS");
  expect(state.updates).toContain("");
});

it("includes an offered minor elective whose external prerequisite is completed in the shared transcript", async () => {
  const { ElectiveDetails } = await import("@/components/curriculum/CurriculumExplorer");
  const slot = { kind: "elective-slot" as const, id: "minor-elective", semester: 3, title: "Minor elective", category: "MT", creditOptions: [3], ectsOptions: [5], courses: [{ code: "YZV 411E", title: "Artificial Intelligence", creditOptions: [3], ectsOptions: [5] }] };
  const props = {
    slot,
    curriculum: { planId: 2, programCode: "MINOR_YD", title: "Minor", planTitle: "Minor plan", semesters: [{ semester: 3, items: [slot] }], prerequisites: { "YZV 411E": { courseCode: "YZV 411E", expression: { kind: "course" as const, courseCode: "MAT 103E", minimumGrade: "DD" as const }, rawText: "MAT 103E" } }, equivalenceRules: [], prerequisiteBranchesLoaded: ["YZV"], prerequisiteDataAvailable: true, warnings: [], fetchedAt: "2026-01-01T00:00:00.000Z" },
    progress: { version: 3 as const, planId: 2, courses: {} },
    resolvedProgress: { "MAT 103E": { state: "passed" as const, grade: "AA" as const } },
    onlyTakeable: true, availableCourseCodes: new Set(["YZV 411E"]), onSelectCourse: () => {},
  };
  const html = renderToStaticMarkup(createElement(ElectiveDetails, props));
  expect(html).toContain("YZV 411E");
  expect(html).toContain("Artificial Intelligence");
});

it("does not automatically adopt an unverified secondary plan for a migrated enrollment", async () => {
  const enrollment = { id: "minor", type: "minor", facultyId: "1", facultyName: "Faculty", educationLevel: "undergraduate", planType: "yandal", primaryProgramCode: "MAT_LS", programCode: "FZT_YD", programName: "Minor", curriculumPlanId: 0, curriculumPlanName: "", selectionRequiresReview: true };
  state.profile = { ...EMPTY_PROFILE, programEnrollments: [enrollment] };
  state.initialValues.set(4, "FZT_YD");
  state.initialValues.set(5, "minor");
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ plans: [{ id: 9, title: "Eligibility unknown", isCurrent: true, primaryProgramEligibility: "unknown" }] })));
  renderToStaticMarkup(createElement(CurriculumExplorer));
  state.effects[1]();
  await vi.waitFor(() => expect(state.updates).toContain(false));
  expect(state.updates).not.toContain(9);
  expect(state.updates).toContain(null);
});

it("shows minimum credits without uncertainty warnings for an unselected variable-credit elective", () => {
  const slot = { kind: "elective-slot", id: "variable", semester: 1, title: "Variable-credit elective", category: "MT", creditOptions: [3, 4], ectsOptions: [5], courses: [{ code: "FIZ 362", title: "Physics", creditOptions: [4], ectsOptions: [5] }] };
  state.initialValues.set(7, { planId: 2, programCode: "FZT_LS", title: "Physics", planTitle: "Test plan", semesters: [{ semester: 1, items: [slot] }], prerequisites: {}, equivalenceRules: [], prerequisiteBranchesLoaded: ["FIZ"], prerequisiteDataAvailable: true, warnings: ["Official equivalence coverage is unavailable for this curriculum."], fetchedAt: "2026-01-01T00:00:00.000Z" });
  state.initialValues.set(8, { version: 3, planId: 2, courses: {} });
  const html = renderToStaticMarkup(createElement(CurriculumExplorer));
  expect(html).not.toContain("Some credit totals are unavailable because the applicable curriculum credits are uncertain.");
  expect(html).toContain("0.00 / 3.00");
  expect(html).not.toContain("NaN");
  expect(html).toContain("Official equivalence coverage is unavailable for this curriculum.");
});

it("keeps an available faculty's programs when another faculty endpoint fails", async () => {
  state.query = "program=BLGE_LS&plan=2340";
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.endsWith("/faculties")) return new Response(JSON.stringify({ faculties: [{ id: "10", name: "Business" }, { id: "28", name: "Computing" }] }));
    if (url.includes("facultyId=10")) throw new Error("Faculty service unavailable");
    return new Response(JSON.stringify({ programs: [{ code: "BLGE_LS", faculty: "Computing", major: "Computer Engineering" }] }));
  });
  renderToStaticMarkup(createElement(CurriculumExplorer));
  state.effects[0]();
  await vi.waitFor(() => expect(state.updates).toContain("BLGE_LS"));
  expect(state.updates).toContainEqual([{ id: "10", name: "Business" }]);
  // Re-render with the actual updates produced by the request, including its
  // successful empty page error, rather than injecting a warning-state index.
  state.hookIndex = 0;
  state.effects = [];
  const html = renderToStaticMarkup(createElement(CurriculumExplorer));
  expect(html).toContain("Programs could not be loaded.");
  expect(html).toContain("Business");
  expect(html).toContain("Computer Engineering");
});

it("shows equivalence evidence limitations before generating a semester plan", async () => {
  const { default: SmartSemesterPlanner } = await import("@/components/semester-planner/SmartSemesterPlanner");
  const enrollment = { id: "main", type: "main", facultyId: "1", facultyName: "Science", educationLevel: "undergraduate", planType: "undergraduate", programCode: "FZT_LS", programName: "Physics", curriculumPlanId: 2611, curriculumPlanName: "Plan" };
  state.profile = { ...EMPTY_PROFILE, programEnrollments: [enrollment] };
  state.initialValues.set(0, [{ enrollment, curriculum: { planId: 2611, programCode: "FZT_LS", title: "Physics", planTitle: "Plan", semesters: [], prerequisites: {}, equivalenceRules: [], prerequisiteBranchesLoaded: [], prerequisiteDataAvailable: true, warnings: ["Official equivalence coverage is unavailable for this curriculum."], fetchedAt: "2026-01-01T00:00:00.000Z" }, progress: { version: 3, planId: 2611, courses: {} } }]);
  state.initialValues.set(1, false);
  const html = renderToStaticMarkup(createElement(SmartSemesterPlanner));
  expect(html).toContain("Official equivalence coverage is unavailable for this curriculum.");
});
