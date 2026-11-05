import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { curriculumTotals } from "@/lib/curriculum/graduation";
import { emptyProgress } from "@/lib/curriculum/progress";
import { parseNumericOptions } from "@/lib/itu/curriculum/parsers/numbers";
import { translate } from "@/lib/i18n";
import type { ItuCurriculum, ItuCurriculumItem } from "@/lib/itu/curriculum/types";

const state = vi.hoisted(() => ({ language: "en" as "tr" | "en" }));
vi.mock("@/lib/i18n/client", () => ({ useLanguage: () => ({
  language: state.language,
  t: (key: string, values?: Record<string, string | number>) => translate(state.language, key, values),
}) }));
import { ProgramAuditSection } from "@/components/curriculum/GraduationCalculator";
import { MinimumEnglishCredit } from "@/components/curriculum/MinimumEnglishCredit";

type SourcePlan = {
  id: number; programCode: string; programName: string; facultyId: string;
  planType: string; title: string; notes: string[];
  courses: { kind: "course" | "elective-slot"; code: string; title: string;
    language?: string; requirementType?: string; credit: string; ects: string }[];
};
const catalog = JSON.parse(readFileSync("src/data/itu/curriculum-catalog.json", "utf8")) as { plans: SourcePlan[] };

// Select from source metadata, independently of the production policy registry:
// ordinary undergraduate plans, excluding fully English offerings and the
// Turkish Music conservatory (which follows a separate language policy).
const mixedPlans = catalog.plans.filter(source => source.planType === "undergraduate"
  && source.facultyId !== "20"
  && !/İngilizce|English/iu.test(`${source.programName} ${source.title}`));

function auditFixture(source: SourcePlan) {
  const match = source.notes.join(" ").match(/Toplam Kredi\s*:\s*(\d+),(\d{2})/u);
  if (!match) throw new Error(`Missing published total for ${source.programCode}/${source.id}`);
  const hundredths = Number(match[1]) * 100 + Number(match[2]);
  // Exact integer arithmetic independently checks ceil(30%); no production
  // policy, rounding helper, numeric formatter, or binary fraction is reused.
  const expectedMinimum = Math.floor((hundredths * 3 + 999) / 1000);
  const items: ItuCurriculumItem[] = source.courses.map((row, index) => {
    const common = { id: `source-${index}`, semester: 1, title: row.title,
      creditOptions: parseNumericOptions(row.credit), ectsOptions: parseNumericOptions(row.ects) };
    return row.kind === "course"
      ? { ...common, kind: "course", code: row.code, language: row.language,
        requirementType: row.requirementType === "S" ? "elective" : "compulsory" }
      : { ...common, kind: "elective-slot", courses: [] };
  });
  const curriculum: ItuCurriculum = {
    planId: source.id, programCode: source.programCode, planType: "undergraduate",
    title: source.programName, planTitle: source.title, totalCredit: hundredths / 100,
    semesters: [{ semester: 1, items }], prerequisites: {}, equivalenceRules: [],
    prerequisiteBranchesLoaded: [], prerequisiteDataAvailable: true, warnings: [], fetchedAt: "2026-11-05",
  };
  return { source, curriculum, expectedMinimum };
}

it("covers all bundled mixed-language offerings without silently dropping plans missing from the policy registry", () => {
  expect(mixedPlans).toHaveLength(228);
  expect(new Set(mixedPlans.map(source => source.programCode)).size).toBe(43);
  expect(mixedPlans.map(source => source.id)).toEqual(expect.arrayContaining([2611, 2612, 2296, 1557, 1558]));
});

for (const language of ["tr", "en"] as const) {
  it.each(mixedPlans.map(auditFixture))(
    `${language}: $source.programCode / plan $source.id presents minimum $expectedMinimum in both screens`,
    ({ source, curriculum, expectedMinimum }) => {
      state.language = language;
      const progress = emptyProgress(curriculum.planId);
      const totals = curriculumTotals(curriculum, progress);
      expect(totals.requiredEnglishCredit).toBe(expectedMinimum);
      const expectedLabel = `${language === "tr" ? "Asgari İngilizce kredisi" : "Minimum English credit"}: ${expectedMinimum}.00`;
      const curriculumLabel = renderToStaticMarkup(createElement(MinimumEnglishCredit, { credit: totals.requiredEnglishCredit }));
      expect(curriculumLabel.replace(/<[^>]*>/g, "")).toContain(expectedLabel);
      const graduation = renderToStaticMarkup(createElement(ProgramAuditSection, { audit: {
        curriculum, progress, program: null,
        enrollment: { id: `audit-${source.id}`, type: "main", facultyId: source.facultyId, facultyName: "Faculty",
          educationLevel: "undergraduate", planType: "undergraduate", programCode: source.programCode,
          programName: source.programName, curriculumPlanId: source.id, curriculumPlanName: source.title },
      } }));
      expect(graduation.replace(/<[^>]*>/g, "")).not.toContain(expectedLabel);
      expect(graduation.replace(/<[^>]*>/g, "")).toContain(`0.00 / ${expectedMinimum}.00`);
    },
  );
}
