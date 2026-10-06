import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CurriculumGraph from "@/components/curriculum/CurriculumGraph";
import type { RequirementProgress } from "@/lib/curriculum/graduation";

function renderCard(kind: "course" | "elective-slot", completion?: RequirementProgress, status: "passed" | "failed" | "not-taken" = "passed", category = "MT") {
  return renderToStaticMarkup(createElement(CurriculumGraph, {
    graph: { nodes: [{ id: "card", kind, label: kind === "course" ? "MAT 103E\nMathematics I" : `Semester Elective (${category})`, semester: 1, x: 0, y: 0, externalPrerequisiteCodes: ["FIZ 101E"] }], edges: [] },
    statuses: { card: status },
    completions: { card: completion ?? null },
    visibleNodeIds: new Set(["card"]),
    onSelectNode: () => {},
  }));
}

function completedCourse(grade: "AA" | "FF", name = "Art History"): RequirementProgress {
  return {
    code: "SNT 101", name, course: { state: grade === "FF" ? "failed" : "passed", grade },
    courses: [], requirementCode: "Elective", requirementName: "Elective",
    satisfaction: { requirementId: "card", requirementCourseCode: "Elective", satisfiedByCourseCodes: ["SNT 101"], satisfactionType: "elective" },
  };
}

describe("curriculum graph cards", () => {
  it.each([ ["AA", "passed"], ["FF", "failed"] ] as const)("shows the recorded %s grade instead of completion status", (grade, status) => {
    const html = renderCard("course", completedCourse(grade), status);
    expect(html).toContain(`>${grade}</span>`);
    expect(html).not.toMatch(/>Passed<|>Failed<|>Geçti<|>Kaldı<|External prerequisite|Haricî önkoşul/);
  });

  it.each(["course", "elective-slot"] as const)("leaves an untaken %s without a grade or status", (kind) => {
    const html = renderCard(kind, completedCourse("AA"), "not-taken");
    expect(html).not.toMatch(/>AA<|Not Taken|Alınmadı|Elective requirement|Seçmeli gereksinimi|External prerequisite|Haricî önkoşul/);
  });

  it.each(["ITB", "TM", "MT"])("shows a passed %s elective's actual course code and name", (category) => {
    const html = renderCard("elective-slot", completedCourse("AA"), "passed", category);
    expect(html).toContain(">SNT 101</span>");
    expect(html).toContain(">Art History</p>");
    expect(html).not.toContain("Semester Elective");
  });

  it("leaves the grade blank for legacy completions without a recorded grade", () => {
    const completion = completedCourse("AA");
    delete completion.course.grade;
    const html = renderCard("course", completion);
    expect(html).not.toMatch(/>AA<|>Passed<|>Geçti</);
  });
});
