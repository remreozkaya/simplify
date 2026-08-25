import { fetchCoursePage } from "@/lib/itu/client/fetchCoursePage";
import { ItuObsUpstreamError } from "@/lib/itu/errors";
import { normalizeCoursePage } from "@/lib/itu/normalizers/normalizeCoursePage";
import { parseCoursePage } from "@/lib/itu/parsers/parseCoursePage";
import { getUndergraduateBranches } from "@/lib/itu/services/getUndergraduateBranches";
import type { ItuCourseCatalog } from "@/lib/itu/types";

export async function getAllUndergraduateCourses(): Promise<
  ItuCourseCatalog[]
> {
  const branches = await getUndergraduateBranches();
  const catalogs: ItuCourseCatalog[] = [];

  // Keep the rarely used bulk operation deliberately sequential so it cannot
  // create a burst of requests against the public OBS service.
  for (const branch of branches) {
    const html = await fetchCoursePage(branch.id);

    try {
      catalogs.push(
        normalizeCoursePage(
          parseCoursePage(html),
          branch.id,
          branch.code,
        ),
      );
    } catch (error: unknown) {
      throw new ItuObsUpstreamError(
        `İTÜ OBS returned an invalid ${branch.code} schedule.`,
        { cause: error },
      );
    }
  }

  return catalogs;
}
