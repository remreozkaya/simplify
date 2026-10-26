import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/itu/curriculum/catalogStore", () => ({ readStoredCurriculumCatalog: vi.fn() }));
vi.mock("@/lib/itu/curriculum/client/fetchCurriculumPlans", () => ({ fetchCurriculumPlansPage: vi.fn() }));
vi.mock("@/lib/itu/curriculum/client/fetchCurriculumDetail", () => ({ fetchCurriculumDetailPage: vi.fn() }));

import { readStoredCurriculumCatalog } from "@/lib/itu/curriculum/catalogStore";
import { fetchCurriculumPlansPage } from "@/lib/itu/curriculum/client/fetchCurriculumPlans";
import { fetchCurriculumDetailPage } from "@/lib/itu/curriculum/client/fetchCurriculumDetail";
import { getCurriculumPlans } from "@/lib/itu/curriculum/services/getCurriculumPlans";

// Synthetic relationships are explicit in the official-shaped detail table.
// A title is presentation, and cannot establish academic eligibility.
const list = `<table><tbody>
  <tr><td><a href="/DersPlanDetay/71">Open</a></td><td>Shared curriculum 2026</td></tr>
  <tr><td><a href="/DersPlanDetay/72">Open</a></td><td>ARCH_TARGET misleading title</td></tr>
  <tr><td><a href="/DersPlanDetay/73">Open</a></td><td>Unverified plan</td></tr>
</tbody></table>`;
const detail = (codes: string[]) => `<div class="content-area"><h2>Curriculum</h2>
  <table id="dersPlanProgramList"><tbody>${codes.map(code => `<tr><td>${code}</td><td>Program</td></tr>`).join("")}</tbody></table></div>`;

describe("secondary curricula use explicit main-program relationships", () => {
  beforeEach(() => {
    vi.mocked(readStoredCurriculumCatalog).mockResolvedValue(null);
    vi.mocked(fetchCurriculumPlansPage).mockResolvedValue(list);
    vi.mocked(fetchCurriculumDetailPage).mockImplementation(async id => detail(id === 71 ? ["ARCH_LS", "CHEM_LS"] : id === 72 ? ["OTHER_LS"] : []));
  });

  it.each(["ARCH_LS", "CHEM_LS"])("retains eligible cap plans regardless of title for %s", async main => {
    const plans = await getCurriculumPlans("TARGET_LS", "cap", main);
    expect(plans.map(plan => plan.id)).toContain(71);
    expect(plans.map(plan => plan.id)).not.toContain(72);
    expect(plans.find(plan => plan.id === 71)?.associatedPrimaryProgramCodes).toEqual(["ARCH_LS", "CHEM_LS"]);
  });

  it.each(["cap", "yandal"] as const)("preserves missing %s association data as unknown", async type => {
    const plans = await getCurriculumPlans("TARGET_LS", type, "ARCH_LS");
    expect(plans.find(plan => plan.id === 73)).toMatchObject({ primaryProgramEligibility: "unknown" });
    expect(plans.map(plan => plan.id)).not.toContain(72);
  });

  it("uses the same uncertainty rule for bundled minor versions", async () => {
    vi.mocked(readStoredCurriculumCatalog).mockResolvedValue({ version: 1, faculties: [], programs: [], plans: [{
      id: 73, programCode: "TARGET_YD", programName: "Target", facultyId: "9", planType: "yandal",
      title: "Minor", retrievedAt: "2026-01-01", sourceUrl: "https://obs.itu.edu.tr/plan/73", courses: [{}],
    }] });
    expect(await getCurriculumPlans("TARGET_YD", "yandal", "ARCH_LS")).toMatchObject([{ id: 73, primaryProgramEligibility: "unknown" }]);
  });

  it("preserves outcomes when synthetic identifiers are consistently renamed", async () => {
    vi.mocked(fetchCurriculumDetailPage).mockImplementation(async id => detail(id === 71 ? ["RENAMED_LS"] : id === 72 ? ["EXCLUDED_LS"] : []));
    const plans = await getCurriculumPlans("NEW_TARGET_LS", "cap", "RENAMED_LS");
    expect(plans.map(plan => plan.id).sort()).toEqual([71, 73]);
  });

  it("retains verified plans when another version's association page is unavailable", async () => {
    vi.mocked(fetchCurriculumDetailPage).mockImplementation(async id => {
      if (id === 73) throw new Error("OBS unavailable for this version");
      return detail(id === 71 ? ["ARCH_LS"] : ["OTHER_LS"]);
    });
    const plans = await getCurriculumPlans("TARGET_LS", "cap", "ARCH_LS");
    expect(plans.map(plan => plan.id).sort()).toEqual([71, 73]);
    expect(plans.find(plan => plan.id === 71)?.primaryProgramEligibility).toBeUndefined();
    expect(plans.find(plan => plan.id === 73)?.primaryProgramEligibility).toBe("unknown");
  });
});
