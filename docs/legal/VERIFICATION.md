# Verification evidence

2026-10-03, workspace implementation. No live account deletion, request email or real transcript upload was performed. Provider-dependent tests use synthetic identities and mocked responses.

| Check | Outcome and limits |
|---|---|
| ESLint | Passed, no warnings in final run |
| `npm run typecheck` | Passed: Next route generation and TypeScript |
| `npm run test:run` | Final 51 suites / 277 tests passed; includes 31 privacy tests and existing academic/planner regression suites |
| Standard `npm run build` | Earlier runs passed. Final retry failed in Turbopack CSS worker with `binding to a port / Operation not permitted`; same outcome on permission-adjusted retry. Do not claim the final standard build passed |
| `npm run build -- --webpack` | Passed on final production source: compilation, TypeScript, static generation of all four legal routes and build tracing |
| `npm run legal:check` | Exits 1 as intended: 32 missing owner/server facts and reviews, no secret values printed |
| `git diff --check` | Passed via installed Command Line Tools Git; no commits/pushes |
| Public legal routing | Unit tests exercise each route with absent and existing/invalid cookie headers; Proxy returns 200 without redirect, auth client initialization or cookie writes. Route decisions also allow both authenticated/anonymous callers |
| TR/EN coverage | Equal copy-key and section structure tests; actual server-rendered legal content and signup notice tested in both languages. Browser switched between TR/EN, with persisted language retained across navigation/reload |
| Mobile / keyboard | Browser inspected at 390×844: privacy/storage screenshots; terms/requests page scrollWidth 390, storage scrollWidth 390 with table in its own scroll container. Tab moved focus from language control to legal navigation. Semantic headings, landmarks, row/column headers, labels, live status, skip link and global focus styles present. Viewport restored. No full screen-reader/device matrix or automated accessibility certification |
| Signup notice | Bilingual SSR test passed, separate Terms/Privacy links and no blanket consent checkbox. Live browser navigation to signup encountered an existing authenticated session and redirected to planner, so anonymous live signup UI was not verified. No account data was inspected |
| Account export | Verified-session/confirmed-email checks; explicit account/profile field allowlists; credentials/unrelated metadata excluded; saved legacy profile values preserved instead of UI migration. Provider failure returns generic status |
| Profile correction | Anonymous and unverified callers denied before upstream academic requests; only session-scoped Auth update used, client target ID ignored; existing profile validation/correction tests retained |
| Account deletion | Mocked tests cover malformed/unconfirmed input, anonymous caller, unverified account, bad password, different reauthenticated identity, correct owner despite malicious target ID, actual admin failure, missing admin client and successful hard-delete/cookie clear. No live Supabase delete was attempted; server credential absent, UI unavailable. Processor backup/log erasure not implemented or promised |
| Browser data controls | Allowlist export/clear tests cover all seven existing keys and preservation of unrelated keys/auth tokens. Browser download UI reported “Download prepared”; download event timed out in this browser tool, so actual file receipt was not verified. No real browser records were cleared |
| Network/storage inspection | Source/SDK inspection completed. Browser read-only evaluation exposed DOM but not localStorage/performance globals; no direct network trace or complete deployed storage inspection obtained. Deployed host/CDN/auth/email provider behavior requires a separate check |
| Optional-consent category tests | **Not applicable to this version**: no optional tracking/request initialization exists and no optional consent mechanism was introduced. Consent category acceptance, expiry and withdrawal are therefore not claimed tested. Legal-render tests detect external iframe/script markup, but do not substitute for deployed network verification. Reassess and implement blocking tests before any optional integration |
| Planner with optional tracking off | No optional tracker is initialized by this code; existing curriculum, recommendation, generator and schedule tests pass. Live planner network behavior with optional rejection is not a testable state because no optional-consent categories exist |
| Request delivery / retention | Not verified: contact channel, monitored mailbox, processor retention and backup policy are absent owner facts. Public page explicitly does not claim request submission. No fabricated delivery backend or purge periods |

Independent code review identified one export defect: use of the UI repair parser changed legacy stored values. A failing regression reproduced it; dedicated value-preserving allowlist fixed it and the test passed. No additional actionable authorization, public-route or secret-exposure finding was reported in that bounded review.

Remaining verification before launch: disposable provider test account lifecycle, actual mailbox/postal response workflow, production network/cookie/storage inspection, privacy exports/deletion against deployed records, backups/retention, provider contracts/locations and current consolidated legal review. See OPERATIONS.md and REQUIREMENTS.md.
