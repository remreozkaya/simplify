# Simplify functional and Turkish/English audit — 8 October 2026

## Outcome and limits

Confirmed defects were reproduced, fixed and verified. The final **445 Vitest tests across 75 files**, lint and type checking pass. The exact `npm run build` **fails** with Turbopack's prohibited worker port bind; `npm run build -- --webpack` **passes** compilation, TypeScript and route generation. `npm run legal:check` **fails** its unresolved launch gate. Neither alternative compilation nor fixture verification establishes deployment readiness.

The application was run and exercised in Chrome. All seven application routes, five authentication routes, the legal index/four legal documents and the 404 page were switched TR → EN → TR, including English-preference refresh restoration. There were 56 desktop/mobile × language × theme layout measurements. The label inventory found only 32 repeated hidden React action-metadata inputs without labels; visible controls had labels or accessible names. Tests are scoped evidence, not a claim that every institutional rule, dynamic state, browser or provider operation is correct.

Intermediate academic, translation, and persistence reports were consolidated here and archived locally during cleanup.

## Baseline, ownership and environment

- Branch: `main`; initial commit: `6e084fa81d3d9270ac28717f2c07a824645d25f9`. No commit, push, branch switch or deployment was performed.
- Read AGENTS.md, CLAUDE.md, README.md, package.json, vitest.config.ts, existing tests and previous quality reports. Read installed Next.js 16.3.3 client-component, Proxy and metadata documentation before edits; inspected installed React 19's actual form-reset implementation for the auth defect.
- Original unrelated edits were present in courses API, WeeklyCalendar, dictionaries, catalog adapters/store/cache and calendar types, plus bookmarklet/local-credit/plan-action files and browser tests. They were retained. Initial source diff (local archive) separates those edits from this audit; do not attribute the whole current Git diff to this work.
- Apple's Git was blocked by the unaccepted Xcode license. Read-only Git status/diff checks used GitHub Desktop's bundled Git. No license or system setting was changed.
- An existing real-account development server on port 3000 was left running. A fresh anonymous browser context tested its protected redirects. The signed-in account was not changed, exported, deleted, or used to send email.
- State-changing application checks used `/private/tmp/simplify-audit-20261008`, bound to `127.0.0.1:3111`, with synthetic authentication, a file-backed disposable profile and deterministic branch/course/curriculum adapters. The committed selector snapshot and real domain/UI code were retained. The clone used system fonts to avoid the Google Fonts dependency; those screenshots do not certify production-font metrics.
- Standalone weekly and auth browser fixtures mount production components with Vite/local adapters and close their own servers and browser contexts. No real provider, registration page or inbox is mutated.

## Functional coverage

PASS means the stated scenario passed using the stated method. BLOCKED means a required service/configuration was unavailable or inappropriate for disposable testing. UNTESTED is deliberately not converted into a pass.

| Feature | Scenario | Method | Result |
| --- | --- | --- | --- |
| Protected routes | Anonymous access to `/`, `/profile`, `/curriculum`, `/graduation-calculator`, `/semester-planner`, `/generator`, `/weekly-planner`; intended path retained in `next` | Fresh Chrome context against actual workspace server | **PASS**; observations (local archive) |
| Authentication | Signup/email/password/confirmation validation, hostile redirects, unverified users, resend cooldown, recovery callbacks/expiry, successful reset, profile password verification and expired identity, logout cleanup | 25 real-action integration tests with mocked Supabase/cookies; existing validators/cookie/redirect tests | **PASS, fixtures**; no email or credential change |
| Remember me | Session-only vs persistent cookie options; remembered input after invalid login | Cookie/action fixtures plus real LoginForm browser fixture | **PASS, fixtures**; actual provider-issued cookie expiry across browser restarts remains **BLOCKED** |
| Auth form state | Failed signup/login/recovery/reset retains values; existing validation changes language without resubmission; Remember me remains selected | Production forms + fixture actions; actual clone signup repeat | **PASS**; auth evidence (local archive) |
| Profile password clearing | Successful change clears current/new/confirm fields; language and visibility changes cannot restore values | Production ProfilePage with a synthetic success action | **PASS**; this regression was caught during independent review and the shared-input change was removed |
| Provider lifecycle | Delivered signup/recovery email, real verification tokens, old-password invalidation, remote token revocation after provider outage | No disposable Supabase/inbox configured | **BLOCKED**; action fixtures do not prove provider behavior |
| Profile selectors | Faculty changes reset dependent program/plan; exact main-plan save and refresh | Actual UI and real profile validation/actions with file-backed user adapter | **PASS**; plan 2340 persisted, academic routes opened with it; profile evidence (local archive) |
| Program identities | Main/ÇAP/Yandal validation, associations and exact plan versions; `MAT_YD_TE`/`MAT_YD_UY` and catalog minor identities | Current profile/catalog/API-handler fixtures, quality regressions | **PASS, fixtures**; simultaneous three-program browser signup/save was **UNTESTED** |
| Profile propagation | Saved profile reaches home and academic routes; curriculum/graduation/planner requests use saved plan; generator/weekly membership logic | Browser profile repeat + provider/context/registration fixtures | **PASS** for observed propagation; live Supabase metadata persistence **BLOCKED** |
| Transcript parsing | Turkish/English OBS text and Markdown, decimal credit formats, malformed rows, unknown grades, unused records, duplicate attempts | Current parser and quality fixtures; actual browser Markdown import | **PASS**; full TR OBS paste in browser was **UNTESTED** |
| Cumulative transcript | Reimports keep latest attempt; older FF/credit input cannot overwrite newer AA; refresh preserves import | Actual browser import plus transcript-store tests | **PASS** |
| GPA and credit distinctions | Explicit sample: AA × 4 + BB × 4.5 gives `(16 + 13.5)/8.5 = 3.470588…`; UI 3.47/3,47, transcript credits 8.5, requirement credits 8.5, actual English credits 4.5 | Independent arithmetic + browser + distinct-weight fixture examples | **PASS**; no institutional GPA or English-percentage rule invented |
| Independent audits | Main/ÇAP/minor shared courses satisfy separate audits; once-only allocation within an audit; elective/direct priority, official equivalences, language counterparts | Current graduation/equivalence/progress/multi-program tests | **PASS, fixtures**; a complete three-program browser audit was **UNTESTED** |
| Prerequisites | AND/OR, minimum grades, outside-program transcript grades, unknown data, elective eligibility, registration uncertainty | Eligibility/expression/planner fixtures | **PASS**; fresh official rule correctness across all plans **UNTESTED** |
| Transcript reset | Imported progress cleared, manual completion retained, inactive stored plans included | Real curriculum/graduation UI repeat + store/progress fixtures | **PASS** |
| Planner controls | Target semester, local credits, maximum courses and priority; 1000 rejected, decimal 4.5 accepted, zero means unlimited, unknown prerequisites produce no proven recommendation | Actual browser + planner/UI fixtures | **PASS**; workflow results (local archive) |
| Planner boundaries | Impossible targets, unavailable offerings, elective/completed exclusion, search limits and incomplete comparison warnings | Current bounded-search fixtures + no-result browser observation | **PASS**; exhaustive live optimality not claimed |
| End-to-end handoff | Known synthetic prerequisites; target 8.5/max 0 → generator → named weekly plan; two course identities, selected CRNs and all three meetings survive refresh | Actual application UI with deterministic academic fixtures | **PASS**; handoff evidence (local archive) |
| Generator | Pinned sections, excluded days, time bounds, overlaps, adjacent classes, unavailable/no-result and bounded results | Generator/conflict/session/conversion tests; actual generation and save | **PASS**; handoff preference preservation additionally fixture-tested |
| Meeting completeness | Missing lab/time/cardinality/weekday cannot be certified conflict-free; zero/reversed cached intervals rejected | Quality normalizer/generator and API schema fixtures | **PASS**; current `tests/quality/` regressions remain enabled |
| Weekly plan CRUD | Add/remove, CRN/section changes, named creation/rename/switch/delete, keyboard reorder, refresh and multi-meeting retention | Existing deterministic weekly browser runner + actual clone workflows | **PASS**; runner log (local archive) |
| Weekly overlaps/ranges | Overlap columns and adjacency; early 07:00 inside displayed grid; late/midnight rounding | Actual section-change geometry + layout/export fixtures | **PASS**; late/midnight browser pixels were **UNTESTED** |
| Persistence failures | Corrupt raw/partially filtered records not overwritten; denied reads/quota writes warn instead of crashing; memory edits retained | Actual browser corruption/write-denial and JSON roundtrip fixtures | **PASS**; recovery requires user export/clear, not an account migration |
| Rapid interactions | Existing weekly fixtures and plan-action/reorder tests; prior five-add/remove report is historical | Current fixture runner + tests | **PASS** for those fixtures; extended multi-tab concurrent editing race stress **UNTESTED** |
| Account switching | Browser transcript/progress persists from synthetic account A to B on same origin | Two synthetic session identities plus README/storage review | **CONFIRMED limitation**; evidence (local archive). Shared across accounts and retained after logout; no incidental migration |
| JPEG | TR/EN headings, dates, weekdays, legend and instructor fallback; long Turkish-character name; two meetings/one legend; empty/overlap/range algorithms | Actual downloads inspected visually + renderer/range fixtures | **PASS** for downloaded example and fixtures; all combinations of late/overlap/font/browser pixels **UNTESTED** |
| ITU data | Invalid queries/data, cache semester isolation/staleness, failure recovery/retry and literal enrollment header | Current HTTP/cache/parser tests; forced 503 browser adapter | **PASS, fixtures**; slow-request real OBS timeout and current institutional data completeness **UNTESTED** |
| Generator retry | Unknown 503 diagnostic translated, existing error switches language, Retry clears error and course generation resumes | Actual browser + TR/EN SSR regression | **PASS**; retry evidence (local archive) |
| Legal/privacy | Public legal routes; browser download/clear preserves unrelated keys; account export allowlist/deletion verified owner/provider errors | Actual public UI with disposable browser data + privacy action fixtures | **PASS**; UI evidence (local archive). Real account deletion **BLOCKED** by missing server secret |

Current `tests/quality/` minor codes, incomplete meetings, English totals, official enrollment header and cross-module academic workflow tests pass. Prior October 5 reports were read as historical evidence and not reused as current pass results.

## Translation coverage

| Route/component | Turkish result | English result | Remaining fallback/limit |
| --- | --- | --- | --- |
| `/` | PASS rendered navigation, headings, program/checklist states | PASS switch and saved preference refresh | Official program/plan names may retain source Turkish |
| `/profile` | PASS labels, notices, dependent reset; “Mevcut parola” fixed | PASS labels/save/validation and fixture success | Actual provider errors/email lifecycle not browser-certified |
| `/curriculum` | PASS selectors, statuses, dates, manual progression | PASS same state after switch | Source academic names retained when official EN absent |
| `/graduation-calculator` | PASS imported results, GPA 3,47 and English credit 4,5 | PASS GPA 3.47 and English credit 4.5 | Teaching-language arithmetic is independent of UI locale |
| `/semester-planner` | PASS four controls, validation, uncertainty/no-result | PASS recommendations and confirmed handoff | Search-limit/eligibility variants fixture-tested, not every variant browser-triggered |
| `/generator` | PASS controls/warnings and runtime unknown diagnostics | PASS generated schedules/Retry/save | Original unknown diagnostics intentionally retained after localized prefix |
| `/weekly-planner` | PASS controls/weekdays/dialog/storage warnings and JPEG | PASS equivalent states and JPEG | User names/codes/CRNs unchanged; native bookmark title intentionally fixed while visible/accessible label is localized |
| Login/signup/verification/recovery/reset | PASS route headings, labels, validation/expired-link states | PASS language switches and fixture validation/success | Delivered-email/real provider success blocked; reset-success page rendering covered by fixtures |
| Legal index/privacy/storage/terms/requests | PASS public notices, draft disclosure and controls | PASS full document switch, section topology/copy parity | Operator facts deliberately unresolved; draft pages do not authorize launch |
| 404 | PASS rendered message/navigation | PASS switch/refresh | Generic error-boundary copies inspected/fixture-tested; real browser error boundary was not forced in final checks |
| Dictionaries/source | PASS | PASS | 459 recursive leaves, parity/nonempty/placeholders, static AST references and dynamic key families. This is not full rendered coverage |
| Runtime message templates | PASS | PASS | Roundtrips retain counts/course codes/limits; unknown upstream diagnostics keep their source text with a localized fallback |
| Official academic names | Available official TR values/source used | Available official EN values/source used | Blank localized fields now fall back; raw snapshot lacks bilingual names for 10,800 named records. No automatic name translation was added |
| Formatting | Locale-aware numbers/dates/weekdays/percentages | Equivalent underlying values | Numeric inputs tested with native decimal dot in both languages; typed comma behavior across browser locales **UNTESTED** |
| Metadata | Document language follows preference | Document language follows preference | Follow-up: server title/description default to Turkish, hydrated browser metadata follows TR/EN. Browser localStorage preference is unavailable to server metadata/crawlers |

Already-visible transcript results, unknown API errors, auth validation and an open course dialog update when language changes without resubmission. Dialog language was changed in a second tab because a modal correctly blocks background controls; its state/meetings were retained and Escape closes it. Invalid preferences/blocked storage/cross-tab updates were tested. Explicit browser back/forward preference restoration and switching during every asynchronous loading stage remain **UNTESTED**.

## Confirmed defects and final fixes

| Severity | Defect and cause | Final fix / changed files |
| --- | --- | --- |
| P1 | Corrupt weekly storage was silently sanitized/replaced by automatic persistence | Guard load/save, preserve original raw value and show localized recovery warning; `calendar/persistence.ts`, `WeeklyCalendar.tsx`, dictionaries |
| P2 | Failed localStorage writes could crash/drop edits without notice | Catch failures, preserve current memory state and warn; same persistence/UI files |
| P2 | Actual completed teaching language lost to target requirement language in English-credit totals | Prioritize actual completion language; `curriculum/graduation.ts` |
| P2 | Cached catalogs accepted zero/reversed recurring intervals | Require strictly positive meeting intervals; `itu/services/semesterCache.ts` |
| P2 | Early/late weekly blocks used a fixed 08–20 grid and could clip | Expand grid from displayed meetings, half-hour bounds including 24:00 edge; `calendar/layout.ts`, `WeeklyCalendar.tsx` |
| P2 | JPEG contained English-only labels/date and unbounded plan heading | Locale argument/current locale, dictionary strings and measured title truncation; `calendar/exportJpeg.ts`, weekly export caller, dictionaries |
| P2 | Other-tab storage changes notified React while leaving its document-language snapshot stale | Apply language before subscriber notification; `i18n/client.ts` |
| P2 | Blank official localized names suppressed existing source names | Skip empty/whitespace candidates; `i18n/index.ts` |
| P2 | Unknown upstream messages escaped UI localization | Opt-in localized diagnostic prefix at academic/catalog/profile boundaries; `runtimeMessages.ts`, dictionaries and six rendering components |
| P2 | Rejected provider logout cleaned local cookies but prevented login redirect | Catch rejected sign-out, keep cleanup and redirect; `app/auth/actions.ts`. Remote revocation is not guaranteed by this fallback |
| P2 | Generator displayed catalog failure with no Retry action | Wire existing branch-specific retry through generator panel; `ScheduleGeneratorPanel.tsx`, `WeeklyCalendar.tsx` |
| P2 | Resolved invalid auth form actions reset user inputs/Remember me | Native reset listener scoped to four auth forms; `hooks/useAuthForm.ts`, Login/Signup/Forgot/Reset forms. Shared inputs and successful Profile clearing unchanged |
| P3 | Turkish “current password” incorrectly meant “valid password” | “Mevcut parola” consistently; `tr.ts`, `runtimeMessages.ts` |

Tests changed/added: calendar export/layout/persistence, auth action integrations/browser regressions, i18n event/dictionary/runtime/generator retry, ITU cache validation/recovery, and quality minor/English-credit cases. Assertions were not weakened and no failing tests were skipped. The independent review found the temporary shared-input reset regression; it was removed and the final profile-success browser regression passes. No other finding remained in that bounded review.

No additional small explanatory copy was removed: retained credit/zero-limit hints, import instructions, uncertainty messages and privacy disclosures explain actual decisions. The earlier redundant home/tool copy cleanup is already present.

## Exact verification commands and outcomes

| Command | Initial result | Final observed result/evidence |
| --- | --- | --- |
| `npm run lint` | PASS | **PASS**, exit 0; log (local archive) |
| `npm run typecheck` | FAILED: generated `.next/types` files disappeared while an audit-started build ran concurrently | **PASS**, exit 0 when isolated; log (local archive). Initial failure was an audit orchestration race, not silently counted as a pass |
| `npm run test:run` | **384/384**, 72 files | **445/445**, 75 files, exit 0; log (local archive) |
| `npm run build` | FAILED Google Fonts fetch under restricted network; network retry hit worker port bind | **FAILED**, exit 1: Turbopack/PostCSS worker `Operation not permitted` binding a port, including broader-execution retry; log (local archive) |
| `npm run build -- --webpack` | An intermediate run during edits had transient TypeScript failures, retained as historical log | **PASS**, exit 0: compile, TypeScript and generated routes; log (local archive). This does not make the original command pass |
| `npm run legal:check` | FAILED unresolved facts/reviews/config | **FAILED**, exit 1; log (local archive) |
| `PLAYWRIGHT_MODULE='/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright' PLANNER_SCREENSHOTS="/private/tmp/simplify-weekly-browser" node tests/calendar/browser/verify.mjs` | Existing fixture rerun | **PASS**, exit 0; weekly selection/switch/reorder/CRN/JPEG, TR/EN × four widths |
| `PLAYWRIGHT_MODULE='/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright' AUTH_SCREENSHOTS="/private/tmp/simplify-auth-browser" node tests/auth/browser/verify.mjs` | **FAILED** immediately after signup action, before toggle: email empty | **PASS**, exit 0: four auth forms plus Profile success clearing; log (local archive) |
| Structured application browser recipes | Initial harness selector/hydration mistakes were corrected; one broad dialog wait timed out | Final scoped repeats **PASS** for handoff, exact-plan persistence, dialog language, privacy, auth retention, storage recovery and generator retry. Recipes saved as text beside observations |
| GitHub Desktop bundled `git diff --check` | Read-only substitute for blocked Apple Git | **PASS**, exit 0 |

The clone start initially failed inside the sandbox (`EPERM`); broader execution allowed loopback binding. The workspace already had a dev server, so no competing workspace server was terminated. Standalone browser runners close their own processes; the disposable loopback application server was stopped after verification, while the existing workspace server was preserved. Initial harness failures and intermediate worker red phases are evidence of attempted checks, not false product defects or final pass claims.

## Remaining issues / blocked and untested checks

| Severity | Status | Issue / consequence |
| --- | --- | --- |
| Launch blocker | **FAILED/BLOCKED** | Legal owner identity/address/contact/effective date, hosting/auth/email locations, retention/transfer disclosures and required operational/legal reviews remain unresolved. Missing production site URL and deletion secret are reported, not invented |
| P1 privacy limitation | **CONFIRMED** | Browser academic data is shared across accounts and retained after logout. Synthetic A/B browser check confirms it; no account-scoped migration was introduced |
| P2 environment | **FAILED** | Exact Turbopack build cannot complete in this execution environment. Webpack passes compilation only |
| P2 verification gap | **BLOCKED** | Real disposable Supabase sign-in/email/verification/recovery/password invalidation/deletion/revocation; no configured disposable provider/inbox/secret |
| P2 verification gap | **UNTESTED** | Fresh live OBS correctness across every program/elective/equivalence/restriction; live slow-response timeout. Deterministic fixtures do not certify current institutional data |
| P2 usability limit | **CONFIRMED** | Corrupt data is protected against overwrite, but there is no in-product record repair editor. User can export originals and clear disposable/local data deliberately |
| P3 localization limit | **CONFIRMED** | Client metadata fixed in follow-up; server/crawler metadata defaults to Turkish; missing official bilingual names/source-name fallbacks; diagnostic source text and stable native bookmark title |
| P3 verification gaps | **UNTESTED** | Safari/Firefox/session restoration, exhaustive screen-reader/contrast audit, back/forward, every loading/success/error combination, comma inputs by browser locale, every JPEG late/overlap/font combination, extended concurrent storage stress |

These limits remain visible rather than being replaced with fabricated institutional, provider or legal assurances.

## Representative browser/export evidence

- Route language observations (local archive), 56 layout cases (local archive), actual workflow repeats (local archive).
- TR transcript/GPA (local archive), EN transcript/GPA (local archive).
- Planner recommendation (local archive), generator handoff (local archive), saved weekly plan (local archive).
- Localized unknown error and Retry (local archive), open Turkish detail dialog (local archive), corrupt-storage warning (local archive).
- Downloaded TR JPEG (local archive), downloaded EN JPEG (local archive): visually inspected, long title contained, same CRN/two meetings/one legend.
- Mobile dark English weekly (local archive), desktop light Turkish weekly (local archive).



## Repository cleanup and follow-up

Generated screenshots, request dumps, build logs, intermediate reports, and obsolete design/implementation plans were removed from the repository after backing them up locally under `/private/tmp/simplify-audit-archive-20261008`. Historical observations above remain dated evidence; image/log references labelled “local archive” are not committed assets. Reproducible auth and calendar browser harnesses and all regression tests remain.

The build script now explicitly selects the supported webpack compiler. Geist fonts are bundled with their license, removing build-time Google Fonts fetches. The original Turbopack failures above are historical failures, not retroactively passes. Initial server metadata is Turkish; hydrated titles/descriptions follow the saved client language and subsequent toggles. Crawlers without client execution receive Turkish metadata.

### Final publish verification (2026-10-08)

These results supersede earlier final counts and the earlier build-script result:

| Command/check | Observed result |
| --- | --- |
| `npm run lint` | PASS, exit 0 |
| `npm run typecheck` | PASS, exit 0 |
| `npm run test:run` | PASS, 448 tests in 76 files, exit 0 |
| `npm run build` | PASS, exit 0; script explicitly invokes `next build --webpack`, local fonts, compilation/types/14 static pages |
| `npm run legal:check` | FAILED, exit 1; 32 missing operator/provider/retention/transfer/review/configuration entries. No fabricated facts or approvals |
| Auth browser runner (`PLAYWRIGHT_MODULE` as above, default `/tmp` artifacts) | PASS, exit 0; all four failed auth forms retain values, visible messages and title/description switch TR/EN, successful profile password fields clear |
| Calendar browser runner (`PLAYWRIGHT_MODULE` as above, default `/tmp` artifacts) | PASS, exit 0; named plan switching, selection/reordering, CRNs, drag/click behavior, TR/EN JPEG exports, four viewport widths |

Browser fixtures exercise real React components with disposable provider actions, not live Supabase/OBS operations. Vite emitted a dependency-scan warning for Next's `server-only` import during the calendar runner; browser execution and assertions completed successfully. Apple Git's Xcode license gate affected the initial remote fetch; using GitHub Desktop's bundled Git binary and helper directory allowed the fetch. Public runtime icon and required source data/tests/licenses were retained. No account data migration was introduced: academic localStorage remains shared across accounts in one browser and retained after logout, as explicitly documented in README.

The final production metadata runner (`PLAYWRIGHT_MODULE` as above, `node tests/i18n/browser/verify.mjs`, production server on port 3122) passed with exit 0. It caught an initial English-refresh failure: Next committed server metadata after the client effect. The fix observes metadata mutations with conditional writes to prevent loops and refreshes on pathname changes; the redundant English auth metadata override was removed. The runner now verifies client navigation, refresh, browser Back, saved English metadata, and Turkish switching on the legal privacy page. The temporary production server was stopped after verification. Regression coverage includes an explicit no-redundant-mutation assertion.
