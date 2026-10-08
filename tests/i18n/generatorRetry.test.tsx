import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n";

const state = vi.hoisted(() => ({ language: "tr" as "tr" | "en" }));
vi.mock("@/lib/i18n/client", () => ({
  useLanguage: () => ({
    language: state.language,
    t: (key: string, values?: Record<string, string | number>) => translate(state.language, key, values),
  }),
}));
import ScheduleGeneratorPanel from "@/components/calendar/ScheduleGeneratorPanel";

const props = {
  programMemberships: [],
  courseCatalog: [],
  isLoadingBranches: false,
  isBranchLoading: () => false,
  loadBranch: async () => {},
  catalogError: "Gateway refused upstream request (OBS-503).",
  onRetryCatalog: () => {},
  onPreviewChange: () => {},
  onSave: () => "saved",
};

describe("generator catalog recovery controls", () => {
  it.each(["tr", "en"] as const)("shows an accessible %s retry beside the retained catalog diagnostic", (language) => {
    state.language = language;
    const html = renderToStaticMarkup(createElement(ScheduleGeneratorPanel, props));
    const retry = translate(language, "weeklyPlanner.retry");
    expect(html).toContain(`title="${retry}"`);
    expect(html).toContain(`aria-label="${retry}"`);
    expect(html).toContain(`>${retry}</button>`);
    expect(html).toContain('role="alert"');
    expect(html).toContain("OBS-503");
    expect(html).toContain(language === "tr" ? "İşlem tamamlanamadı." : "The request could not be completed.");
  });

  it("does not show a retry control without a catalog error", () => {
    state.language = "en";
    const html = renderToStaticMarkup(createElement(ScheduleGeneratorPanel, { ...props, catalogError: null }));
    expect(html).not.toContain('aria-label="Retry"');
  });
});
