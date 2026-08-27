import { requestCurriculumPage } from "@/lib/itu/curriculum/client/requestCurriculumPage";

export function fetchElectiveGroupPage(groupId: number) {
  return requestCurriculumPage("/public/DersPlan/_DersGrupSearch", {
    grupId: String(groupId),
  });
}
