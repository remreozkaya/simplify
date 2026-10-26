import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn(), programs: vi.fn(), plans: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser, updateUser: mocks.updateUser } }) }));
vi.mock("@/lib/itu/curriculum/services/getCurriculumCatalog", () => ({ getFacultyPrograms: mocks.programs }));
vi.mock("@/lib/itu/curriculum/services/getCurriculumPlans", () => ({ getCurriculumPlans: mocks.plans }));
import { saveProfileAction } from "@/app/(app)/profile/actions";
import { localizeRuntimeMessage } from "@/lib/i18n";

const main = { id: "main", type: "main", facultyId: "2", facultyName: "Science", educationLevel: "undergraduate", planType: "undergraduate", programCode: "MAIN_LS", programName: "Main", curriculumPlanId: 1, curriculumPlanName: "Main plan" };
const secondary = { ...main, id: "secondary", type: "minor", planType: "yandal", programCode: "TARGET_YD", programName: "Target", curriculumPlanId: 2, primaryProgramCode: "MAIN_LS" };
const input = { name: "Student", surname: "One", nickname: "", birthdate: "", programEnrollments: [main, secondary] };
const unknownMessage = "Eligibility for the selected secondary curriculum could not be verified. Review the official main-program associations.";

describe("secondary eligibility is verified again when saving", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "student", email_confirmed_at: "2026-01-01" } }, error: null });
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.programs.mockImplementation(async (_faculty, type) => [{ code: type === "undergraduate" ? "MAIN_LS" : "TARGET_YD", name: "Official program" }]);
    mocks.plans.mockImplementation(async (_code, type) => [{ id: type === "undergraduate" ? 1 : 2, title: "Official plan", associatedPrimaryProgramCodes: [] }]);
  });

  it("does not authorize a secondary plan with missing association evidence", async () => {
    expect(await saveProfileAction(input)).toMatchObject({ status: "error", message: unknownMessage });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it.each(["Student", "Different name"])("saves the same verified relationship for %s", async name => {
    mocks.plans.mockImplementation(async (_code, type) => [{ id: type === "undergraduate" ? 1 : 2, title: "Official plan", associatedPrimaryProgramCodes: ["MAIN_LS"] }]);
    const result = await saveProfileAction({ ...input, name });
    expect(result).toMatchObject({ status: "success", profile: { name, programEnrollments: [{ programCode: "MAIN_LS" }, { programCode: "TARGET_YD", associatedPrimaryProgramCodes: ["MAIN_LS"] }] } });
  });

  it("localizes uncertainty in both directions without declaring ineligibility", () => {
    const tr = "Seçilen ikincil ders planı için uygunluk doğrulanamadı. Resmî anadal programı ilişkilerini inceleyin.";
    expect(localizeRuntimeMessage("tr", unknownMessage)).toBe(tr);
    expect(localizeRuntimeMessage("en", tr)).toBe(unknownMessage);
  });
});
