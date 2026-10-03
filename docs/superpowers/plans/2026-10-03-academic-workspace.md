# Academic Workspace Implementation Plan

> Execute bounded independent modules with runtime subagents; integrate shared styling centrally and request an independent final review.

**Goal:** Improve the existing student workspace and correct verified audit/planning defects without changing academic policy, authentication or storage keys.
**Architecture:** Keep App Router, Supabase metadata and browser persistence. Requirement allocation remains program-specific; shared transcript records supply eligibility separately. Keep edits in the assigned local tree, with no commits, pushes or deployments.
**Tech Stack:** Next 16.3.3, React 19.2.4, TypeScript 5.9.3, Tailwind 4.3, Vitest 4.1.9.
**Design brief:** User attachment and the three read-only audits completed before edits. Shared surfaces retain Geist, slate/blue palette and restrained motion. Home exposes actual profile programs and a clear setup → transcript → semester → generator → weekly sequence, with no invented progress.

## Baseline
Clean main / origin https://github.com/remreozkaya/simplify.git. 44 files / 225 tests pass; lint and typecheck pass. Default build blocked by Turbopack port sandbox restriction; webpack fallback blocked on Google Fonts DNS. Preview server starts with sandbox exception; unauthenticated browser reaches login. Authenticated visual verification depends on user sign-in and must not be bypassed.

## Tasks
- [x] Academic agent: graduation.ts and planner.ts + their tests. Reproduce elective overcount with one passed choice shared between slots; resolve allocation once per audit, including manual progress, preserving failed attempts and cross-program independence. Consider sections across language offerings. Test totals, remaining planner slots and actual handoff identity.
- [x] Architecture agent: progress.ts, transcriptStore.ts, SmartSemesterPlanner.tsx, GraduationCalculator.tsx, CurriculumExplorer.tsx and targeted tests. Explicit reset clears imported rows/completions across all stored plans but preserves manual progress. Empty valid shared stores do not migrate old imports. Pass all shared transcript records/credits to planner prerequisite evaluation without granting degree completion.
- [x] Lead: globals.css, PageShell, AppNavigation, home, theme controls, dictionaries and small graph accessibility changes. Scope legacy theme fallbacks to elements without an explicit dark utility for the same property so component states win. Add profile setup/program overview and actionable workflow links. Mobile navigation must remain visible and wrap; provide a deliberate profile preview button, Escape/outside dismissal and direct profile link. Improve readable graph badges and selected-detail relation/keyboard access. Tables get a named focusable scroll region. All new labels exist in TR/EN.
- [x] Lead: create narrow read-only project agent TOML files per official documented schema; validate syntax without claiming runtime loading.
- [x] Independent reviewer: final diff, academic allocation, reset/migration, handoff, accessibility and verification limits. Resolve actionable findings; run full suite, lint, typecheck and production build, responsive browser checks and console inspection.

## Review focus / acceptance
1. One course cannot earn two slots in the same audit; separate programs remain independent.
2. Reset cannot resurrect inactive-plan legacy transcript; manual completions survive.
3. External prerequisite records preserve grades and credit metadata, without counting toward unmatched degree requirements.
4. TR/EN offering order cannot hide a conflict-free section; handoff carries selected identity.
5. Dark component backgrounds/hover states win; keyboard and translated mobile UI remain usable.

Deferred: per-account ownership migration, comprehensive storage-failure handling, partial enrollment loading/retry, provider-backed confirmed API enforcement, latent AND/OR equivalence ambiguity, full curriculum mobile table redesign. These are not silently claimed fixed.

## Integration evidence and decisions
- Three runtime audit agents; architecture and academic agents implemented separately; design audit agent independently reviewed changes. Four read-only project TOML definitions syntax-validated, runtime loading not claimed.
- Reviewer edge defects reproduced and fixed: failed elective hiding passed manual alternative, manual TR/EN direct lookup, and canonical transcript evidence precedence.
- Signed-in browser discovered synchronous planner freeze after live offerings loaded. Added finite candidate/section budgets, cached preparation, truthful incomplete-search notice and memoized UI. A bounded search may omit a better or valid unexamined combination; it never declares an exhausted search impossible.
- Mobile live audit found program tabs expanded the document to 666px at 375px viewport. min-w-0 restores375px document width; ArrowLeft program selection verified.
- Next dev generated AGENTS.md/CLAUDE.md; retained as generated setup artifacts.
- Initial parallel typecheck/build raced on generated .next/types; final checks are sequential to avoid this artifact race.
- Final checks: 45 test files / 246 tests passed; lint, typecheck, default Turbopack production build (with sandbox exception) and git diff --check passed.
- Signed-in browser: 375px mobile, 768px tablet and 1440px desktop; TR/EN and light/dark inspected. Curriculum detail shortcut focuses its aside; program-tab arrow navigation and profile-preview dismissal verified. Live semester recommendation returned six conflict-free courses and an incomplete-search notice. Generator received all six pinned CRNs, including MAT 271 in Turkish, and produced one valid schedule. No console warnings/errors in final captured log. Generator output was not saved into the user's weekly plans.
- Profile program selectors loaded existing main/CAP choices; credentials and profile data were not changed. Provider email delivery/confirmation and password changes were not exercised. Transcript import/reset correctness is covered by regression tests; browser import validation was checked without importing personal records or resetting existing data.
- Desktop light and mobile dark screenshots saved in the task visualization directory; authenticated local preview retained.
