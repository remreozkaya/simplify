import { officialAcademicLabel } from "@/lib/i18n/academicLabels";
import { fetchCurriculumPlansPage } from "@/lib/itu/curriculum/client/fetchCurriculumPlans";
import { parseCurriculumPlans } from "@/lib/itu/curriculum/parsers/parseCurriculumPlans";
import { ItuObsUpstreamError } from "@/lib/itu/errors";
import { baseProgramIdFromCode, isPrimaryProgramEligible, OBS_PLAN_TYPE } from "@/lib/itu/curriculum/catalog";
import type { ItuCurriculumPlan, ItuPlanType } from "@/lib/itu/curriculum/types";
import { fetchCurriculumDetailPage } from "@/lib/itu/curriculum/client/fetchCurriculumDetail";
import { parseCurriculumDetail } from "@/lib/itu/curriculum/parsers/parseCurriculumDetail";
import { readStoredCurriculumCatalog } from "@/lib/itu/curriculum/catalogStore";

export async function getCurriculumPlans(programCode: string, planType: ItuPlanType = "undergraduate", primaryProgramCode?: string): Promise<ItuCurriculumPlan[]> {
  try {
    const stored = await readStoredCurriculumCatalog();
    const storedPlans = stored?.plans.filter((plan) => plan.programCode === programCode && plan.planType === planType && plan.courses?.length).map((plan) => {
      const associatedPrimaryProgramCodes = plan.associatedPrimaryPrograms?.map((item) => item.code) ?? [];
      const associatedPrimaryProgramIds = associatedPrimaryProgramCodes.map(baseProgramIdFromCode);
      return { id: plan.id, programCode, title: plan.title, nameTr: plan.title, nameEn: officialAcademicLabel(plan.title, "en"), isCurrent: /(?:sonrası|after|ve sonrası|and after)/i.test(plan.title), planType, validityPeriod: plan.validityPeriod ?? undefined, sourceUrl: plan.sourceUrl, retrievedAt: plan.retrievedAt, associatedPrimaryProgramCodes, associatedPrimaryProgramIds, ...(associatedPrimaryProgramIds.length === 1 ? { primaryProgramId: associatedPrimaryProgramIds[0] } : {}), targetProgramId: baseProgramIdFromCode(programCode), ...(planType === "cap" ? { capPlanId: plan.id } : {}) };
    });
    const plans = storedPlans?.length ? storedPlans : parseCurriculumPlans(await fetchCurriculumPlansPage(programCode, OBS_PLAN_TYPE[planType]), programCode, planType);
    if (planType === "undergraduate" || !primaryProgramCode) return plans;
    // Titles and language suffixes are not authoritative program relationships.
    const checked = await Promise.all(plans.map(async (plan): Promise<ItuCurriculumPlan | null> => {
      let associatedPrimaryProgramCodes = plan.associatedPrimaryProgramCodes;
      if (!storedPlans?.length) {
        try {
          associatedPrimaryProgramCodes = parseCurriculumDetail(await fetchCurriculumDetailPage(plan.id), plan.id, programCode).associatedPrimaryProgramCodes;
        } catch {
          // A failed version must not hide other verified versions or grant access.
          associatedPrimaryProgramCodes = undefined;
        }
      }
      const eligibility = isPrimaryProgramEligible(associatedPrimaryProgramCodes, primaryProgramCode);
      if (eligibility === false) return null;
      return {
        ...plan,
        associatedPrimaryProgramCodes: associatedPrimaryProgramCodes ?? [],
        ...(eligibility === undefined ? { primaryProgramEligibility: "unknown" as const } : {}),
      };
    }));
    return checked.filter((plan): plan is NonNullable<typeof plan> => Boolean(plan));
  } catch (error: unknown) {
    if (error instanceof ItuObsUpstreamError) throw error;
    throw new ItuObsUpstreamError("İTÜ OBS returned an invalid curriculum plan list.", {
      cause: error,
    });
  }
}
