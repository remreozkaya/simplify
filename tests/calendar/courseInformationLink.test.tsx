import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n";
vi.mock("@/lib/i18n/client", () => ({ useLanguage: () => ({ language: "en", t: (key: string) => translate("en", key) }) }));
import { CourseInformationStatus } from "@/components/calendar/CourseInformationLink";

describe("course information link", () => {
  it("opens a verified course in a separate tab", () => {
    const html = renderToStaticMarkup(createElement(CourseInformationStatus, { code: "EHB222E", state: "available" }));
    expect(html).toContain('href="https://obs.itu.edu.tr/public/DersBilgi?bransKodu=EHB&amp;dersNo=222"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('EHB222E');
  });
  it.each(["loading", "missing", "unknown"] as const)("does not link %s entries and explains their state", state => {
    const html = renderToStaticMarkup(createElement(CourseInformationStatus, { code: "EHB222E", state }));
    expect(html).not.toContain('href=');
    expect(html).toContain('EHB222E');
    expect(html).toContain(state === "missing" ? "Information unavailable" : state === "loading" ? "Checking ITU" : "Could not verify");
  });
  it("does not create a link for malformed custom course codes", () => {
    const html = renderToStaticMarkup(createElement(CourseInformationStatus, { code: "custom activity", state: "available" }));
    expect(html).not.toContain('href=');
  });
});
