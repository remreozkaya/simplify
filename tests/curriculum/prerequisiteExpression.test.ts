import { describe, expect, it } from "vitest";

import {
  normalizeCourseCode,
  parsePrerequisiteExpression,
} from "@/lib/itu/curriculum/prerequisiteExpression";

describe("prerequisite expression parsing", () => {
  it("normalizes compact course codes", () => {
    expect(normalizeCourseCode("mat103e")).toBe("MAT 103E");
    expect(normalizeCourseCode("fiz101el")).toBe("FIZ 101EL");
  });

  it.each([
    ["MAT 103E", { kind: "course", courseCode: "MAT 103E" }],
    [
      "MAT 103E AND BLG 102E",
      {
        kind: "and",
        operands: [
          { kind: "course", courseCode: "MAT 103E" },
          { kind: "course", courseCode: "BLG 102E" },
        ],
      },
    ],
    [
      "MAT 103E VEYA MAT 103",
      {
        kind: "or",
        operands: [
          { kind: "course", courseCode: "MAT 103E" },
          { kind: "course", courseCode: "MAT 103" },
        ],
      },
    ],
    [
      "MAT 103E VE (BLG 102E VEYA BLG 102)",
      {
        kind: "and",
        operands: [
          { kind: "course", courseCode: "MAT 103E" },
          {
            kind: "or",
            operands: [
              { kind: "course", courseCode: "BLG 102E" },
              { kind: "course", courseCode: "BLG 102" },
            ],
          },
        ],
      },
    ],
    [
      "(MAT 103E OR MAT 103) AND (BLG 102E OR BLG 102)",
      {
        kind: "and",
        operands: [
          {
            kind: "or",
            operands: [
              { kind: "course", courseCode: "MAT 103E" },
              { kind: "course", courseCode: "MAT 103" },
            ],
          },
          {
            kind: "or",
            operands: [
              { kind: "course", courseCode: "BLG 102E" },
              { kind: "course", courseCode: "BLG 102" },
            ],
          },
        ],
      },
    ],
  ])("parses %s", (raw, expected) => {
    expect(parsePrerequisiteExpression(raw)).toEqual(expected);
  });

  it("preserves actual OBS minimum-grade conditions", () => {
    expect(
      parsePrerequisiteExpression("( BLG 231 MIN. DD Veya BLG 231E MIN. BB )"),
    ).toEqual({
      kind: "or",
      operands: [
        { kind: "course", courseCode: "BLG 231", minimumGrade: "DD" },
        { kind: "course", courseCode: "BLG 231E", minimumGrade: "BB" },
      ],
    });
  });

  it("returns unknown for syntax it cannot interpret safely", () => {
    expect(parsePrerequisiteExpression("MAT 103E / MAT 103")).toEqual({
      kind: "unknown",
      raw: "MAT 103E / MAT 103",
    });
  });
});
