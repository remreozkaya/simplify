import { readFile } from "node:fs/promises";
import { cache } from "react";
import { join } from "node:path";

import type { ItuFaculty, ItuPlanType } from "@/lib/itu/curriculum/types";

type StoredPlan = {
  id: number;
  programCode: string;
  programName: string;
  facultyId: string;
  planType: ItuPlanType;
  title: string;
  validityPeriod?: string | null;
  sourceUrl: string;
  associatedPrimaryPrograms?: { code: string; name: string }[];
  retrievedAt: string;
  courses?: unknown[];
};

type StoredCatalog = {
  version: 1;
  faculties: ItuFaculty[];
  programs: { code: string; name: string; facultyId: string; facultyName: string; planType: ItuPlanType }[];
  plans: StoredPlan[];
};

export const readStoredCurriculumCatalog = cache(async (): Promise<StoredCatalog | null> => {
  try {
    const parsed = JSON.parse(await readFile(join(process.cwd(), "src/data/itu/curriculum-catalog.json"), "utf8")) as StoredCatalog;
    if (parsed.version !== 1 || !parsed.faculties.length || !parsed.programs.length || !parsed.plans.length) return null;
    return {
      ...parsed,
      faculties: parsed.faculties.map((faculty) => ({ ...faculty, nameTr: faculty.nameTr ?? faculty.name })),
    };
  } catch {
    return null;
  }
});
