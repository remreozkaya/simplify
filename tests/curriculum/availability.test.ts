import { describe, expect, it } from "vitest";

import {
  availableCoursesForElectiveSlot,
  isCurriculumItemAvailableThisSemester,
} from "@/lib/curriculum/availability";
import { emptyProgress } from "@/lib/curriculum/progress";
import type { ItuCurriculum, ItuElectiveSlot } from "@/lib/itu/curriculum/types";

const slot: ItuElectiveSlot = {
  kind: "elective-slot",
  id: "elective-mt",
  semester: 7,
  title: "7th Semester Elective Course (MT)",
  category: "MT",
  creditOptions: [3],
  ectsOptions: [5],
  courses: [
    { code: "YZV 411E", title: "Artificial Intelligence", creditOptions: [3], ectsOptions: [5] },
    { code: "BLG 478E", title: "Computer Security", creditOptions: [3], ectsOptions: [5] },
  ],
};

const curriculum: ItuCurriculum = {
  planId: 1562,
  programCode: "BLGE_LS",
  title: "Computer Engineering",
  planTitle: "Test",
  semesters: [{ semester: 7, items: [slot] }],
  prerequisites: {},
  equivalenceRules: [],
  prerequisiteBranchesLoaded: ["BLG", "YZV"],
  prerequisiteDataAvailable: true,
  warnings: [],
  fetchedAt: "2026-09-02T00:00:00.000Z",
};

describe("curriculum availability", () => {
  it("does not show a completed elective requirement among available courses", () => {
    const progress = emptyProgress(curriculum.planId);
    progress.courses["ITB 201"] = {
      state: "passed",
      matchedRequirementId: slot.id,
      courseCode: "ITB 201",
    };

    const offerings = new Set(["YZV 411E", "BLG 478E"]);
    expect(isCurriculumItemAvailableThisSemester(slot, curriculum, progress, progress.courses, offerings)).toBe(false);
    expect(availableCoursesForElectiveSlot(slot, curriculum, progress, progress.courses, offerings)).toEqual([]);
  });

  it("shows an offered MT course whose branch exists only in its elective pool", () => {
    const progress = emptyProgress(curriculum.planId);
    const offerings = new Set(["YZV 411E"]);

    expect(isCurriculumItemAvailableThisSemester(slot, curriculum, progress, progress.courses, offerings)).toBe(true);
    expect(availableCoursesForElectiveSlot(slot, curriculum, progress, progress.courses, offerings).map((course) => course.code)).toEqual(["YZV 411E"]);
  });
});
