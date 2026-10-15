import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { EMPTY_PROFILE } from "@/lib/profile/types";
import { translate } from "@/lib/i18n";
import { CURRENT_SEMESTER_STORAGE_KEY, serializeCurrentSemester } from "@/lib/curriculum/semesters";
import { SHARED_TRANSCRIPT_STORAGE_KEY, serializeSharedTranscript } from "@/lib/curriculum/transcriptStore";
import { CURRICULUM_PROGRESS_STORAGE_KEY } from "@/lib/curriculum/progress";
import { WEEKLY_PROGRAMS_STORAGE_KEY } from "@/lib/calendar/persistence";

const state = vi.hoisted(() => ({ language: "en" as "en" | "tr" }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));
vi.mock("@/components/profile/ProfileProvider", () => ({ useProfile: () => ({ profile: EMPTY_PROFILE }) }));
vi.mock("@/lib/i18n/client", () => ({ useLanguage: () => ({ language: state.language, t: (key: string, parameters?: Record<string, string | number>) => translate(state.language, key, parameters) }) }));
import SemestersPage from "@/app/(app)/semesters/page";

afterEach(() => vi.unstubAllGlobals());

it.each(["en", "tr"] as const)("renders saved projections before collapsible historical terms in %s", language => {
  state.language = language;
  const values: Record<string, string> = {
    [CURRENT_SEMESTER_STORAGE_KEY]: serializeCurrentSemester([{ courseCode: "MAT 104E", courseName: "Math II", credit: 4, grade: "AA" }]),
    [SHARED_TRANSCRIPT_STORAGE_KEY]: serializeSharedTranscript([
      { term: "202510", crn: "1", courseCode: "MAT 103E", courseName: "Math I", grade: "BA", countedCredit: 4, transcriptCredit: 4, calculated: true, completionStatus: "passed", source: "transcript" },
      { term: "202610", crn: "2", courseCode: "FIZ 101", courseName: "Physics I", grade: "BB", countedCredit: 3, transcriptCredit: 3, calculated: true, completionStatus: "passed", source: "transcript" },
    ]),
  };
  vi.stubGlobal("localStorage", { getItem: (key: string) => values[key] ?? null });
  const html = renderToStaticMarkup(createElement(SemestersPage));
  expect(html).toContain(translate(language, "navigation.semesters"));
  expect(html).toContain(translate(language, "semesters.gradeSelection", { code: "MAT 104E" }));
  expect(html).toContain('<option value="AA" selected="">AA</option>');
  expect(html).toContain(language === "en" ? "3.29" : "3,29");
  expect(html).toContain(translate(language, "semesters.currentOverallGpa"));
  expect(html).toContain(translate(language, "semesters.projectedOverallGpa"));
  expect(html).not.toContain('type="number"');
  expect(html).not.toContain(translate(language, "semesters.courseSelection", { row: 1 }));
  expect(html).not.toContain(translate(language, "semesters.creditSelection", { code: "MAT 104E" }));
  expect(html).not.toContain('type="search"');
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain(translate(language, "semesters.addCourseButton"));
  expect(html.indexOf("Math II")).toBeLessThan(html.indexOf("2025-2026"));
  expect(html.indexOf("2025-2026")).toBeLessThan(html.indexOf("2024-2025"));
  expect(html).not.toContain("202610");
  expect(html).not.toContain(translate(language, "semesters.projectionHelp"));
  expect(html).not.toContain(translate(language, "semesters.historyHelp"));
  expect(html).toContain(translate(language, "semesters.importWeekly").replaceAll("'", "&#x27;"));
  expect(html.match(/<details\b/g)).toHaveLength(3);
  expect(html.match(/<details open=""/g)).toHaveLength(1);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
});

it("provides planner and transcript links and a collapsed course picker for an empty workspace", () => {
  vi.stubGlobal("localStorage", { getItem: () => null });
  const html = renderToStaticMarkup(createElement(SemestersPage));
  expect(html).toContain('href="/weekly-planner"');
  expect(html).toContain('href="/graduation-calculator"');
  expect(html).toContain(translate(state.language, "semesters.emptyCurrent"));
});

it("shows migrated legacy history when the shared transcript is malformed", () => {
  const record = { term: "202410", crn: "1", courseCode: "MAT 103E", courseName: "Legacy mathematics", grade: "BA", countedCredit: 4, transcriptCredit: 4, calculated: true, completionStatus: "passed", source: "transcript" };
  vi.stubGlobal("localStorage", { getItem: (key: string) => key === SHARED_TRANSCRIPT_STORAGE_KEY ? "broken" : key === CURRICULUM_PROGRESS_STORAGE_KEY ? JSON.stringify({ plans: { "1": { importedCourses: [record] } } }) : null });
  expect(renderToStaticMarkup(createElement(SemestersPage))).toContain("Legacy mathematics");
});

it("offers saved weekly plans with an enabled import button", () => {
  state.language = "en";
  const programs = ["Plan A", "Plan B"].map(name => ({ id: name, name, updatedAt: "", courseSelections: [], courseBlocks: [{ id: name, code: "MAT 104E", title: "Math II", day: "Monday", startTime: "09:00", endTime: "10:00" }] }));
  vi.stubGlobal("localStorage", { getItem: (key: string) => key === WEEKLY_PROGRAMS_STORAGE_KEY ? JSON.stringify(programs) : null });
  const html = renderToStaticMarkup(createElement(SemestersPage));
  expect(html).toContain('aria-label="Weekly plan to import"');
  expect(html).toContain("Plan A");
  expect(html).toContain("Plan B");
  expect(html).not.toContain('disabled=""');
});
