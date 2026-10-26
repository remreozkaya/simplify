# Account academic storage Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore students' academic work from their own Supabase account.
**Architecture:** Validated, revisioned documents protected by RLS and atomic compare-and-swap. A shared synchronous client adapter keeps tools responsive while a provider handles cloud hydration, pending recovery and conflicts.
**Tech Stack:** Existing Next.js 16, Supabase Auth/Postgres, React, Zod, Vitest.
**Spec:** docs/superpowers/specs/2026-10-26-account-academic-storage-design.md

## Global Constraints
- Preserve official ITU snapshots and unrelated working-tree edits.
- Latest user instruction supersedes legacy import: discard old unowned personal browser records; no import UI.
- Degree enrollments remain Auth metadata; no hosting migration.
- Every request asserts expected identity against verified auth; RLS enforces ownership.
- Maximum JSON document 1 MiB; no silent truncation or unconditional conflict overwrite.

## Review Focus
- Cookie identity changes during queued saves: reject expected-user mismatches.
- Stale first writes and resets: atomic revisions and durable tombstones.
- Remote hydration: mount tools only after loaded; remount on accepted remote changes.
- Pending recovery: preserve local edits and refuse stale revision overwrites.
- Complete export/deletion: cloud read failure fails export, FK cascades on deletion.

### Task 1: Schema and server boundary
Files: supabase/migrations/*, src/lib/academic/records.ts, src/app/api/academic-records/route.ts, tests/academic/records.test.ts, tests/academic/route.test.ts.
Interfaces: validateRecord(key,value), AcademicRecord { record_key,payload,revision }; GET/PUT expected-user assertions.
- [x] Write failing validation and authorization/conflict tests; run to establish red.
- [x] Export reusable existing record schemas, implement bounded authenticated route and invoker CAS SQL.
- [x] Run focused tests; exercise SQL with isolated Postgres if available.

### Task 2: Client storage and recovery
Files: src/lib/academic/storage.ts, src/lib/academic/sync.ts, src/components/academic/AcademicProvider.tsx, tests/academic/sync.test.ts.
Interfaces: academicStorage getItem/setItem/removeItem, AcademicSync initialize/flush/refresh/resolve/dispose and status subscriptions.
- [x] Write failing isolation, race, cache recovery, conflict, tombstone tests; run red.
- [x] Implement account namespaces, bounded writes, hydration and bilingual status/recovery controls.
- [x] Run focused tests.

### Task 3: Integrate tools and privacy lifecycle
Files: protected layout, academic consumers, calendar selection, privacy actions/controls/copy, README and docs.
- [x] Add failing consumer/selected-plan/export checks.
- [x] Replace academic localStorage usage with explicit shared adapter; persist selected weekly plan.
- [x] Update export/deletion and accurate cloud-storage disclosures; discard legacy personal keys only, retain theme/language and ITU data.
- [x] Run full tests, lint, typecheck, build; fresh independent review and resolve findings.

## Execution ledger
Ruling: execute in existing checkout on a feature branch, preserving unrelated uncommitted academic fixes needed by current tree; no reset or automated commits.
Ruling: native execution follows user's explicit instruction to implement the approved design, with a final independent review.

Task 1: complete — migration executed in embedded PostgreSQL; RLS/CAS/reset/cascade checks pass.
Task 2: complete — per-writer recovery, JSONB structural comparison, identity latch, conflict and interrupted recovery regressions pass.
Task 3: complete — all academic consumers use account storage; selected-plan persistence, privacy export/deletion, bilingual notices and setup documentation updated.
Verification: 99 test files / 672 tests passed; lint and production build exit 0. Standalone typecheck passed, and the final production build's TypeScript stage passed. Isolated headless Chrome checks passed for restore, conflict, recovery and account switching.
Deployment update: user requested live execution. Applied SQL transaction through the authenticated Supabase dashboard to the matching Simplify project `kbydlevgbozichdqkeml`; live checks passed for table installation, RLS, owner policies, invoker function, anonymous-access denial, authenticated save, physical-delete denial, and FK cascade. The new table contained zero documents. No existing data was deleted. Direct database credentials remain unconfigured; execution used the dashboard.
Final review findings were reproduced with failing tests and fixed. Unrelated working-tree changes and official ITU datasets were preserved. Branch is retained locally with uncommitted changes for user review; no push or merge.
