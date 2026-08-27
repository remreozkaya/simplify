import { fetchCurriculumPlansPage } from "@/lib/itu/curriculum/client/fetchCurriculumPlans";
import { parseCurriculumPlans } from "@/lib/itu/curriculum/parsers/parseCurriculumPlans";
import { ItuObsUpstreamError } from "@/lib/itu/errors";

export async function getCurriculumPlans(programCode: string) {
  try {
    return parseCurriculumPlans(await fetchCurriculumPlansPage(programCode), programCode);
  } catch (error: unknown) {
    if (error instanceof ItuObsUpstreamError) throw error;
    throw new ItuObsUpstreamError("İTÜ OBS returned an invalid curriculum plan list.", {
      cause: error,
    });
  }
}
