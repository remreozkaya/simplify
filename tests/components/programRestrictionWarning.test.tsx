import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n";
import { SortableCourseRow } from "@/components/calendar/CourseRows";
import type { FacultyOption } from "@/types/calendar";
import ProgramRestrictionWarning from "@/components/calendar/ProgramRestrictionWarning";

const locale = vi.hoisted(() => ({ language: "tr" as "tr" | "en" }));
vi.mock("@/lib/i18n/client", () => ({
  useLanguage: () => ({ language: locale.language, t: (key: string, parameters?: Record<string, string | number>) => translate(locale.language, key, parameters) }),
}));
vi.mock("@dnd-kit/sortable", () => ({ useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, setActivatorNodeRef: () => {} }) }));


function render(status: "eligible" | "ineligible" | "unknown", allowedCodes = ["BLG_LS"]) {
  return renderToStaticMarkup(<ProgramRestrictionWarning eligibility={{ status, reason: "test", allowedCodes, matchedCodes: [] }} />);
}

describe("manual program restriction warning", () => {
  it("does not warn for eligible or unknown eligibility", () => {
    expect(render("eligible")).toBe("");
    expect(render("unknown")).toBe("");
  });
  it("renders an inline factual warning with readable program codes, without an alert", () => {
    expect(render("ineligible")).toContain("Bu şube seçtiğiniz programlara açık değil. Açık olduğu programlar:");
    expect(render("ineligible")).toContain("BLG_LS");
    expect(render("ineligible")).not.toContain('role="alert"');
  });
  it("renders the same concise warning in English", () => {
    locale.language = "en";
    try {
      expect(render("ineligible")).toContain("This section is not open to your selected programs. Open to:");
    } finally {
      locale.language = "tr";
    }
  });
  it("provides a labeled close button for short and expandable warnings", () => {
    locale.language = "en";
    try {
      for (const codes of [["BLG_LS"], ["A", "B", "C", "D", "E"]]) {
        expect(render("ineligible", codes)).toContain('aria-label="Dismiss program restriction warning"');
        expect(render("ineligible", codes)).toContain('type="button"');
      }
    } finally {
      locale.language = "tr";
    }
  });
  it("keeps long allowed-program lists expandable and accessible", () => {
    const markup = render("ineligible", ["A", "B", "C", "D", "E"]);
    expect(markup).toContain("<details");
    expect(markup).toContain("<summary");
    expect(markup).toContain("E");
  });
  it("includes equivalent English and Turkish restriction and uncertainty copy", () => {
    expect(translate("en", "courses.programRestrictionWarning")).toBe("This section is not open to your selected programs. Open to:");
    for (const language of ["en", "tr"] as const) {
      expect(translate(language, "courses.restrictionNoSchedule", { courses: "BLG 101" })).toContain("BLG 101");
      expect(translate(language, "courses.unknownProgramRestrictions", { count: 2 })).toContain("2");
    }
  });
});


const catalog: FacultyOption[] = [{ facultyCode: "BLG", courses: [{ id: "course", code: "BLG 101", title: "Course", sections: [{ id: "section", crn: "12345", majorRestriction: "BLG_LS", meetings: [] }] }] }];
function renderRow(codes: string[], sectionId = "section", loading = false) {
  return renderToStaticMarkup(<SortableCourseRow
    selection={{ id: "selection", facultyCode: "BLG", courseId: "course", sectionId, courseBlockIds: [] }}
    courseCatalog={catalog}
    programMemberships={codes.map((code) => ({ enrollmentId: code, type: "main", rawCode: code, codes: [code], resolved: true }))}
    isLoadingBranches={false} isBranchLoading={() => loading}
    onFacultyChange={() => {}} onCourseChange={() => {}} onSectionChange={() => {}} onDelete={() => {}}
  />);
}

describe("selected section restriction integration", () => {
  it("updates the warning for changed selected-program membership without blocking section selection", () => {
    const mismatch = renderRow(["MAT_LS"]);
    expect(mismatch).toContain("Bu şube seçtiğiniz programlara açık değil.");
    expect(mismatch).toContain('value="section" selected=""');
    expect(renderRow(["BLG_LS"])).not.toContain("Bu şube seçtiğiniz programlara açık değil.");
    expect(renderRow(["MAT_LS", "BLG_LS"])).not.toContain("Bu şube seçtiğiniz programlara açık değil.");
  });
  it("does not claim ineligibility for absent sections, loading branches, or missing profiles", () => {
    for (const markup of [renderRow([], "section"), renderRow(["MAT_LS"], "missing"), renderRow(["MAT_LS"], "section", true)]) {
      expect(markup).not.toContain("Bu şube seçtiğiniz programlara açık değil.");
    }
  });
});
