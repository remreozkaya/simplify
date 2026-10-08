import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseUrl = process.env.BROWSER_BASE_URL || 'http://127.0.0.1:3122';
(async () => {
 const browser = await chromium.launch({headless:true, channel:'chrome'});
 try {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/login`);
  await page.getByRole('button', {name:'Dili İngilizce olarak değiştir'}).first().click();
  await page.waitForFunction(()=>document.title==='Simplify · ITU Student Planner');
  await page.locator('a[href="/signup"]').first().click();
  await page.waitForURL('**/signup');
  await page.waitForTimeout(700);
  assert.equal(await page.title(),'Simplify · ITU Student Planner');
  assert.match(await page.locator('meta[name="description"]').getAttribute('content'),/public ITU OBS/);
  await page.reload();
  await page.waitForTimeout(1500);
  await page.waitForFunction(()=>document.title==='Simplify · ITU Student Planner');
  await page.goBack();
  await page.waitForFunction(()=>document.title==='Simplify · ITU Student Planner');
  await page.goto(`${baseUrl}/legal/privacy`);
  await page.waitForFunction(()=>document.title==='Simplify · ITU Student Planner');
  await page.getByRole('button', {name:'Switch language to Turkish'}).first().click();
  await page.waitForFunction(()=>document.title==='Simplify · İTÜ Öğrenci Planlayıcısı');
  console.log('PASS: production metadata, client navigation, refresh, back navigation, saved EN, legal TR switch');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
