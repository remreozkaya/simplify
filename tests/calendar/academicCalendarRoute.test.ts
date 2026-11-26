import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/itu/academic-calendar/route";

const html = readFileSync(new URL("./fixtures/itu-calendar-2026-2027.html", import.meta.url), "utf8");
const request = (query = "") => new Request(`https://simplify.test/api/itu/academic-calendar${query}`);

afterEach(() => vi.unstubAllGlobals());

it("discovers official years, retries failed retrievals and caches verified results", async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response(html))
    .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
    .mockResolvedValueOnce(new Response(html));
  vi.stubGlobal("fetch", fetch);

  expect((await GET(request("?term=202730"))).status).toBe(400);
  expect(await (await GET(request())).json()).toMatchObject({ years: ["2026-2027", "2025-2026", "2024-2025", "2023-2024"] });
  expect((await GET(request("?term=202210"))).status).toBe(404);
  expect((await GET(request("?term=202710"))).status).toBe(502);

  const found = await GET(request("?term=202710"));
  expect(found.status).toBe(200);
  expect(await found.json()).toMatchObject({
    calendar: { term: "202710", start: "2026-09-28", end: "2026-12-31" },
    source: expect.stringContaining("akademikyil=854&takvimadi=15"),
  });
  expect((await GET(request("?term=202710"))).status).toBe(200);
  expect(fetch).toHaveBeenCalledTimes(3);
});
