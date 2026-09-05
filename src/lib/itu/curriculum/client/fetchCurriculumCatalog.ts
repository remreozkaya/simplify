import { cache } from "react";

import { requestCurriculumPage } from "@/lib/itu/curriculum/client/requestCurriculumPage";
import { ITU_OBS_ORIGIN } from "@/lib/itu/constants";

export const fetchCurriculumIndexPage = cache(() => requestCurriculumPage("/public/DersPlan/"));

export const fetchFacultyPrograms = cache(async (facultyId: string, obsPlanType: string): Promise<unknown> => {
  const response = await fetch(`${ITU_OBS_ORIGIN}/public/DersPlan/GetAkademikProgramByBirimIdAndPlanTipi`, {
    method: "POST",
    body: new URLSearchParams({ birimId: facultyId, planTipiKodu: obsPlanType }),
    headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
    next: { revalidate: 86_400 },
  });
  if (!response.ok) throw new Error(`İTÜ OBS returned ${response.status}.`);
  return response.json();
});
