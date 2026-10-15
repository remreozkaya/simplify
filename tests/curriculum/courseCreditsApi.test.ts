import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ catalog: null as unknown }));
vi.mock("@/lib/itu/curriculum/catalogStore", () => ({ readStoredCurriculumCatalog: async () => state.catalog }));
import { GET } from "@/app/api/itu/course-credits/route";

beforeEach(() => {
  state.catalog = { plans: [{ courses: [{ kind: "course", code: "MAT 104E", credit: "4" }] }], electiveGroups: { group: { courses: [{ code: "FIZ 102E", credit: "3" }] } } };
});

describe("database course credit lookup", () => {
  it("resolves courses outside a user's curriculum from stored plans and elective groups", async () => {
    const response = await GET(new NextRequest("http://localhost/api/itu/course-credits?code=MAT104E&code=FIZ102E&code=XYZ101"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ credits: { "MAT 104E": 4, "FIZ 102E": 3, "XYZ 101": null } });
  });
  it("rejects invalid codes", async () => {
    expect((await GET(new NextRequest("http://localhost/api/itu/course-credits?code=bad"))).status).toBe(400);
  });
  it("reports database unavailability instead of supplying invented credits", async () => {
    state.catalog = null;
    expect((await GET(new NextRequest("http://localhost/api/itu/course-credits?code=MAT104E"))).status).toBe(503);
  });
});
