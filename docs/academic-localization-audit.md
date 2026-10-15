# Academic localization audit — 2026-10-12

## Findings and changes

| Area | Gap | Change |
| --- | --- | --- |
| Profile academic selectors | Most faculty/program names and all plan titles lacked English fields | Import official labels and return bilingual metadata from catalogue services and parsers |
| Dashboard, navigation, program tabs | Previously saved profiles contained Turkish-only names | Shared official-name lookup works with saved source strings, without resaving the profile |
| Curriculum explorer | Faculty/major selectors, faculty summary, headings and plan descriptions retained source language | Localize the displayed label while retaining stable selection values |
| Graduation calculator | Faculty names and validity periods bypassed localization | Localize both; suppress duplicate period text after translation |
| Curriculum graph, details, elective lists, graduation rows and semester recommendations | Coded courses used the same helper as academic metadata | Render source course titles independently of interface language |
| Elective placeholders | OBS commonly returns the identical untranslated label in both languages | Translate recognized generic elective labels, semester ordinals, restricted/free/technical qualifiers and Roman numerals; preserve category codes and specialty names |
| CRN bookmark link | Saved bookmark title was always Turkish | Use the current localized link label |

The translation dictionary key audit also covers static interface text, interpolation placeholders and runtime-constructed status keys. Existing requirements, credit, ECTS, completion and theme-control labels already have both translations.

## Official sources

- [İTÜ OBS course plans](https://obs.itu.edu.tr/public/DersPlan)
- [Screenshot curriculum, plan 1562](https://obs.itu.edu.tr/public/DersPlan/DersPlanDetay/1562)
- English and Turkish metadata are requested using the official `.AspNetCore.Culture` preference. Source URLs and retrieval time are recorded in `src/data/itu/academic-translations.json`.
- Reimport with `node scripts/import-academic-translations.mjs`. The importer reads public metadata and never writes or translates course records. Downloaded public pages are cached in `/tmp/simplify-academic-translations`.

The import produced 2,537 label pairs from 1,840 source URLs, with no request failures or conflicting pairs. Every stored faculty and curriculum-plan title has an English source label. The full catalogue contains 245 program offerings and 1,593 plans.

## Source limitations

Fourteen historical conservatory minor names have no distinct English label on the official program-list endpoint (for example, Music Technology specializations and Turkish Folk Dances specializations). Some official English plan headings are themselves partly Turkish. These names keep the available official wording; the app does not present invented wording as an official translation. Specialty elective groups that are named after particular subjects also keep their source wording unless an official pair is available.

## Course invariance

Course codes and source titles do not depend on the interface language. MAT103 remains Matematik I; MAT103E remains Mathematics I. This applies to course cards, details, graph nodes, prerequisite/unlock lists, elective course choices, graduation rows, semester recommendations, schedule generation and calendar displays. Language-equivalent courses still remain separate course records. No course record in `curriculum-catalog.json` was modified.
