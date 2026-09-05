import { fetchCurriculumPlansPage } from "@/lib/itu/curriculum/client/fetchCurriculumPlans";
import { parseCurriculumPlans } from "@/lib/itu/curriculum/parsers/parseCurriculumPlans";
import { ItuObsUpstreamError } from "@/lib/itu/errors";
import { baseProgramIdFromCode, isPrimaryProgramEligible, OBS_PLAN_TYPE, primaryProgramStem } from "@/lib/itu/curriculum/catalog";
import type { ItuPlanType } from "@/lib/itu/curriculum/types";
import { fetchCurriculumDetailPage } from "@/lib/itu/curriculum/client/fetchCurriculumDetail";
import { parseCurriculumDetail } from "@/lib/itu/curriculum/parsers/parseCurriculumDetail";
import { readStoredCurriculumCatalog } from "@/lib/itu/curriculum/catalogStore";

export async function getCurriculumPlans(programCode: string, planType: ItuPlanType = "undergraduate", primaryProgramCode?: string) {
  try {
    const stored = await readStoredCurriculumCatalog();
    const storedPlans = stored?.plans.filter((plan) => plan.programCode === programCode && plan.planType === planType && plan.courses?.length).map((plan) => {
      const associatedPrimaryProgramCodes = plan.associatedPrimaryPrograms?.map((item) => item.code) ?? [];
      const associatedPrimaryProgramIds = associatedPrimaryProgramCodes.map(baseProgramIdFromCode);
      return { id: plan.id, programCode, title: plan.title, nameTr: plan.title, nameEn: undefined, isCurrent: /(?:sonrası|after|ve sonrası|and after)/i.test(plan.title), planType, validityPeriod: plan.validityPeriod ?? undefined, sourceUrl: plan.sourceUrl, retrievedAt: plan.retrievedAt, associatedPrimaryProgramCodes, associatedPrimaryProgramIds, ...(associatedPrimaryProgramIds.length === 1 ? { primaryProgramId: associatedPrimaryProgramIds[0] } : {}), targetProgramId: baseProgramIdFromCode(programCode), ...(planType === "cap" ? { capPlanId: plan.id } : {}) };
    });
    const plans = storedPlans?.length ? storedPlans : parseCurriculumPlans(await fetchCurriculumPlansPage(programCode, OBS_PLAN_TYPE[planType]), programCode, planType);
    if (planType === "undergraduate" || !primaryProgramCode) return plans;
    const candidates = planType === "cap" && !storedPlans?.length
      ? plans.filter((plan) => plan.title.toLocaleUpperCase("tr-TR").startsWith(`${primaryProgramStem(primaryProgramCode)}_`))
      : plans;
    const checked = await Promise.all(candidates.map(async (plan) => {
      if (storedPlans?.length) return isPrimaryProgramEligible(plan.associatedPrimaryProgramCodes, primaryProgramCode) ? plan : null;
      const detail = parseCurriculumDetail(await fetchCurriculumDetailPage(plan.id), plan.id, programCode);
      return isPrimaryProgramEligible(detail.associatedPrimaryProgramCodes, primaryProgramCode)
        ? { ...plan, associatedPrimaryProgramCodes: detail.associatedPrimaryProgramCodes ?? [] }
        : null;
    }));
    return checked.filter((plan): plan is NonNullable<typeof plan> => Boolean(plan));
  } catch (error: unknown) {
    if (error instanceof ItuObsUpstreamError) throw error;
    throw new ItuObsUpstreamError("İTÜ OBS returned an invalid curriculum plan list.", {
      cause: error,
    });
  }
}
