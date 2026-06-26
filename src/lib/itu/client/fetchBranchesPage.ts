import {
  ITU_CACHE_REVALIDATE_SECONDS,
  ITU_OBS_ORIGIN,
  ITU_OBS_PATHS,
  ITU_REQUEST_HEADERS,
  ITU_REQUEST_TIMEOUT_MS,
} from "@/lib/itu/constants";

export async function fetchBranchesPage(): Promise<string> {
  const url = new URL(
    ITU_OBS_PATHS.courseSchedule,
    ITU_OBS_ORIGIN,
  );

  const response = await fetch(url, {
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

  if (!response.ok) {
    throw new Error(
      `İTÜ OBS branches request failed with status ${response.status}.`,
    );
  }

  return response.text();
}