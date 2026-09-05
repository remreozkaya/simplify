import { gradePoint, isGrade, isPassingGrade } from "@/lib/curriculum/grades";
import type { Grade } from "@/lib/curriculum/grades";
import type { TranscriptCourseRecord } from "@/lib/curriculum/types";
import { normalizeCourseCode } from "@/lib/itu/curriculum/prerequisiteExpression";

export type TranscriptRowError = { line: number; row: string; reason: string };
export type TranscriptParseResult = {
  calculatedCourses: TranscriptCourseRecord[];
  nonCalculatedCourses: TranscriptCourseRecord[];
  invalidRows: TranscriptRowError[];
  duplicateRows: TranscriptRowError[];
};
type Section = "calculated" | "non-calculated" | null;

export function parseCredit(value: string): { countedCredit: number; transcriptCredit: number } | null {
  const parts = value.split("/").map((part) => part.trim().replace(",", "."));
  if (parts.length > 2 || parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part))) return null;
  const numbers = parts.map(Number);
  if (numbers.some((number) => !Number.isFinite(number) || number < 0)) return null;
  return { countedCredit: numbers[0], transcriptCredit: numbers[1] ?? numbers[0] };
}

function cellsOf(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  if (trimmed.includes("\t")) return trimmed.split("\t").map((cell) => cell.trim());
  if (!trimmed.includes("|")) return [trimmed];
  return trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replace(/^\*+/, "").replace(/\*+$/, "").trim());
}
function isSeparator(cells: string[]) { return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell)); }
function isHeader(cells: string[]) {
  const normalized = cells.map((cell) => cell.toLocaleLowerCase("tr-TR"));
  return (
    normalized.includes("term") && normalized.includes("course code") && normalized.includes("grade")
  ) || (
    normalized.includes("dönem") && normalized.includes("ders kodu") && normalized.includes("not")
  );
}

function makeRecord(cells: string[], section: Exclude<Section, null>): string | TranscriptCourseRecord {
  const [term, crn, courseCode, courseName] = cells;
  const hasLanguage = section === "non-calculated" && cells.length >= 7;
  const courseLanguage = hasLanguage ? cells[4] : undefined;
  const creditValue = cells[hasLanguage ? 5 : 4];
  const gradeValue = cells[hasLanguage ? 6 : 5]?.toUpperCase();
  if (!term || !/^\d+$/.test(term)) return "Term must be numeric.";
  if (!crn || !/^\d+$/.test(crn)) return "CRN must be numeric.";
  if (!courseCode) return "Course code is required.";
  if (!courseName) return "Course name is required.";
  const normalizedCode = normalizeCourseCode(courseCode);
  if (!/^[A-ZÇĞİÖŞÜ]{2,8}\s\d{2,5}[A-Z]{0,3}$/u.test(normalizedCode)) return "Course code is invalid.";
  const credit = parseCredit(creditValue ?? "");
  if (!credit) return "Credit must be a number or counted/transcript pair.";
  if (!gradeValue || !isGrade(gradeValue)) return `Unknown grade: ${gradeValue || "empty"}.`;
  const grade = gradeValue as Grade;
  return {
    term, crn, courseCode: normalizedCode, courseName,
    ...(courseLanguage ? { courseLanguage: courseLanguage.toUpperCase() } : {}),
    grade, ...credit, completionStatus: isPassingGrade(grade) ? "passed" : "failed",
    source: "transcript", calculated: section === "calculated",
  };
}

function applicableAttempts(records: Array<{ record: TranscriptCourseRecord; line: number; row: string }>) {
  const byCode = new Map<string, { record: TranscriptCourseRecord; line: number; row: string }>();
  const duplicates: TranscriptRowError[] = [];
  records.forEach((candidate) => {
    const existing = byCode.get(candidate.record.courseCode);
    if (!existing) { byCode.set(candidate.record.courseCode, candidate); return; }
    const candidateWins = Number(candidate.record.term) >= Number(existing.record.term);
    const removed = candidateWins ? existing : candidate;
    if (candidateWins) byCode.set(candidate.record.courseCode, candidate);
    duplicates.push({ line: removed.line, row: removed.row, reason: `Older duplicate attempt for ${removed.record.courseCode}; the most recent term is used.` });
  });
  return { records: [...byCode.values()].map(({ record }) => record), duplicates };
}

export function parseTranscriptMarkdown(markdown: string): TranscriptParseResult {
  let section: Section = null;
  const calculated: Array<{ record: TranscriptCourseRecord; line: number; row: string }> = [];
  const nonCalculated: Array<{ record: TranscriptCourseRecord; line: number; row: string }> = [];
  const invalidRows: TranscriptRowError[] = [];
  markdown.split(/\r?\n/).forEach((row, index) => {
    const cells = cellsOf(row);
    if (!cells.length) return;
    const first = cells[0].toLocaleLowerCase("tr-TR");
    if (first === "completed english courses" || first === "ingilizce tamamlanan dersler") { section = "calculated"; return; }
    if (first === "non-calculated courses" || first === "kullanılmayan dersler") { section = "non-calculated"; return; }
    if (isSeparator(cells) || isHeader(cells) || cells.every((cell) => !cell)) return;
    if (!section) { invalidRows.push({ line: index + 1, row, reason: "Course row appears outside a recognized section." }); return; }
    const record = makeRecord(cells, section);
    if (typeof record === "string") { invalidRows.push({ line: index + 1, row, reason: record }); return; }
    (section === "calculated" ? calculated : nonCalculated).push({ record, line: index + 1, row });
  });
  const selectedCalculated = applicableAttempts(calculated);
  const selectedNonCalculated = applicableAttempts(nonCalculated);
  return {
    calculatedCourses: selectedCalculated.records,
    nonCalculatedCourses: selectedNonCalculated.records,
    invalidRows,
    duplicateRows: [...selectedCalculated.duplicates, ...selectedNonCalculated.duplicates],
  };
}

export function calculateGpa(records: readonly TranscriptCourseRecord[]): number | null {
  let weighted = 0; let credits = 0;
  records.forEach((record) => {
    if (!record.calculated) return;
    const point = gradePoint(record.grade);
    if (point === null) return;
    weighted += record.transcriptCredit * point; credits += record.transcriptCredit;
  });
  return credits > 0 ? weighted / credits : null;
}
