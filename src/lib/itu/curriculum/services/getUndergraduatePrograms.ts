import { fetchUndergraduateProgramsPage } from "@/lib/itu/curriculum/client/fetchUndergraduatePrograms";
import { parseUndergraduatePrograms } from "@/lib/itu/curriculum/parsers/parseUndergraduatePrograms";
import { ItuObsUpstreamError } from "@/lib/itu/errors";

export async function getUndergraduatePrograms() {
  try {
    const programs = parseUndergraduatePrograms(await fetchUndergraduateProgramsPage());
    if (!programs.length) throw new Error("No undergraduate programs were parsed.");
    return programs;
  } catch (error: unknown) {
    if (error instanceof ItuObsUpstreamError) throw error;
    throw new ItuObsUpstreamError("İTÜ OBS returned an invalid undergraduate program list.", {
      cause: error,
    });
  }
}
