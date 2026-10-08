import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = fileURLToPath(new URL("../../..", import.meta.url));
const screenshots = resolve(process.env.PLANNER_SCREENSHOTS || "/tmp/simplify-planner-browser");
await mkdir(screenshots, { recursive: true });
const server = await createServer({
  configFile: false, root,
  resolve: { alias: { "@": resolve(root, "src"), "next/link": resolve(root, "tests/calendar/browser/nextLink.tsx") } },
  oxc: { jsx: { runtime: "automatic" } },
  server: { host: "127.0.0.1", port: 3108, strictPort: true },
});
let browser;
const semester = "2026-2027 Fall";
const meeting = (id, day, startTime = "09:00") => ({ id, day, startTime, endTime: "11:00" });
const section = (id, crn, meetings) => ({ id, crn, semester, meetings, programRestriction: { state: "unrestricted", codes: [] } });
const catalog = { facultyCode: "MAT", semester, fetchedAt: new Date().toISOString(), courses: [
  { id: "a", code: "MAT 101", title: "First course", localCredits: 3.5, sections: [section("a1", "00123", [meeting("al", "Monday"), meeting("ap", "Tuesday")]), section("a2", "00456", [meeting("a2m", "Wednesday")])] },
  { id: "b", code: "MAT 102", title: "Second course", localCredits: 2, sections: [section("b1", "98765", [meeting("bl", "Thursday")])] },
  { id: "c", code: "MAT 103", title: "Missing credits", localCredits: null, sections: [section("c1", "55555", [meeting("cl", "Friday")])] },
  { id: "d", code: "MAT 104", title: "Invalid CRN", localCredits: 1, sections: [section("d1", "invalid", [meeting("dl", "Friday")])] },
] };
const selection = (id, courseId, sectionId) => ({ id, facultyCode: "MAT", courseId, sectionId, courseBlockIds: [] });
const program = (id, courseSelections) => ({ id, name: id, courseSelections, courseBlocks: [], updatedAt: new Date().toISOString() });
const plans = [program("First", [selection("s1", "a", "a1"), selection("s2", "b", "b1")]), program("Second", [selection("s3", "b", "b1")]), program("Empty", [])];

try {
  await server.listen();
  browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  await context.route("**/api/itu/branches", (route) => route.fulfill({ json: { branches: [{ id: 1, code: "MAT" }] } }));
  await context.route("**/api/itu/courses?**", (route) => route.fulfill({ json: { catalog } }));
  await context.addInitScript((plans) => {
    localStorage.setItem("simplify-weekly-programs", JSON.stringify(plans));
  }, plans);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:3108/tests/calendar/browser/index.html");
  const link = page.getByRole("link", { name: /^Fill CRNs:/ });
  const credit = (text) => page.getByRole("status").filter({ hasText: text });
  await credit("Credits: 5.5").waitFor();
  const crns = async () => JSON.parse((await link.getAttribute("href")).match(/var crns=(\[[^;]+\]);/)[1]);
  assert.deepEqual(await crns(), ["00123", "98765"]);
  const snapshot = await link.getAttribute("href");
  await link.click();
  assert.equal(await page.locator('input[type="number"]').count(), 0);
  assert.equal(page.url(), "http://127.0.0.1:3108/tests/calendar/browser/index.html");
  const drag = await link.evaluate((anchor) => {
    const dataTransfer = new DataTransfer();
    anchor.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer }));
    return { href: anchor.getAttribute("href"), uri: dataTransfer.getData("text/uri-list"), text: dataTransfer.getData("text/plain"), html: dataTransfer.getData("text/html") };
  });
  assert.equal(drag.href, snapshot);
  assert.equal(drag.uri, snapshot);
  assert.equal(drag.text, snapshot);
  assert.ok(drag.html.includes("javascript:"));
  assert.equal(await link.textContent(), "CRN Doldur");
  assert.equal(await link.getAttribute("data-label"), "Fill CRNs");
  const signedOut = await page.evaluate(async (bookmarklet) => {
    const logoutForm = document.createElement("form");
    const logoutButton = document.createElement("button");
    logoutButton.type = "submit";
    logoutButton.textContent = "Sign Out";
    logoutForm.hidden = true;
    logoutForm.append(logoutButton);
    let signedOut = false;
    logoutForm.onsubmit = (event) => { event.preventDefault(); signedOut = true; };
    document.body.append(logoutForm);
    new Function(bookmarklet.slice(11))();
    await new Promise((resolve) => setTimeout(resolve, 150));
    logoutForm.remove();
    return signedOut;
  }, snapshot);
  assert.equal(signedOut, false);

  const handles = page.getByRole("button", { name: "Drag to reorder course", exact: true });
  await handles.first().focus();
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector('button[aria-pressed="true"]'));
  await page.keyboard.press("ArrowDown");
  await page.getByText("Position 2 of 2 courses.", { exact: true }).waitFor({ state: "attached" });
  await page.keyboard.press("Space");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("simplify-weekly-programs"))[0].courseSelections[0].id === "s2");
  assert.deepEqual(await crns(), ["98765", "00123"]);
  await credit("Credits: 5.5").waitFor();
  const field = (label) => page.locator("label").filter({ has: page.locator("span.sr-only").filter({ hasText: label }) }).locator("select");
  const courses = field(/^Course$/);
  const sections = field(/^CRN \/ Section$/);
  await sections.nth(1).selectOption("a2");
  assert.deepEqual(await crns(), ["98765", "00456"]);
  assert.ok(snapshot.includes('["00123","98765"]'));
  await courses.nth(1).selectOption("c");
  await credit("Credits: unavailable").waitFor();
  assert.equal(await link.getAttribute("href"), null);
  await page.getByRole("alert").filter({ hasText: "Select a valid CRN" }).waitFor();
  await sections.nth(1).selectOption("c1");
  assert.deepEqual(await crns(), ["98765", "55555"]);
  await courses.nth(1).selectOption("d");
  await sections.nth(1).selectOption("d1");
  assert.equal(await link.getAttribute("href"), null);
  await credit("Credits: 3").waitFor();
  await page.getByRole("button", { name: "Delete", exact: true }).nth(1).click();
  await credit("Credits: 2").waitFor();
  assert.deepEqual(await crns(), ["98765"]);
  await page.locator("#weekly-program").selectOption("Empty");
  await credit("Credits: 0").waitFor();
  assert.equal(await link.getAttribute("href"), null);
  assert.equal(await link.getAttribute("draggable"), "false");
  await page.getByRole("button", { name: "Add Course", exact: true }).click();
  await credit("Credits: 0").waitFor();
  await field(/^Course prefix$/).selectOption("MAT");
  await courses.first().selectOption("a");
  await credit("Credits: 3.5").waitFor();
  await sections.first().selectOption("a1");
  assert.deepEqual(await crns(), ["00123"]);
  assert.equal(await page.getByRole("button", { name: /MAT 101.*00123/ }).count(), 2);
  await page.locator("#weekly-program").selectOption("Second");
  await credit("Credits: 2").waitFor();
  assert.deepEqual(await crns(), ["98765"]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "simplify-second.jpg");
  const jpeg = await readFile(await download.path());
  assert.equal(jpeg.subarray(0, 3).toString("hex"), "ffd8ff");
  for (const language of ["en", "tr"]) {
    await page.evaluate((language) => {
      document.documentElement.lang = language;
      window.dispatchEvent(new Event("simplify-language-change"));
    }, language);
    await page.locator("#weekly-program").selectOption("Empty");
    await credit(language === "en" ? "Credits: 3.5" : "Kredi: 3,5").waitFor();
    for (const width of [1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const exportButton = page.getByRole("button", { name: language === "en" ? "Export" : "Dışa Aktar", exact: true });
      await exportButton.waitFor();
      const fill = page.getByRole("link", { name: language === "en" ? /^Fill CRNs:/ : /^CRN Doldur:/ });
      const bounds = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll("button")];
        const exportButton = buttons.find((button) => ["Export", "Dışa Aktar"].includes(button.textContent.trim()));
        const add = buttons.find((button) => ["Add Course", "Ders Ekle"].includes(button.textContent.trim()));
        const credit = add.parentElement.querySelector("span");
        const rect = (element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; };
        return { grid: rect(document.querySelector(".overflow-y-hidden")), export: rect(exportButton), add: rect(add), credit: rect(credit), width: innerWidth, scrollWidth: document.documentElement.scrollWidth };
      });
      await page.evaluate(async () => {
        window.scrollTo(0, 0);
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      });
      await page.screenshot({ path: resolve(screenshots, `${language}-${width}.png`), fullPage: true });
      assert.ok(bounds.export.y >= bounds.grid.bottom, JSON.stringify(bounds));
      assert.ok(bounds.export.right <= width && bounds.export.x >= 0);
      assert.ok(bounds.credit.right <= width && bounds.credit.x >= 0);
      assert.ok(bounds.credit.y >= bounds.add.bottom || bounds.credit.x >= bounds.add.right);
      assert.equal(bounds.scrollWidth, width);
      const fillBounds = await fill.boundingBox();
      assert.ok(fillBounds.x >= 0 && fillBounds.x + fillBounds.width <= width);
    }
  }
  const registration = await context.newPage();
  await registration.setContent(`<input type="number" style="display:none"><div style="visibility:hidden"><input type="number"></div><input type="number" id="first"><div style="display:none"><input type="number"></div><input type="number" id="second"><input type="number" id="unused"><button type="submit" disabled>Disabled</button><button type="submit" id="submit">Submit</button><div class="card-footer d-flex justify-content-end"><button>First</button><button id="confirm">Confirm</button></div>`);
  await registration.evaluate((bookmarklet) => {
    window.fixtureEvents = [];
    document.addEventListener("input", (event) => window.fixtureEvents.push(`input:${event.target.id}:${event.bubbles}`));
    document.getElementById("submit").onclick = () => window.fixtureEvents.push("submit");
    document.getElementById("confirm").onclick = () => window.fixtureEvents.push("confirm");
    new Function(bookmarklet.slice(11))();
  }, snapshot);
  await registration.waitForFunction(() => window.fixtureEvents.includes("confirm"));
  assert.deepEqual(await registration.evaluate(() => window.fixtureEvents), ["input:first:true", "input:second:true", "submit", "confirm"]);
  assert.deepEqual(await registration.locator('input[type="number"]').evaluateAll((inputs) => inputs.map((input) => input.value)), ["", "", "00123", "", "98765", ""]);
  assert.deepEqual(errors, []);
  console.log("PASS: planner selection changes, plan switching, reordering, CRNs, native drag data, click suppression, JPEG, English/Turkish and 4 viewport widths.");
  console.log(`Screenshots: ${screenshots}`);
} finally {
  await browser?.close();
  await server.close();
}
