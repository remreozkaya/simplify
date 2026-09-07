import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { translate } from "@/lib/i18n";

const componentSource = readFileSync(
  new URL("../../src/components/semester-planner/SmartSemesterPlanner.tsx", import.meta.url),
  "utf8",
);

describe("smart semester planner interface", () => {
  it("renders only the four requested configuration fields", () => {
    const configBlock = componentSource.match(/data-testid="planner-config-fields"[^]*?<\/div>/u)?.[0] ?? "";

    expect(configBlock).toContain('semesterPlanner.targetSemester');
    expect(configBlock).toContain('semesterPlanner.desiredCredits');
    expect(configBlock).toContain('semesterPlanner.maximumCourses');
    expect(configBlock).toContain('semesterPlanner.programPriority');
    expect(configBlock.match(/<label/g)).toHaveLength(4);
    expect(componentSource).not.toMatch(/includeCourses|excludeCourses|inProgressCourses|targetGraduationDate/u);
  });

  it("keeps recommendation generation and removes the suggested-credit action", () => {
    expect(componentSource).toContain('semesterPlanner.generate');
    expect(componentSource).toContain("generateRecommendations");
    expect(componentSource).not.toMatch(/useSuggested|suggestedCredits|18-credit target/u);
  });

  it("provides Turkish and English labels", () => {
    expect(translate("tr", "semesterPlanner.targetSemester")).toBe("Hedef Dönem");
    expect(translate("tr", "semesterPlanner.desiredCredits")).toBe("Kredi");
    expect(translate("en", "semesterPlanner.targetSemester")).toBe("Target Semester");
    expect(translate("en", "semesterPlanner.maximumCourses")).toBe("Max Course Count");
    expect(translate("en", "semesterPlanner.generate")).toBe("Generate Recommendations");
  });

  it("uses responsive one, two, and four-column layouts for the inputs", () => {
    expect(componentSource).toContain("grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4");
  });
});
