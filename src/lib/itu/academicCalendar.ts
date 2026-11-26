import { load } from "cheerio";
import { z } from "zod";
import {
  ITU_ACADEMIC_CALENDAR_URL,
  calendarTermDetails,
  type AcademicCalendar,
  type CalendarDateRange,
  type CalendarExportSource,
} from "@/lib/calendar/academicCalendar";
import { ITU_REQUEST_HEADERS, ITU_REQUEST_TIMEOUT_MS } from "@/lib/itu/constants";

const undergraduate = "Lisans / Önlisans Akademik Takvimi";
const months = [
  "ocak", "şubat", "mart", "nisan", "mayıs", "haziran",
  "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık",
];
const isoDate = z.iso.date();

function normalize(text: string) {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

export function parseCalendarFilters(html: string) {
  const $ = load(html);
  const years: Record<string, string> = {};
  for (const option of $("#akademikyil option").toArray()) {
    const year = /^(\d{4})\s*[-–]\s*(\d{4})/.exec(normalize($(option).text()));
    const id = $(option).val();
    if (year && Number(year[1]) + 1 === Number(year[2]) && typeof id === "string" && /^\d+$/.test(id)) {
      years[`${year[1]}-${year[2]}`] = id;
    }
  }
  const group = $("#takvimadi option").filter((_, option) => normalize($(option).text()) === undergraduate);
  const groupId = group.val();
  if (!Object.keys(years).length || group.length !== 1 || typeof groupId !== "string" || !/^\d+$/.test(groupId)) {
    throw new Error("İTÜ academic calendar filters are invalid.");
  }
  return { years, undergraduate: groupId };
}

function parseDate(text: string, endOfRange?: string) {
  const parts = /^(\d{1,2})(?: ([\p{L}]+)(?: (\d{4}))?)?$/u.exec(text.toLocaleLowerCase("tr-TR"));
  if (!parts) throw new Error("Invalid İTÜ calendar date.");
  const month = parts[2] ? String(months.indexOf(parts[2]) + 1).padStart(2, "0") : endOfRange?.slice(5, 7);
  const year = parts[3] ?? endOfRange?.slice(0, 4);
  if (!month || !year) throw new Error("Incomplete İTÜ calendar date.");
  const inferredYear = !parts[3] && endOfRange && month > endOfRange.slice(5, 7)
    ? String(Number(year) - 1)
    : year;
  return isoDate.parse(`${inferredYear}-${month}-${parts[1].padStart(2, "0")}`);
}

function parseBreak(text: string): CalendarDateRange {
  const parts = text.split(/\s*[-–—]\s*/u);
  if (parts.length === 1) {
    const date = parseDate(parts[0]);
    return { start: date, end: date };
  }
  if (parts.length !== 2) throw new Error("Invalid İTÜ break range.");
  const end = parseDate(parts[1]);
  return { start: parseDate(parts[0], end), end };
}

export function parseAcademicCalendar(html: string, term: string): AcademicCalendar | null {
  const details = calendarTermDetails(term);
  if (!details || details.season === "summer") return null;

  const $ = load(html);
  const headingPattern = /^(\d{4})\s*[-–]\s*(\d{4}) Eğitim\s*[-–]\s*Öğretim Yılı (.+)$/u;
  const heading = $("h4").filter((_, element) => {
    const match = headingPattern.exec(normalize($(element).text()));
    return Boolean(match && `${match[1]}-${match[2]}` === details.year && match[3] === undergraduate);
  });
  if (!heading.length) return null;
  if (heading.length !== 1) throw new Error("Conflicting İTÜ undergraduate calendar sections.");

  const season = details.season === "fall" ? "Güz" : "Bahar";
  const rows: { label: string; date: string }[] = [];
  let sections = 0;
  let inTerm = false;
  for (const row of heading.next(".table-responsive").children("table").find("tr").toArray()) {
    const cells = $(row).children("td, th");
    const label = normalize(cells.first().text());
    const date = normalize(cells.eq(1).text());
    if (date === "Tarih" && cells.first().hasClass("tablo-baslik")) {
      inTerm = label === `${season} Dönemi`;
      if (inTerm) sections++;
    } else if (inTerm) {
      rows.push({ label, date });
    }
  }
  if (sections !== 1) throw new Error("Missing or conflicting İTÜ calendar semester.");

  const boundary = (suffix: string) => {
    const matches = rows.filter(row => row.label === `${season} Yarıyılı ${suffix}`);
    if (matches.length !== 1) throw new Error("Missing or conflicting İTÜ calendar boundary.");
    return parseDate(matches[0].date);
  };
  const start = boundary("Başlangıcı");
  const end = boundary("Sonu");
  const breaks = rows.filter(row => row.label === "Ara Tatil").map(row => parseBreak(row.date));
  if (end < start || breaks.some(range => range.start < start || range.end > end || range.end < range.start)) {
    throw new Error("Invalid İTÜ academic calendar range.");
  }
  return { term, start, end, breaks };
}

const cacheTtl = 5 * 60 * 1000;

function cachedLookup<Key, Value>(loadValue: (key: Key) => Promise<Value>) {
  const cache = new Map<Key, { value: Promise<Value>; expires: number }>();
  return (key: Key) => {
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    for (const [expiredKey, entry] of cache) {
      if (entry.expires <= Date.now()) cache.delete(expiredKey);
    }
    const value = loadValue(key);
    cache.set(key, { value, expires: Date.now() + cacheTtl });
    void value.catch(() => {
      if (cache.get(key)?.value === value) cache.delete(key);
    });
    return value;
  };
}

async function fetchCalendarHtml(url: string) {
  const response = await fetch(url, {
    headers: ITU_REQUEST_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(ITU_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`İTÜ academic calendar returned ${response.status}.`);
  return response.text();
}

const getFilters = cachedLookup<void, ReturnType<typeof parseCalendarFilters>>(async () =>
  parseCalendarFilters(await fetchCalendarHtml(ITU_ACADEMIC_CALENDAR_URL)));

export async function getAcademicCalendarYears() {
  const { years } = await getFilters();
  return Object.keys(years).sort().reverse();
}

export const getAcademicCalendar = cachedLookup(async (term: string): Promise<CalendarExportSource | null> => {
  const details = calendarTermDetails(term);
  if (!details || details.season === "summer") return null;

  const filters = await getFilters();
  const yearId = filters.years[details.year];
  if (!yearId) return null;
  const url = new URL(ITU_ACADEMIC_CALENDAR_URL);
  url.searchParams.set("akademikyil", yearId);
  url.searchParams.set("takvimadi", filters.undergraduate);
  const source = url.toString();
  const calendar = parseAcademicCalendar(await fetchCalendarHtml(source), term);
  if (!calendar) throw new Error("The requested İTÜ academic calendar section is missing.");
  return { calendar, source };
});
