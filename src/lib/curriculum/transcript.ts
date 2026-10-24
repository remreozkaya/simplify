import { gradePoint, isGrade, isPassingGrade } from "@/lib/curriculum/grades";
import type { Grade } from "@/lib/curriculum/grades";
import type { TranscriptCourseRecord } from "@/lib/curriculum/types";
import { normalizeCourseCode } from "@/lib/itu/curriculum/prerequisiteExpression";

export type TranscriptRowError = { line: number; row: string; reason: string };
export type TranscriptParseResult = {
  /** All valid attempts, before latest-attempt selection for graduation. */
  attempts?: TranscriptCourseRecord[];
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

function makeSemesterRecord(cells: string[]): string | TranscriptCourseRecord | null {
  const [term, crn, code, name, language, grade, counted, credit] = cells;
  if (!grade?.trim()) return null; // Future/ungraded requirements are not attempts.
  const countedValue = parseCredit(counted ?? "");
  const creditValue = parseCredit(credit ?? "");
  if (!countedValue || !creditValue) return "Credit must be a number or counted/transcript pair.";
  const record = makeRecord([term, crn, code, name, `${countedValue.countedCredit}/${creditValue.transcriptCredit}`, grade], "calculated");
  return typeof record === "string" ? record : { ...record, ...(language ? { courseLanguage: language.toUpperCase() } : {}) };
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
  const semesterCourses: typeof calculated = [];
  const nonCalculated: Array<{ record: TranscriptCourseRecord; line: number; row: string }> = [];
  const invalidRows: TranscriptRowError[] = [];
  let semesterMode = false;
  let pending: { cells: string[]; line: number; row: string } | null = null;

  function flushPending() {
    if (!pending) return;
    const { cells, line, row } = pending;
    pending = null;
    if (cells.length < 8) {
      invalidRows.push({ line, row, reason: "Incomplete semester course row." });
      return;
    }
    const record = makeSemesterRecord(cells);
    if (typeof record === "string") invalidRows.push({ line, row, reason: record });
    else if (record) semesterCourses.push({ record, line, row });
  }

  markdown.split(/\r?\n/).forEach((row, index) => {
    const cleanedRow = row.replace(/\\\s*$/, "").replace(/^(\d+)\\\./, "$1.");
    const cells = cellsOf(cleanedRow);
    if (!cells.length) return;
    const first = cells[0].toLocaleLowerCase("tr-TR");
    if (/^\d+\s*\.?\s*(?:yarıyıl|yariyil|semester)$/iu.test(first) || /^\d+(?:st|nd|rd|th)\s+semester$/iu.test(first)) {
      flushPending(); semesterMode = true; section = "calculated"; return;
    }
    if (first === "completed english courses" || first === "ingilizce tamamlanan dersler") { flushPending(); semesterMode = false; section = "calculated"; return; }
    if (first === "non-calculated courses" || first === "kullanılmayan dersler") { flushPending(); semesterMode = false; section = "non-calculated"; return; }
    if (isHeader(cells) && cells.some((cell) => ["sayılan kredi", "counted credit"].includes(cell.toLocaleLowerCase("tr-TR")))) {
      flushPending(); semesterMode = true; section = "calculated"; return;
    }
    if (isSeparator(cells) || isHeader(cells) || cells.every((cell) => !cell)) return;
    if (semesterMode) {
      if (first === "tamamlanan" || first === "completed") { flushPending(); return; }
      if (/^\d+$/.test(first) || (!pending && cells.length >= 8)) {
        flushPending();
        pending = { cells, line: index + 1, row };
      } else if (pending) {
        pending.cells.push(...cells);
        pending.row += `\n${row}`;
      }
      if (pending && pending.cells.length >= 8) flushPending();
      return;
    }
    if (!section) { invalidRows.push({ line: index + 1, row, reason: "Course row appears outside a recognized section." }); return; }
    const record = makeRecord(cells, section);
    if (typeof record === "string") { invalidRows.push({ line: index + 1, row, reason: record }); return; }
    (section === "calculated" ? calculated : nonCalculated).push({ record, line: index + 1, row });
  });
  flushPending();
  // The English summary repeats semester rows but omits language/zero-credit courses.
  // Prefer the detailed row for the same attempt, without reporting a duplicate import.
  const detailedAttempts = new Set(semesterCourses.map(({ record }) => `${record.term}:${record.courseCode}`));
  const allCalculated = [...calculated.filter(({ record }) => !detailedAttempts.has(`${record.term}:${record.courseCode}`)), ...semesterCourses];
  const selectedCalculated = applicableAttempts(allCalculated);
  const selectedNonCalculated = applicableAttempts(nonCalculated);
  return {
    attempts: [...allCalculated, ...nonCalculated].map(({ record }) => record),
    calculatedCourses: selectedCalculated.records,
    nonCalculatedCourses: selectedNonCalculated.records,
    invalidRows,
    duplicateRows: [...selectedCalculated.duplicates, ...selectedNonCalculated.duplicates],
  };
}

/** Total passed credits across the transcript, including unused courses. */
export function calculateEarnedCredits(records: readonly TranscriptCourseRecord[]): number {
  return records.reduce((sum, record) => sum + (record.completionStatus === "passed" ? record.countedCredit : 0), 0);
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
