import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseCurriculumDetail } from "@/lib/itu/curriculum/parsers/parseCurriculumDetail";
import { parseCurriculumPlans } from "@/lib/itu/curriculum/parsers/parseCurriculumPlans";
import { parseElectiveGroup } from "@/lib/itu/curriculum/parsers/parseElectiveGroup";
import {
  parsePrerequisiteBranches,
  parsePrerequisites,
} from "@/lib/itu/curriculum/parsers/parsePrerequisites";
import { parseUndergraduatePrograms } from "@/lib/itu/curriculum/parsers/parseUndergraduatePrograms";
import {
  collectElectiveGroupIds,
  collectPrerequisiteBranchCodes,
} from "@/lib/itu/curriculum/services/getCurriculum";

function fixture(name: string) {
  return readFileSync(join(process.cwd(), "tests/fixtures/itu/curriculum", name), "utf8");
}

describe("ITU curriculum parsers", () => {
  it("parses and sorts official undergraduate program rows", () => {
    const programs = parseUndergraduatePrograms(fixture("programs.html"));
    expect(programs).toHaveLength(3);
    expect(programs.map((program) => program.code)).toEqual([
      "BLGE_LS",
      "BLG_LS",
      "ECNE_LS",
    ]);
    expect(programs[0].faculty).toBe("Bilgisayar ve Bilişim Fakültesi");
    expect(programs[0].major).toBe("Bilgisayar Mühendisliği");
    expect(programs[1].major).toBe("Bilgisayar Mühendisliği");
  });

  it("parses every historical plan and identifies the current plan", () => {
    const plans = parseCurriculumPlans(fixture("plans.html"), "BLGE_LS");
    expect(plans.map((plan) => plan.id)).toEqual([2340, 1562, 1194]);
    expect(plans[0].isCurrent).toBe(true);
    expect(plans[1].isCurrent).toBe(false);
  });

  it("preserves non-undergraduate plan types, versions, sources, and associated programs", () => {
    const plans = parseCurriculumPlans(fixture("plans.html"), "END_LS", "cap");
    expect(plans).toHaveLength(3);
    expect(plans[0]).toMatchObject({ planType: "cap", sourceUrl: "https://obs.itu.edu.tr/public/DersPlan/DersPlanDetay/2340" });
    const detail = parseCurriculumDetail(`<div class="content-area"><h1>Target</h1><h2>MAT_END ÇAP Programı</h2><table class="datalist"><tbody><tr><td><a>END 112E</a></td><td>Course</td><td>English</td><td>Z</td><td>3</td><td>5</td><td>3</td><td>0</td><td>0</td><td>TM</td></tr></tbody></table><h2>İlişkili Programlar</h2><table id="dersPlanProgramList" class="datalist"><tbody><tr><td>MAT_LS</td><td>Matematik</td><td>today</td></tr></tbody></table></div>`, 77, "END_LS");
    expect(detail.semesters[0].items).toHaveLength(1);
    expect(detail.associatedPrimaryProgramCodes).toEqual(["MAT_LS"]);
  });

  it("parses semesters, courses, elective slots, decimal commas, alternatives, totals, and notes", () => {
    const curriculum = parseCurriculumDetail(fixture("detail.html"), 2340, "BLGE_LS");
    expect(curriculum.semesters).toHaveLength(2);
    expect(curriculum.semesters[0].items[0]).toMatchObject({
      kind: "course",
      code: "MAT 103E",
      creditOptions: [4],
      ectsOptions: [6.5],
      requirementType: "compulsory",
    });
    expect(curriculum.semesters[1].items[0]).toMatchObject({
      kind: "elective-slot",
      groupId: 11778,
      creditOptions: [3],
      ectsOptions: [4, 5],
    });
    expect(curriculum.semesters[1].items[1]).toMatchObject({
      requirementType: "elective",
      creditOptions: [4.5],
    });
    expect(curriculum).toMatchObject({ totalCredit: 130, totalEcts: 240 });
    expect(curriculum.note).toContain("internship");
  });

  it("parses and deduplicates elective courses", () => {
    const group = parseElectiveGroup(fixture("elective.html"));
    expect(group.title).toBe("TM Elective I");
    expect(group.courses).toHaveLength(2);
    expect(group.courses[0]).toMatchObject({
      code: "BLG 337E",
      title: "Principles of Computer Communication",
      ectsOptions: [4.5],
    });
    expect(group.courses[1].ectsOptions).toEqual([4, 5]);
  });

  it("deduplicates repeated elective group requests across distinct slots", () => {
    const curriculum = parseCurriculumDetail(fixture("detail.html"), 2340, "BLGE_LS");
    const slot = curriculum.semesters[1].items[0];
    if (slot.kind !== "elective-slot") throw new Error("Fixture elective slot is missing.");
    curriculum.semesters[1].items.push({ ...slot, id: `${slot.id}:copy` });
    expect(collectElectiveGroupIds(curriculum)).toEqual([11778]);
  });

  it("loads prerequisite branches used only by elective pools", () => {
    const curriculum = parseCurriculumDetail(fixture("detail.html"), 2340, "BLGE_LS");
    const slot = curriculum.semesters[1].items[0];
    if (slot.kind !== "elective-slot") throw new Error("Fixture elective slot is missing.");
    slot.courses = [
      { code: "YZV 411E", title: "AI elective", creditOptions: [3], ectsOptions: [5] },
      { code: "ITB 201", title: "Humanities elective", creditOptions: [3], ectsOptions: [5] },
    ];

    expect(collectPrerequisiteBranchCodes(curriculum)).toEqual(["BLG", "ITB", "MAT", "YZV"]);
  });

  it("parses branch IDs, prerequisite logic, grades, and earned-credit conditions", () => {
    expect(parsePrerequisiteBranches(fixture("branches.html"))).toEqual({ BLG: 3, BBF: 310 });
    const records = parsePrerequisites(fixture("prerequisites.html"));
    expect(records).toHaveLength(3);
    expect(records.find((record) => record.courseCode === "BLG 212E")?.expression).toMatchObject({
      kind: "or",
    });
    expect(records.find((record) => record.courseCode === "BLG 4901E")).toMatchObject({
      minimumCredits: 95,
      expression: { kind: "and" },
    });
  });
});
