# Five regression failures fixed — 5 October 2026

All five original regression assertions now pass. The full suite passes **357 tests across 68 files**, including nine additional boundary/integration cases. No original failing expectation was weakened or skipped. Existing user changes and the earlier interface cleanup were preserved.

## Causes and fixes, one by one

1. **Minor program codes:** `curriculumProgramCodeSchema` required an `_LS` suffix. The profile selector supplied valid official codes such as `FIZ_YD`, `MAT_YD_TE` and `MAT_YD_UY`, so the plans/detail API rejected them before reaching the curriculum service. The validator now accepts exact minor identities from the committed official catalog as well as the existing undergraduate format. Unknown minor identities, doctoral codes and URL-like input remain invalid. Plan-type and primary-program association checks remain in place. Tests validate all 76 catalog minor identities and exercise the actual plans handler: Physics minor plans for BLGE_LS are 1646, 1824 and 1920.

2. **Lecture valid, separate laboratory time missing:** The normalizer skipped the unresolved laboratory row and retained the lecture under the same CRN. The generator saw a nonempty meeting array and certified the truncated schedule. Normalization now records unresolved recurring rows and excludes their entire CRN, regardless of row order. Complete alternative CRNs remain available. Explicit exam-only rows remain excluded from weekly sessions without invalidating a complete lecture.

3. **One known time beside `TBA`:** Time parsing extracted only the valid range; the generic single-time pairing logic repeated it across both weekdays. Unequal multi-session lists were also truncated to their shorter length. Normalization now rejects unresolved day/time text and incompatible day/time counts. A clean single explicit time shared across multiple named weekdays remains supported and its existing tests still pass. The change does not invent times for unknown sessions.

4. **English-credit totals:** Curriculum parsers retained `English`, while the audit compared languages strictly with `EN`. Consequently the earned/required counters stayed zero. A shared normalizer converts explicit English/Turkish labels to `EN`/`TR` for both compulsory and elective course parsing; the audit also normalizes raw labels for compatibility with previously loaded data. Unknown labels are preserved rather than inferred from a course suffix. The original fixture now yields 4 earned English credits and 8.5 required English credits. The isolated browser's real main curriculum yields 8.5 / 127 English credits, including its existing manual Physics completion; transcript GPA remains 3.73.

5. **Enrollment counts:** The header map recognized `Kayıtlı`/`Enrolled` but omitted the official `Yazılan` header. Its cell never reached the normalized section. Added verified Turkish and unaccented header aliases. The source fixture's CRN 12476 now retains capacity 95 and enrollment 90, rather than undefined. This does not infer reserve-seat eligibility or guarantee that the live enrollment remains 90 later.

The two meeting failures share one root cause family and are fixed at normalization, before data reaches either scheduling tool. Incomplete CRNs are conservatively omitted from the normalized catalog; this change does not reconstruct missing meetings. The earlier shared-account browser-storage finding is outside these five regressions and remains unresolved.

## Verification

| Check | Result |
| --- | --- |
| Original five regression assertions | All pass |
| `npm run test:run` | 357 / 357 pass, 68 / 68 files; [output](evidence/fixes-tests.log) |
| `npm run lint` | Pass; [output](evidence/fixes-lint.log) |
| `npm run typecheck` | Pass; [output](evidence/fixes-typecheck.log) |
| `npm run build -- --webpack` | Pass; [output](evidence/fixes-webpack-build.log) |
| Bundled `git diff --check` | Pass |
| Isolated browser profile → minor → audit | Minor plans load, plan 1920 saves, minor detail API returns 200, and five requirements / 19 credits render |
| Isolated browser main audit | English-credit total corrected, GPA unchanged, no console errors observed |

Browser profile writes affected only `/tmp/simplify-qa-app`'s synthetic user and file-backed QA profile. No real account sign-in or account modification was performed in this follow-up. Academic detail requests used live OBS. Missing-meeting boundary cases and enrollment count assertions use fixtures; they are not claims about every current live CRN.

The default Turbopack build's worker-port environment failure and legal production-readiness blockers from the original audit were not changed or retested by these fixes. Webpack compilation passing does not establish deployment readiness.

## Evidence

- [Source changes against the pre-fix snapshot](evidence/fixes-source.diff)
- [Successful minor plans/detail browser requests](evidence/fixes-browser-requests.log)
- [Rendered minor audit](evidence/fixes-minor-audit.txt)
- [Corrected main-audit screenshot](evidence/fixes-graduation-desktop.jpg)

Changed production files: `src/lib/itu/curriculum/schemas.ts`, `language.ts`, the compulsory/elective parsers, `src/lib/curriculum/graduation.ts`, `src/lib/itu/constants.ts`, and `src/lib/itu/normalizers/normalizeCoursePage.ts`. Supporting tests remain under `tests/quality/`.
