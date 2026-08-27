import { requestCurriculumPage } from "@/lib/itu/curriculum/client/requestCurriculumPage";

export function fetchCurriculumPlansPage(programCode: string) {
  return requestCurriculumPage("/public/DersPlan/DersPlanlariList", {
    planTipiKodu: "lisans",
    programKodu: programCode,
  });
}
