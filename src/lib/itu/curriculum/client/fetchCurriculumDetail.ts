import { requestCurriculumPage } from "@/lib/itu/curriculum/client/requestCurriculumPage";

export function fetchCurriculumDetailPage(planId: number) {
  return requestCurriculumPage(`/public/DersPlan/DersPlanDetay/${planId}`);
}
