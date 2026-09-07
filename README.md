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
| `/`                      | Links to the planning tools                                                 |
| `/semester-planner`      | Recommend courses across the profile’s active programs                      |
| `/generator`             | Generate and compare schedules using course, day, time, and CRN preferences |
| `/weekly-planner`        | Manage named schedules, reorder courses, view overlaps, and export JPEGs    |
| `/curriculum`            | Explore prerequisites and program progress                                  |
| `/graduation-calculator` | Import transcripts and audit graduation requirements and GPA                |
| `/profile`               | Manage personal details, main major, double majors, minors, and password    |

The semester planner accepts a local-credit target, maximum course count (0 means unlimited), program priority, and the currently published semester. Recommendations retain prerequisite, availability, and registration warnings, with detailed reasoning available on demand. A confirmed schedule can be sent to the generator while preserving its day/time preferences, then saved and opened in the weekly planner.

Transcript imports accumulate across semesters. Reimporting a course retains the most recent attempt; older input cannot overwrite a newer result. Each main-major, double-major, and minor enrollment is audited independently against its exact curriculum. Program GPA uses transcript credit weights for matched, numerically graded courses, counting each course once. Courses without numeric grades do not contribute to GPA.

Profile details and enrollments are stored in Supabase user metadata. Weekly schedules, generator preferences, transcripts, curriculum progress, language, and theme are stored in this browser’s `localStorage`. They are not synchronized across devices and remain after logout. Cleanup must preserve existing storage keys and migrations. Official academic names use the requested language when supplied by OBS, with the source name as fallback.

Public İTÜ data is advisory. Unknown availability, registration limits, and unstructured corequisite rules must stay visible; students should verify registration decisions in OBS.

## Structure

```text
src/
  app/
    (app)/                 # authenticated tool pages and profile actions
    (auth)/                # login, signup, verification, and recovery pages
    api/itu/               # authenticated OBS data endpoints
    auth/                  # authentication actions and callback
  components/
    auth/                  # account forms and shared input controls
    calendar/              # weekly calendar, course rows, schedule generator
    curriculum/            # curriculum graph, audit, and program tabs
    profile/               # profile form and enrollment context
    semester-planner/      # recommendation interface
    PageShell.tsx          # shared tool-page layout
    AppNavigation.tsx      # navigation and account controls
    OptionalHelp.tsx       # expandable secondary guidance
  hooks/                   # live course catalog loading
  lib/
    auth/, supabase/        # validation, session cookies, provider clients
    calendar/              # layout, catalog lookup, persistence, JPEG export
    curriculum/            # transcript, equivalency, eligibility, audit logic
    http/                  # shared JSON response handling
    i18n/                  # Turkish/English dictionaries and runtime messages
    itu/                   # clients, parsers, schemas, catalog services
    profile/               # enrollment and profile validation
    schedule/              # constraints, conflicts, scoring, generator handoff
    semester-planner/      # recommendation engine
    navigation.ts          # shared tool links
  data/itu/                # imported official curriculum/equivalence snapshots
  types/calendar.ts        # shared calendar types
scripts/                   # controlled official-data importers
tests/                     # unit/regression tests and source fixtures
```

Keep generated snapshots, importer caches, dependencies, and build output separate from manual source cleanup. Refresh official snapshots through the import commands below.

## Authentication

Simplify uses Supabase Auth for email/password accounts, provider-managed password hashing, email confirmation, password recovery, refresh-token rotation, and secure cookie-backed sessions. Application pages and ITU API routes are protected by the Next.js request Proxy; the protected server layout also validates the current verified user before rendering. Personal details and academic-program enrollments from the Profile page are stored in the authenticated user's Supabase metadata. Planner, curriculum progress, the shared transcript, and theme data remain in `localStorage` and are not deleted or uploaded by authentication.

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

### Official course-equivalence data

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

The Profile, Curriculum, and Graduation Calculator use the server-side snapshot at `src/data/itu/curriculum-catalog.json`. Refresh it from the official İTÜ OBS faculty and plan selectors with:

```bash
npm run curricula:import
```

The importer discovers faculties and undergraduate, ÇAP, and Yandal programs; follows every plan version; imports associations, notes, courses, elective pools, and prerequisites; and replaces the snapshot atomically only after a non-empty run. A focused prerequisite repair is also available:

```bash
npm run curricula:prerequisites
```
