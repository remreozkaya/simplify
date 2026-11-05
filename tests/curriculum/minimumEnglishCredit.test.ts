import { expect, it } from "vitest";
import { curriculumTotals } from "@/lib/curriculum/graduation";
import { emptyProgress } from "@/lib/curriculum/progress";
import type { ItuCurriculum } from "@/lib/itu/curriculum/types";

function plan(overrides: Partial<ItuCurriculum> = {}): ItuCurriculum {
  return {
    planId: 1, programCode: "FIZ_LS", planType: "undergraduate",
    title: "Fizik Mühendisliği Lisans Ders Planı", planTitle: "2021-2022 / Güz Dönemi Sonrası",
    totalCredit: 150, totalEcts: 240,
    semesters: [{ semester: 1, items: [
      { kind: "course", id: "math", semester: 1, code: "MAT 103E", title: "Math", language: "EN", requirementType: "compulsory", creditOptions: [4], ectsOptions: [6] },
      { kind: "elective-slot", id: "language", semester: 1, title: "Language", creditOptions: [3], ectsOptions: [5], courses: [] },
    ] }],
    prerequisites: {}, equivalenceRules: [], prerequisiteBranchesLoaded: [], prerequisiteDataAvailable: true, warnings: [], fetchedAt: "2026-11-05",
    ...overrides,
  };
}

it("uses 30% of the published graduation credits rather than English-labelled rows or ECTS", () => {
  const curriculum = plan();
  expect(curriculumTotals(curriculum, emptyProgress(1)).requiredEnglishCredit).toBe(45);
  const course = curriculum.semesters[0].items[0];
  if (course.kind === "course") course.language = "TR";
  expect(curriculumTotals(curriculum, emptyProgress(1)).requiredEnglishCredit).toBe(45);
});

it("keeps fractional targets and falls back to complete requirement credits when the published total is absent", () => {
  expect(curriculumTotals(plan({ totalCredit: 151.5 }), emptyProgress(1)).requiredEnglishCredit).toBeCloseTo(45.45);
  expect(curriculumTotals(plan({ totalCredit: undefined }), emptyProgress(1)).requiredEnglishCredit).toBeCloseTo(2.1);
});

it("does not invent a target when both credit sources are unresolved", () => {
  const curriculum = plan({ totalCredit: undefined });
  curriculum.semesters[0].items[0].creditOptions = [];
  expect(curriculumTotals(curriculum, emptyProgress(1)).requiredEnglishCredit).toBeNull();
});

it.each(["İspanyolca", "Almanca", "Çince"])("preserves earned elective English credits for %s", courseLanguage => {
  const curriculum = plan();
  const slot = curriculum.semesters[0].items[1];
  if (slot.kind !== "elective-slot") throw new Error("fixture");
  slot.courses = [{ code: "LANG 101", title: "Language", language: courseLanguage, creditOptions: [3], ectsOptions: [5] }];
  const progress = emptyProgress(1);
  progress.courses["LANG 101"] = { state: "passed", source: "manual", courseLanguage };
  expect(curriculumTotals(curriculum, progress)).toMatchObject({ requiredEnglishCredit: 45, earnedEnglishCredit: 3 });
});

it.each(["cap", "yandal"] as const)("preserves the current target for %s curricula", planType => {
  expect(curriculumTotals(plan({ planType }), emptyProgress(1)).requiredEnglishCredit).toBe(7);
});

it.each([
  { programCode: "FIZE_LS", title: "Fizik Mühendisliği (İngilizce) Lisans Ders Planı" },
  { programCode: "FIZ_LS", planTitle: "Fizik Mühendisliği (%100 İngilizce)" },
  { programCode: "UNKNOWN_LS", title: "Unknown", planTitle: "Unknown" },
])("preserves the existing target for fully English or unclassified plans: $programCode", overrides => {
  expect(curriculumTotals(plan(overrides), emptyProgress(1)).requiredEnglishCredit).toBe(7);
});

it.each(["Program (%30 İngilizce)", "Program (30% English)"])("recognizes explicit policy in %s", planTitle => {
  expect(curriculumTotals(plan({ programCode: "NEW_LS", planTitle }), emptyProgress(1)).requiredEnglishCredit).toBe(45);
});
