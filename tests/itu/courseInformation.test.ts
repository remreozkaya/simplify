import { describe, expect, it } from "vitest";
import { courseInformationQuery } from "@/lib/itu/courseInformation.mjs";
import { parseCourseInformation } from "@/lib/itu/parsers/parseCourseInformation.mjs";

describe("official course information", () => {
  it.each([
    ["EHB222E", "EHB", "222"], ["blg 113", "BLG", "113"],
    ["FIZ 101EL", "FIZ", "101L"], ["FIZ101L", "FIZ", "101L"],
    ["MAT 100A", "MAT", "100A"],
  ])("resolves %s without discarding meaningful suffixes", (code, branch, number) => {
    expect(courseInformationQuery(code)).toEqual({ branch, number, key: `${branch} ${number}`,
      url: `https://obs.itu.edu.tr/public/DersBilgi?bransKodu=${branch}&dersNo=${number}` });
  });
  it.each(["", "custom activity", "EHB222?x=1", "https://example.com"])("rejects invalid code %s", code => {
    expect(courseInformationQuery(code)).toBeNull();
  });
  it("requires a catalog row matching the requested course", () => {
    const html = '<table><tr><td>EHB222 -EHB222E</td><td><a href="/public/DersKatalog/DersKatalogBilgiBransDersKodu?bransKodu=EHB&amp;dersNo=222">Catalog</a></td></tr></table>';
    expect(parseCourseInformation(html, "EHB222E")).toBe("available");
    expect(parseCourseInformation(html, "EHB223")).toBe("unknown");
  });
  it("does not mistake an upstream error or empty response for a missing course", () => {
    expect(parseCourseInformation('<html><h1>Error.</h1></html>', "EHB222")).toBe("unknown");
    expect(parseCourseInformation('', "EHB222")).toBe("unknown");
  });
  it("recognizes an explicit no-result response", () => {
    expect(parseCourseInformation('<div class="alert">Ders bilgisi bulunamadı.</div>', "EHB222")).toBe("missing");
  });
});
