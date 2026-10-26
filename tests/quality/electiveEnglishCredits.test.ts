import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { applyTranscriptImport, calculateProgramGpa, curriculumTotals } from "@/lib/curriculum/graduation";
import { emptyProgress } from "@/lib/curriculum/progress";
import { parseTranscriptMarkdown } from "@/lib/curriculum/transcript";
import { parseNumericOptions } from "@/lib/itu/curriculum/parsers/numbers";
import type { ItuCurriculum, ItuCurriculumItem } from "@/lib/itu/curriculum/types";

function electivePlan(language: string, named = false): ItuCurriculum {
  const choice = { code: "LANG 101", title: "Language elective", language, creditOptions: [4], ectsOptions: [5] };
  const item: ItuCurriculumItem = named
    ? { ...choice, kind: "course", id: "elective", semester: 1, requirementType: "elective", creditOptions: [4, 3] }
    : { kind: "elective-slot", id: "elective", semester: 1, title: "Elective", creditOptions: [4, 3], ectsOptions: [5], courses: [choice] };
  return { planId: 1, programCode: "TEST_LS", title: "Test", planTitle: "Test", semesters: [{ semester: 1, items: [item] }], prerequisites: {}, equivalenceRules: [], prerequisiteDataAvailable: true, prerequisiteBranchesLoaded: [], warnings: [], fetchedAt: "2026-10-26T00:00:00Z" };
}

it.each(["İspanyolca", "Almanca", "Türkçe", "English", "Unconfirmed"])("counts minimum elective credits toward English credits for %s", language => {
  const plan = electivePlan(language);
  const parsed = parseTranscriptMarkdown("Completed English Courses\n202610\t1\tLANG 101\tLanguage elective\t4\tAA");
  parsed.calculatedCourses[0].courseLanguage = language;
  const progress = applyTranscriptImport(plan, emptyProgress(1), parsed).progress;
  expect(curriculumTotals(plan, progress)).toMatchObject({ requiredCredit: 3, requiredEnglishCredit: 3, earnedCredit: 3, earnedEnglishCredit: 3 });
  expect(progress.courses["LANG 101"].courseLanguage).toBe(language);
  expect(progress.courses["LANG 101"].transcriptCredit).toBe(4);
  expect(calculateProgramGpa(plan, progress)).toBe(4);
});

it("counts a named non-English elective using its minimum plan credit", () => {
  const plan = electivePlan("Almanca", true);
  const progress = emptyProgress(1);
  progress.courses["LANG 101"] = { state: "passed", courseLanguage: "Almanca" };
  expect(curriculumTotals(plan, progress)).toMatchObject({ requiredEnglishCredit: 3, earnedEnglishCredit: 3 });
});

it("counts required elective credits before choices load, without earning unfinished or failed credits", () => {
  const plan = electivePlan("İspanyolca");
  const slot = plan.semesters[0].items[0];
  if (slot.kind !== "elective-slot") throw new Error("fixture");
  slot.courses = [];
  expect(curriculumTotals(plan, emptyProgress(1))).toMatchObject({ requiredEnglishCredit: 3, earnedEnglishCredit: 0 });
  slot.courses = electivePlan("İspanyolca").semesters[0].items.flatMap(item => item.kind === "elective-slot" ? item.courses : []);
  const parsed = parseTranscriptMarkdown("Completed English Courses\n202610\t1\tLANG 101\tLanguage elective\t4\tFF");
  const progress = applyTranscriptImport(plan, emptyProgress(1), parsed).progress;
  expect(curriculumTotals(plan, progress)).toMatchObject({ requiredEnglishCredit: 3, earnedEnglishCredit: 0 });
});

type SourceCourse = { kind: "course" | "elective-slot"; code: string; title: string; language?: string; requirementType?: string; credit: string; ects: string; groupId?: number };
type SourceCatalog = { plans: { id: number; programCode: string; title: string; courses: SourceCourse[] }[]; electiveGroups: Record<string, { courses: SourceCourse[] }> };
it.each([1562, 2340])("matches 130 total and English credits for bundled fully English plan %s", id => {
  const catalog = JSON.parse(readFileSync("src/data/itu/curriculum-catalog.json", "utf8")) as SourceCatalog;
  const source = catalog.plans.find(plan => plan.id === id)!;
  const items: ItuCurriculumItem[] = source.courses.map((row, index) => {
    const common = { id: String(index), semester: 1, title: row.title, creditOptions: parseNumericOptions(row.credit), ectsOptions: parseNumericOptions(row.ects) };
    return row.kind === "course"
      ? { ...common, kind: "course", code: row.code, language: row.language, requirementType: row.requirementType === "S" ? "elective" : "compulsory" }
      : { ...common, kind: "elective-slot", courses: (catalog.electiveGroups[String(row.groupId)]?.courses ?? []).map(choice => ({ code: choice.code, title: choice.title, language: choice.language, creditOptions: parseNumericOptions(choice.credit), ectsOptions: parseNumericOptions(choice.ects) })) };
  });
  const plan = { ...electivePlan("English"), planId: id, programCode: source.programCode, planTitle: source.title, semesters: [{ semester: 1, items }] };
  expect(curriculumTotals(plan, emptyProgress(id))).toMatchObject({ requiredCredit: 130, requiredEnglishCredit: 130 });
});
