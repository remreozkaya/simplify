import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parseCalendarCatalog } from "@/lib/itu/services/semesterCache";

const state = vi.hoisted(() => ({ available: true }));
vi.mock("@/lib/itu/services/getCoursesByBranch", () => ({
  getCoursesByBranch: async () => ({ branchId: 1, branchCode: "MAT", semester: "2026 Fall", fetchedAt: "2026-10-08T00:00:00Z", courses: [
    { id: "a", code: "MAT 101", title: "A", sections: [{ id: "s", crn: "00123", semester: "2026 Fall", meetings: [{ day: "Monday", startTime: "09:00", endTime: "10:00" }] }] },
    { id: "b", code: "MAT 102", title: "B", sections: [{ id: "t", crn: "98765", semester: "2026 Fall", meetings: [{ day: "Tuesday", startTime: "09:00", endTime: "10:00" }] }] },
  ] }),
}));
vi.mock("@/lib/itu/curriculum/catalogStore", () => ({
  readStoredCurriculumCatalog: async () => state.available ? { plans: [{ courses: [{ kind: "course", code: "MAT 101", credit: "3,5", ects: "8" }] }] } : null,
}));
import { GET } from "@/app/api/itu/courses/route";

describe("local credits through the catalog API and browser validator", () => {
  it("preserves exact-code fractional local credits and marks unmatched courses unavailable", async () => {
    state.available = true;
    const response = await GET(new NextRequest("http://localhost/api/itu/courses?branchId=1&branchCode=MAT"));
    expect(response.status).toBe(200);
    const parsed = parseCalendarCatalog(await response.json(), "MAT");
    expect(parsed.courses.map((course) => course.localCredits)).toEqual([3.5, null]);
    expect(parsed.courses[0].sections[0].crn).toBe("00123");
  });
  it("keeps section choices available when the imported credit source is unavailable", async () => {
    state.available = false;
    const response = await GET(new NextRequest("http://localhost/api/itu/courses?branchId=1&branchCode=MAT"));
    expect(response.status).toBe(200);
    const parsed = parseCalendarCatalog(await response.json(), "MAT");
    expect(parsed.courses.map((course) => course.localCredits)).toEqual([null, null]);
    expect(parsed.courses[0].sections).toHaveLength(1);
  });
});
