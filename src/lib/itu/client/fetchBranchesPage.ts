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

export async function fetchBranchesPage(): Promise<unknown> {
  const url = new URL(
    ITU_OBS_PATHS.branchesSearch,
    ITU_OBS_ORIGIN,
  );

  url.searchParams.set(
    ITU_QUERY_PARAMETER_NAMES.programLevel,
    ITU_PROGRAM_LEVELS.undergraduate,
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
      "İTÜ OBS branches could not be reached.",
      { cause: error },
    );
  }

  if (!response.ok) {
    throw new ItuObsUpstreamError(
      `İTÜ OBS branches request failed with status ${response.status}.`,
    );
  }

  const responseText = await response.text();

  try {
    return JSON.parse(responseText) as unknown;
  } catch (error: unknown) {
    throw new ItuObsUpstreamError(
      "İTÜ OBS returned an invalid branch response.",
      { cause: error },
    );
  }
}
