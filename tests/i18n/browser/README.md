# Production metadata regression

Start the production build locally on port 3122 (`npm run build`, then
`npm run start -- --hostname 127.0.0.1 --port 3122`). Run:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright node tests/i18n/browser/verify.mjs
```

`BROWSER_BASE_URL` overrides the local server URL. The runner checks TR/EN
metadata, saved English restoration after refresh, client navigation, browser
Back, and public legal-page language switching. It submits no forms and changes
only the disposable browser context's language preference.
