# Authentication form browser regressions

This fixture mounts the production signup, login, forgot-password and reset-password forms. Local fixture actions reuse production validation and never import Supabase or send email. It verifies input and Remember me preservation immediately after a failed action, then TR → EN → TR without resubmitting. A production ProfilePage fixture also verifies that a synthetic successful password change clears all three fields and that language/visibility toggles do not restore them.

Run `node tests/auth/browser/verify.mjs` with the existing Vite dependency, Playwright and installed Google Chrome. If Playwright is supplied outside this repository, set `PLAYWRIGHT_MODULE` to its package path. Optional `AUTH_SCREENSHOTS` changes the screenshot directory (default `/tmp/simplify-auth-inputs-browser`). The fixture binds only `127.0.0.1:3109` and closes its server/browser when finished.
