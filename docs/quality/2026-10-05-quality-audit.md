# Simplify quality audit — 5 October 2026

**Follow-up:** The five failures documented below were subsequently fixed at the user's request. See [regression fixes and current verification](2026-10-05-regression-fixes.md). This audit retains the original findings and evidence.

## Outcome and scope

The requested copy cleanup is implemented. Lint, type checking, and a webpack production compilation pass. The expanded test suite has **343 passing and 5 failing tests** across 68 files. The five new failures demonstrate four functional defects; they remain enabled. All 341 pre-existing tests pass. This is not a claim that every workflow or institutional rule is correct.

Changes are limited to interface copy, removal of unused copy references, deduplication of a displayed curriculum validity period, and focused regression tests. Functional defects below were not fixed, as requested. Existing working-tree changes were preserved; the cleanup diff was calculated against a pre-edit filesystem snapshot, rather than treating the already modified repository as a clean baseline.

The authorized live account was used for sign-in, read-only profile inspection, sign-out and sign-in again. No real profile, password, transcript, or academic record was changed. Academic mutations used a disposable local clone on port 3101 with synthetic authentication and a file-backed QA profile. Port 3100 used real authentication and live public academic data, with disposable browser-origin planning data. Neither origin was the ordinary port-3000 workspace. Credentials are excluded from this report and evidence. [Sanitized final browser observations](evidence/browser-verification.json) confirm sign-out, six restored QA course rows, cleared errors and no mobile page overflow. QA tabs and both development servers were closed after verification.

## Project inspected

Read AGENTS.md, README, package scripts/dependencies, installed Next.js client-component documentation, academic/authentication/privacy documentation, domain modules, UI components, API routes, and existing tests. The project uses Next.js 16.3.3, React 19, TypeScript, Tailwind, Zod, Cheerio, Supabase Auth, and Vitest. There is no configured Playwright/Cypress browser-test script; browser verification was performed interactively with CUA.

| Implemented surface | Data and behavior |
| --- | --- |
| Home, profile | Authenticated Supabase metadata; main program and additional enrollments with exact plan versions |
| Curriculum, graduation | Live plan details, prerequisites/electives, imported equivalences, shared browser transcript, plan-specific manual completion, weighted GPA |
| Semester planner | Bounded multi-program recommendations, local-credit target, course-count ceiling, priority, actual section identities and uncertainty warnings |
| Generator, weekly planner | Section constraints, conflict calculations, named local schedules, multiple meetings, conversion and persistence |
| Login/signup/verification/recovery | Supabase server actions, session cookies, verified-user protected layout |
| Legal/privacy settings | Bilingual draft notices, browser-data controls, authenticated account export/deletion interfaces; launch gate |
| ITU APIs | Branches, courses, faculties, programs, plans, and plan detail; OBS clients, validation and caching |

The committed catalog contains 23 faculties, 245 program offerings and 1,593 plan versions (378 undergraduate, 1,081 ÇAP, 134 Yandal), including 76 distinct minor identities. This is snapshot coverage, not proof that every current official plan is present. Account-scoped academic storage and cross-device academic synchronization are explicitly **not implemented**. Legal deployment facts and reviews remain incomplete. Minor selectors exist, but the API defect below prevents their successful completion.

## Interface changes

Changed `src/app/(app)/page.tsx`, `PlanningChecklist.tsx`, `AppNavigation.tsx`, `LegalFooter.tsx`, `GraduationCalculator.tsx`, `lib/navigation.ts`, and both TR/EN dictionaries.

- Removed the home eyebrow, generic tools introduction, and five tool-card descriptions that repeated their destination headings.
- Removed five planning-step descriptions while retaining step names, completion state, next-step indication and action links.
- Removed the redundant profile-incomplete explanation from navigation; retained the warning heading and profile action.
- Removed the footer planning tagline; retained the independent-tool disclosure, legal links and storage/privacy notices.
- Shortened the academic-program note to “İlerleme her program için ayrı hesaplanır.” / “Progress is calculated separately for each program.”
- Avoided repeating the curriculum validity period when it is already part of the displayed plan name.
- Removed ten unused translation entries in each language after checking references, and unused navigation description fields.

Reviewed the remaining forms, tool cards, dialogs, settings/privacy controls and legal pages. Password requirements, credit-target and zero-course-count semantics, transcript input instructions, source limitations, missing-rule warnings, restriction warnings, validation and privacy disclosures remain because they affect decisions. Accessible labels remain. The retained planner hints still have matching `aria-describedby` targets. No broad layout or behavior refactor was made. [Cleanup diff](evidence/text-cleanup.diff).

The planner already had exactly **Target Semester, Credits, Maximum Course Count, Priority** at inspection. The suggested-18-credit button was already absent; no removal was needed. Confirmed in code, existing UI tests and browser controls.

## Significant findings

### P1 — Official minor codes rejected by curriculum APIs

**Reproduce:** In Profile select a valid main major, add a minor, choose Fen–Edebiyat and Physics (`FIZ_YD`). The plans request uses `programCode=FIZ_YD&planType=yandal&primaryProgramCode=BLGE_LS`.

**Expected:** Return the officially catalogued minor plans and permit a minor enrollment. **Actual:** HTTP 400, “Geçerli bir lisans programı seçin.” All 76 catalog minor identities fail the shared program-code schema.

**Location:** `src/lib/itu/curriculum/schemas.ts:3`, plans and detail API validation, profile curriculum selectors. The schema accepts only an `_LS` suffix.

**Evidence:** [Browser screenshot](evidence/minor-api-error.jpg), [request log](evidence/browser-requests.log), `tests/quality/minor-program-codes.test.ts`, [test output](evidence/source-contracts.log).

**Recommended fix:** Validate exact catalog identities for the relevant plan type, including verified minor suffix variants; retain primary-major validation separately. Do not derive minor identities by replacing display names or suffixes speculatively.

### P1 — Incomplete CRN meeting data can be certified conflict-free

**Reproduce:** Normalize one CRN with a Monday 09:00–10:00 lecture and a separate Wednesday laboratory row whose time is `-`; generate schedules. A second case puts “Monday Wednesday” and “09:00/10:00 TBA” in one row.

**Expected:** Neither CRN is a verified conflict-free selection because a recurring meeting time is unresolved. **Actual:** Both cases return one conflict-free schedule. The first silently drops the unresolved meeting; the second repeats the known time for the unresolved session.

**Location:** `src/lib/itu/normalizers/normalizeCoursePage.ts:129` and `:228`; `src/lib/schedule/generator.ts:82`; calendar adapter loses the distinction between complete and partially parsed meetings.

**Evidence:** Two enabled failures in `tests/quality/incomplete-meetings.test.ts`; [output](evidence/incomplete-meetings.log). These are synthetic boundary fixtures, not a claim that a specific current live CRN has this defect.

**Recommended fix:** Track recurring-meeting completeness through normalization and conversion. Reject incomplete sections from verified automatic schedules or explicitly mark them unverified. Distinguish non-teaching rows from missing laboratory/lecture sessions; do not guess repeated times.

### P2 — English-credit totals collapse to zero for parsed source language labels

**Reproduce:** Parse the official-format curriculum fixture, then import an AA in MAT 103E with four local credits. The fixture marks MAT 103E (4 credits) and programming (4.5) as English. The browser QA audit similarly imported MAT 103E and BLG 113E.

**Expected:** Fixture audit shows 4 earned English credits and 8.5 required English credits. **Actual:** Both are zero. Browser audit showed correct earned local credits and GPA but English credits `0 / 0`.

**Location:** `src/lib/curriculum/graduation.ts:341`; `src/lib/itu/curriculum/parsers/parseCurriculumDetail.ts`. The audit recognizes `EN`, while parsed source values retain labels such as `English`.

**Evidence:** `tests/quality/english-credit-audit.test.ts`, [output](evidence/english-credit-audit.log), [mobile audit](evidence/graduation-mobile.jpg).

**Recommended fix:** Normalize verified language labels at the source boundary and preserve unknown labels explicitly. This finding concerns classification arithmetic; no institutional English-percentage graduation rule was invented or certified.

### P2 — Official enrollment count is lost

**Reproduce:** Fetch current BLG offerings and inspect CRN 12476, BLG 231E. The official table has capacity 95 and enrollment 90 under `Yazılan`. Parse through the application pipeline.

**Expected:** Section enrollment is 90. **Actual:** Enrollment is undefined. A live MAT 103E details dialog also displayed enrollment as unspecified.

**Location:** `src/lib/itu/constants.ts:168` enrolled header aliases and course-page parser.

**Evidence:** [Live source capture](evidence/live-sources.json), attributed existing official-section fixture, `tests/quality/official-enrollment.test.ts`, [output](evidence/source-contracts.log).

**Recommended fix:** Support the verified `Yazılan` header and test it against literal source rows. Do not infer eligibility or reserved-seat availability from the aggregate count alone.

### P1 — Academic browser data is shared between accounts

**Reproduce from architecture:** Account A saves academic data, signs out, then account B signs in on the same browser origin. Transcript, progress, generator and calendar keys contain no account identifier, and logout does not clear them.

**Expected for account isolation:** Account B cannot receive account A’s academic records. **Actual:** Storage is origin-scoped and explicitly shared across accounts; this is documented existing behavior. The sign-out/sign-in check confirmed persistence for the same account. A second-account live test was not available, so this finding is source-confirmed rather than a completed live A/B test.

**Location:** `src/lib/curriculum/transcriptStore.ts:8`, `progress.ts:6`, calendar persistence, `src/lib/schedule/session.ts:3`, `src/app/auth/actions.ts:341`, README data-ownership section.

**Evidence:** Account-independent storage keys and logout implementation; existing storage tests. Profile metadata actions do validate the current authenticated user, separately from this browser-storage gap.

**Recommended fix:** Scope academic keys to a verified user identity and design an explicit migration for existing shared records. Avoid silently assigning old shared data to the next user. This requires product behavior changes outside the copy-cleanup scope.

## Workflow verification

“Fixture” below means isolated synthetic authentication/profile or deterministic test data. Public OBS requests in the fixture browser still used the real academic integration except during the explicit 503 injection.

| Check | Evidence / result |
| --- | --- |
| Real account authentication | Sign-in, protected home, sign-out, sign-in again, unchanged main/ÇAP profile, final sign-out passed. No recovery emails or credential changes. |
| Create/update academic profile | Fixture main BLGE_LS plan 1562 and ÇAP ECNE_LS plan 2256 saved, reloaded and propagated to tools. Changing main faculty reset dependent main program/plan and additional program/plan. Minor blocked as above. |
| Transcript repeats and GPA | Fixture FF then AA for MAT 103E plus BB in BLG 113E retained two latest records. GPA `(4×4 + 1.5×3)/5.5 = 3.72727…`, UI 3.73, earned credits 5.5. Refresh retained data. |
| Manual completion and audit | Marked FIZ 101E complete; dependent audit and recommendations updated. Main and ÇAP tabs worked; keyboard ArrowRight selected the next program tab. |
| Independent cross-module arithmetic | New test: latest AA(3) plus BB(4) gives GPA 24/7; older CC cannot overwrite AA. Requirement credits remain 3+3, separate from transcript GPA weights. Main/ÇAP/minor synthetic audits pass. |
| Shared requirements and ITU/ECTS | New test: one course contributes to three programs but counts once in a 6-local-credit / 12-ECTS recommendation; combined remaining credits are 6. Separate local/ECTS browser totals also visible. |
| Live recommendations | Target 18/max 6/balanced returned 18 local credits, 31.5 ECTS and six courses. Search-limit, prerequisite, registration-limit and corequisite uncertainty remained visible. |
| Completed courses and ÇAP contribution | Fixture recommendations omitted completed MAT 103E/BLG 113E and considered ECN requirements. Target 18 produced 17.5 local credits/31 ECTS; target is not a hard minimum. |
| Boundary credit targets | Zero produced no selected courses and disabled handoff, with explanatory results; 1000 rejected with 0–60 validation. Existing tests cover ceilings and alternative targets. |
| Handoff and schedules | Live handoff retained six actual CRNs; generation produced one schedule; save yielded six courses/seven weekly blocks. Fixture handoff yielded six courses/six blocks. Refresh restored both saved plans. |
| Meetings and overlap | Existing conflict tests cover partial overlaps and alternative sections. New workflow test retains lecture + laboratory and proves 09:00–10:00 followed by 10:00–11:00 does not overlap. Incomplete-session exceptions fail as above. |
| Impossible constraints | Excluding all seven days returned no feasible schedule and no save-to-weekly action. |
| Add/remove and rapid interaction | Fixture weekly plan grew from six to eleven rows after five additions, then returned to six after five removals. Course/CRN selectors and course details exercised. |
| Section restriction warning | MAT 117 CRN 13765 showed the short warning with exact allowed program MAT_LS and localized Mathematics Engineering name in TR/EN; test row removed afterward. [Screenshot](evidence/ineligible-section-mobile.jpg). |
| Restriction uncertainty | Existing tests separately cover eligible, ineligible, missing restriction and unresolved identities, exact CRN/semester lookup, and uncertain minors. No unverified minor mapping was added. Live 12476 explicitly lists BLG_LS, BLGE_LS, END_LS, ENDE_LS, SECE_LS. |
| API failure and recovery | Injected 503 into clone branch API only: alert and Retry appeared, saved program remained selectable. Restored route, clicked Retry, six-course saved program loaded and alert cleared. No actual source route changed. |
| Language/theme/layout | Turkish initial default, TR/EN switching, light/dark, localized controls/errors/warnings verified. Home, profile, audit, generator and weekly views checked at desktop and 390px mobile. QA weekly document width equalled 390px, without page overflow. Official names may fall back to original Turkish when English metadata is absent. |
| Accessibility | Labels, skip link, focusable controls, program-tab arrow navigation, dialog Escape dismissal and preserved hint associations checked. Not a complete screen-reader or WCAG audit. |
| Console/network | Settled QA browser error log empty. Expected minor 400 and injected 503 recorded. A transient hot-reload error during intermediate copy edits did not persist after the completed edits. No final workflow-breaking console error observed. |

Existing unit/integration tests additionally exercise prerequisite AND/OR expressions and minimum grades, equivalencies and elective allocation, missing academic rules, parser/cache errors, corrupted persisted structures, overlap metrics, authentication validation, privacy action authorization, and bilingual rendering. Those passing tests are fixture evidence, not live verification of every institution rule or external service.

## Live-source checks

On 5 October 2026 at approximately 17:32 TRT, direct HTTP checks returned 200 for the [official program-code list](https://obs.itu.edu.tr/public/GenelTanimlamalar/ProgramKodlariList?programSeviyeTipiId=2), [BLG offerings](https://obs.itu.edu.tr/public/DersProgram/DersProgramSearch?programSeviyeTipiAnahtari=LS&dersBransKoduId=3), [main plan 1562](https://obs.itu.edu.tr/public/DersPlan/DersPlanDetay/1562), and [ÇAP plan 2256](https://obs.itu.edu.tr/public/DersPlan/DersPlanDetay/2256). Response sizes, headings and literal CRN 12476 values are in [live-sources.json](evidence/live-sources.json). Browser tool requests also loaded real branch/course/plan data successfully.

These checks establish availability and those specific rows at that time. They do not certify all plans, future semesters, unpublished restrictions, reserve-seat rules, language-counterpart equivalence policies or institutional graduation approval. No snapshot import command was run and no institutional rule was invented.

## Commands and check results

| Command | Result |
| --- | --- |
| `npm run lint` | Passed; [log](evidence/final-lint.log) |
| `npm run typecheck` | Passed; Next route type generation and tsc; [log](evidence/final-typecheck.log) |
| `npm run test:run` | 343 pass / 5 fail; 64 pass / 4 fail files; [log](evidence/final-tests.log). All pre-existing 341 pass. |
| `npx vitest run tests/quality/incomplete-meetings.test.ts` | Two demonstrated meeting-completeness failures |
| `npx vitest run tests/quality/minor-program-codes.test.ts tests/quality/official-enrollment.test.ts` | Two demonstrated source-contract failures |
| `npx vitest run tests/quality/english-credit-audit.test.ts` | Demonstrated English-credit failure |
| `npm run build` | Failed: Turbopack/PostCSS worker attempts a prohibited port bind (`Operation not permitted`). Reproduced with broader execution permissions; environment issue, not a copy regression. [Log](evidence/final-turbopack-build.log). |
| `npm run build -- --webpack` | Passed compile, TypeScript and route generation; [log](evidence/final-webpack-build.log) |
| `npm run legal:check` / `npm run build:production` | Failed expected deployment gate: missing controller/provider/retention/transfer facts and reviews, deletion secret and production site URL. [Log](evidence/production-readiness.log). Do not fabricate these values. |
| `npm run dev -- --port 3100` | Real auth + live academic browser checks |
| `npm run dev -- --webpack --port 3101` | Disposable clone browser workflow and failure injection |
| Direct Node HTTP source-check script | Four official URLs returned 200; sandbox network required broader execution permissions |
| Bundled `git diff --check` | Passed. System Git blocked by Xcode license; bundled Git used. |

New tests derive expected values from explicit sample arithmetic, literal source values, exact catalog identities or the requirement that unresolved meetings cannot be verified conflict-free. No existing assertions were skipped, deleted, or weakened. No deployment, commit or snapshot refresh was performed.

## Remaining uncertainties and untested areas

- No live second-account A/B isolation experiment; the shared-storage architecture is confirmed and remains unresolved.
- No signup/email verification delivery, password reset/change, account deletion, production SMTP, or expired-email-link lifecycle testing on the real account.
- No end-to-end minor workflow past the failing plans request; synthetic minor calculation tests do not establish actual minor curriculum integration.
- Corrupted saved data and timeouts are covered by existing deterministic tests; no browser storage corruption or prolonged live network timeout was induced. The browser 503 test is separate evidence.
- No full audit of every curriculum/version, external link, institutional elective/corequisite rule, reserve-seat policy or all dynamic translations. Source-language fallback was observed.
- No Safari/Firefox matrix, assistive-technology session, exhaustive keyboard traversal, or visual comparison at every viewport. Browser testing used the Codex in-app browser.
- Production compilation passed with webpack; the default build and deployment-readiness gate remain failed. The application is not verified ready to launch.

## Visual evidence

- [Cleaned desktop home, dark](evidence/clean-home-desktop-dark.jpg)
- [Cleaned mobile home, English/light](evidence/clean-home-mobile-light-en.jpg)
- [Live generated weekly plan](evidence/live-weekly-desktop.jpg)
- [Mobile graduation audit](evidence/graduation-mobile.jpg)
- [Minor API error](evidence/minor-api-error.jpg)
- [Localized ineligible-section warning](evidence/ineligible-section-mobile.jpg)
