import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CurriculumWarnings from "@/components/curriculum/CurriculumWarnings";
import { getCurriculum } from "@/lib/itu/curriculum/services/getCurriculum";
import { emptyProgress } from "@/lib/curriculum/progress";
import { courseBranch, isCurriculumItemAvailableThisSemester } from "@/lib/curriculum/availability";
import { buildSemesterPlan } from "@/lib/semester-planner/planner";
import type { ItuCurriculum } from "@/lib/itu/curriculum/types";
import type { CourseProgress, CurriculumProgress } from "@/lib/curriculum/types";

vi.mock("@/lib/i18n/client", () => ({ useLanguage: () => ({ language: "tr" }) }));

const detail = `<div class="content-area"><h1>Languages</h1><h2>Current plan</h2>
  <table class="datalist"><thead><tr><th><h2>1. Semester</h2></th></tr></thead><tbody>
  <tr><td><a>ARB 101</a></td><td>Arabic</td><td>Turkish</td><td>Z</td><td>3</td><td>5</td></tr>
  </tbody></table></div>`;

afterEach(() => vi.unstubAllGlobals());

function upstream(branches: string, status = 200, directoryStatus = 200) {
  vi.stubGlobal("fetch", async (input: URL) => {
    const url = new URL(input);
    if (url.pathname.endsWith("DersOnsartList")) return new Response(branches, { status: directoryStatus });
    if (url.pathname.endsWith("OnsartAra")) return new Response("<table><tbody></tbody></table>", { status });
    if (url.pathname.includes("DersPlanDetay")) return new Response(detail);
    throw new Error(`Unexpected URL: ${url.pathname}`);
  });
}

const directory = '<select name="DersBransKoduId"><option value="1">ARB</option></select>';

function planFor(curriculum: ItuCurriculum, progress: CurriculumProgress, offeredCodes: string[]) {
  return buildSemesterPlan([{
    curriculum, progress,
    enrollment: { id: "main", type: "main", facultyId: "1", facultyName: "Languages", educationLevel: "undergraduate", planType: "undergraduate", programCode: "TEST_LS", programName: "Languages", curriculumPlanId: 991, curriculumPlanName: "Current plan" },
  }], { desiredCredits: 3, maxCourses: 1, priority: "balanced", availabilityMode: "published", knownBranchCodes: new Set(offeredCodes.map(courseBranch)), offeredCourseCodes: new Set(offeredCodes), courseOfferings: offeredCodes.map((code, index) => ({
    branchCode: courseBranch(code), courseId: code, courseCode: code, courseTitle: code,
    sections: [{ id: code, crn: String(index + 123), meetings: [{ id: code, day: "Monday", startTime: "09:00", endTime: "10:00" }] }],
  })) });
}

async function results() {
  const curriculum = await getCurriculum(991, "TEST_LS");
  const progress = emptyProgress(991);
  const item = curriculum.semesters[0].items[0];
  const plan = planFor(curriculum, progress, ["ARB 101"]);
  return { curriculum, plan, available: isCurriculumItemAvailableThisSemester(item, curriculum, progress, {}, new Set(["ARB 101"])) };
}

describe("missing official prerequisite pages", () => {
  it.each([
    { label: "identified directory and course failures", brokenOption: "BLG", extraRow: '<tr><td><a>MAT 301</a></td><td>Truncated course row</td></tr>', unmatchedAvailable: true },
    { label: "unidentified directory and course failures", brokenOption: "?", extraRow: '<tr><td><a>?</a><br><a>MAT 104</a></td><td>Only one code is readable</td><td>MAT 101 MIN. DD</td><td></td></tr>', unmatchedAvailable: false },
  ])("keeps valid rules and the full curriculum with $label", async ({ brokenOption, extraRow, unmatchedAvailable }) => {
    const codes = ["MAT 102", "MAT 103", "MAT 104", "MAT 301", "BLG 101", "FIZ 101"];
    vi.stubGlobal("fetch", async (input: URL) => {
      const url = new URL(input);
      if (url.pathname.endsWith("DersOnsartList")) {
        return new Response(`<select name="DersBransKoduId"><option value="bad">${brokenOption}</option><option value="26">MAT</option></select>`);
      }
      if (url.pathname.endsWith("OnsartAra") && url.searchParams.get("DersBransKoduId") === "26") {
        return new Response(`<table><tbody>
          <tr><td><a>MAT 102</a></td><td>Valid rule</td><td>MAT 101 MIN. DD</td><td></td></tr>
          <tr><td><a>MAT 103</a></td><td>Unreadable expression</td><td>Instructor approval</td><td></td></tr>
          ${extraRow}
        </tbody></table>`);
      }
      if (url.pathname.includes("DersPlanDetay")) {
        return new Response(detail.replace(/<tr><td>.*?<\/tr>/, codes.map(code =>
          `<tr><td><a>${code}</a></td><td>${code}</td><td>Turkish</td><td>Z</td><td>3</td><td>5</td></tr>`,
        ).join("")));
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const curriculum = await getCurriculum(991, "TEST_LS");
    const progress = { ...emptyProgress(991), courses: { "MAT 101": { state: "passed" as const, grade: "DD" as const } } };
    const items = curriculum.semesters[0].items;
    expect(items.map(item => item.kind === "course" && item.code)).toEqual(codes);
    expect(curriculum.prerequisites["MAT 102"]?.expression).toEqual({ kind: "course", courseCode: "MAT 101", minimumGrade: "DD" });
    expect(curriculum.prerequisites["MAT 103"]?.expression).toEqual({ kind: "unknown", raw: "Instructor approval" });
    const available = (index: number, resolved: Record<string, CourseProgress> = progress.courses) =>
      isCurriculumItemAvailableThisSemester(items[index], curriculum, progress, resolved, new Set(codes));
    expect(available(0)).toBe(true);
    expect(available(0, {})).toBe(false);
    expect(available(1)).toBe(false);
    expect(available(2)).toBe(true);
    expect(available(3)).toBe(false);
    expect(available(4)).toBe(false);
    expect(available(5)).toBe(unmatchedAvailable);
    const plan = planFor(curriculum, progress, [codes[0], codes[1], ...codes.slice(3, 5)]);
    expect(plan.recommendations).toMatchObject([{ code: "MAT 102", eligibility: "confirmed" }]);
    expect(plan.prerequisiteReviewCourses.map(course => course.code)).toEqual(
      unmatchedAvailable ? ["BLG 101", "MAT 103", "MAT 301"] : ["BLG 101", "FIZ 101", "MAT 103", "MAT 301"],
    );
    expect(plan.notices.map(notice => notice.kind)).toContain("eligibility-unknown");
  });

  it("keeps prerequisite eligibility unknown when a branch returns an unrelated HTTP 200 page", async () => {
    upstream(directory);
    const upstreamFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: URL) => new URL(input).pathname.endsWith("OnsartAra")
      ? new Response("<html>Service temporarily unavailable</html>")
      : upstreamFetch(input));
    const { available, plan } = await results();
    expect(available).toBe(false);
    expect(plan.notices.map(notice => notice.kind)).toContain("eligibility-unknown");
  });

  it("loads published MAT and U_IPF-B prerequisites from the same directory", async () => {
    const planDetail = detail.replace("ARB 101", "MAT 102").replace("Arabic", "Mathematics")
      .replace("</tbody>", "<tr><td><a>U_IPF-B09E</a></td><td>Engineering Mathematics</td><td>English</td><td>Z</td><td>3</td><td>5</td></tr></tbody>");
    const fetch = vi.fn(async (input: URL) => {
      const url = new URL(input);
      if (url.pathname.endsWith("DersOnsartList")) {
        return new Response('<select name="DersBransKoduId"><option value="26">MAT</option><option value="335">U_ARCH</option><option value="398">U_IPF-B</option></select>');
      }
      if (url.pathname.endsWith("OnsartAra") && url.searchParams.get("DersBransKoduId") === "26") {
        return new Response(`<table><tbody><tr>
          <td><a>MAT 102</a><br><a>MAT 102E</a></td><td>Mathematics II</td>
          <td><span>(</span><span>MAT 101</span><span>MIN. DD</span><span>Or</span><span>MAT 101E</span><span>MIN. DD</span><span>)</span><br>
          <span>Or ( MAT 103 MIN. DD Or MAT 103E MIN. DD )</span><br>
          <span>Or ( MAT 112 MIN. DD Or MAT 112E MIN. DD )</span></td><td></td>
        </tr></tbody></table>`);
      }
      if (url.pathname.endsWith("OnsartAra") && url.searchParams.get("DersBransKoduId") === "398") {
        return new Response(`<table><tbody><tr>
          <td><a>U_IPF-B 09E</a></td><td>Engineering Mathematics</td>
          <td>U_IPF-B 06E MIN. DD Veya U_IPF-B 05E MIN. DD</td><td></td>
        </tr></tbody></table>`);
      }
      if (url.pathname.includes("DersPlanDetay")) return new Response(planDetail);
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetch);

    const curriculum = await getCurriculum(991, "TEST_LS");

    expect(curriculum.prerequisites["MAT 102"]).toMatchObject({
      rawExpression: "( MAT 101 MIN. DD Or MAT 101E MIN. DD ) Or ( MAT 103 MIN. DD Or MAT 103E MIN. DD ) Or ( MAT 112 MIN. DD Or MAT 112E MIN. DD )",
      expression: { kind: "or" },
    });
    expect(curriculum.prerequisites["U_IPF-B 09E"]?.expression).toEqual({
      kind: "or",
      operands: [
        { kind: "course", courseCode: "U_IPF-B 06E", minimumGrade: "DD" },
        { kind: "course", courseCode: "U_IPF-B 05E", minimumGrade: "DD" },
      ],
    });
    expect(curriculum.prerequisiteBranchesLoaded).toEqual(["MAT", "U_IPF-B"]);
    expect(curriculum.prerequisiteDataAvailable).toBe(true);
    expect(curriculum.warnings).toEqual([]);
  });

  it.each(["absent branch", "404 page", "absent course"])("treats %s as no prerequisite without downstream eligibility warnings", async mode => {
    upstream(mode === "absent branch" ? '<select name="DersBransKoduId"><option value="2">MAT</option></select>' : directory, mode === "404 page" ? 404 : 200);
    const { curriculum, plan, available } = await results();
    expect(curriculum.prerequisites).toEqual({});
    expect(curriculum.warnings.filter(warning => /prerequisite/i.test(warning))).toEqual([]);
    expect(available).toBe(true);
    expect(plan.recommendations).toMatchObject([{ code: "ARB 101", eligibility: "confirmed" }]);
    expect(plan.notices.map(notice => notice.kind)).not.toContain("eligibility-unknown");
  });

  it("retains unknown eligibility for an actual prerequisite server failure", async () => {
    upstream(directory, 503);
    const { curriculum, plan, available } = await results();
    expect(curriculum.warnings).toContain("Prerequisites for ARB could not be loaded.");
    const html = renderToStaticMarkup(createElement(CurriculumWarnings, { warnings: curriculum.warnings }));
    expect(html).toContain(">ARB dersleri için ön koşul bilgileri yüklenemedi.</li>");
    expect(html).not.toContain("Ayrıntılar");
    expect(available).toBe(false);
    expect(plan.recommendations).toEqual([]);
    expect(plan.notices.map(notice => notice.kind)).toContain("eligibility-unknown");
  });

  it("renders a Turkish warning when the prerequisite directory returns HTTP 503", async () => {
    upstream(directory, 200, 503);
    const { curriculum, plan, available } = await results();
    const html = renderToStaticMarkup(createElement(CurriculumWarnings, { warnings: curriculum.warnings }));
    expect(html).toContain(">Ön koşul bilgileri geçici olarak kullanılamıyor.</li>");
    expect(html).not.toContain("Ayrıntılar");
    expect(curriculum.prerequisiteDataAvailable).toBe(false);
    expect(available).toBe(false);
    expect(plan.notices.map(notice => notice.kind)).toContain("eligibility-unknown");
  });

  it.each([
    "<html>Service temporarily unavailable</html>",
    '<select name="DersBransKoduId"><option value="bad">ARB</option></select>',
  ])("does not mistake malformed directory data for missing prerequisite pages: %s", async html => {
    upstream(html);
    const { curriculum, available } = await results();
    expect(curriculum.warnings).toContain("Prerequisite information is temporarily unavailable.");
    expect(available).toBe(false);
  });

  it("retains unknown eligibility when the prerequisite request times out", async () => {
    upstream(directory);
    const successfulFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: URL) => {
      if (new URL(input).pathname.endsWith("OnsartAra")) throw new Error("Request timed out");
      return successfulFetch(input);
    });
    const { curriculum, plan, available } = await results();
    expect(curriculum.warnings).toContain("Prerequisites for ARB could not be loaded.");
    expect(available).toBe(false);
    expect(plan.notices.map(notice => notice.kind)).toContain("eligibility-unknown");
  });
});
