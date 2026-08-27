import { requestCurriculumPage } from "@/lib/itu/curriculum/client/requestCurriculumPage";

export function fetchUndergraduateProgramsPage() {
  return requestCurriculumPage("/public/GenelTanimlamalar/ProgramKodlariList", {
    programSeviyeTipiId: "2",
  });
}
