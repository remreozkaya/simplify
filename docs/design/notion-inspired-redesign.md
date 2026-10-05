# Simplify visual redesign

Reference: https://www.notion.com/product and the supplied footer screenshot, examined 2026-10-04. The implementation uses the reference's neutral surfaces, generous heading spacing, compact navigation, blue actions, and grouped footer. It does not reuse Notion branding or assets.

Shared Tailwind tokens restyle the academic tools, forms, calendars, and legal pages in white/charcoal themes. The home page has a bilingual hero, real planning links, academic program summary, workflow, tool directory, and final planning action. Navigation remains available on small screens through a horizontally scrollable tool row.

The home planner notice and browser-storage paragraph are removed. Updated 2026-10-05: repeated page-wide planner notices are removed from every tool. At the owner’s request, profile and transcript privacy disclosures are removed from the planning interface; policies remain in the footer. Footer-only presentation at these collection points requires a legal launch review and is not asserted to satisfy transparency requirements. The account-creation notice remains visible on registration. Legal pages and browser privacy controls remain linked in the footer. No academic algorithms, account operations, or storage semantics are changed by the redesign.

Verification: 279 tests across 52 suites, lint, TypeScript, and a Webpack production build passed. Browser inspection covered the authenticated home in TR/EN and light/dark mode, all five tool routes and terms at 390px without document overflow, desktop curriculum, mobile footer, and keyboard movement from the main action to the curriculum action. Sign-in was inspected on a separate localhost origin without a session. Responsive calendars keep their existing internal scrolling; calculations were covered by the existing regression suite rather than executed against real academic records.

A normal Turbopack build remains affected by the environment's worker/port restrictions documented in the legal verification record. Production legal readiness remains a separate gate; this visual change does not resolve missing operator configuration.
