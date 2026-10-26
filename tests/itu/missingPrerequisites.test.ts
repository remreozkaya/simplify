import { afterEach, describe, expect, it, vi } from "vitest";
import { getCurriculum } from "@/lib/itu/curriculum/services/getCurriculum";
import { emptyProgress } from "@/lib/curriculum/progress";
import { isCurriculumItemAvailableThisSemester } from "@/lib/curriculum/availability";
import { buildSemesterPlan } from "@/lib/semester-planner/planner";

const detail = `<div class="content-area"><h1>Languages</h1><h2>Current plan</h2>
  <table class="datalist"><thead><tr><th><h2>1. Semester</h2></th></tr></thead><tbody>
  <tr><td><a>ARB 101</a></td><td>Arabic</td><td>Turkish</td><td>Z</td><td>3</td><td>5</td></tr>
  </tbody></table></div>`;

afterEach(() => vi.unstubAllGlobals());

function upstream(branches: string, status = 200) {
  vi.stubGlobal("fetch", async (input: URL) => {
    const url = new URL(input);
    if (url.pathname.endsWith("DersOnsartList")) return new Response(branches);
    if (url.pathname.endsWith("OnsartAra")) return new Response("<table><tbody></tbody></table>", { status });
    if (url.pathname.includes("DersPlanDetay")) return new Response(detail);
    throw new Error(`Unexpected URL: ${url.pathname}`);
  });
}

const directory = '<select name="DersBransKoduId"><option value="1">ARB</option></select>';

async function results() {
  const curriculum = await getCurriculum(991, "TEST_LS");
  const progress = emptyProgress(991);
  const item = curriculum.semesters[0].items[0];
  const plan = buildSemesterPlan([{
    curriculum, progress,
    enrollment: { id: "main", type: "main", facultyId: "1", facultyName: "Languages", educationLevel: "undergraduate", planType: "undergraduate", programCode: "TEST_LS", programName: "Languages", curriculumPlanId: 991, curriculumPlanName: "Current plan" },
  }], { desiredCredits: 3, maxCourses: 1, priority: "balanced", availabilityMode: "published", knownBranchCodes: new Set(["ARB"]), offeredCourseCodes: new Set(["ARB 101"]), courseOfferings: [{
    branchCode: "ARB", courseId: "arabic", courseCode: "ARB 101", courseTitle: "Arabic", sections: [{ id: "section", crn: "00123", meetings: [{ id: "meeting", day: "Monday", startTime: "09:00", endTime: "10:00" }] }],
  }] });
  return { curriculum, plan, available: isCurriculumItemAvailableThisSemester(item, curriculum, progress, {}, new Set(["ARB 101"])) };
}

describe("missing official prerequisite pages", () => {
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
    expect(available).toBe(false);
    expect(plan.recommendations).toEqual([]);
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
