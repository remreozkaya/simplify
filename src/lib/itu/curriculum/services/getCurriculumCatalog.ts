import { academicOfferingId, baseProgramIdFromCode, OBS_PLAN_TYPE, officialProgramNames, parseFaculties, parseFacultyPrograms } from "@/lib/itu/curriculum/catalog";
import { fetchCurriculumIndexPage, fetchFacultyPrograms } from "@/lib/itu/curriculum/client/fetchCurriculumCatalog";
import type { ItuFaculty, ItuPlanType } from "@/lib/itu/curriculum/types";
import { ItuObsUpstreamError } from "@/lib/itu/errors";
import { readStoredCurriculumCatalog } from "@/lib/itu/curriculum/catalogStore";

export async function getCurriculumFaculties(): Promise<ItuFaculty[]> {
  const stored = await readStoredCurriculumCatalog();
  if (stored) return stored.faculties;
  try {
    const faculties = parseFaculties(await fetchCurriculumIndexPage());
    if (!faculties.length) throw new Error("No faculties");
    return faculties;
  } catch (error) {
    throw new ItuObsUpstreamError("İTÜ OBS faculty catalog is unavailable.", { cause: error });
  }
}

export async function getFacultyPrograms(facultyId: string, planType: ItuPlanType) {
  const stored = await readStoredCurriculumCatalog();
  if (stored) return stored.programs.filter((item) => item.facultyId === facultyId && item.planType === planType).map((item) => ({
    ...item,
    id: academicOfferingId(item.facultyId, item.planType, item.code),
    baseProgramId: baseProgramIdFromCode(item.code),
    officialProgramCode: item.code,
    ...officialProgramNames(item.code, item.name),
    major: item.name.replace(/\s+(?:Lisans|\(Yandal\))\s*$/iu, ""),
    faculty: item.facultyName,
  }));
  const faculty = (await getCurriculumFaculties()).find((item) => item.id === facultyId);
  if (!faculty) return [];
  try {
    return parseFacultyPrograms(await fetchFacultyPrograms(facultyId, OBS_PLAN_TYPE[planType]), faculty, planType);
  } catch (error) {
    throw new ItuObsUpstreamError("İTÜ OBS program catalog is unavailable.", { cause: error });
  }
}
