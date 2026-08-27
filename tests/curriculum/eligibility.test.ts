import { describe, expect, it } from "vitest";

import {
  evaluatePrerequisiteExpression,
  getCourseStatus,
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

  it("keeps planned status while reporting blocked prerequisites", () => {
    expect(
      getCourseStatus(
        "BBF 301E",
        { courseCode: "BBF 301E", expression: andExpression },
        { "BBF 301E": { state: "planned" } },
      ),
    ).toEqual({
      status: "planned",
      eligibility: "unsatisfied",
      plannedWarning: true,
    });
  });

  it("uses passed and planned precedence", () => {
    expect(getCourseStatus("A", undefined, { A: { state: "passed" } }).status).toBe("passed");
    expect(getCourseStatus("A", undefined, { A: { state: "planned" } }).status).toBe("planned");
    expect(getCourseStatus("A", undefined, {}).status).toBe("eligible");
    expect(getCourseStatus("A", undefined, {}, false).status).toBe("unknown");
  });
});
