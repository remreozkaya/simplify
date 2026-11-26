import type { AcademicCalendar } from "@/lib/calendar/academicCalendar";
import type { Language } from "@/lib/i18n/translations";
import { days, type CourseBlock, type WeeklyProgram } from "@/types/calendar";

const weekdayNumbers = [1, 2, 3, 4, 5, 6, 0];
const timeZone = "Europe/Istanbul";
const dayMs = 86_400_000;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const encoder = new TextEncoder();

// Türkiye has used year-round UTC+03:00 since 2016, covering the published terms.
const timezoneLines = [
  "BEGIN:VTIMEZONE",
  `TZID:${timeZone}`,
  "BEGIN:STANDARD",
  "DTSTART:20160907T000000",
  "TZOFFSETFROM:+0300",
  "TZOFFSETTO:+0300",
  "END:STANDARD",
  "END:VTIMEZONE",
];

export class CalendarExportError extends Error {
  constructor(readonly code: "invalidMeeting" | "noOccurrences") {
    super(code);
  }
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|[\r\n]/g, "\\n").replace(/[;,]/g, "\\$&")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}

function foldLine(line: string) {
  let folded = "";
  let length = 0;
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (length + bytes > 75) {
      folded += "\r\n ";
      length = 1;
    }
    folded += character;
    length += bytes;
  }
  return folded;
}

function localDateTime(date: string, time: string) {
  return `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
}

function utcDateTime(date: Date) {
  return date.toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z";
}

function meetingEvents(
  planId: string,
  meeting: CourseBlock,
  calendar: AcademicCalendar,
  language: Language,
  stamp: string,
) {
  const weekday = weekdayNumbers[days.indexOf(meeting.day)];
  if (weekday === undefined || !timePattern.test(meeting.startTime) ||
      !timePattern.test(meeting.endTime) || meeting.endTime <= meeting.startTime) {
    throw new CalendarExportError("invalidMeeting");
  }

  const start = Date.parse(calendar.start);
  const end = Date.parse(calendar.end);
  const firstWeekday = new Date(start).getUTCDay();
  const firstMeeting = start + ((weekday - firstWeekday + 7) % 7) * dayMs;
  const included: string[] = [];
  const excluded: string[] = [];
  for (let date = firstMeeting; date <= end; date += 7 * dayMs) {
    const day = new Date(date).toISOString().slice(0, 10);
    const onBreak = calendar.breaks.some(range => range.start <= day && day <= range.end);
    (onBreak ? excluded : included).push(day);
  }

  const first = included[0];
  const last = included.at(-1);
  if (!first || !last) return [];
  const summary = [meeting.code, meeting.title].filter(Boolean).join(" ").trim();
  const location = [meeting.building, meeting.room].filter(Boolean).join(" · ");
  const description = [
    meeting.crn ? `CRN: ${meeting.crn}` : "",
    meeting.instructor ? `${language === "tr" ? "Öğretim elemanı" : "Instructor"}: ${meeting.instructor}` : "",
  ].filter(Boolean).join("\n");
  const uid = encodeURIComponent(JSON.stringify([planId, calendar.term, meeting.id]));
  const until = utcDateTime(new Date(`${last}T${meeting.startTime}:00+03:00`));

  return [
    "BEGIN:VEVENT",
    `UID:${uid}@simplify`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${timeZone}:${localDateTime(first, meeting.startTime)}`,
    `DTEND;TZID=${timeZone}:${localDateTime(first, meeting.endTime)}`,
    ...(first === last ? [] : [`RRULE:FREQ=WEEKLY;UNTIL=${until}`]),
    ...excluded.filter(day => first < day && day < last)
      .map(day => `EXDATE;TZID=${timeZone}:${localDateTime(day, meeting.startTime)}`),
    `SUMMARY:${escapeText(summary)}`,
    ...(location ? [`LOCATION:${escapeText(location)}`] : []),
    ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
    "END:VEVENT",
  ];
}

export function buildWeeklyCalendar(
  plan: WeeklyProgram,
  calendar: AcademicCalendar,
  language: Language,
  now = new Date(),
) {
  const stamp = utcDateTime(now);
  const events = plan.courseBlocks.flatMap(meeting => meetingEvents(plan.id, meeting, calendar, language, stamp));
  if (!events.length) throw new CalendarExportError("noOccurrences");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Simplify//Weekly Planner//EN",
    "CALSCALE:GREGORIAN",
    ...timezoneLines,
    ...events,
    "END:VCALENDAR",
    "",
  ].map(foldLine).join("\r\n");
}

export function downloadWeeklyCalendar(plan: WeeklyProgram, calendar: AcademicCalendar, language: Language) {
  const ics = buildWeeklyCalendar(plan, calendar, language);
  const name = plan.name.normalize("NFC").trim().replace(/[^\p{L}\p{N}]+/gu, "-")
    .slice(0, 100).replace(/^-+|-+$/g, "") || "weekly-program";
  const filename = `simplify-${name}.ics`;
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
  return filename;
}
