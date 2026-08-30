import { describe, expect, it } from "vitest";

import {
  evaluatePrerequisiteExpression,
  getCourseStatus,
  isCourseTakeableThisSemester,
} from "@/lib/curriculum/eligibility";
import { parsePrerequisiteExpression } from "@/lib/itu/curriculum/prerequisiteExpression";

describe("curriculum eligibility", () => {
  const andExpression = parsePrerequisiteExpression("MAT 103E AND BLG 102E");
  const orExpression = parsePrerequisiteExpression("MAT 103E OR BLG 102E");
  const nested = parsePrerequisiteExpression("MAT 103E AND (BLG 102E OR BLG 102)");

  it("requires every AND operand", () => {
    expect(
      evaluatePrerequisiteExpression(andExpression, {
        "MAT 103E": { state: "passed" },
        "BLG 102E": { state: "passed" },
      }),
    ).toBe("satisfied");
    expect(
      evaluatePrerequisiteExpression(andExpression, {
        "MAT 103E": { state: "passed" },
      }),
    ).toBe("unsatisfied");
  });

  it("accepts either OR operand", () => {
    expect(
      evaluatePrerequisiteExpression(orExpression, {
        "MAT 103E": { state: "passed" },
      }),
    ).toBe("satisfied");
    expect(
      evaluatePrerequisiteExpression(orExpression, {
        "BLG 102E": { state: "passed" },
      }),
    ).toBe("satisfied");
    expect(evaluatePrerequisiteExpression(orExpression, {})).toBe("unsatisfied");
  });

  it("evaluates nested AND/OR expressions", () => {
    expect(
      evaluatePrerequisiteExpression(nested, {
        "MAT 103E": { state: "passed" },
        "BLG 102": { state: "passed" },
      }),
    ).toBe("satisfied");
  });

  it("requires a grade when OBS specifies a minimum", () => {
    const graded = parsePrerequisiteExpression("MAT 103E MIN. BB");
    expect(
      evaluatePrerequisiteExpression(graded, { "MAT 103E": { state: "passed" } }),
    ).toBe("unknown");
    expect(
      evaluatePrerequisiteExpression(graded, {
        "MAT 103E": { state: "passed", grade: "BA" },
      }),
    ).toBe("satisfied");
    expect(
      evaluatePrerequisiteExpression(graded, {
        "MAT 103E": { state: "passed", grade: "CC" },
      }),
    ).toBe("unsatisfied");
  });

  it("keeps failed status while reporting prerequisite eligibility separately", () => {
    expect(
      getCourseStatus(
        "BBF 301E",
        { courseCode: "BBF 301E", expression: andExpression },
        { "BBF 301E": { state: "failed" } },
      ),
    ).toEqual({
      status: "failed",
      eligibility: "unsatisfied",
    });
  });

  it("uses the three user-facing progress categories", () => {
    expect(getCourseStatus("A", undefined, { A: { state: "passed" } }).status).toBe("passed");
    expect(getCourseStatus("A", undefined, { A: { state: "failed" } }).status).toBe("failed");
    expect(getCourseStatus("A", undefined, {}).status).toBe("not-taken");
    expect(getCourseStatus("A", undefined, {}, false).status).toBe("not-taken");
  });

  it("only recommends offered, unpassed courses with completed prerequisites", () => {
    const prerequisite = { courseCode: "BBF 301E", expression: andExpression };
    const offered = new Set(["BBF 301E"]);
    const completed = {
      "MAT 103E": { state: "passed" as const },
      "BLG 102E": { state: "passed" as const },
    };

    expect(isCourseTakeableThisSemester("BBF 301E", prerequisite, completed, offered)).toBe(true);
    expect(isCourseTakeableThisSemester("BBF 301E", prerequisite, {}, offered)).toBe(false);
    expect(isCourseTakeableThisSemester("BBF 301E", prerequisite, completed, new Set())).toBe(false);
    expect(isCourseTakeableThisSemester(
      "BBF 301E",
      prerequisite,
      { ...completed, "BBF 301E": { state: "passed" as const } },
      offered,
    )).toBe(false);
    expect(isCourseTakeableThisSemester(
      "BBF 301E",
      prerequisite,
      { ...completed, "BBF 301E": { state: "failed" as const } },
      offered,
    )).toBe(true);
  });
});
