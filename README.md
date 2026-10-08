# Simplify

Academic planning for İTÜ students, built with Next.js, React, TypeScript, Tailwind CSS, and Supabase Auth. Turkish is the default language; English and light/dark themes are available throughout the interface.

## Development

```bash
npm ci
cp .env.example .env.local
# Configure Supabase as described below.
npm run dev
```

Open http://localhost:3000. Run the checks before merging changes:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

`npm test` runs Vitest in watch mode. `npm start` serves a production build. Tests use local fixtures and do not send email or refresh official data.

## Tools and data

| Route                    | Purpose                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| `/`                      | Profile programs, planning steps, and links to all tools                     |
| `/semester-planner`      | Recommend courses across the profile’s active programs                      |
| `/generator`             | Generate and compare schedules using course, day, time, and CRN preferences |
| `/weekly-planner`        | Manage named schedules, reorder courses, view overlaps, and export JPEGs    |
| `/curriculum`            | Explore prerequisites and program progress                                  |
| `/graduation-calculator` | Import transcripts and audit graduation requirements and GPA                |
| `/profile`               | Manage personal details, main major, double majors, minors, and password    |

The semester planner accepts a local-credit target, maximum course count (0 means unlimited), program priority, and the currently published semester. Recommendations retain prerequisite, availability, and registration warnings, with detailed reasoning available on demand. A confirmed schedule can be sent to the generator while preserving its day/time preferences, then saved and opened in the weekly planner. The planner considers recognized Turkish/English offering sections together while retaining the selected CRN and section identity. Candidate and section search have finite work limits; when reached, the interface explicitly reports that comparison is incomplete and shows only proven conflict-free selections.

Transcript imports accumulate across semesters. Reimporting a course retains the most recent attempt; older input cannot overwrite a newer result. Each main-major, double-major, and minor enrollment is audited independently against its exact curriculum. Program GPA uses transcript credit weights for matched, numerically graded courses, counting each course once. Courses without numeric grades do not contribute to GPA. A course is allocated once per program audit; manual completions follow direct-course priority before elective slots. Shared transcript grades and credits remain authoritative for prerequisite eligibility, including courses outside the active degree requirements. Resetting the shared transcript clears transcript-derived progress in all saved plans, including inactive enrollments, while preserving manual completions. An intentionally empty transcript does not reimport legacy plan records.

Profile details and enrollments are stored in Supabase user metadata. Weekly schedules, generator preferences, transcripts, curriculum progress, language, and theme are stored in this browser’s `localStorage`. They are shared by accounts using the same browser, are not synchronized across devices, and remain after logout. Cleanup must preserve existing storage keys and migrations. Official academic names use the requested language when supplied by OBS, with the source name as fallback.

Public İTÜ data is advisory. Unknown availability, registration limits, and unstructured corequisite rules must stay visible; students should verify registration decisions in OBS.

## Structure

The repository uses the App Router with authenticated and public authentication route groups. The `@/` import alias resolves to `src/`. Domain calculations live in `src/lib/`; React components handle rendering, interaction, and browser persistence.

```text
simplify/
├── src/
│   ├── app/
│   │   ├── (app)/             # protected layout, home, and tool pages
│   │   │   ├── curriculum/
│   │   │   ├── generator/
│   │   │   ├── graduation-calculator/
│   │   │   ├── profile/       # profile page and server actions
│   │   │   ├── semester-planner/
│   │   │   └── weekly-planner/
│   │   ├── (auth)/            # login, signup, verify-email, forgot/reset-password
│   │   ├── api/itu/           # branches, courses, curriculum catalog/detail APIs
│   │   ├── auth/              # shared auth actions and callback route
│   │   ├── layout.tsx         # Geist fonts, language/theme initialization
│   │   ├── globals.css        # Tailwind, theme fallbacks, focus/motion styles
│   │   ├── error.tsx
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── auth/              # account forms and shared input controls
│   │   ├── calendar/          # weekly calendar, course rows, schedule generator
│   │   ├── curriculum/        # curriculum graph, audit, and program tabs
│   │   ├── profile/           # profile form and enrollment context
│   │   ├── semester-planner/  # recommendation interface
│   │   ├── AppNavigation.tsx  # tool navigation and account preview
│   │   ├── PageShell.tsx      # shared page layout and skip-link target
│   │   ├── OptionalHelp.tsx   # expandable secondary guidance
│   │   ├── LocalizedText.tsx
│   │   ├── LanguageToggle.tsx
│   │   └── ThemeToggle.tsx
│   ├── hooks/                # useItuCourseCatalog: live offering loading
│   ├── lib/
│   │   ├── auth/              # validation, redirects, cookies, verified users
│   │   ├── supabase/          # server client and Proxy session refresh
│   │   ├── calendar/          # layout, catalog lookup, persistence, JPEG export
│   │   ├── curriculum/        # transcript, equivalencies, eligibility, GPA/audits
│   │   ├── http/              # shared JSON response handling
│   │   ├── i18n/              # TR/EN dictionaries and runtime messages
│   │   ├── itu/               # OBS clients, parsers, schemas, and adapters
│   │   │   ├── curriculum/    # catalog, detail, elective, prerequisite services
│   │   │   └── equivalence/   # importer parsing and state management
│   │   ├── profile/           # enrollment and profile validation
│   │   ├── schedule/          # constraints, conflicts, scoring, generator session
│   │   ├── semester-planner/  # bounded recommendation search
│   │   └── navigation.ts      # shared tool links
│   ├── data/itu/
│   │   ├── curriculum-catalog.json
│   │   ├── equivalence-targets.json
│   │   └── equivalences.json
│   ├── types/calendar.ts      # shared calendar types
│   └── proxy.ts               # Next.js request Proxy entry point
├── scripts/                   # controlled OBS snapshot importers
├── tests/
│   ├── auth/, profile/, i18n/, http/
│   ├── calendar/, schedule/, semester-planner/
│   ├── curriculum/, itu/
│   └── fixtures/              # OBS HTML and sample transcript records
├── .codex/agents/             # architecture, academic, design, reviewer TOML
├── docs/quality/             # functional and translation audit
├── AGENTS.md                  # Next.js-generated agent guidance
├── CLAUDE.md                  # reference to AGENTS.md
├── .env.example               # public Supabase/site configuration placeholders
├── package.json
├── package-lock.json          # pinned npm dependency tree
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
└── vitest.config.ts
```

The project agent definitions are read-only audit/review roles. Their TOML syntax has been validated; discovery and loading depend on the Codex client. They are not application runtime dependencies.

Keep the committed official snapshots separate from importer caches and live-page captures. `.gitignore` excludes `.env.local`, `node_modules/`, `.next/`, coverage, TypeScript build metadata, and temporary importer files. Refresh snapshots through the import commands below.

### Data flow and ownership

- The protected layout validates the Supabase user and provides profile enrollments through `ProfileProvider`. Profile actions update user metadata.
- ITU API routes serve catalog selectors and live OBS course/plan data. Server clients, parsing, and validation stay under `src/lib/itu/`; the UI uses the calendar adapter and catalog hook.
- Curriculum and graduation views share a cumulative transcript, while each plan keeps its own manual progress and requirement allocation. The semester planner uses that evidence to evaluate eligibility across active programs.
- Semester recommendations hand actual course/section identities to the schedule generator. Generated schedules can be saved into named weekly plans.
- Browser storage retains schedules, transcript/progress, generator state, language, and theme. It is shared by accounts using the same browser profile; account-scoped storage and cloud synchronization are not implemented.

## Authentication

Simplify uses Supabase Auth for email/password accounts, provider-managed password hashing, email confirmation, password recovery, refresh-token rotation, and cookie-backed sessions. The Next.js request Proxy checks session claims for application pages and ITU API routes; the protected server layout additionally validates the current user's email confirmation before rendering. ITU API routes do not independently recheck email confirmation, so **Confirm email** must remain enabled in Supabase. Personal details and academic-program enrollments from the Profile page are stored in the authenticated user's Supabase metadata. Planner, curriculum progress, the shared transcript, and theme data remain in `localStorage` and are not deleted or uploaded by authentication.

### 1. Create and configure Supabase

Create a Supabase project, then open **Authentication → Providers → Email** and:

- enable email/password sign-in;
- enable **Confirm email** (required — an unverified user must not access Simplify);
- configure a production SMTP provider before launch. Supabase's default sender is rate-limited and intended only for initial testing.

No service-role key or application database table is required for this feature.

### 2. Configure environment variables

Copy the placeholder file and add the public values shown by **Supabase Dashboard → Connect**:

```bash
cp .env.example .env.local
```

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`NEXT_PUBLIC_SITE_URL` must be the deployment's public origin without a trailing slash. Local development defaults safely to `http://localhost:3000` when the variable is omitted; production must provide it (or Vercel's `VERCEL_PROJECT_PRODUCTION_URL`). These are public project identifiers, not service-role credentials. Never add a service-role key with a `NEXT_PUBLIC_` prefix.

### 3. Configure authentication URLs

In **Authentication → URL Configuration**, set:

- **Site URL** to the deployed Simplify origin (use `http://localhost:3000` locally);
- **Redirect URLs** to `http://localhost:3000/auth/callback` and `https://your-domain.example/auth/callback` for the environments you use.

Signup confirmations return through `/auth/callback` and then show `/verify-email`. Password recovery uses the same callback to establish a short-lived, single-purpose recovery session before `/reset-password`. The application constructs these URLs from `NEXT_PUBLIC_SITE_URL`; no production domain is hard-coded.

If you customize Supabase email templates, preserve the provider's confirmation/recovery link or use the documented `TokenHash` server callback format. Do not place access tokens directly in custom application URLs.

### Session behavior

With **Remember me** selected, Supabase refresh-token cookies retain the provider's persistent lifetime. Without it, Simplify removes persistent expiry attributes so the browser receives session-only auth cookies. Some browsers' “restore previous session” feature may restore session cookies; this is the closest secure cross-browser behavior Supabase's cookie-based SSR model supports. Passwords, emails, and session tokens are never copied into `localStorage`.

### Manual authentication smoke test

Use a test inbox or local Supabase/Mailpit environment; automated tests never send email.

1. Sign up at `/signup` and confirm that invalid email, short password, and mismatched passwords are rejected.
2. Confirm the verification screen appears and protected URLs redirect to `/login` before verification.
3. Follow the email link, log in, refresh, and open `/`, `/generator`, `/curriculum`, `/graduation-calculator`, and `/semester-planner`.
4. Log out and verify a manually entered protected URL redirects to `/login` with its intended path preserved.
5. Request a reset from `/forgot-password`, follow the link, set a new password, and confirm the old password no longer works.
6. Exercise expired/used verification and recovery links and the verification resend cooldown.

Provider-dependent email delivery, verification, and old-password invalidation require a configured Supabase project and cannot be completed with placeholder environment values.

## Official course-equivalence data

Course-equivalence rules are imported at build/development time from İTÜ OBS and stored in `src/data/itu/equivalences.json`; the browser never scrapes OBS for equivalences. Import targets are explicit so program and plan scope cannot be lost:

```bash
npm run equivalences:import
npm run equivalences:import -- --plan=1561
```

The importer rate-limits and caches requests, retries temporary failures, updates rules by deterministic ID, marks missing verified rows stale, and preserves prior verified rows whenever an OBS response fails validation. Inspect the stored data without making network requests:

```bash
npm run equivalences:report
npm run equivalences:report -- --plan=1561 --target="BLG 113"
npm run equivalences:report -- --equivalent="BLG 111" --unverified
```

Add another officially mapped program/plan to `src/data/itu/equivalence-targets.json` before importing it. Never add inferred equivalences by hand.

At resolution time, Turkish and English offerings of the same course are treated as language counterparts (`BBF 101` ↔ `BBF 101E`; laboratory forms `FIZ 101L` ↔ `FIZ 101EL`). This application policy also expands the target and alternatives of an official plan rule, but is stored as a distinct `language-equivalence` satisfaction type so it is not presented as a separate OBS record.

## Curriculum catalog refresh

Profile and academic program selectors use the server-side snapshot at `src/data/itu/curriculum-catalog.json`. Curriculum detail, elective pools and prerequisites are fetched from OBS when an academic tool loads a plan; the selector snapshot does not provide offline degree audits. Refresh it from the official İTÜ OBS faculty and plan selectors with:

```bash
npm run curricula:import
```

The importer discovers faculties and undergraduate, ÇAP, and Yandal programs; follows every plan version; imports associations, notes, courses, elective pools, and prerequisites; and replaces the snapshot atomically only after a non-empty run. A focused prerequisite repair is also available:

```bash
npm run curricula:prerequisites
```

## Privacy and deployment readiness

Public bilingual legal pages live at `/legal/privacy`, `/legal/storage`, `/legal/terms`, and `/legal/requests`. Collection-point notices explain server-saved profiles and browser-only academic data. Profile includes verified account export/deletion; the public storage policy also offers local download/clear. Local records remain shared by accounts in the same browser and survive logout; users are warned explicitly.

Legal owner facts are centralized in `src/lib/legal/operator.json`. They are intentionally unresolved: notices remain pre-launch drafts. Account deletion additionally requires a **server-only** `SUPABASE_SECRET_KEY`; no admin credential is sent to clients. The request page opens a configured mail app and has no fake delivery form; contact/delivery must be confirmed before launch.

Run `npm run legal:check` to see missing mandatory facts/reviews. Use **`npm run build:production` as the deployment build command**; ordinary `npm run build` only verifies compilation and does not authorize launch. Read [audit](docs/legal/AUDIT.md), [requirements and official sources](docs/legal/REQUIREMENTS.md), [operations and launch blockers](docs/legal/OPERATIONS.md), and [verification](docs/legal/VERIFICATION.md). No overseas-transfer arrangement, retention period, controller identity or university affiliation has been invented.

The production compiler is explicitly webpack (`npm run build`). Geist fonts are bundled locally with their OFL license to avoid network-dependent font builds. Metadata is Turkish on the server and follows the browser language preference after hydration; search crawlers without JavaScript receive Turkish metadata. Generated audit screenshots/logs are kept outside the repository; browser regression runners write their evidence to temporary directories.
