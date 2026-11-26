import { calendarTermDetails } from "@/lib/calendar/academicCalendar";
import { getAcademicCalendar, getAcademicCalendarYears } from "@/lib/itu/academicCalendar";

export async function GET(request: Request) {
  const term = new URL(request.url).searchParams.get("term");
  const details = term === null ? null : calendarTermDetails(term);
  if (term !== null && (!details || details.season === "summer")) {
    return Response.json({ error: "INVALID_TERM" }, { status: 400 });
  }

  try {
    if (term === null) return Response.json({ years: await getAcademicCalendarYears() });
    const result = await getAcademicCalendar(term);
    return result
      ? Response.json(result)
      : Response.json({ error: "TERM_UNAVAILABLE" }, { status: 404 });
  } catch {
    return Response.json({ error: "CALENDAR_UNAVAILABLE" }, { status: 502 });
  }
}
