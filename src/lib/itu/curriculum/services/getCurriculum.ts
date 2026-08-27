import { fetchCurriculumDetailPage } from "@/lib/itu/curriculum/client/fetchCurriculumDetail";
import { fetchElectiveGroupPage } from "@/lib/itu/curriculum/client/fetchElectiveGroup";
import {
  fetchPrerequisiteBranchesPage,
  fetchPrerequisitesPage,
} from "@/lib/itu/curriculum/client/fetchPrerequisites";
import { parseCurriculumDetail } from "@/lib/itu/curriculum/parsers/parseCurriculumDetail";
import { parseElectiveGroup } from "@/lib/itu/curriculum/parsers/parseElectiveGroup";
import {
  parsePrerequisiteBranches,
  parsePrerequisites,
} from "@/lib/itu/curriculum/parsers/parsePrerequisites";
import type {
  ItuCoursePrerequisite,
  ItuCurriculum,
  ParsedCurriculum,
} from "@/lib/itu/curriculum/types";
import { ItuObsUpstreamError } from "@/lib/itu/errors";

export function collectElectiveGroupIds(curriculum: ParsedCurriculum): number[] {
  return [
    ...new Set(
      curriculum.semesters.flatMap((semester) =>
        semester.items.flatMap((item) =>
          item.kind === "elective-slot" && item.groupId ? [item.groupId] : [],
        ),
      ),
    ),
  ];
}

export async function getCurriculum(
  planId: number,
  programCode: string,
): Promise<ItuCurriculum> {
  let parsed;
  try {
    parsed = parseCurriculumDetail(
      await fetchCurriculumDetailPage(planId),
      planId,
      programCode,
    );
  } catch (error: unknown) {
    if (error instanceof ItuObsUpstreamError) throw error;
    throw new ItuObsUpstreamError("İTÜ OBS returned invalid curriculum data.", {
      cause: error,
    });
  }
  if (parsed.semesters.length === 0) {
    throw new ItuObsUpstreamError("İTÜ OBS returned a curriculum without semester data.");
  }
  const warnings: string[] = [];
  const groupIds = collectElectiveGroupIds(parsed);
  const groupEntries = await Promise.all(
    groupIds.map(async (groupId) => {
      try {
        return [groupId, parseElectiveGroup(await fetchElectiveGroupPage(groupId))] as const;
      } catch {
        warnings.push(`Elective group ${groupId} could not be loaded.`);
        return [groupId, undefined] as const;
      }
    }),
  );
  const groups = new Map(groupEntries);
  parsed.semesters.forEach((semester) => {
    semester.items.forEach((item) => {
      if (item.kind === "elective-slot" && item.groupId) {
        item.courses = groups.get(item.groupId)?.courses ?? [];
      }
    });
  });

  const courseCodes = parsed.semesters.flatMap((semester) =>
    semester.items.flatMap((item) => (item.kind === "course" ? [item.code] : [])),
  );
  const electiveCourseCodes = parsed.semesters.flatMap((semester) =>
    semester.items.flatMap((item) =>
      item.kind === "elective-slot" ? item.courses.map((course) => course.code) : [],
    ),
  );
  const allKnownCourseCodes = new Set([...courseCodes, ...electiveCourseCodes]);
  const neededBranches = [
    ...new Set(courseCodes.map((code) => code.split(" ")[0])),
  ];
  const prerequisites: Record<string, ItuCoursePrerequisite> = {};
  const prerequisiteBranchesLoaded: string[] = [];
  let prerequisiteDataAvailable = true;
  try {
    const branchMap = parsePrerequisiteBranches(await fetchPrerequisiteBranchesPage());
    await Promise.all(
      neededBranches.map(async (branch) => {
        const branchId = branchMap[branch];
        if (!branchId) {
          warnings.push(`Prerequisite branch ${branch} is unavailable.`);
          return;
        }
        try {
          const records = parsePrerequisites(await fetchPrerequisitesPage(branchId));
          records.forEach((record) => {
            if (allKnownCourseCodes.has(record.courseCode)) prerequisites[record.courseCode] = record;
          });
          prerequisiteBranchesLoaded.push(branch);
        } catch {
          warnings.push(`Prerequisites for ${branch} could not be loaded.`);
        }
      }),
    );
    if (prerequisiteBranchesLoaded.length === 0) prerequisiteDataAvailable = false;
  } catch {
    prerequisiteDataAvailable = false;
    warnings.push("Prerequisite information is temporarily unavailable.");
  }

  return {
    ...parsed,
    prerequisites,
    prerequisiteBranchesLoaded: prerequisiteBranchesLoaded.sort(),
    prerequisiteDataAvailable,
    warnings,
    fetchedAt: new Date().toISOString(),
  };
}
