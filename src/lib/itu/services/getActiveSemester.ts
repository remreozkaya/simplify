import { z } from "zod";
import { ITU_OBS_ORIGIN, ITU_OBS_PATHS, ITU_PROGRAM_LEVELS, ITU_QUERY_PARAMETER_NAMES, ITU_REQUEST_HEADERS, ITU_REQUEST_TIMEOUT_MS } from "@/lib/itu/constants";
import { ItuObsUpstreamError } from "@/lib/itu/errors";

/** Resolve the semester before consulting a branch cache; never guess it from the date. */
export async function getActiveSemester(): Promise<string> {
  const url = new URL(ITU_OBS_PATHS.activeSemester, ITU_OBS_ORIGIN);
  url.searchParams.set(ITU_QUERY_PARAMETER_NAMES.programLevel, ITU_PROGRAM_LEVELS.undergraduate);
  try {
    const response = await fetch(url, {
      headers: {...ITU_REQUEST_HEADERS, Accept: "application/json"},
      cache: "no-store",
      signal: AbortSignal.timeout(ITU_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Semester request failed with status ${response.status}.`);
    return z.object({aktifDonem: z.string().trim().min(1).max(150)}).parse(await response.json()).aktifDonem;
  } catch (cause) {
    throw new ItuObsUpstreamError("The active İTÜ semester could not be verified.", {cause});
  }
}
