export const GRADES = [
  "AA",
  "BA+",
  "BA",
  "BB+",
  "BB",
  "CB+",
  "CB",
  "CC+",
  "CC",
  "DC+",
  "DC",
  "DD+",
  "DD",
  "FD",
  "FF",
  "VF",
  "BL",
] as const;

export type Grade = (typeof GRADES)[number];

/** Numeric grades affect GPA. BL is a successful pass/fail grade. */
export const GRADE_POINTS: Readonly<Record<Exclude<Grade, "BL">, number>> = {
  AA: 4,
  "BA+": 3.75,
  BA: 3.5,
  "BB+": 3.25,
  BB: 3,
  "CB+": 2.75,
  CB: 2.5,
  "CC+": 2.25,
  CC: 2,
  "DC+": 1.75,
  DC: 1.5,
  "DD+": 1.25,
  DD: 1,
  FD: 0.5,
  FF: 0,
  VF: 0,
};

export const PASSING_GRADES: ReadonlySet<Grade> = new Set([
  "AA", "BA+", "BA", "BB+", "BB", "CB+", "CB", "CC+", "CC", "DC+", "DC", "DD+", "DD", "BL",
]);

export function isGrade(value: string): value is Grade {
  return (GRADES as readonly string[]).includes(value);
}

export function gradePoint(grade: Grade): number | null {
  return grade === "BL" ? null : GRADE_POINTS[grade];
}

export function isPassingGrade(grade: Grade): boolean {
  return PASSING_GRADES.has(grade);
}
