# Website design audit — 2026-11-11

## Scope and implementation checklist

Preserve the existing neutral surfaces, blue actions, local Geist fonts, Turkish/English content, legal wording, URLs, authentication and academic integrations. Use existing Tailwind utilities and shared components. Avoid animation and decorative assets.

- [x] Inventory all page routes, dynamic legal documents, footer/navigation targets and special states.
- [x] Capture baseline at 1440, 768 and 390 pixels.
- [x] Refine shared shell, responsive navigation, footer, controls and form readability.
- [x] Align legal titles and articles, improve reading measure and section hierarchy, contain storage table scrolling.
- [x] Refine authentication, homepage, profile and error layouts.
- [x] Revisit every page at all three widths; inspect dark mode, English, navigation and key interactions.
- [x] Run tests, lint, typecheck and production build.
- [x] Complete independent diff review and resolve findings.

## Route checklist

| Route/template | Coverage |
| --- | --- |
| `/` | Homepage, incomplete/complete profile |
| `/semester-planner` | Controls, empty and generated plans |
| `/weekly-planner` | Calendar, program controls, course dialog |
| `/generator` | Course selection and scheduling controls |
| `/curriculum` | Program selection, graph, loading/error states |
| `/graduation-calculator` | Progress and credit panels |
| `/semesters` | Current semester and transcript tables |
| `/profile` | Personal/program fields, security, privacy controls |
| `/login` | Form, password visibility, Remember me |
| `/signup` | Form and legal links |
| `/forgot-password` | Form |
| `/reset-password` | Expired, success and recovery form |
| `/verify-email` | Resend, expired and success |
| `/legal/privacy` | Privacy policy |
| `/legal/storage` | Cookie/browser storage policy and controls |
| `/legal/terms` | Terms of service |
| `/legal/requests` | Privacy requests and contact |
| `/legal` | Redirect to privacy policy |
| `/legal/[document]` | Four supported values above; invalid value → 404 |
| `not-found.tsx` / `error.tsx` | Recovery layouts |
| `/auth/callback` | Auth handler redirects, no rendered page |
| `/api/**`, `/privacy/actions`, `/auth/actions` | API/action handlers, no rendered pages |

## Approach

Update shared components for consistent spacing and accessible controls, then make bounded page-specific corrections. A broad visual redesign would change the established identity; isolated CSS overrides per route would make consistency harder to maintain. No new runtime dependencies.

## Inspection environment

Public/auth/legal routes use the local Next.js server. Signed-in pages use production React components in an isolated Vite preview with synthetic profile, curriculum and academic storage responses. Live account-backed persistence cannot be verified without a signed-in session. Preview stubs never enter production source. Screenshots and machine-readable measurements are stored under `/tmp/simplify-design/`.

## Changes

- Shared page backgrounds, gutters, heading sizes and section rhythm now distinguish white working panels from the neutral canvas.
- Mobile/tablet navigation exposes all six tools through a native expandable menu with active links, Escape dismissal and keyboard focus handling. Header controls use 44-pixel targets. Profile previews wrap long names within the viewport.
- Homepage hero and closing section use less vertical space. Profile forms are centered within their working width. Authentication cards have a distinct surface, responsive padding and a shorter surrounding canvas. Error pages use the same typography and surfaces.
- Footer links have consistent spacing and readable group headings. Mobile planning/workspace columns reduce footer height without removing links.
- All four legal documents share a 768-pixel outer reading column, aligned headings, policy navigation, larger body text, clear section boundaries and visible draft notices. The cookie/storage table has fixed column sizing, wrapped identifiers, alternating rows and a labeled keyboard-focusable scroll region. Legal wording and configuration are unchanged.
- Weekly course selectors stack with visible labels on mobile; desktop rows retain their layout and drag controls. Semester tables can be focused and scrolled with a keyboard. Course-dialog close targets are larger.
- Curriculum restoration now displays its loading message while the initial requirements are pending.
- A hydration reconciliation restores saved language/theme after Next's streamed 404 fallback resets the document attributes. The focused browser regression failed before the fix and passes after it.

## Verification results

All 17 page routes and the invalid-legal-document 404 were revisited at **1440 × 900**, **768 × 900**, and **390 × 900**. Each was checked in Turkish/light mode and English/dark mode: **108 final captures**, zero document overflow, zero missing page headings, zero browser runtime errors. Calendar and data tables intentionally scroll inside their containers.

Additional checks at all three widths:

- Verification success/expired states, password-reset success/recovery form, error fallback, incomplete-profile homepage, curriculum loading and source-error states.
- Mobile menu visibility, all six tool links, Escape dismissal; profile popover and focus return.
- Weekly course-row insertion, prefix/course/CRN selection, populated calendar, course-details dialog and Escape dismissal.
- Semester recommendation generation and semester course picker.

Public-route interaction checks covered native email validation, password visibility, Remember me, language switching, login/signup/legal navigation, `/legal` redirect and keyboard scrolling of the cookie table. No account creation, email delivery, password change, deletion or live data write was submitted.

Automated verification:

- `npm run test:run`: **102 files, 1,154 tests passed**.
- Focused curriculum/restriction/i18n checks after the final loading-state change: **9 files, 59 tests passed**.
- `npm run lint`: passed.
- `npm run typecheck`: passed; final production build also ran TypeScript successfully.
- `npm run build`: passed; generated route list matched the inventory above.
- `tests/i18n/browser/verify.mjs` against the production server: passed, including the added saved language/dark-mode 404 regression.
- `git diff --check`: passed.

## Access limits

The live signed-in versions of `/`, `/semester-planner`, `/weekly-planner`, `/generator`, `/curriculum`, `/graduation-calculator`, `/semesters` and `/profile` could not be inspected without an authenticated session. Their production components were rendered and exercised in an isolated preview with synthetic data. Live Supabase persistence, actual account operations and external OBS availability were not verified through the browser. The error component was previewed with a synthetic error rather than deliberately breaking the running application. API/action handlers and the authentication callback have no standalone design to inspect.

Independent review found one contrast issue caused by an unintended hover background on the error/404 headings. It was removed before delivery; no other concrete regressions were reported.
