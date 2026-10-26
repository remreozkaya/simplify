# Account-owned academic storage

Status: approved by user on 26 October 2026; legacy personal data may be discarded.

User amendment: remove old unowned personal browser records instead of importing
them. Preserve all official ITU course data. No legacy import UI is required.

## Intent and scope

Students' saved academic work must belong to their verified Supabase account and
restore on another device. Keep the current Supabase authentication and degree
enrollments in Auth metadata. Do not change hosting or academic calculations.

Synchronize these independently versioned records:

- Named weekly programs, including course selections and stored section snapshots.
- Selected weekly program ID (currently only component state); a URL program
  parameter can override the restored selection without deleting saved programs.
- Generator course selections, preferences, and completed planning milestones.
- Parsed transcript attempts/history, including grades; never upload the original
  pasted transcript text solely to synchronize it.
- Curriculum completion records and saved curriculum selection.
- Current-semester course selections and estimated grades.

Theme and interface language remain browser preferences. Temporary generated
alternatives need not persist unless explicitly saved as weekly programs.

## Approaches

The user selected Supabase database storage associated with authenticated user IDs.
Auth metadata alone is unsuitable for growing academic records. Replacing Supabase
would add authentication migration and is outside this request.

Within Supabase, fully normalized course/grade tables offer finer querying but
would require a broad rewrite of the existing snapshot-based persistence model.
The proposed initial implementation uses one versioned document per academic
record type. This is an implementation recommendation, not a user-selected schema.
It preserves current formats, allows independent saves, and avoids new services.

## Database and authorization

Add a version-controlled SQL migration for `public.academic_records`, with a
composite primary key `(user_id, record_key)`, JSONB payload, integer revision,
schema version, and server-generated update time. Reference `auth.users(id)` with
`on delete cascade`. Restrict keys to the synchronized types above and enforce
payload limits. Use a documented initial ceiling of 1 MiB per document, including
an explicit error if a student's records exceed it; do not truncate records.

Enable RLS and grant only necessary authenticated operations. Every operation
must enforce `auth.uid() = user_id`; update policies must validate both old and
new ownership. Anonymous clients receive no access. Server entry points verify
the current confirmed user with `auth.getUser()` and derive ownership from that
session, never from a submitted user ID. Use the user's Supabase client for normal
reads and writes, not the administrative credential.

Every request also supplies the account ID expected by its mounted provider.
Compare it with the verified session and reject mismatches before reads/writes;
this is a precondition, never the source of authorization. Return the verified
account ID with responses. This prevents cross-tab cookie changes from assigning
an old account's queued data to the newly signed-in account.

Writes use an atomic expected-revision comparison, including first creation.
Any SQL function must use invoker privileges and an explicit search path.
Concurrent creation must be treated as a conflict, not an upsert overwrite.
Validate record schemas server-side and bound request sizes before writing.
Use a bounded Route Handler with sufficient envelope headroom for the document
limit rather than relying on the default Server Action request-size allowance.
Clearing a cloud category writes a versioned empty document/tombstone instead of
resetting revision history through physical row deletion. Keep the selected
weekly-program ID valid after deletion/import, using a deterministic fallback.

## Client persistence and synchronization

Introduce a shared academic persistence layer and update every academic consumer
to use it. Preserve existing serialization/parser migrations. Do not monkey-patch
Storage or mirror the active account back into the old shared keys.

Mount the account provider under the protected layout using its verified user ID
as an identity boundary. Load cloud records before mounting tools that initialize
and autosave defaults. During failure, display retry and recovery controls; never
replace unknown cloud state with an empty document. A missing migration gets an
actionable setup error rather than silently falling back to shared browser data.

Local recovery caches and pending edits use explicit user-ID namespaces. Never
read another account's namespace or the legacy shared keys as current account
state. Treat cached academic data as sensitive browser data: it is not protected
from someone with local browser/developer access. Logout clears rendered account
state and stops queued writes; explicitly clearing this device removes its caches.
Public legal/privacy controls must describe and handle these namespaces too.
Before clearing local recovery data, distinguish saved caches from unsynced work;
require explicit confirmation and offer export of unsynced edits. Clearing only
device data leaves cloud records intact and available for restoration.

Coalesce writes per changed document, allow at most one request in flight for
that document, and preserve later edits while earlier writes complete. Display
saving, saved, unsaved/error, and conflict states in Turkish and English. Keep
pending edits locally when requests fail, with explicit retry. Pending requests
must never be rebound to a newly signed-in user. Stale responses are ignored after
identity changes. Prevent unguarded navigation/logout while writes are pending,
or retain an account-scoped recoverable pending record and accurately disclose it.

Refresh on return to the app/window focus and coordinate same-account tabs. A
shared subscription contract notifies mounted tools when records are replaced;
tools must apply remote updates without autosaving their stale local state back.
A
conflict preserves the local document for export and offers either loading the
cloud version or deliberately replacing it against the newly fetched revision.
Never retry a conflict as an unconditional overwrite. Each document is the conflict
unit; concurrent edits to different weekly programs in the same document can
therefore require manual resolution. Realtime subscriptions are unnecessary.

## Existing browser data — approved amendment

The user explicitly permits removing existing personal data and will enter it again
after implementation. Discard the unowned legacy academic keys during protected
workspace initialization instead of importing them. Preserve official ITU source
data, theme/language, unrelated keys and authentication cookies. Do not remove
existing Auth accounts/profile metadata merely to initialize the new storage.
New account-owned pending edits are recovery records, not legacy data, and must
remain isolated and recoverable.

## Export, deletion, and privacy

Account export must include all persisted academic documents and their versions
alongside the existing profile allowlist; a failed cloud read cannot be reported
as a complete export. Account deletion relies on the tested foreign-key cascade.
Keep password confirmation and verified-user checks. Clear the current account's
local records only after deletion succeeds, without deleting another account's
cache. Disclose the limits of clearing other devices and backups.

Update README, bilingual privacy/storage/terms copy where relevant, and operations
instructions: parsed academic history and grades now leave the browser for
Supabase. Clearing a device cache must not be described as deleting cloud records.
Update account export's scope label. Existing legal launch reviews remain pending;
this feature does not certify compliance or authorize a public launch.

## Verification and rollout

Add focused tests for document round trips and validation, spoofed ownership,
unverified sessions, RLS cross-account denial, foreign-key cascade, first-write
races, revision conflicts, late save responses, recovery, account switches,
two-device restore, legacy personal-key cleanup, and export failure behavior.
Exercise actual RLS/CAS/cascade SQL against an isolated Supabase/Postgres instance
when available; source inspection and mocked tests alone are not proof of deployed
database enforcement. Report any unavailable integration environment honestly.

Run lint, typecheck, relevant tests, and production compilation. Preserve unrelated
working-tree edits to equivalence import/service code and tests.

Deliver the migration and exact setup instructions with the implementation.
Applying SQL to a live Supabase project requires an available authenticated
database connection and an identified target; never infer that target from public
project keys or print credentials. An uninstalled migration is a deployment step
remaining, not a completed live rollout. Apply schema before deploying consumers.
Rollback app code without deleting cloud records; retain the table for recovery.

## Approval

Approved by the user on 26 October 2026, with the clean-start amendment above.
Parsed transcript/grade synchronization is included. No hosting migration is included.

## Implemented recovery details

Each account/page writer has its own pending recovery slot. Recovered snapshots
carry source provenance through interrupted recovery. Completion acknowledges the
exact snapshot with a SHA-256 digest in a separate account-scoped key, never
removing a newer source writer's edits. Acknowledged older copies remain on the
device until explicit clearing; notices disclose this. Remote hydration commits
before tools can submit stale state, and an edit during recovery aborts that
recovery attempt rather than replacing the new edit.
