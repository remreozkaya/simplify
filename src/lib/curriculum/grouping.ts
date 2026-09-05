import { normalizeCourseCode } from "@/lib/itu/courseCode.mjs";
import type { ItuCurriculum, ItuCurriculumItem, ItuPlanType } from "@/lib/itu/curriculum/types";

export const FALLBACK_GROUP = 99;

export function courseCodeGroup(code: string): number | null {
  const normalized = normalizeCourseCode(code).replace(/\s+/g, "");
  const match = normalized.match(/^[^\d]*(\d)/);
  return match ? Number(match[1]) : null;
}

export function curriculumSectionLabel(planType: ItuPlanType | undefined, section: number) {
  if (!planType || planType === "undergraduate") return `Semester ${section}`;
  if (section === FALLBACK_GROUP) return "Electives and Other Requirements";
  const suffix = section === 1 ? "st" : section === 2 ? "nd" : section === 3 ? "rd" : "th";
  return `${section}${suffix} Group`;
}

export function groupCurriculum(curriculum: ItuCurriculum): ItuCurriculum {
  if (!curriculum.planType || curriculum.planType === "undergraduate") return curriculum;
  const groups = new Map<number, ItuCurriculumItem[]>();
  curriculum.semesters.flatMap((section) => section.items).forEach((item) => {
    const group = item.kind === "course" ? courseCodeGroup(item.code) ?? FALLBACK_GROUP : FALLBACK_GROUP;
    groups.set(group, [...(groups.get(group) ?? []), { ...item, semester: group }]);
  });
  const semesters = [...groups.entries()].sort(([a], [b]) => a - b).map(([semester, items]) => ({
    semester,
    items: items.sort((a, b) => {
      const left = a.kind === "course" ? normalizeCourseCode(a.code) : a.title;
      const right = b.kind === "course" ? normalizeCourseCode(b.code) : b.title;
      return left.localeCompare(right, "en", { numeric: true });
    }),
  }));
  return { ...curriculum, semesters };
}
