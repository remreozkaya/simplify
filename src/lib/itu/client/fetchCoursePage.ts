import {
  ITU_CACHE_REVALIDATE_SECONDS,
  ITU_OBS_ORIGIN,
  ITU_OBS_PATHS,
  ITU_PROGRAM_LEVELS,
  ITU_QUERY_PARAMETER_NAMES,
  ITU_REQUEST_HEADERS,
  ITU_REQUEST_TIMEOUT_MS,
} from "@/lib/itu/constants";
import { ItuObsUpstreamError } from "@/lib/itu/errors";

export async function fetchCoursePage(
  branchId: number,
): Promise<string> {
  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw new Error(
      `Invalid İTÜ branch ID: ${branchId}`,
    );
  }

  const url = new URL(
    ITU_OBS_PATHS.courseSearch,
    ITU_OBS_ORIGIN,
  );

  url.searchParams.set(
    ITU_QUERY_PARAMETER_NAMES.programLevel,
    ITU_PROGRAM_LEVELS.undergraduate,
  );

  url.searchParams.set(
    ITU_QUERY_PARAMETER_NAMES.branchId,
    branchId.toString(),
  );

  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: ITU_REQUEST_HEADERS,
      next: {
        revalidate:
          ITU_CACHE_REVALIDATE_SECONDS,
      },
      signal: AbortSignal.timeout(
        ITU_REQUEST_TIMEOUT_MS,
      ),
    });
  } catch (error: unknown) {
    throw new ItuObsUpstreamError(
      "İTÜ OBS course schedules could not be reached.",
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new ItuObsUpstreamError(
      `İTÜ OBS course request failed with status ${response.status}.`,
    );
  }

  return response.text();
}
