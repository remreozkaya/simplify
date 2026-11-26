import { requestCurriculumPage } from "@/lib/itu/curriculum/client/requestCurriculumPage";
import { ITU_PREREQUISITE_DIRECTORY_PATH } from "@/lib/itu/constants";
import { ItuObsUpstreamError } from "@/lib/itu/errors";

export function fetchPrerequisiteBranchesPage() {
  return requestCurriculumPage(ITU_PREREQUISITE_DIRECTORY_PATH);
}

export async function fetchPrerequisitesPage(branchId: number) {
  try {
    return await requestCurriculumPage("/public/GenelTanimlamalar/OnsartAra", {
      DersBransKoduId: String(branchId),
    });
  } catch (error) {
    // An absent prerequisite page means no prerequisite; transport failures do not.
    if (error instanceof ItuObsUpstreamError && error.status === 404) return null;
    throw error;
  }
}
