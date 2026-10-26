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
import { courseLanguageVariants } from "@/lib/itu/courseCode.mjs";
import { getStoredEquivalenceRules, getStoredEquivalenceCoverage } from "@/lib/curriculum/equivalenceStore";
import { readStoredCurriculumCatalog } from "@/lib/itu/curriculum/catalogStore";

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

export function collectPrerequisiteBranchCodes(curriculum: ParsedCurriculum): string[] {
  return [
    ...new Set(
      curriculum.semesters.flatMap((semester) =>
        semester.items.flatMap((item) =>
          item.kind === "course"
            ? [item.code.split(" ")[0]]
            : item.courses.map((course) => course.code.split(" ")[0]),
        ),
      ),
    ),
  ].sort();
}

export async function getCurriculum(
  planId: number,
  programCode: string,
  planType: import("@/lib/itu/curriculum/types").ItuPlanType = "undergraduate",
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
    throw new ItuObsUpstreamError("İTÜ OBS returned a curriculum without course data.");
  }
  const warnings: string[] = [getStoredEquivalenceCoverage(programCode, planId) === "unavailable"
    ? "Official equivalence coverage is unavailable for this curriculum."
    : "Official equivalence coverage is incomplete for this curriculum."];

  const groupIds = collectElectiveGroupIds(parsed);
  const storedCatalog = groupIds.length ? await readStoredCurriculumCatalog() : null;
  const groupEntries = await Promise.all(
    groupIds.map(async (groupId) => {
      try {
        const knownCourses = (storedCatalog?.electiveGroups?.[String(groupId)]?.courses ?? [])
          .filter((course): course is { code: string; title: string } =>
            typeof course === "object" && course !== null &&
            "code" in course && typeof course.code === "string" &&
            "title" in course && typeof course.title === "string",
          );
        return [groupId, parseElectiveGroup(await fetchElectiveGroupPage(groupId), knownCourses)] as const;
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
  const allKnownCourseCodes = new Set([...courseCodes, ...electiveCourseCodes].flatMap(courseLanguageVariants));
  const neededBranches = collectPrerequisiteBranchCodes(parsed);
  const prerequisites: Record<string, ItuCoursePrerequisite> = {};
  const prerequisiteBranchesLoaded: string[] = [];
  let prerequisiteDataAvailable = true;
  try {
    const branchMap = parsePrerequisiteBranches(await fetchPrerequisiteBranchesPage());
    await Promise.all(
      neededBranches.map(async (branch) => {
        const branchId = branchMap[branch];
        if (!branchId) {
          // A branch absent from the official prerequisite index has no prerequisites.
          prerequisiteBranchesLoaded.push(branch);
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

  // Keep the published record authoritative. Under the existing language
  // counterpart model, use its evidence only where the exact code is absent.
  [...courseCodes, ...electiveCourseCodes].forEach((code) => {
    if (prerequisites[code]) return;
    const counterpart = courseLanguageVariants(code).slice(1)
      .map((variant) => prerequisites[variant]).find(Boolean);
    if (counterpart) prerequisites[code] = { ...counterpart, courseCode: code };
  });

  return {
    ...parsed,
    planType,
    equivalenceRules: getStoredEquivalenceRules(programCode, planId),
    prerequisites,
    prerequisiteBranchesLoaded: prerequisiteBranchesLoaded.sort(),
    prerequisiteDataAvailable,
    warnings,
    fetchedAt: new Date().toISOString(),
  };
}
