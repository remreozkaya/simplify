import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { translate } from "@/lib/i18n";
vi.mock("@/lib/i18n/client", () => ({ useLanguage: () => ({ language: "en", t: (key: string) => translate("en", key) }) }));
vi.mock("@/app/(app)/profile/actions", () => ({ changePasswordAction: vi.fn(), saveProfileAction: vi.fn() }));
vi.mock("@/components/legal/PrivacyControls", () => ({ default: () => null }));
import { ProgramFields } from "@/components/profile/ProfilePage";

it("shows an unverified secondary plan without permitting its selection", () => {
  const props = {
    enrollment: { id: "minor", type: "minor" as const, facultyId: "1", facultyName: "Faculty", educationLevel: "undergraduate" as const, planType: "yandal" as const, programCode: "MAT_YD", programName: "Mathematics", curriculumPlanId: 0, curriculumPlanName: "" },
    faculties: [{ id: "1", name: "Faculty" }], programs: [],
    plans: [{ id: 9, title: "Unverified plan", isCurrent: false, programCode: "MAT_YD", planType: "yandal" as const, primaryProgramEligibility: "unknown" as const, sourceUrl: "https://obs.itu.edu.tr/" }],
    disabled: false, programsLoaded: true, plansLoaded: true, onChange: () => {},
  };
  const html = renderToStaticMarkup(createElement(ProgramFields, props));
  expect(html).toMatch(/<option[^>]*value="9"[^>]*disabled=""/);
  expect(html).toContain("Eligibility unverified");
});
