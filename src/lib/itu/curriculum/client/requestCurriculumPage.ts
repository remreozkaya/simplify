import {
  ITU_OBS_ORIGIN,
  ITU_REQUEST_HEADERS,
  ITU_REQUEST_TIMEOUT_MS,
} from "@/lib/itu/constants";
import { ItuObsUpstreamError } from "@/lib/itu/errors";

export const CURRICULUM_REVALIDATE_SECONDS = 6 * 60 * 60;

export async function requestCurriculumPage(
  pathname: string,
  searchParams?: Record<string, string>,
): Promise<string> {
  const url = new URL(pathname, ITU_OBS_ORIGIN);
  Object.entries(searchParams ?? {}).forEach(([key, value]) => url.searchParams.set(key, value));
  let response: Response;
  try {
    response = await fetch(url, {
      headers: ITU_REQUEST_HEADERS,
      next: { revalidate: CURRICULUM_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(ITU_REQUEST_TIMEOUT_MS),
    });
  } catch (error: unknown) {
    throw new ItuObsUpstreamError("İTÜ OBS curriculum data could not be reached.", {
      cause: error,
    });
  }
  if (!response.ok) {
    throw new ItuObsUpstreamError(
      `İTÜ OBS curriculum request failed with status ${response.status}.`,
    );
  }
  return response.text();
}
