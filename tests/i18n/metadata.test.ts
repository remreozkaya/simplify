import { describe, expect, it } from "vitest";
import { applyLocalizedMetadata, localizedMetadata } from "@/lib/i18n/metadata";

describe("browser metadata localization", () => {
  it("updates existing metadata in both directions without replacing the description node", () => {
    let description = "";
    const node = { getAttribute: () => description, setAttribute: (key: string, value: string) => {
      expect(key).toBe("content");
      description = value;
    } };
    const target = { title: "", querySelector: (selector: string) => {
      expect(selector).toBe('meta[name="description"]');
      return node;
    } } as unknown as Document;
    for (const language of ["tr", "en", "tr"] as const) {
      applyLocalizedMetadata(language, target);
      expect(target.title).toBe(localizedMetadata[language].title);
      expect(description).toBe(localizedMetadata[language].description);
    }
  });
  it("does not rewrite unchanged metadata, allowing observation without mutation loops", () => {
    const target = {
      title: localizedMetadata.en.title,
      querySelector: () => ({
        getAttribute: () => localizedMetadata.en.description,
        setAttribute: () => { throw new Error("redundant mutation"); },
      }),
    } as unknown as Document;
    expect(() => applyLocalizedMetadata("en", target)).not.toThrow();
  });
  it("handles documents without a description", () => {
    const target = { title: "", querySelector: () => null } as unknown as Document;
    expect(() => applyLocalizedMetadata("tr", target)).not.toThrow();
    expect(target.title).toContain("İTÜ");
  });
});
