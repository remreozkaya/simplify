import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = fileURLToPath(new URL("../../..", import.meta.url));
const screenshots = resolve(process.env.AUTH_SCREENSHOTS || "/tmp/simplify-auth-inputs-browser");
await mkdir(screenshots, { recursive: true });
const server = await createServer({ configFile: false, root,
  resolve: { alias: [
    { find: "@/app/auth/actions", replacement: resolve(root, "tests/auth/browser/actions.ts") },
    { find: "@/app/(app)/profile/actions", replacement: resolve(root, "tests/auth/browser/actions.ts") },
    { find: "@/app/privacy/actions", replacement: resolve(root, "tests/auth/browser/actions.ts") },
    { find: "@", replacement: resolve(root, "src") },
    { find: "next/link", replacement: resolve(root, "tests/calendar/browser/nextLink.tsx") },
    { find: "next/navigation", replacement: resolve(root, "tests/auth/browser/navigation.ts") },
  ] },
  oxc: { jsx: { runtime: "automatic" } },
  server: { host: "127.0.0.1", port: 3109, strictPort: true },
});
let browser;
const evidence = [];
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const mode of ["signup", "login", "forgot", "reset"]) {
    await page.goto(`http://127.0.0.1:3109/tests/auth/browser/index.html?mode=${mode}`);
    const email = mode === "forgot" ? "invalid-email" : "fixture@example.invalid";
    if (mode !== "reset") await page.locator('input[name="email"]').fill(email);
    if (mode === "signup" || mode === "login" || mode === "reset") await page.locator('input[name="password"]').fill("short");
    if (mode === "signup" || mode === "reset") await page.locator('input[name="confirmPassword"]').fill("different");
    if (mode === "login") await page.locator('input[name="remember"]').check();
    await page.locator('button[type="submit"]').first().click();
    await page.locator('[role="alert"]').first().waitFor();
    // The first assertion is immediately after the action, before any language toggle.
    const beforeToggle = mode === "reset" ? null : await page.locator('input[name="email"]').inputValue();
    evidence.push({ mode, stage: "after failed action before toggle", email: beforeToggle });
    if (mode !== "reset") assert.equal(beforeToggle, email, `${mode}: failed action cleared email before toggle`);
    if (mode !== "forgot") assert.equal(await page.locator('input[name="password"]').inputValue(), "short", `${mode}: failed action cleared password before toggle`);
    if (mode === "login") assert.equal(await page.locator('input[name="remember"]').isChecked(), true, "failed login cleared remember selection");
    let visibleMessage = await page.getByRole("alert").first().innerText();
    for (const target of ["en", "tr"]) {
      await page.getByRole("button", { name: /Dili İngilizce olarak değiştir|Switch language to Turkish/ }).click();
      assert.equal(await page.locator("html").getAttribute("lang"), target);
      await page.waitForFunction(language => document.title === (language === "tr" ? "Simplify · İTÜ Öğrenci Planlayıcısı" : "Simplify · ITU Student Planner"), target);
      assert.match(await page.locator('meta[name="description"]').getAttribute("content"), target === "tr" ? /İTÜ OBS/ : /public ITU OBS/);
      const translatedMessage = await page.getByRole("alert").first().innerText();
      assert.notEqual(translatedMessage, visibleMessage, `${mode}: visible error did not change language`);
      visibleMessage = translatedMessage;
      if (mode !== "reset") assert.equal(await page.locator('input[name="email"]').inputValue(), email);
      if (mode !== "forgot") assert.equal(await page.locator('input[name="password"]').inputValue(), "short");
      if (mode === "signup" || mode === "reset") assert.equal(await page.locator('input[name="confirmPassword"]').inputValue(), "different");
      if (mode === "login") assert.equal(await page.locator('input[name="remember"]').isChecked(), true);
      await page.screenshot({ path: resolve(screenshots, `${mode}-${target}.png`), fullPage: true });
    }
  }
  await context.route("**/api/itu/curriculum/**", route => route.fulfill({ json: { faculties: [], programs: [], plans: [] } }));
  await page.goto("http://127.0.0.1:3109/tests/auth/browser/index.html?mode=profile");
  await page.locator('input[name="currentPassword"]').fill("fixture-current");
  await page.locator('input[name="newPassword"]').fill("fixture-next");
  await page.locator('input[name="confirmPassword"]').fill("fixture-next");
  await page.getByRole("button", { name: "Parolayı değiştir", exact: true }).click();
  await page.locator("form").filter({ has: page.locator('input[name="currentPassword"]') }).getByRole("status").waitFor();
  assert.equal(await page.locator("form").filter({ has: page.locator('input[name="currentPassword"]') }).getByRole("status").innerText(), "Parola değiştirildi.");
  for (const name of ["currentPassword", "newPassword", "confirmPassword"]) assert.equal(await page.locator(`input[name="${name}"]`).inputValue(), "");
  await page.getByRole("button", { name: "Dili İngilizce olarak değiştir" }).first().click();
  assert.equal(await page.locator("form").filter({ has: page.locator('input[name="currentPassword"]') }).getByRole("status").innerText(), "Password changed.");
  await page.getByRole("button", { name: /^Show / }).first().click();
  for (const name of ["currentPassword", "newPassword", "confirmPassword"]) assert.equal(await page.locator(`input[name="${name}"]`).inputValue(), "");
  evidence.push({ mode: "profile", stage: "success then language/visibility toggle", passwordsCleared: true });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "passed", evidence, screenshots }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
