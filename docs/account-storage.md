# Account academic storage

## Install before deploying

1. Open the intended Supabase project's SQL Editor.
2. Run `supabase/migrations/202610260001_academic_records.sql` once, or apply it through your normal Supabase migration workflow.
3. Confirm email confirmation is enabled. Keep the existing public Supabase URL/key configuration. Normal academic reads/writes need no administrative secret.
4. Deploy the app only after the migration succeeds. If the table/function is unavailable, the app displays an account-storage error with retry and does not autosave empty data over missing cloud state.
5. Use two disposable verified test accounts to check account isolation, and two browser contexts to check save/restore and conflict handling against the deployed project.

The SQL Editor runs the migration with database-owner privileges. Never paste credentials into source control or expose the service-role/secret key to the browser. The migration was applied manually through the Supabase SQL Editor on 26 October 2026 to project `kbydlevgbozichdqkeml` (the project configured by this app). Live verification confirmed the table, row-level security, three owner policies, invoker save function, restricted privileges, and account-deletion cascade. The new table contained zero documents after installation. If you later introduce CLI migration-history tracking, reconcile this manually applied version before attempting to replay it.

## What is saved

`public.academic_records` stores one revisioned JSONB document per `(user_id, record_key)`:

- Named weekly programs, selected courses/sections and the selected weekly program ID.
- Generator selections, constraints and planning milestones.
- Parsed transcript courses, grades and attempt history.
- Current-semester selections and grade estimates.
- Curriculum completion progress and the saved curriculum selection.

Main-major/double-major/minor enrollments and personal profile fields remain in Supabase Auth metadata. Language/theme remain device preferences. Raw pasted transcript text is parsed locally and is not uploaded; the extracted academic records are uploaded. Generated alternatives are transient until saved as weekly plans.

Official ITU source snapshots, importers and course-catalog fetching remain independent of personal records. The migration does not alter them.

## Clean start for old personal browser data

As explicitly requested, the previous unowned personal planning keys are removed when the protected workspace initializes. They are not imported into any account. Official source data, auth cookies, unrelated browser keys, language and theme are not part of this removal. Existing Auth accounts and profile metadata are not deleted.

## Saving, conflicts and recovery

The workspace loads cloud records before mounting planner components. Each write asserts the account expected by that page, and the server checks it against a freshly verified session. Supabase RLS also restricts database rows to their owner. A changed login session locks the workspace until reload/sign-in.

Writes are coalesced per document and compare the expected database revision atomically. A stale save reports a conflict rather than replacing newer records. The UI offers an export and an explicit choice between the cloud document and the pending document. This is document-level conflict resolution: two devices editing different weekly plans in the same weekly-plans document can still conflict.

Unsaved edits use a separate recovery slot for each account and page session under `simplify-academic-pending-v1:<user-id>:<writer-id>`. Each writer clears only its own slot after successful saves. On reopening, the same account can explicitly recover/export another session's pending data; conflicting cloud revisions require resolution. Recovering a slot copies it and does not erase its original. After the recovered edits are saved or deliberately discarded, a SHA-256 completion digest under `simplify-academic-recovered-v1:<user-id>:<writer-id>` acknowledges that exact source snapshot, so it is not offered again after later cloud changes. A source writer’s newer edits remain independently recoverable. Slots whose payloads already match the cloud or have been acknowledged are not offered as unfinished work; device clearing removes retained recovery copies.

Device storage is not encrypted and is accessible to someone with access to browser storage. Other signed-in accounts do not use or export another account's recovery namespace. If storage is blocked/full, the UI warns that recovery is unavailable; keep the page open until cloud saving succeeds. Navigation within the app retains the provider. Closing/reloading with pending edits prompts the browser's unload warning when supported. Logout does not guarantee saving pending changes; they remain recoverable for the original account if device storage is available.

A document is limited to 1 MiB of compact JSON. Invalid/oversized documents fail explicitly rather than being truncated. A save failure preserves current edits. Cloud state refreshes on focus, cross-tab storage events and once per minute while visible; this is not realtime collaborative editing.

## Export, clearing and deletion

Account export includes the profile and all saved academic documents with revisions. Cloud read failure fails the export instead of producing an apparently complete partial download. Pending device edits have their own export.

The Profile device export includes that account's recovery slots; the public storage-page export covers device preferences and any remaining legacy keys. Device clearing explicitly covers all Simplify recovery slots on that browser and warns about unsaved edits. It does not delete saved cloud data.

Password-confirmed hard account deletion cascades to the account's academic rows. After success, the app clears that account's recovery slots on the current device. Other accounts' recovery slots are preserved. Other devices and provider backups require their own cleanup/retention procedures. No extra uploads/storage buckets are introduced.

## Verification and rollback

`npm run test:run` includes embedded PostgreSQL tests using development-only PGlite. These execute the migration and verify RLS, revision checks, JSON-null resets and deletion cascades. Authentication claims/roles are modeled locally; still perform the disposable-account check against the actual configured Supabase project before launch.

Run `npm run lint`, `npm run typecheck`, `npm run test:run`, and `npm run build`. Production deployment must use `npm run build:production` after completing the existing legal/operator setup. Parsed grades/history now reach Supabase; reassess disclosures, region, contracts, retention and exports before public launch.

For rollback, keep the table and recoverable cloud documents. Do not drop the table or restore shared legacy personal data. Reverting to browser-only app code stops cloud synchronization and must be disclosed if used as an emergency rollback. Keep database backups and rehearse restoration separately.
