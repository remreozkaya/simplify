import * as cheerio from 'cheerio';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Import metadata only. Course titles and course records are never changed.
const origin = 'https://obs.itu.edu.tr';
const output = 'src/data/itu/academic-translations.json';
const catalog = JSON.parse(await readFile('src/data/itu/curriculum-catalog.json', 'utf8'));
const cacheDir = '/tmp/simplify-academic-translations';
await mkdir(cacheDir, { recursive: true });
const clean = value => String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const labels = {};
const sources = new Set();
const failures = [];
function pair(tr, en, url) {
  tr = clean(tr); en = clean(en);
  if (!tr || !en || tr === en) return;
  if (labels[tr] && labels[tr] !== en) {
    failures.push({ scope: tr, error: `Conflicting official labels: ${labels[tr]} / ${en}` });
    return;
  }
  labels[tr] = en;
  const trPeriod = tr.match(/\d{4}-\d{4}.*$/)?.[0];
  const enPeriod = en.match(/(?:Between )?\d{4}-\d{4}.*$/)?.[0];
  if (trPeriod && enPeriod) labels[trPeriod] ??= enPeriod;
  const trMajor = tr.replace(/\s+(?:Lisans|\(Yandal\))\s*$/iu, "");
  const enMajor = en.replace(/\s+(?:Undergraduate|\(Minor\))\s*$/iu, "");
  if (trMajor !== tr && enMajor !== en) labels[trMajor] ??= enMajor;
  sources.add(url);
}
async function request(path, options = {}, language = "en-US") {
  const key = createHash('sha256').update(path + JSON.stringify(options) + (language === 'en-US' ? '' : language)).digest('hex');
  const cached = `${cacheDir}/${key}.txt`;
  try { return await readFile(cached, 'utf8'); } catch {}
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(origin + path, { ...options, headers: {
        cookie: `.AspNetCore.Culture=c%3D${language}%7Cuic%3D${language}`,
        'user-agent': 'Simplify academic metadata importer', ...options.headers,
      }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      await writeFile(cached, text);
      return text;
    } catch (error) { if (attempt === 2) throw error; }
  }
}
async function mapLimit(items, work) {
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { await work(items[index], index); }
      catch (error) { failures.push({ scope: String(items[index].id ?? items[index].code), error: String(error) }); }
    }
  }));
}
const indexPath = '/public/DersPlan/';
const $ = cheerio.load(await request(indexPath));
for (const faculty of catalog.faculties) pair(faculty.name, $(`#akademikBirimId option[value="${faculty.id}"]`).text(), origin + indexPath);
const programGroups = [...new Set(catalog.programs.map(p => `${p.facultyId}:${p.planType}`))];
await mapLimit(programGroups, async key => {
  const [facultyId, type] = key.split(':');
  const path = '/public/DersPlan/GetAkademikProgramByBirimIdAndPlanTipi';
  const rows = JSON.parse(await request(path, { method: 'POST', body: new URLSearchParams({ birimId: facultyId, planTipiKodu: type === 'undergraduate' ? 'lisans' : type }).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' } }));
  for (const program of catalog.programs.filter(p => p.facultyId === facultyId && p.planType === type)) {
    pair(program.name, rows.find(p => p.programKodu === program.code)?.programAdi, origin + path);
  }
});
console.log(`Imported faculty/program labels: ${Object.keys(labels).length}`);
const programs = [...new Map(catalog.programs.map(p => [`${p.planType}:${p.code}`, p])).values()];
await mapLimit(programs, async program => {
  const path = `/public/DersPlan/DersPlanlariList?PlanTipiKodu=${program.planType === 'undergraduate' ? 'lisans' : program.planType}&programKodu=${encodeURIComponent(program.code)}`;
  const $ = cheerio.load(await request(path));
  $('table tbody tr').each((_, row) => {
    const id = Number($(row).find('a').attr('href')?.match(/DersPlanDetay\/(\d+)/)?.[1]);
    const plan = catalog.plans.find(p => p.id === id && p.programCode === program.code);
    if (plan) pair(plan.title, $(row).find('td').last().text(), origin + path);
  });
});
console.log(`Imported plan list labels: ${Object.keys(labels).length}`);
const plans = [...new Map(catalog.plans.map(p => [p.id, p])).values()];
await mapLimit(plans, async (plan, index) => {
  const path = `/public/DersPlan/DersPlanDetay/${plan.id}`;
  const $ = cheerio.load(await request(path));
  const tr = cheerio.load(await request(path, {}, 'tr-TR'));
  const heading = clean($('.content-area h1').first().text());
  pair(tr('.content-area h1').first().text(), heading, origin + path);
  pair(tr('.content-area h2').first().text(), $('.content-area h2').first().text(), origin + path);
  pair(`${plan.programName} Ders Planı`, heading, origin + path);
  pair(plan.curriculumPlanName, $('.content-area h2').first().text(), origin + path);
  const rows = $('table.datalist').not('#dersPlanProgramList').find('tbody tr').toArray().filter(row => $(row).find('td').length >= 6);
  const trRows = tr('table.datalist').not('#dersPlanProgramList').find('tbody tr').toArray().filter(row => tr(row).find('td').length >= 6);
  // Only elective placeholders are UI metadata; coded courses retain their source title.
  for (const item of plan.courses.filter(c => c.kind === 'elective-slot')) {
    const row = rows[item.sourceIndex];
    if (row) {
      pair(item.title, $(row).find('td').eq(1).text(), origin + path);
      const sourceRow = trRows[item.sourceIndex];
      if (sourceRow) pair(tr(sourceRow).find('td').eq(1).text(), $(row).find('td').eq(1).text(), origin + path);
    }
  }
  const notes = $('.content-area p').map((_, p) => clean($(p).text())).get().filter(Boolean);
  for (let i = 0; i < (plan.notes ?? []).length; i++) pair(plan.notes[i], notes[i], origin + path);
  if ((index + 1) % 200 === 0) console.log(`Metadata details: ${index + 1}/${plans.length}`);
});
const result = { retrievedAt: new Date().toISOString(), sources: [...sources].sort(), labels: Object.fromEntries(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b, 'tr'))), failures };
await writeFile(`${output}.tmp`, JSON.stringify(result, null, 2) + '\n');
await rename(`${output}.tmp`, output);
console.log(JSON.stringify({ labels: Object.keys(labels).length, sources: sources.size, failures: failures.length }));
