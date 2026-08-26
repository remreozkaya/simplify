import { fetchBranchesPage } from "@/lib/itu/client/fetchBranchesPage";
import { ItuObsUpstreamError } from "@/lib/itu/errors";
import { parseUndergraduateBranches } from "@/lib/itu/parsers/parseUndergraduateBranches";
import type { ItuBranch } from "@/lib/itu/types";

export async function getUndergraduateBranches(): Promise<ItuBranch[]> {
  const response = await fetchBranchesPage();

  try {
    return parseUndergraduateBranches(response);
  } catch (error: unknown) {
    throw new ItuObsUpstreamError(
      "İTÜ OBS returned an invalid branch list.",
      { cause: error },
    );
  }
}
