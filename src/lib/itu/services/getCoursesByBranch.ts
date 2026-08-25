import { fetchCoursePage } from "@/lib/itu/client/fetchCoursePage";
import {
  ItuBranchMismatchError,
  ItuObsUpstreamError,
} from "@/lib/itu/errors";
import { normalizeCoursePage } from "@/lib/itu/normalizers/normalizeCoursePage";
import { parseCoursePage } from "@/lib/itu/parsers/parseCoursePage";
import { getUndergraduateBranches } from "@/lib/itu/services/getUndergraduateBranches";
import type { ItuCourseCatalog, ItuCoursesQuery } from "@/lib/itu/types";

export async function getCoursesByBranch(
  query: ItuCoursesQuery,
): Promise<ItuCourseCatalog> {
  const branches = await getUndergraduateBranches();
  const branch = branches.find(
    (candidate) => candidate.id === query.branchId,
  );

  if (!branch || branch.code !== query.branchCode) {
    throw new ItuBranchMismatchError(
      "The supplied İTÜ branch ID and code do not match.",
    );
  }

  const html = await fetchCoursePage(branch.id);

  try {
    const rows = parseCoursePage(html);

    return normalizeCoursePage(rows, branch.id, branch.code);
  } catch (error: unknown) {
    throw new ItuObsUpstreamError(
      `İTÜ OBS returned an invalid ${branch.code} schedule.`,
      { cause: error },
    );
  }
}
