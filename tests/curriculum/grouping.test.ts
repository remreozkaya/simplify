import { describe, expect, it } from "vitest";

import { FALLBACK_GROUP, courseCodeGroup, groupCurriculum } from "@/lib/curriculum/grouping";
import type { ItuCurriculum } from "@/lib/itu/curriculum/types";

const course = (code: string, index: number) => ({ kind: "course" as const, id: `course-${index}`, semester: 1, code, title: code, requirementType: "compulsory" as const, creditOptions: [3], ectsOptions: [5] });

describe("ÇAP and Yandal course grouping", () => {
  it.each([["ECN105E", 1], ["ECN 301E", 3], ["ECN4901E", 4]])("groups %s by its first numeric digit", (code, expected) => {
    expect(courseCodeGroup(code)).toBe(expected);
  });

  it("sorts numeric groups and keeps elective placeholders in the fallback section", () => {
    const curriculum: ItuCurriculum = { planId: 1, programCode: "ECN_YD", title: "Minor", planTitle: "Plan", planType: "yandal", semesters: [{ semester: 1, items: [course("ECN 301E", 1), { kind: "elective-slot", id: "elective", semester: 1, title: "Elective", creditOptions: [3], ectsOptions: [5], courses: [] }, course("ECN105E", 2)] }], prerequisites: {}, equivalenceRules: [], prerequisiteBranchesLoaded: [], prerequisiteDataAvailable: true, warnings: [], fetchedAt: "2026-09-02T00:00:00.000Z" };
    const grouped = groupCurriculum(curriculum);
    expect(grouped.semesters.map((item) => item.semester)).toEqual([1, 3, FALLBACK_GROUP]);
    expect(grouped.semesters.at(-1)?.items[0].kind).toBe("elective-slot");
  });
});
