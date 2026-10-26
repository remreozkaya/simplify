import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('../../..', import.meta.url));
const server = await createServer({ configFile: false, root,
  resolve: { alias: { '@': resolve(root, 'src'), 'next/link': resolve(root, 'tests/calendar/browser/nextLink.tsx') } },
  optimizeDeps: { entries: ['tests/academic/browser/index.html'] },
  oxc: { jsx: { runtime: 'automatic' } }, server: { host: '127.0.0.1', port: 3110, strictPort: true, watch: { ignored: ['**/.next/**'] } },
});
const url = 'http://127.0.0.1:3110/tests/academic/browser/index.html';
const documents = new Map();
const errors = [];
let browser;
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)])) : value;
async function install(context, session) {
  await context.addInitScript(() => localStorage.setItem('simplify-language', 'en'));
  await context.route('**/api/academic-records', async route => {
    const request = route.request();
    const userId = request.headers()['x-simplify-account'];
    if (userId !== session.user) return route.fulfill({ status: 403, json: { error: 'account_changed' } });
    if (request.method() === 'PUT' && session.offline) return route.fulfill({ status: 503, json: { error: 'storage_unavailable' } });
    const records = documents.get(userId) ?? new Map(); documents.set(userId, records);
    if (request.method() === 'GET') return route.fulfill({ json: { userId, records: [...records.values()] } });
    const { key, payload, revision } = request.postDataJSON();
    if ((records.get(key)?.revision ?? 0) !== revision) return route.fulfill({ status: 409, json: { userId, error: 'conflict' } });
    const record = { record_key: key, payload: ordered(payload), revision: revision + 1 };
    records.set(key, record);
    return route.fulfill({ json: { userId, record } });
  });
}
async function page(context, account = 'A') {
  const result = await context.newPage();
  result.on('pageerror', error => errors.push(error.message));
  await result.goto(`${url}?account=${account}`);
  await result.getByRole('heading', { name: 'Account storage fixture' }).waitFor();
  return result;
}
async function saved(page) {
  await page.waitForFunction(() => !document.querySelector('[aria-label="Account saving"]'));
  assert.equal(await page.getByText('Saved to your account', { exact: true }).count(), 0);
}
async function waitValue(input, value) {
  await input.page().waitForFunction(value => document.querySelector('input')?.value === value, value);
}
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const first = await browser.newContext(); const second = await browser.newContext();
  const sessionOne = { user: 'A', offline: false }; const sessionTwo = { user: 'A', offline: false };
  await install(first, sessionOne); await install(second, sessionTwo);
  await first.addInitScript(() => { localStorage.setItem('simplify-weekly-programs', 'old private'); localStorage.setItem('itu-catalog', 'official keep'); });
  const one = await page(first); const inputOne = one.getByRole('textbox', { name: 'Course name' });
  assert.equal(await one.evaluate(() => localStorage.getItem('simplify-weekly-programs')), null);
  assert.equal(await one.evaluate(() => localStorage.getItem('itu-catalog')), 'official keep');
  await inputOne.fill('First device'); await saved(one);
  const two = await page(second); const inputTwo = two.getByRole('textbox', { name: 'Course name' });
  assert.equal(await inputTwo.inputValue(), 'First device');
  await inputTwo.fill('Other device'); await saved(two);
  await one.evaluate(() => window.dispatchEvent(new Event('focus')));
  await waitValue(inputOne, 'Other device');

  sessionOne.offline = true;
  await inputOne.fill('Offline edit');
  await one.getByRole('status').filter({ hasText: 'Account storage is unavailable' }).waitFor();
  await inputTwo.fill('Newer cloud edit'); await saved(two);
  sessionOne.offline = false;
  await one.getByRole('button', { name: 'Retry', exact: true }).click();
  await one.getByRole('button', { name: 'Use cloud version' }).waitFor();
  assert.equal(await inputOne.inputValue(), 'Offline edit');
  await one.getByRole('button', { name: 'Use cloud version' }).click();
  await waitValue(inputOne, 'Newer cloud edit');

  sessionOne.offline = true;
  await inputOne.fill('Recover this work');
  await one.getByRole('status').filter({ hasText: 'Account storage is unavailable' }).waitFor();
  await one.close();
  sessionOne.offline = false;
  const reopened = await page(first);
  await reopened.getByRole('button', { name: 'Recover these edits' }).click();
  await waitValue(reopened.getByRole('textbox'), 'Recover this work');
  await saved(reopened);
  assert.equal(await reopened.getByRole('textbox').inputValue(), 'Recover this work');

  sessionOne.user = 'B';
  await reopened.getByRole('textbox').fill('Must stay with A');
  await reopened.getByRole('status').filter({ hasText: 'Your sign-in session changed' }).waitFor();
  assert.equal(await reopened.getByRole('textbox').count(), 0);
  const otherAccount = await page(first, 'B');
  assert.equal(await otherAccount.getByRole('textbox').inputValue(), '');
  assert.equal(await otherAccount.getByRole('button', { name: 'Recover these edits' }).count(), 0);
  assert.equal(documents.get('B')?.size ?? 0, 0);
  assert.deepEqual(errors, []);
  console.log('Passed: hydration, JSONB responses, two-device restore, remote refresh, conflict resolution, offline recovery, switched-session isolation, and legacy-only cleanup.');
} finally { await browser?.close(); await server.close(); }
