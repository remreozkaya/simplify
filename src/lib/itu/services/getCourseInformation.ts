import { ITU_OBS_ORIGIN, ITU_REQUEST_HEADERS, ITU_REQUEST_TIMEOUT_MS } from "@/lib/itu/constants";
import { courseInformationQuery } from "@/lib/itu/courseInformation.mjs";
import { parseCourseInformation } from "@/lib/itu/parsers/parseCourseInformation.mjs";

type Availability = "available" | "missing";
const cache = new Map<string, { state: Availability; expiresAt: number }>();
const inFlight = new Map<string, Promise<Availability>>();
const CACHE_MS = 24 * 60 * 60 * 1000;

export async function getCourseInformation(code: string): Promise<Availability> {
  const query = courseInformationQuery(code);
  if (!query) return "missing";
  const cached = cache.get(query.key);
  if (cached && cached.expiresAt > Date.now()) return cached.state;
  const pending = inFlight.get(query.key);
  if (pending) return pending;
  const lookup = (async (): Promise<Availability> => {
    const url = new URL("/public/DersBilgi/DersBilgiSearch", ITU_OBS_ORIGIN);
    url.searchParams.set("bransKodu", query.branch);
    url.searchParams.set("dersNo", query.number);
    const response = await fetch(url, { headers: ITU_REQUEST_HEADERS, cache: "no-store",
      signal: AbortSignal.timeout(ITU_REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new Error("ITU course information could not be verified.");
    const state = parseCourseInformation(await response.text(), code);
    if (state === "unknown") throw new Error("Unrecognized ITU course information response.");
    // Keep this cache bounded when querying courses outside the current schedule.
    if (cache.size >= 5000) cache.clear();
    cache.set(query.key, { state, expiresAt: Date.now() + CACHE_MS });
    return state;
  })();
  inFlight.set(query.key, lookup);
  try { return await lookup; } finally { inFlight.delete(query.key); }
}
