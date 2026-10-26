# Account storage browser checks

This fixture mounts the production AcademicProvider and storage adapter with an isolated mock HTTP database. It does not access real accounts, Supabase or ITU sites.

Run `node tests/academic/browser/verify.mjs` with Playwright and Google Chrome installed. If Playwright is supplied outside the project, set `PLAYWRIGHT_MODULE` to that package's absolute directory. The runner binds localhost port 3110 and closes the server/browser afterward.

Checks cover cloud hydration, PostgreSQL-style JSON key reordering, two browser contexts sharing an account, remote refresh, explicit conflict resolution, offline close/recovery, switched-cookie identity rejection, second-account isolation, and removal of only legacy personal keys. Actual SQL RLS/CAS/cascade checks live in `tests/academic/database.test.ts` and run in embedded PostgreSQL as part of `npm run test:run`.
