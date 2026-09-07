import { describe, expect, it } from "vitest";
import { responseJson } from "@/lib/http/responseJson";

describe("JSON response handling", () => {
  it("returns successful data without changing the payload", async () => {
    await expect(
      responseJson(Response.json({ courses: ["BLG 101"] })),
    ).resolves.toEqual({ courses: ["BLG 101"] });
  });
  it("explains session expiry even when the response is not JSON", async () => {
    await expect(
      responseJson(new Response("Unauthorized", { status: 401 })),
    ).rejects.toThrow("Your session has expired. Sign in again.");
  });
  it("preserves both API error formats and uses a fallback when absent", async () => {
    for (const error of ["Unavailable", { message: "Unavailable" }]) {
      await expect(
        responseJson(Response.json({ error }, { status: 503 })),
      ).rejects.toThrow("Unavailable");
    }
    await expect(
      responseJson(Response.json({}, { status: 500 })),
    ).rejects.toThrow("The request failed.");
  });
});
