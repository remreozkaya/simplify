import * as cheerio from "cheerio";

import type { ItuCurriculumPlan, ItuFaculty, ItuPlanType, ItuUndergraduateProgram } from "@/lib/itu/curriculum/types";

export const OBS_PLAN_TYPE: Record<ItuPlanType, string> = {
  undergraduate: "lisans",
  cap: "cap",
  yandal: "yandal",
};

export function enrollmentPlanType(type: "main" | "double-major" | "minor"): ItuPlanType {
  return type === "main" ? "undergraduate" : type === "double-major" ? "cap" : "yandal";
}

export function parseFaculties(html: string): ItuFaculty[] {
  const $ = cheerio.load(html);
  return $("#akademikBirimId option")
    .map((_, option) => {
      const name = $(option).text().replace(/\s+/g, " ").trim();
      return { id: String($(option).attr("value") ?? "").trim(), name, nameTr: name };
    })
    .get()
    .filter((faculty) => faculty.id && faculty.name)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export function parseFacultyPrograms(
  value: unknown,
  faculty: ItuFaculty,
  planType: ItuPlanType,
): ItuUndergraduateProgram[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const code = typeof record.programKodu === "string" ? record.programKodu.trim() : "";
    const name = typeof record.programAdi === "string" ? record.programAdi.replace(/\s+/g, " ").trim() : "";
    if (!code || !name) return [];
    const baseProgramId = baseProgramIdFromCode(code);
    const bilingualName = officialProgramNames(code, name);
    return [{
      id: academicOfferingId(faculty.id, planType, code),
      baseProgramId,
      officialProgramCode: code,
      code,
      name,
      ...bilingualName,
      major: name.replace(/\s+(?:Lisans|\(Yandal\))\s*$/iu, ""),
      facultyId: faculty.id,
      faculty: faculty.name,
      planType,
    }];
  });
}

/** Explicit names supplied by the official product requirements; all other names use source-language fallback. */
export function officialProgramNames(programCode: string, sourceName: string): { nameTr: string; nameEn?: string } {
  if (programCode === "ECNE_LS") return { nameTr: sourceName, nameEn: "Economics (English)" };
  if (programCode === "ECN_YD") return { nameTr: sourceName, nameEn: "Economics" };
  return { nameTr: sourceName };
}

export function baseProgramIdFromCode(programCode: string) {
  return programCode.trim().toLocaleUpperCase("tr-TR").replace(/_(?:LS|YD)$/u, "").replace(/E$/u, "");
}

export function academicOfferingId(facultyId: string, planType: ItuPlanType, officialProgramCode: string) {
  return `${facultyId}:${planType}:${officialProgramCode}`;
}

export function curriculumPlanKey(plan: Pick<ItuCurriculumPlan, "id" | "programCode" | "planType">) {
  return `${plan.planType}:${plan.programCode}:${plan.id}`;
}

export function primaryProgramStem(programCode: string) {
  return programCode.replace(/_LS$/i, "").replace(/E$/i, "");
}

export function isPrimaryProgramEligible(associated: readonly string[] | undefined, primaryProgramCode: string) {
  return !associated?.length || associated.includes(primaryProgramCode);
}
