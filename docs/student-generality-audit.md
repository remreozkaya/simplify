# Student generality audit — 26 October 2026

This audit traced profile enrollment → typed program and curriculum selection →
shared transcript and plan progress → requirement allocation and prerequisite
evaluation → semester recommendations → restricted section scheduling → saved
weekly plans, credits, JPEG geometry, and CRN bookmarklets. It covers the current
İTÜ undergraduate/main, double-major, and minor model. It does not certify every
curriculum or university registration decision.

Subsequent requested policy change: elective credit alternatives now count their
minimum official value in Curriculum, Graduation Calculator and Smart Semester
Planner. This replaces the completed-choice/unknown treatment described in the
original audit below. Known requirement totals are summed using those minimum
values; transcript GPA weights remain separate.
Electives also contribute those minimum values to required and earned English
credits, including non-English language choices, under the subsequently
requested application policy.

## Confirmed issues and corrections

| Issue / affected students | Shared correction | Principal files |
| --- | --- | --- |
| Curriculum fallback queried only faculty `10`; explicit unavailable programs silently became the first unrelated program. This affected incomplete/migrated profiles and links or saved selections outside that faculty. | Enumerate faculties and their offerings; preserve explicit selections without substitution. Keep successful faculty responses when another fails, with an incomplete-catalog warning. | `src/components/curriculum/CurriculumExplorer.tsx` |
| Live double-major plans were rejected by title prefix before official program associations were read. Empty associations were treated as permission for every main program. | Use explicit full-code relationships. Missing or failed association evidence remains visible but unverified and unselectable; profile saving verifies it again. One unavailable version does not discard verified versions. | `src/lib/itu/curriculum/services/getCurriculumPlans.ts`, `catalog.ts`, `src/app/(app)/profile/actions.ts` |
| Curriculum availability and semester planning applied different minimum-credit logic; stale local manual progress could override the shared transcript, and elective details omitted external prerequisites in that transcript. | Share prerequisite evaluation and transcript precedence. Count explicit unique passed credit evidence once; insufficient/conflicting evidence remains unknown. All affected views use the same merged prerequisite progress. | `src/lib/curriculum/eligibility.ts`, `progress.ts`, `src/lib/semester-planner/planner.ts`, `CurriculumExplorer.tsx` |
| Prerequisite loading discarded records published under the recognized course-language counterpart. | Retain counterpart evidence and use it only when the exact course record is absent, preserving distinct published exact records. | `src/lib/itu/curriculum/services/getCurriculum.ts` |
| Variable-credit requirements always used the first numeric option. The bundled physics plan `2611`, group `13204`, allows `3 / 4`; completing its four-credit `FIZ 362E` counted only three credits. | Resolve a variable elective from its actual pool choice; preserve fixed target requirement credits. Unresolved credit/GPA totals stay unknown and display an explanation in both languages. Unknown ECTS does not remove a recommendation whose local credits are known. | `src/lib/curriculum/graduation.ts`, `src/lib/semester-planner/planner.ts`, graduation/explorer/planner views, `src/lib/i18n/index.ts` |
| One manual completion could make several overlapping elective slots disappear from availability; greedy elective allocation could count only one requirement when a valid two-course assignment existed. | Availability uses the same curriculum allocation as audits. Elective matching can move flexible assignments while preserving direct/official matches and explicit manual assignments. | `src/lib/curriculum/availability.ts`, `graduation.ts` |
| The bundled official-equivalence import targets contain only six Computer Engineering plans; other curricula received no indication of this coverage limit. | Preserve verified directional records, expose missing/incomplete coverage, and allow refreshes from an explicitly supplied verified target configuration. No course equivalences or program IDs are guessed. | `src/lib/curriculum/equivalenceStore.ts`, curriculum service and views, `scripts/import-course-equivalences.mjs`, `README.md` |

## Retained data and behavior

- No production dependency on a personal name, account, sample transcript,
  course list, or CRN was found. The repository owner's name in the HTTP user
  agent is source attribution, not academic logic. Personal examples in tests
  do not seed production state.
- Exact OBS program/full-code restrictions, separately evidenced minor mappings,
  unresolved legacy identities, and per-section allowlists remain intact. Their
  provenance and ambiguity are documented in `docs/program-restrictions.md`.
  A dash or unavailable restriction is not assumed unrestricted.
- Plan-specific directional equivalences retain their verified source records;
  no reverse, transitive, or similarly named-course equivalence was added.
- Turkish/English course counterparts remain the application's documented
  matching policy (`src/lib/legal/copy.ts`), not independently verified official
  equivalence decisions for every course. Exact prerequisite evidence takes
  priority. Economics English display-name overrides affect labels only.
- Fixed target requirement credits, transcript GPA weights, zero-credit
  requirements, repeated-attempt handling, grade tables, search budgets, and
  recommendation scoring remain separate from individual student identities.
- Calendar/CRN checks found current-selection behavior rather than personal
  seed values. Manual schedules remain saved snapshots, as documented.

## Regression scenarios

New tests reproduce the defects before their respective fixes. Expected values
use hand-checked synthetic relationships or attributed bundled source data.
Coverage includes science, chemistry, mathematics and computing branches;
main-only, double-major, minor and three-program combinations; varied credit and
prerequisite structures; shared requirements; exact and language-counterpart
electives; failed/repeated attempts; missing program associations; partial
upstream failures; missing credits/ECTS; unavailable offerings; external
prerequisites; and program changes with saved progress.

The added invariance cases change display labels and opaque identifiers while
preserving relationships. Save-action tests change the student's name without
changing verified program outcomes. Turkish/English rendering checks cover
uncertainty and affected controls. Scheduling cases check full-code identities,
unknown minor mappings, leading-zero CRNs, ordered current selections,
fractional credits, multiple meetings and weekend/early/late export geometry.

Principal new suites: `tests/itu/secondaryPlanGenerality.test.ts`,
`tests/profile/secondaryEligibilityAction.test.ts`,
`tests/profile/planEligibilityUi.test.tsx`,
`tests/curriculum/explorerPrograms.test.tsx`,
`tests/curriculum/creditAuditUi.test.tsx`,
`tests/quality/studentAcademicGenerality.test.ts`, and
`tests/quality/studentSchedulingGenerality.test.ts`. Existing academic,
restriction, transcript, calendar, and profile suites provide additional
regression coverage.

## Final verification

- Baseline: 85 test files / 558 tests passed before changes.
- `npm run test:run`: **93 files / 622 tests passed**, exit 0.
- `npm run typecheck`: passed, including Next route type generation.
- `npm run lint`: passed.
- `npm run build`: passed, including webpack compilation, TypeScript checks,
  static page generation and route collection.
- `git diff --check`: passed.
- Production HTTP smoke check: `/login` returned 200; `/curriculum`,
  `/graduation-calculator`, `/semester-planner`, and `/weekly-planner` returned
  the expected 307 redirects to their sign-in continuations without a session.
  The temporary local server was stopped afterward.
- Integration coverage includes an actual isolated importer subprocess,
  authenticated profile-action boundaries with controlled provider responses,
  academic-to-weekly-plan conversion, and Turkish/English component rendering.
- Authenticated browser interaction, live university registration, and actual
  JPEG raster rendering were not exercised. No deployment or online institutional
  data refresh was performed. The production publication/legal-readiness gate
  was outside this academic audit.
- Independent review found and resolved two partial-upstream-failure regressions.
  A separate comparison of the elective matcher with exhaustive search on 2,500
  small random assignment graphs found no cardinality/exact-match discrepancies.
  This supplementary check is not a universal proof.

## Limits and unresolved institutional rules

- Official equivalence coverage is incomplete. The snapshot has no ledger
  proving exhaustive successful imports, including for the configured six
  plans. Warnings do not manufacture missing equivalences. No online catalog or
  equivalence refresh was performed during this audit.
- Four bundled minor versions have no recorded main-program association list.
  Their eligibility remains unverified rather than universally allowed.
- Local transcripts, progress, semesters, calendar plans and generator state
  are intentionally browser-global and shared across accounts. The existing
  privacy notices explicitly disclose this. This audit preserves that storage
  policy; it does not claim account isolation. Profile metadata itself is
  account-backed.
- Imported course results support passed/failed states and attempt history;
  current-term grade projections do not establish completed prerequisites.
  General in-progress/co-requisite registration authorization is not modeled.
- Registration limits, residency rules, official graduation/GPA thresholds,
  mixed-language multi-course equivalence credit rules, and unknown source
  expressions require institutional evidence. They were not invented.
- Manual saved meetings can differ from a later refreshed section timetable.
  Export geometry tests do not constitute JPEG pixel verification or live OBS
  registration testing. Search budgets can leave feasible alternatives unseen.
- Passing the representative matrix demonstrates the specific contracts above,
  not universal correctness for every student or future curriculum.
