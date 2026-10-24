import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { GRADE_POINTS, GRADES, gradePoint } from "@/lib/curriculum/grades";
import { calculateEarnedCredits, calculateGpa, parseCredit, parseTranscriptMarkdown } from "@/lib/curriculum/transcript";
import { normalizeCourseCode } from "@/lib/itu/curriculum/prerequisiteExpression";
import { courseLanguageFromCode, courseLanguageVariants } from "@/lib/itu/courseCode.mjs";

const sample = readFileSync(join(process.cwd(), "tests/fixtures/transcript/sample.md"), "utf8");
const turkishSample = readFileSync(join(process.cwd(), "tests/fixtures/transcript/sample-tr.txt"), "utf8");
const semesterSample = readFileSync(join(process.cwd(), "tests/fixtures/transcript/semester-tr.txt"), "utf8");

describe("transcript parser", () => {
  it("totals 99 earned credits including unused courses and the counted side of split credits", () => {
    const parsed = parseTranscriptMarkdown(`${semesterSample}\n${turkishSample}\nCompleted English Courses\n202610\t12301\tECN 105E\tMicroeconomics\t3.5\tAA\n202620\t23672\tECN 102E\tMacroeconomics\t3.5\tAA\n202620\t23682\tECN 201E\tIntermediate Microeconomics\t3.5\tAA\n202610\t12308\tECN 211E\tStatistics\t4\tAA\n202620\t23689\tECN 301E\tEconometrics\t3.5\tAA`);
    const courses = [...parsed.calculatedCourses, ...parsed.nonCalculatedCourses];
    expect(parsed.calculatedCourses.reduce((sum, course) => sum + course.transcriptCredit, 0)).toBe(97);
    expect(calculateEarnedCredits(courses)).toBe(99);
    expect(calculateEarnedCredits(parsed.nonCalculatedCourses)).toBe(3);
    expect(calculateEarnedCredits(parsed.calculatedCourses)).toBe(96);
    expect(calculateGpa(courses)).toBe(calculateGpa(parsed.calculatedCourses));
  });

  it("does not count failed courses or award credits to zero-credit BL courses", () => {
    const parsed = parseTranscriptMarkdown("Completed English Courses\n202510\t1\tMAT103E\tMath\t4\tFF\n202510\t2\tTUR121\tTurkish I\t0\tBL");
    expect(calculateEarnedCredits(parsed.calculatedCourses)).toBe(0);
    expect(calculateEarnedCredits([])).toBe(0);
  });

  it("imports multiline OBS semester rows, including all five zero-credit BL courses", () => {
    const parsed = parseTranscriptMarkdown(semesterSample);
    expect(parsed.invalidRows).toEqual([]);
    expect(parsed.calculatedCourses).toHaveLength(34);
    expect(parsed.duplicateRows).toEqual([]);
    expect(parsed.calculatedCourses.filter((course) => course.grade === "BL").map((course) => course.courseCode)).toEqual(["DAN 102", "TUR 121", "TUR 122", "ATA 121", "ATA 122"]);
    expect(parsed.calculatedCourses.find((course) => course.courseCode === "TUR 121")).toMatchObject({ completionStatus: "passed", countedCredit: 0, transcriptCredit: 0, courseLanguage: "TR" });
    expect(parsed.calculatedCourses.find((course) => course.courseCode === "BLG 478E")).toMatchObject({ countedCredit: 2, transcriptCredit: 3 });
    expect(parsed.calculatedCourses.some((course) => course.courseCode === "EHB 222E")).toBe(false);
    expect(parsed.calculatedCourses.reduce((sum, course) => sum + course.countedCredit, 0)).toBe(78);
  });

  it("does not duplicate the repeated English summary or overwrite detailed grades and languages", () => {
    const parsed = parseTranscriptMarkdown(`${semesterSample}\n${turkishSample}`);
    expect(parsed.invalidRows).toEqual([]);
    expect(parsed.duplicateRows).toEqual([]);
    expect(parsed.calculatedCourses).toHaveLength(34);
    expect(parsed.attempts).toHaveLength(35);
    expect(parsed.nonCalculatedCourses).toHaveLength(1);
    expect(parsed.calculatedCourses.find((course) => course.courseCode === "BLG 374E")?.grade).toBe("BA");
    expect(parsed.calculatedCourses.find((course) => course.courseCode === "ISP 101")?.courseLanguage).toBe("EN");
  });

  it("supports a single-line English semester table and keeps failures without importing ungraded courses", () => {
    const parsed = parseTranscriptMarkdown("1st Semester\nTerm\tCRN\tCourse Code\tCourse Name\tCourse Language\tGrade\tCounted Credit\tCredit\tStatus\n202510\t1\tTUR121\tTurkish I\tTR\tBL\t0\t0\tPassed\n202510\t2\tMAT103E\tMath\tEN\tFF\t0\t4\tFailed\n202510\t3\tFIZ101E\tPhysics\tEN\t\t0\t3\t");
    expect(parsed.invalidRows).toEqual([]);
    expect(parsed.calculatedCourses).toHaveLength(2);
    expect(parsed.calculatedCourses[1]).toMatchObject({ completionStatus: "failed", countedCredit: 0, transcriptCredit: 4 });
  });

  it("accepts Markdown hard breaks around pasted OBS semester text", () => {
    const escaped = semesterSample.replace(/^([1-8])\./gm, "$1\\.").split("\n").join("\\\n");
    expect(parseTranscriptMarkdown(escaped).calculatedCourses).toHaveLength(34);
  });

  it("reports malformed graded semester rows and continues importing later rows", () => {
    const parsed = parseTranscriptMarkdown("1. Yarıyıl\n202510\t1\tMAT103E\tMath\tEN\tXX\t4\t4\n202510\t2\tFIZ101E\tPhysics\tEN\tAA\tbad\t3\n202510\t3\n2. Yarıyıl\n202520\t4\tTUR121\tTurkish I\tTR\tBL\t0\t0");
    expect(parsed.invalidRows.map((row) => row.reason)).toEqual(["Unknown grade: XX.", "Credit must be a number or counted/transcript pair.", "Incomplete semester course row."]);
    expect(parsed.calculatedCourses).toHaveLength(1);
    expect(parsed.calculatedCourses[0].courseCode).toBe("TUR 121");
  });

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
