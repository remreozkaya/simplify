import { requestCurriculumPage } from "@/lib/itu/curriculum/client/requestCurriculumPage";
import { ItuObsUpstreamError } from "@/lib/itu/errors";

export function fetchPrerequisiteBranchesPage() {
  return requestCurriculumPage("/public/GenelTanimlamalar/DersOnsartList");
}

export async function fetchPrerequisitesPage(branchId: number) {
  try {
    return await requestCurriculumPage("/public/GenelTanimlamalar/OnsartAra", {
      DersBransKoduId: String(branchId),
    });
  } catch (error) {
    // An absent prerequisite page means no prerequisite; transport failures do not.
    if (error instanceof ItuObsUpstreamError && error.status === 404) return "";
    throw error;
  }
}
