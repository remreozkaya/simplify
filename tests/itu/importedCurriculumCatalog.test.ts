import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Catalog = {
  faculties: { id: string; name: string }[];
  programs: { code: string; facultyId: string; planType: string }[];
  plans: { id: number; planType: string; sourceUrl: string; courses: unknown[]; associatedPrimaryPrograms: { code: string }[] }[];
  prerequisites: unknown[];
  failures: unknown[];
};

const catalog = JSON.parse(readFileSync(join(process.cwd(), "src/data/itu/curriculum-catalog.json"), "utf8")) as Catalog;

describe("stored official İTÜ curriculum snapshot", () => {
  it("contains complete faculty-linked program sets for all supported plan types", () => {
    const facultyIds = new Set(catalog.faculties.map((faculty) => faculty.id));
    expect(catalog.faculties.length).toBeGreaterThan(1);
    expect(catalog.programs.every((program) => facultyIds.has(program.facultyId))).toBe(true);
    expect(new Set(catalog.programs.map((program) => program.planType))).toEqual(new Set(["undergraduate", "cap", "yandal"]));
  });

  it("preserves plan sources, contents, eligibility relationships, and prerequisites", () => {
    expect(catalog.plans.every((plan) => plan.id > 0 && plan.sourceUrl.includes(`/DersPlan/DersPlanDetay/${plan.id}`))).toBe(true);
    expect(catalog.plans.filter((plan) => plan.courses.length > 0).length).toBeGreaterThan(catalog.plans.length * 0.95);
    expect(catalog.plans.some((plan) => plan.planType === "cap" && plan.associatedPrimaryPrograms.length > 0)).toBe(true);
    expect(catalog.plans.some((plan) => plan.planType === "yandal")).toBe(true);
    expect(catalog.prerequisites.length).toBeGreaterThan(0);
    expect(catalog.failures).toEqual([]);
  });
});
