# Program restriction sources and refresh

`src/data/itu/program-restrictions.json` records the official OBS undergraduate
program identity table, the separate SIS legacy table, curriculum minor
identities, and schedule observations. The program table is not the schedule
allowlist: a course section's own CRN restriction cell determines its scope.

Refresh online with:

```sh
node scripts/import-program-restrictions.mjs
```

For an offline refresh, supply a source directory:

```sh
node scripts/import-program-restrictions.mjs --source-dir=/tmp/itu-sources
```

The directory contains `itu-programs.html` (Turkish OBS table), `itu-sis.html`,
`itu-branches.json`, `itu-semester.json`, optional `itu-programs-en.html`, and
`itu-sections/<branch>.html` for every branch enumerated in the branches JSON.
`--output=/absolute/path.json` targets an existing registry snapshot instead of
the checked-in registry. Fetches use four concurrent workers and 25-second
timeouts. Required source identities must validate before writing. Schedule
headers must still identify CRN and `Dersi Alabilen Programlar` at index 12 in
the 15-column table. Invalid or missing branch sources are recorded in
`refresh.failures`; output replacement is atomic. A completely empty or failed
schedule refresh does not overwrite the registry.

A minor mapping becomes verified when the exact official curriculum full code
appears literally in a schedule allowlist. No suffix, language marker, campus,
or joint-program transformation is inferred. Each mapping contains its
curriculum source links plus semester, branch, CRN, and section-source URL
observations. Previously verified mappings retain their original observations
and a `retainedFrom` date if a refresh provides no fresh evidence. This historical
evidence verifies identity, not current availability or entitlement.

Legacy minor aliases require a unique exact official name match between SIS and
the curriculum catalog, plus observation of the corresponding full code in a
schedule. The SIS code `MKN` occurs twice and remains ambiguous. Distinct SIS
names are not silently equated to renamed curriculum programs.

The October 5, 2026 snapshot scanned all 178 branches for 2026–2027 fall and
3,959 section rows. All 76 minor identities present in the bundled September 2
curriculum catalog appeared literally. This does not establish completeness for
historical or future minor programs. Seventeen legacy minor aliases meet the
exact-name criterion; `MKN`, `PETM`, `GEMM`, and `SORM` remain unresolved.
All bundled main/second-major curriculum codes resolve to an official OBS identity.
Other unmatched SIS legacy identifiers remain unresolved: `JDF`, `SCE`, `ICME`,
`ELH`, `TEHB`, `TISL`, `UCKE`, `TEB`, `MUZE`, and `SAO` (the latter is listed
under associate education on SIS). These are preserved with their source names;
no renamed, language-variant, or degree-level equivalence is guessed.
The 129 OBS identities have official English labels. The OBS undergraduate
identity table does not supply English names for curriculum minors; their
Turkish names are preserved.

The snapshot has 564 distinct observed tokens, including 360 outside the
undergraduate registry (many graduate and associate identities). They remain in
`observationSummary.unknownTokens` rather than becoming guessed identities.
There were 137 restriction cells containing `-` and no blank cells. The source
does not establish that either value means unrestricted enrollment: both are
unknown. `unrestrictedSentinels` is empty. The observations are not a substitute
for registration-system authorization.

`tests/program-restrictions/fixtures/official-sections.json` contains small,
attributed extracts from real source tables: two BLG 231E sections with different
allowlists, a literal FIZ minor token, and a dash restriction cell. Tests cover
column validation, literal identity evidence, ambiguity, unobserved candidates,
and provenance retention during partial refreshes.

Runtime scheduling uses one exact-token, three-state eligibility function. Main
and second-major identities use their verified OBS full codes; minor identities
use the independent explicit mapping above. Unresolved memberships are retained.
Curriculum requirements and section permissions remain separate. Manual warnings
are inline and non-blocking; automatic searches exclude definitive mismatches,
prefer verified sections, and identify unknown fallback recommendations.

Catalog refresh resolves the official active semester before consulting the
validated branch cache. The server cache is process-local and refreshes after
five minutes; it is not durable across server restarts. Browser catalogs refresh
on the same interval and on focus. Failed or incomplete refreshes preserve the
validated snapshot internally but expose restriction eligibility as unknown with
`source-unavailable`, retaining its raw text and original timestamp. Successful
semester transitions remove other-semester catalogs. Derived generator results
are invalidated when memberships or relevant section/semester data change; saved
manual schedules are retained.
