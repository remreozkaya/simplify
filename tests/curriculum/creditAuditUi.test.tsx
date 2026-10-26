import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n";
import { emptyProgress } from "@/lib/curriculum/progress";
import type { ItuCurriculum } from "@/lib/itu/curriculum/types";

const state = vi.hoisted(() => ({ language: "en" as "tr" | "en" }));
vi.mock("@/lib/i18n/client", () => ({ useLanguage: () => ({ language: state.language, t: (key: string, values?: Record<string, string | number>) => translate(state.language, key, values) }) }));
import { ProgramAuditSection } from "@/components/curriculum/GraduationCalculator";

const curriculum: ItuCurriculum = {
  planId: 19, programCode: "SYNTHETIC_LS", title: "Science", planTitle: "Variable credit plan", totalCredit: 4,
  semesters: [{ semester: 1, items: [{ kind: "elective-slot", id: "slot", semester: 1, title: "Elective", creditOptions: [3, 4], ectsOptions: [5], courses: [] }] }],
  prerequisites: {}, equivalenceRules: [], prerequisiteBranchesLoaded: [], prerequisiteDataAvailable: true, warnings: ["Official equivalence coverage is unavailable for this curriculum."], fetchedAt: "2026-01-01T00:00:00Z",
};

it.each(["tr", "en"] as const)("shows minimum elective credit totals without uncertainty warnings in %s", language => {
  state.language = language;
  const html = renderToStaticMarkup(createElement(ProgramAuditSection, { audit: {
    curriculum, progress: emptyProgress(19), program: null,
    enrollment: { id: "student-main", type: "main", facultyId: "science", facultyName: "Science", educationLevel: "undergraduate", planType: "undergraduate", programCode: "SYNTHETIC_LS", programName: "Science", curriculumPlanId: 19, curriculumPlanName: "Variable credit plan" },
  } }));
  expect(html).toContain("0.00 / 3.00");
  expect(html).not.toContain(language === "tr"
    ? "Geçerli ders planı kredileri belirsiz olduğundan bazı kredi toplamları hesaplanamıyor."
    : "Some credit totals are unavailable because the applicable curriculum credits are uncertain.");
  expect(html).toContain("0.00/3.00");
  expect(html).toContain(language === "tr" ? "Bu ders planı için resmî denklik kapsamı verisi mevcut değil." : "Official equivalence coverage is unavailable for this curriculum.");
});
