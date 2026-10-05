import { ITU_CACHE_REVALIDATE_SECONDS, ITU_EMPTY_CELL_VALUES } from "@/lib/itu/constants";
import { markCatalogUnavailable } from "@/lib/itu/services/semesterCache";
import { getActiveSemester } from "@/lib/itu/services/getActiveSemester";
import { fetchCoursePage } from "@/lib/itu/client/fetchCoursePage";
import {
  ItuBranchMismatchError,
  ItuObsUpstreamError,
} from "@/lib/itu/errors";
import { normalizeCoursePage } from "@/lib/itu/normalizers/normalizeCoursePage";
import { parseCoursePage } from "@/lib/itu/parsers/parseCoursePage";
import { getUndergraduateBranches } from "@/lib/itu/services/getUndergraduateBranches";
import type { ItuCourseCatalog, ItuCoursesQuery } from "@/lib/itu/types";

const validatedCatalogs = new Map<string, ItuCourseCatalog>();

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

  const semester = await getActiveSemester();
  const key = `${semester}:${branch.id}:${branch.code}`;
  const cached = validatedCatalogs.get(key);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < ITU_CACHE_REVALIDATE_SECONDS * 1000) return cached;

  try {
    const html = await fetchCoursePage(branch.id);
    const rows = parseCoursePage(html);
    // Do not erase previously validated offerings on an empty refresh. A new
    // semester may legitimately have an explicitly empty schedule.
    if (rows.length === 0 && cached?.courses.length) throw new Error("No usable course rows were returned.");
    const catalog = normalizeCoursePage(rows, branch.id, branch.code, new Date().toISOString(), semester);
    if (cached?.courses.length) {
      if (catalog.courses.length === 0) throw new Error("No usable recurring meetings were returned.");
      const previouslyRestricted = cached.courses.flatMap((course) => course.sections)
        .filter((section) => section.programRestriction?.state === "allowlist");
      const hasEmptyRestriction = (raw: string | undefined) => raw === undefined || ITU_EMPTY_CELL_VALUES.has(raw.trim());
      const restrictionsDisappeared = previouslyRestricted.length > 0 && (
        rows.every((row) => hasEmptyRestriction(row.majorRestriction)) ||
        previouslyRestricted.some((section) => rows.some((row) => row.crn === section.crn && hasEmptyRestriction(row.majorRestriction)))
      );
      // Missing/blank source restrictions cannot replace verified allowlists.
      // Keep the whole same-semester snapshot rather than transplanting old
      // restrictions into newly fetched sections or another semester.
      if (restrictionsDisappeared) throw new Error("Previously supplied program restrictions are missing.");
    }
    for (const [oldKey, oldCatalog] of validatedCatalogs) {
      if (oldCatalog.semester !== semester) validatedCatalogs.delete(oldKey);
    }
    validatedCatalogs.set(key, catalog);
    return catalog;
  } catch (error: unknown) {
    if (cached) return markCatalogUnavailable(cached);
    throw new ItuObsUpstreamError(
      `İTÜ OBS returned an invalid ${branch.code} schedule.`,
      { cause: error },
    );
  }
}
