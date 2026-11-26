import type { CourseBlock } from "@/types/calendar";

export const ITU_ACADEMIC_CALENDAR_URL =
  "https://www.takvim.sis.itu.edu.tr/AkademikTakvim/TR/akademik-takvim/AkademikTakvimTablo.php";

export type CalendarDateRange = { start: string; end: string };
export type AcademicCalendar = CalendarDateRange & {
  term: string;
  breaks: CalendarDateRange[];
};
export type CalendarExportSource = { calendar: AcademicCalendar; source: string };
export type CalendarTermResolution =
  | { kind: "known"; term: string }
  | { kind: "confirm"; term?: string }
  | { kind: "mixed" | "unsupported" };

export function calendarTermDetails(term: string) {
  const match = /^([2-9]\d{3})(10|20|30)$/.exec(term);
  if (!match) return null;
  return {
    year: `${Number(match[1]) - 1}-${match[1]}`,
    season: match[2] === "10" ? "fall" : match[2] === "20" ? "spring" : "summer",
  } as const;
}

function normalizeObsTerm(value?: string) {
  const normalized = value?.normalize("NFC").trim();
  if (!normalized) return null;
  if (calendarTermDetails(normalized)) return normalized;
  const match = /^(\d{4})\s*[-–]\s*([2-9]\d{3})\s+(güz|bahar|yaz|fall|spring|summer)(?:\s+(?:dönemi|öğretimi|semester|term))?$/
    .exec(normalized.toLocaleLowerCase("tr-TR"));
  if (!match || Number(match[1]) + 1 !== Number(match[2])) return null;
  const code = /^(güz|fall)$/.test(match[3]) ? "10" : /^(bahar|spring)$/.test(match[3]) ? "20" : "30";
  return match[2] + code;
}

export function resolveCalendarTerm(meetings: readonly Pick<CourseBlock, "semester">[]): CalendarTermResolution {
  const terms = meetings.map(meeting => normalizeObsTerm(meeting.semester));
  const known = [...new Set(terms.filter(term => term !== null))];
  if (known.length > 1) return { kind: "mixed" };
  const [term] = known;
  if (term?.endsWith("30")) return { kind: "unsupported" };
  if (!term) return { kind: "confirm" };
  return terms.includes(null) ? { kind: "confirm", term } : { kind: "known", term };
}
