# Simplify

Academic planning for İstanbul Technical University (İTÜ) students. Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, and Supabase Auth. The interface supports Turkish (default), English, and light/dark themes.

## Features

| Route | Purpose |
| --- | --- |
| `/` | Dashboard with enrolled programs, planning checklist, and tool links |
| `/profile` | Personal details, main major, double majors, minors, password, and account export/deletion |
| `/semester-planner` | Course recommendations across active programs, with credit targets, prerequisites, and registration warnings |
| `/generator` | Generate and compare weekly schedules using course, section/CRN, day, and time preferences |
| `/weekly-planner` | Create named schedules, reorder courses, inspect overlaps, export JPEGs, and access the CRN bookmarklet |
| `/curriculum` | Explore program requirements, prerequisite graphs, and completion progress |
| `/graduation-calculator` | Paste transcript text or Markdown, track degree requirements, and calculate GPA for each program |
| `/semesters` | Review transcript history by semester, select current courses or import a weekly plan, and project semester and overall GPA |

The semester planner can send selected courses and sections to the schedule generator. Generated schedules can be saved as named weekly plans. Automatic searches have finite work limits and report incomplete comparisons. Unknown availability and registration restrictions remain visible; academic results are advisory and should be checked in OBS.

Transcript imports accumulate across semesters. The latest attempt determines current course results, while semester history supports reviewing previous attempts. Main-major, double-major, and minor requirements are evaluated independently against their selected curricula. Official course equivalences and Turkish/English language counterparts contribute to requirement matching. Manual completions are preserved when imported progress is reset. Current-semester grade estimates support projections without changing imported transcript results.

## Local development

Use Node.js 20.9 or newer and npm.

```sh
npm ci
cp .env.example .env.local
# Fill in the Supabase public values and use the local site URL below.
npm run dev
```

Open [localhost:3000](http://localhost:3000).

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

These Supabase values identify the public project. Account deletion additionally requires the server-only `SUPABASE_SECRET_KEY`; never expose an admin credential through a `NEXT_PUBLIC_` variable or commit real credentials.

### Supabase setup

1. Create a Supabase project and enable email/password authentication.
2. Enable **Confirm email**. Protected pages require a verified user; ITU API routes check session claims and rely on the provider's confirmation setting.
3. Set the authentication **Site URL** to your app origin and allow `/auth/callback` on each local or deployed origin, for example `http://localhost:3000/auth/callback`.
4. Set `NEXT_PUBLIC_SITE_URL` to that origin without a trailing slash. Production can alternatively use `VERCEL_PROJECT_PRODUCTION_URL`.
5. Configure production SMTP before launch. Confirmation and recovery emails use Supabase's email delivery.

No application database tables are required. Profile details and program enrollments are saved in Supabase Auth user metadata. Signup verification and password recovery return through `/auth/callback`. Keep the provider's confirmation/recovery links intact if customizing email templates.

**Remember me** controls persistent versus session-only auth cookies. Browser session restoration may retain session cookies. Passwords and auth tokens are not copied into application `localStorage`.

## Storage and privacy

Schedules, generator preferences, shared transcripts, curriculum selections/progress, current-semester courses and grade estimates, language, and theme are stored in this browser's `localStorage`. They persist after logout, are shared by accounts using the same browser profile, and do not synchronize across devices. Transcript parsing and academic calculations run locally; catalog requests use same-origin API routes that fetch public İTÜ data server-side.

Public bilingual pages at `/legal/privacy`, `/legal/storage`, `/legal/terms`, and `/legal/requests` describe data handling. The storage page offers browser-data export and clearing. Profile offers verified account export and, when the server credential is configured, password-confirmed account deletion. Deleting an account does not automatically clear browser records.

## Checks and builds

```sh
npm run lint
npm run typecheck
npm run test:run
npm run build
```

`npm test` runs Vitest in watch mode. Unit and component tests use fixtures and mocks; they do not send email or refresh official snapshots. Optional browser regression runners and their setup instructions live under `tests/auth/browser`, `tests/calendar/browser`, and `tests/i18n/browser`; they require external browser tooling.

`npm run build` compiles with webpack. `npm start` serves that build. Geist fonts and their OFL license are bundled in `src/app/fonts`, so builds do not download fonts. Server-rendered metadata is Turkish; client metadata follows the saved language preference.

Deployment must use:

```sh
npm run build:production
```

This runs `npm run legal:check` before compilation. Operator facts and required reviews in `src/lib/legal/operator.json` are currently unresolved, so the production gate fails until they are completed. Ordinary compilation does not establish launch readiness. See [operations and launch requirements](docs/legal/OPERATIONS.md), [legal requirements and sources](docs/legal/REQUIREMENTS.md), and [dependency licenses](docs/legal/DEPENDENCY-LICENSES.json).

Email delivery, provider session behavior, and live account deletion require a configured disposable Supabase account and cannot be established by fixture tests.

## Official academic data

Bundled snapshots under `src/data/itu` provide curriculum catalog data, official academic translations, course-equivalence rules and import targets, and program-restriction identities/observations. Curriculum details, elective pools, prerequisites, and published course sections are also requested from OBS through server services. The app requires network access for live academic data; bundled selector data does not provide a complete offline workflow.

| Command | Purpose |
| --- | --- |
| `npm run curricula:import` | Refresh the official faculty, program, and curriculum snapshot |
| `npm run curricula:prerequisites` | Refresh prerequisite data in the curriculum snapshot |
| `npm run equivalences:import` | Refresh official equivalences for configured program/plan targets |
| `npm run equivalences:report` | Inspect stored equivalences without network requests |
| `npm run course-information:audit` | Check every current undergraduate course for an ITU information page |
| `npm run restrictions:import` | Refresh program identities and observed section restrictions |
| `node scripts/import-academic-translations.mjs` | Refresh official Turkish/English academic labels |

The weekly planner links verified course codes to ITU course information in a new tab. Lookups are cached in memory for 24 hours. The audit command checks the current schedule and writes its report under `/tmp/simplify-course-information-audit/`, outside the app bundle. ITU errors remain unverified rather than being classified as missing.

Equivalence commands accept filters such as `--plan=1561`. The default refresh selection in `src/data/itu/equivalence-targets.json` currently contains six Computer Engineering plans; it is not a university-wide coverage manifest. Supply another verified target set without editing that file:

```sh
npm run equivalences:import -- --targets=/absolute/path.json
npm run equivalences:import -- --targets=/absolute/path.json --plan=1561
```

The external JSON uses the same array schema as the bundled targets: `programId`, `programCode`, `planTypeId`, `planType`, and `planId`. Copy these identities from official OBS evidence; do not guess program IDs or invent equivalences. Existing rules outside the selected refresh targets are preserved.

The stored rules and import failures do not record a completed inventory of every official equivalence scope. An empty result therefore means evidence is unavailable, not that the curriculum has no equivalents. Existing verified rows remain usable, but exhaustive coverage is unproven and the curriculum, graduation calculator, and semester planner show an incomplete-coverage warning. Refresh selection files are not evidence of completed coverage. The app separately recognizes language counterparts such as `BBF 101` / `BBF 101E` and `FIZ 101L` / `FIZ 101EL`.

Official academic labels use the selected language when an official translation is available. Course codes and source course titles remain unchanged by the interface language. Generic elective labels have interface translations; unavailable official names retain their source wording.

Program registration restrictions are evaluated per section using exact official identity tokens. Unknown identities or stale/unavailable sources remain uncertain rather than being treated as unrestricted. See [program-restriction sources and refresh](docs/program-restrictions.md) for importer options and mapping rules.

## Repository layout

```text
src/app/             App Router pages, auth/profile/privacy actions, and ITU APIs
src/components/      Academic tools, calendars, account forms, and shared UI
src/hooks/           Auth-form and live course-catalog hooks
src/lib/             Academic calculations, scheduling, parsing, auth, storage, i18n
src/data/itu/        Official academic snapshots and equivalence import targets
src/proxy.ts         Session refresh and protected-route handling
scripts/             Snapshot importers and deployment readiness check
tests/               Unit/component tests, source fixtures, optional browser runners
docs/                Operational, legal, licensing, and data-source documentation
.codex/agents/       Optional repository audit/review agent configurations
```

The `@/` alias resolves to `src/`. Application pages use a protected route-group layout; authentication and legal pages are public. Domain calculations live in `src/lib`, with rendering and browser interaction in components.

Keep generated screenshots, test reports, audit logs, importer caches, and temporary captures out of version control. Historical feature-verification reports are not maintained as repository documentation. Official academic snapshots and test fixtures remain versioned; course data may contain source dates. Preserve existing browser storage keys and migrations when changing persistence.
