import { describe, expect, it } from "vitest";

import { academicOfferingId, curriculumPlanKey } from "@/lib/itu/curriculum/catalog";
import { getFacultyPrograms } from "@/lib/itu/curriculum/services/getCurriculumCatalog";
import { getCurriculumPlans } from "@/lib/itu/curriculum/services/getCurriculumPlans";

describe("typed academic-program offerings", () => {
  it("keeps undergraduate, Double Major, and Minor offerings separate", async () => {
    const undergraduate = await getFacultyPrograms("10", "undergraduate");
    const doubleMajor = await getFacultyPrograms("10", "cap");
    const minor = await getFacultyPrograms("10", "yandal");

    expect(doubleMajor.find((program) => program.code === "ECNE_LS")).toMatchObject({
      id: academicOfferingId("10", "cap", "ECNE_LS"),
      officialProgramCode: "ECNE_LS",
      planType: "cap",
      nameEn: "Economics (English)",
    });
    expect(minor.find((program) => program.code === "ECN_YD")).toMatchObject({ planType: "yandal" });
    expect(undergraduate.every((program) => program.planType === "undergraduate")).toBe(true);
    expect(doubleMajor.every((program) => program.planType === "cap")).toBe(true);
    expect(minor.every((program) => program.planType === "yandal")).toBe(true);
  });

  it("loads only the Economics ÇAP plan associated with the selected main program", async () => {
    const plans = await getCurriculumPlans("ECNE_LS", "cap", "VBAE_LS");
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ id: 2644, planType: "cap", primaryProgramId: "VBA", targetProgramId: "ECN", capPlanId: 2644 });
    expect(plans[0].title).toContain("VBA_ECN ÇAP");
    expect(plans[0].associatedPrimaryProgramCodes).toContain("VBAE_LS");
    expect(plans.some((plan) => plan.planType === "undergraduate" || plan.planType === "yandal")).toBe(false);
  });

  it("loads only eligible Economics Yandal plans", async () => {
    const plans = await getCurriculumPlans("ECN_YD", "yandal", "MAT_LS");
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.every((plan) => plan.planType === "yandal")).toBe(true);
    expect(plans.every((plan) => plan.associatedPrimaryProgramCodes?.includes("MAT_LS"))).toBe(true);
  });

  it("includes plan type and target offering in curriculum-plan identity", () => {
    const base = { id: 42, programCode: "ECNE_LS" } as const;
    expect(curriculumPlanKey({ ...base, planType: "undergraduate" })).not.toBe(curriculumPlanKey({ ...base, planType: "cap" }));
    expect(curriculumPlanKey({ ...base, planType: "cap" })).not.toBe(curriculumPlanKey({ id: 42, programCode: "MAT_LS", planType: "cap" }));
  });
});
