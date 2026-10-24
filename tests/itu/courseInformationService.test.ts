import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
let getCourseInformation: typeof import("@/lib/itu/services/getCourseInformation").getCourseInformation;
beforeEach(async () => {
  vi.resetModules();
  ({ getCourseInformation } = await import("@/lib/itu/services/getCourseInformation"));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const html = '<table><tr><td>EHB222 -EHB222E</td><td><a href="/public/DersKatalog/DersKatalogBilgiBransDersKodu?bransKodu=EHB&amp;dersNo=222">Catalog</a></td></tr></table>';
describe("course information availability", () => {
  it("looks up the normalized query and shares its cached result across language variants", async () => {
    vi.stubGlobal("fetch", async (url: URL) => {
      expect(url.toString()).toBe("https://obs.itu.edu.tr/public/DersBilgi/DersBilgiSearch?bransKodu=EHB&dersNo=222");
      return new Response(html);
    });
    expect(await getCourseInformation("EHB222E")).toBe("available");
    vi.stubGlobal("fetch", () => { throw new Error("Should use refreshed cache"); });
    expect(await getCourseInformation("EHB222")).toBe("available");
  });
  it("refreshes expired cached results", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", async () => new Response(html));
    expect(await getCourseInformation("EHB222E")).toBe("available");
    vi.advanceTimersByTime(86400001);
    vi.stubGlobal("fetch", async () => new Response('<div>Ders bilgisi bulunamadı.</div>'));
    expect(await getCourseInformation("EHB222E")).toBe("missing");
  });
  it("does not cache a temporary failure as absence", async () => {
    vi.stubGlobal("fetch", async () => new Response("Error", { status: 500 }));
    await expect(getCourseInformation("EHB222")).rejects.toThrow();
    vi.stubGlobal("fetch", async () => new Response(html));
    expect(await getCourseInformation("EHB222")).toBe("available");
  });
  it("retains unknown status for malformed upstream HTML", async () => {
    vi.stubGlobal("fetch", async () => new Response('<html><h1>Error.</h1></html>'));
    await expect(getCourseInformation("ZZZ999")).rejects.toThrow();
  });
  it("returns missing only when ITU explicitly reports no information", async () => {
    vi.stubGlobal("fetch", async () => new Response('<div>Ders bilgisi bulunamadı.</div>'));
    expect(await getCourseInformation("ZZZ999")).toBe("missing");
  });
});
