# Weekly Planner Browser Checks

This fixture mounts the production planner and stylesheet with mock course APIs and isolated local storage. It never connects to a registration site. It requires the existing Vite dependency, Playwright, and installed Google Chrome.

Run `node tests/calendar/browser/verify.mjs`. Set `PLAYWRIGHT_MODULE` to a Playwright package path if it is supplied outside this project's dependencies. Screenshots go to `/tmp/simplify-planner-browser`, or `PLANNER_SCREENSHOTS` when set.

The checks cover selection changes, plan switching, keyboard reordering, local credits, CRN validation, native drag data, click suppression, JPEG downloads, registration DOM fixtures, and English/Turkish layouts at 320, 390, 768, and 1280 pixels. Actual dragging into browser chrome's bookmarks bar requires manual verification in a headed browser.
