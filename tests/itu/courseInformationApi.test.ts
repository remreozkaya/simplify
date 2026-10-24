import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/itu/services/getCourseInformation", () => ({ getCourseInformation: vi.fn() }));
import { getCourseInformation } from "@/lib/itu/services/getCourseInformation";
import { GET } from "@/app/api/itu/course-information/route";
const request = (code: string) => new NextRequest(`http://localhost/api/itu/course-information?code=${encodeURIComponent(code)}`);
afterEach(() => vi.resetAllMocks());
describe("course information API", () => {
  it("rejects invalid codes before requesting ITU", async () => {
    expect((await GET(request("custom activity"))).status).toBe(400);
    expect(getCourseInformation).not.toHaveBeenCalled();
  });
  it("returns the validated official URL for the popup", async () => {
    vi.mocked(getCourseInformation).mockResolvedValue("available");
    const response = await GET(request("EHB222E"));
    expect(await response.json()).toEqual({ state: "available", url: "https://obs.itu.edu.tr/public/DersBilgi?bransKodu=EHB&dersNo=222" });
  });
  it("does not return a clickable URL for a confirmed missing entry", async () => {
    vi.mocked(getCourseInformation).mockResolvedValue("missing");
    expect(await (await GET(request("EHB222"))).json()).toEqual({ state: "missing", url: null });
  });
  it("distinguishes upstream failure from a missing entry", async () => {
    vi.mocked(getCourseInformation).mockRejectedValue(new Error("Timeout"));
    const response = await GET(request("EHB222"));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ state: "unknown", url: null });
  });
});
