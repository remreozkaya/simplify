# Simplify

Simplify is a web application designed to make university life easier by bringing different student-planning tools into one place.

The project began as a weekly lecture planner for İTÜ students and has grown into a full academic-planning workspace. Students can audit multiple programs, accumulate transcript data semester by semester, compare program-specific progress and GPA, receive semester recommendations, generate conflict-aware schedules, and keep visual weekly plans in one application.

## Current Status

Implemented:

* Next.js project setup
* TypeScript support
* Tailwind CSS styling
* Weekly planner and schedule generator with device-local persistence
* ITU OBS course and curriculum integrations
* Curriculum prerequisite graph
* Cumulative transcript imports, course equivalencies, graduation audits, and program-specific GPA
* Correct undergraduate, ÇAP, and Yandal profile/curriculum support
* Smart Semester Planner with explainable, editable recommendations
* Verified email/password authentication and password recovery

## Smart Semester Planner

The Smart Semester Planner at `/semester-planner` turns the student's academic record into an editable course plan for the coming semester.

It uses:

* the exact undergraduate, ÇAP, and Yandal curriculum plans saved in the student's profile;
* completed courses, grades, transcript matches, verified equivalencies, and exemptions already recognized by each independent degree audit;
* remaining compulsory courses and elective categories across every active program;
* parsed prerequisite AND/OR expressions and minimum-grade requirements;
* current published İTÜ offerings when that target is selected.

Students can set a local-credit target, maximum course count, program priority, graduation date, and explicit include/exclude lists. Courses currently in progress can be entered separately: dependent recommendations are marked conditional and are never treated as already passed. Recommendations explain the requirement they serve, their program contribution, immediate prerequisite unlocks, and longer downstream chains.

The planner counts an identical shared compulsory course once in semester workload while showing its contribution to each applicable program. It does not infer equivalence from similar course names or assume that elective overlap can be shared without an explicit rule. Recommendations can be locked, removed, replaced, and sent directly to the Schedule Generator. Existing generator time/day preferences are preserved during handoff; academically suitable alternatives remain available if the selected courses cannot produce a conflict-free timetable.

Current data boundaries are shown in the interface instead of being silently guessed: future-semester availability remains unknown until offerings are published, official per-semester registration limits are not present in the source data, and İTÜ's public data does not expose corequisites as a separate structured rule. All recommendations remain provisional and should be verified in OBS before registration.

## Graduation Calculator and Curriculum Audit

The Graduation Calculator at `/graduation-calculator` imports İTÜ transcript text into one shared academic record. Imports are cumulative: students can paste only the courses from a newly completed semester without losing previously stored main-major, double-major, or minor progress. Reimporting the same course does not create a duplicate; the newest attempt is retained, and an older pasted attempt cannot overwrite a newer stored result.

Every active profile enrollment is evaluated independently against its exact curriculum type and version:

* the main program uses its selected undergraduate plan;
* a double major uses its associated ÇAP plan;
* a minor uses its associated Yandal plan;
* exact course matches, Turkish/English counterparts, verified directional equivalencies, and elective assignments follow the same deterministic resolution order in every audit.

The selected program summary displays completed requirements, counted local credits, English credits, and a program-specific GPA. Program GPA includes only graded courses matched to that curriculum, uses transcript credits as weights, and counts a course once if it appears through more than one matched requirement. Courses without a numeric grade do not affect the calculation; the interface displays `—` when no numeric program GPA is available.

The Curriculum page at `/curriculum` consumes the same accumulated transcript and stored progress, so switching between program views does not discard another program's data.

## Weekly Lecture Program

The Weekly Lecture Program creates and stores visual weekly schedules.

Implemented functionality:

* View a weekly calendar
* Add lectures to the calendar
* Select lecture code, such as BLG, EEF, EHB, MAT
* Select a course under the chosen lecture code
* Select a course session/CRN
* Display the selected session on the weekly calendar
* Detect overlapping lecture times
* Save selected lectures locally
* Fetch real course data from İTÜ OBS
* Maintain multiple named weekly programs
* Export a program as JPEG

## Future Features

The long-term goal is to turn Simplify into a broader university-life planning platform.

Possible future features:

* Course search and filtering
* Automatic data sync from ITU OBS
* Exam calendar
* Assignment and deadline tracker
* What-if GPA and target-grade simulator
* PDF and calendar (`.ics`) export
* Cloud-saved schedules and academic progress

## Tech Stack

Current stack:

* Next.js 16 App Router
* TypeScript
* Tailwind CSS
* React
* Supabase Auth

Planned future additions:

* Prisma
* PostgreSQL
* Scheduled course-data sync
* Deployment on Vercel or a similar platform

## Authentication

Simplify uses Supabase Auth for email/password accounts, provider-managed password hashing, email confirmation, password recovery, refresh-token rotation, and secure cookie-backed sessions. Application pages and ITU API routes are protected by the Next.js request Proxy; the protected server layout also validates the current verified user before rendering. Personal details and academic-program enrollments from the Profile page are stored in the authenticated user's Supabase metadata. Planner, curriculum progress, the shared transcript, and theme data remain in `localStorage` and are not deleted or uploaded by authentication.

### 1. Create and configure Supabase

Create a Supabase project, then open **Authentication → Providers → Email** and:

* enable email/password sign-in;
* enable **Confirm email** (required — an unverified user must not access Simplify);
* configure a production SMTP provider before launch. Supabase's default sender is rate-limited and intended only for initial testing.

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

* **Site URL** to the deployed Simplify origin (use `http://localhost:3000` locally);
* **Redirect URLs** to `http://localhost:3000/auth/callback` and `https://your-domain.example/auth/callback` for the environments you use.

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

## Project Structure

Current structure:

```txt
src/
  app/
    page.tsx

  components/
    calendar/              # weekly planner and schedule generator
    curriculum/            # curriculum graph and graduation audit
    semester-planner/      # smart semester-planning interface
    profile/               # academic profile and program enrollment UI

  lib/
    curriculum/            # progress, equivalency, eligibility, and audit logic
    semester-planner/      # recommendation and workload engine
    schedule/              # constraints, ranking, conflicts, and handoff session
    itu/                   # OBS clients, parsers, schemas, and stored catalogs

  types/
    course.ts
```

## Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open the app:

```txt
http://localhost:3000
```

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

## Git Workflow

`main` is the stable branch and currently contains the complete application described above. New work should be developed on a short-lived branch and merged only after tests, lint, and a production build pass.

```txt
main
```

Stable version of the project.

```txt
codex/feature-name
```

Example development branch.

Typical workflow:

```bash
git switch main
git pull
git switch -c codex/feature-name
```

After making changes:

```bash
git add .
git commit -m "Describe the change"
git push -u origin codex/feature-name
```

## Roadmap

### Phase 1 — Project Setup

* [x] Create GitHub repository
* [x] Create Next.js project
* [x] Configure TypeScript and Tailwind CSS
* [x] Create clean project folder structure
* [x] Update README

### Phase 2 — Weekly Calendar Layout

* [x] Build weekly calendar grid
* [x] Show Monday-Sunday columns
* [x] Show time range from 08:00 to 20:00
* [x] Align time labels with calendar lines
* [x] Make layout visually clean and responsive

### Phase 3 — Mock Course Data

* [x] Define course data types
* [x] Replace mock data with validated İTÜ data
* [x] Render selected CRNs and all of their meetings

### Phase 4 — Add Lecture Flow

* [x] Add lectures from the live course catalog
* [x] Select course prefix, course, and CRN
* [x] Add every meeting of the selected CRN to the calendar

### Phase 5 — Conflict Detection

* [x] Detect overlapping lectures
* [x] Warn the user about conflicts
* [x] Rank conflict-free generated schedules and expose the best fallback

### Phase 6 — Persistence

* [x] Save selected lectures in localStorage
* [x] Restore selected lectures after page refresh
* [ ] Later, save schedules in a database

### Phase 7 — ITU OBS Integration

* [x] Investigate ITU OBS course schedule requests
* [x] Parse real course schedule data
* [ ] Store course data in database
* [x] Add controlled curriculum/equivalence import commands
* [ ] Add scheduled, rate-limited data refresh

### Phase 8 — Academic Planning

* [x] Add authenticated academic profiles
* [x] Support exact undergraduate, ÇAP, and Yandal curricula
* [x] Import and reconcile transcript progress and verified equivalencies
* [x] Preserve accumulated transcript data across semester imports
* [x] Add independent multi-program graduation audits
* [x] Calculate GPA separately for each selected program
* [x] Recommend editable semester workloads across all active programs
* [x] Transfer semester recommendations into the schedule generator
* [ ] Persist academic planning data to the authenticated user's cloud account

### Phase 9 — Deployment

* [x] Validate the production build
* [ ] Deploy first public version
* [ ] Add environment variables if needed
* [ ] Document deployment process

## Notes

This project is intentionally being built incrementally. Public İTÜ data is treated as advisory: unknown restrictions and availability are surfaced to the student, and registration decisions must still be verified in OBS. Cloud synchronization and deployment remain future work.
