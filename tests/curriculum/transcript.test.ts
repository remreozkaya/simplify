import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { GRADE_POINTS, GRADES, gradePoint } from "@/lib/curriculum/grades";
import { calculateGpa, parseCredit, parseTranscriptMarkdown } from "@/lib/curriculum/transcript";
import { normalizeCourseCode } from "@/lib/itu/curriculum/prerequisiteExpression";
import { courseLanguageFromCode, courseLanguageVariants } from "@/lib/itu/courseCode.mjs";

const sample = readFileSync(join(process.cwd(), "tests/fixtures/transcript/sample.md"), "utf8");
const turkishSample = readFileSync(join(process.cwd(), "tests/fixtures/transcript/sample-tr.txt"), "utf8");

describe("transcript parser", () => {
  it("parses the complete supplied Markdown fixture and ignores headings and separators", () => {
    const parsed = parseTranscriptMarkdown(sample);
    expect(parsed.invalidRows).toEqual([]);
    expect(parsed.calculatedCourses).toHaveLength(29);
    expect(parsed.nonCalculatedCourses).toHaveLength(1);
    expect(parsed.calculatedCourses.reduce((sum, course) => sum + course.countedCredit, 0)).toBe(78);
    expect(parsed.nonCalculatedCourses[0]).toMatchObject({ courseCode: "SNT 105E", calculated: false, courseLanguage: "EN" });
    expect(calculateGpa([...parsed.calculatedCourses, ...parsed.nonCalculatedCourses])).toBeCloseTo(3.8, 2);
  });

  it("parses the Turkish tab-separated transcript export directly", () => {
    const parsed = parseTranscriptMarkdown(turkishSample);
    expect(parsed.invalidRows).toEqual([]);
    expect(parsed.duplicateRows).toEqual([]);
    expect(parsed.calculatedCourses).toHaveLength(29);
    expect(parsed.nonCalculatedCourses).toHaveLength(1);
    expect(parsed.calculatedCourses.reduce((sum, course) => sum + course.countedCredit, 0)).toBe(78);
    expect(parsed.calculatedCourses.find((course) => course.courseCode === "BLG 478E")).toMatchObject({
      countedCredit: 2,
      transcriptCredit: 3,
      grade: "BB+",
    });
    expect(parsed.nonCalculatedCourses[0]).toMatchObject({ courseCode: "SNT 105E", calculated: false, courseLanguage: "EN" });
    expect(calculateGpa([...parsed.calculatedCourses, ...parsed.nonCalculatedCourses])).toBeCloseTo(3.8, 2);
  });

  it("parses comma, dot, and split credits", () => {
    expect(parseCredit("1,5")).toEqual({ countedCredit: 1.5, transcriptCredit: 1.5 });
    expect(parseCredit("3.00")).toEqual({ countedCredit: 3, transcriptCredit: 3 });
    expect(parseCredit("2 / 3")).toEqual({ countedCredit: 2, transcriptCredit: 3 });
  });

  it("normalizes spacing and case without removing suffixes", () => {
    expect(normalizeCourseCode("fiz  101e")).toBe("FIZ 101E");
    expect(normalizeCourseCode("FIZ101EL")).toBe("FIZ 101EL");
  });

  it("pairs only Turkish/English suffixes while preserving laboratory suffixes", () => {
    expect(courseLanguageVariants("bbf101")).toEqual(["BBF 101", "BBF 101E"]);
    expect(courseLanguageVariants("BBF 101E")).toEqual(["BBF 101E", "BBF 101"]);
    expect(courseLanguageVariants("FIZ 101L")).toEqual(["FIZ 101L", "FIZ 101EL"]);
    expect(courseLanguageVariants("FIZ 101EL")).toEqual(["FIZ 101EL", "FIZ 101L"]);
    expect(courseLanguageVariants("ING 112A")).toEqual(["ING 112A"]);
    expect(courseLanguageFromCode("BBF 101")).toBe("TR");
    expect(courseLanguageFromCode("BBF 101E")).toBe("EN");
    expect(courseLanguageFromCode("FIZ 101EL")).toBe("EN");
  });

  it("contains every standard and plus grade in the centralized mapping", () => {
    expect(GRADES).toEqual(expect.arrayContaining(["AA", "BA+", "BA", "BB+", "BB", "CB+", "CB", "CC+", "CC", "DC+", "DC", "DD+", "DD", "FF", "VF", "BL"]));
    expect(GRADE_POINTS["BA+"]).toBe(3.75);
    expect(GRADE_POINTS["BB+"]).toBe(3.25);
    expect(gradePoint("BL")).toBeNull();
  });

  it("keeps only the most recent repeated attempt and reports malformed rows", () => {
    const parsed = parseTranscriptMarkdown(`
| Completed English Courses | | | | | |
| Term | CRN | Course Code | Course Name | Credit | Grade |
| 202410 | 1 | BLG 102E | Old | 4 | FF |
| 202520 | 2 | blg102e | New | 4 | BA+ |
| bad | 3 | MAT 103E | Bad | nope | AA |
`);
    expect(parsed.calculatedCourses).toHaveLength(1);
    expect(parsed.calculatedCourses[0]).toMatchObject({ term: "202520", grade: "BA+", completionStatus: "passed" });
    expect(parsed.duplicateRows).toHaveLength(1);
    expect(parsed.invalidRows[0].reason).toContain("Term");
  });
});
