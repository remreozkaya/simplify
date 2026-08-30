import { requestCurriculumPage } from "@/lib/itu/curriculum/client/requestCurriculumPage";

export function fetchPrerequisiteBranchesPage() {
  return requestCurriculumPage("/public/GenelTanimlamalar/DersOnsartList");
}

export function fetchPrerequisitesPage(branchId: number) {
  return requestCurriculumPage("/public/GenelTanimlamalar/OnsartAra", {
    DersBransKoduId: String(branchId),
  });
}
