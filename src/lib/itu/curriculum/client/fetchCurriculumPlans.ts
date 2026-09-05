import { requestCurriculumPage } from "@/lib/itu/curriculum/client/requestCurriculumPage";

export function fetchCurriculumPlansPage(programCode: string, obsPlanType = "lisans") {
  return requestCurriculumPage("/public/DersPlan/DersPlanlariList", {
    PlanTipiKodu: obsPlanType,
    programKodu: programCode,
  });
}
