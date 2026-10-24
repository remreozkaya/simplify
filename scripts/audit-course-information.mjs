import { load } from "cheerio";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { courseInformationQuery } from "../src/lib/itu/courseInformation.mjs";
import { parseCourseInformation } from "../src/lib/itu/parsers/parseCourseInformation.mjs";

const origin = 'https://obs.itu.edu.tr';
const cache = `/tmp/simplify-course-information-audit/${new Date().toISOString().slice(0, 10)}`;
await mkdir(cache, { recursive: true });
async function request(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Simplify course information audit', 'Accept-Language': 'tr-TR' } });
  return { status: response.status, html: await response.text() };
}
async function mapLimit(items, work) {
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < items.length) await work(items[cursor++]);
  }));
}
const semesterResponse = await request(`${origin}/public/DersProgram/GetAktifDonemByProgramSeviye?programSeviyeTipiAnahtari=LS`);
if (semesterResponse.status !== 200) throw new Error('Semester unavailable');
const semester = JSON.parse(semesterResponse.html).aktifDonem;
if (!semester) throw new Error('Missing semester');
const branchResponse = await request(`${origin}/public/DersProgram/SearchBransKoduByProgramSeviye?programSeviyeTipiAnahtari=LS`);
if (branchResponse.status !== 200) throw new Error('Branches unavailable');
const branches = JSON.parse(branchResponse.html);
const courses = new Map();
const failures = [];
let completed = 0;
await mapLimit(branches, async branch => {
  const url = `${origin}/public/DersProgram/DersProgramSearch?programSeviyeTipiAnahtari=LS&dersBransKoduId=${branch.bransKoduId}`;
  try {
    const file = `${cache}/branch-${encodeURIComponent(semester)}-${branch.bransKoduId}.html`;
    let html;
    try { html = await readFile(file, 'utf8'); } catch {
      const result = await request(url);
      if (result.status !== 200) throw new Error(`HTTP ${result.status}`);
      html = result.html;
      await writeFile(file, html);
    }
    const $ = load(html);
    if (!$('th,td').toArray().some(e => $(e).text().trim() === 'CRN')) throw new Error('Schedule table missing');
    $('tbody tr').each((_, row) => {
      const cells = $(row).children('td');
      if (!/^\d+$/.test(cells.eq(0).text().trim())) return;
      const code = cells.eq(1).text().replace(/\s+/g, ' ').trim();
      const query = courseInformationQuery(code);
      const key = query?.key ?? code;
      const entry = courses.get(key) ?? { query, codes: [] };
      if (!entry.codes.includes(code)) entry.codes.push(code);
      courses.set(key, entry);
    });
  } catch (error) { failures.push({ branch: branch.dersBransKodu, error: String(error), url }); }
  if (++completed % 25 === 0) console.log(`Schedules: ${completed}/${branches.length}`);
});
console.log(`Checking ${courses.size} catalog queries for ${[...courses.values()].reduce((n, c) => n + c.codes.length, 0)} course codes`);
const entries = {};
completed = 0;
await mapLimit([...courses], async ([key, { query, codes }]) => {
  let state = 'unknown';
  let httpStatus = null;
  if (query) {
    const url = `${origin}/public/DersBilgi/DersBilgiSearch?${new URLSearchParams({ bransKodu: query.branch, dersNo: query.number })}`;
    const file = `${cache}/course-${encodeURIComponent(key)}.json`;
    try {
      let result;
      try { result = JSON.parse(await readFile(file, 'utf8')); } catch { result = await request(url); await writeFile(file, JSON.stringify(result)); }
      httpStatus = result.status;
      state = result.status === 200 ? parseCourseInformation(result.html, codes[0]) : 'unknown';
    } catch { state = 'unknown'; }
  }
  entries[key] = { state, codes, httpStatus };
  if (++completed % 100 === 0) console.log(`Catalogs: ${completed}/${courses.size}`);
});
const verifiedSemester = JSON.parse((await request(`${origin}/public/DersProgram/GetAktifDonemByProgramSeviye?programSeviyeTipiAnahtari=LS`)).html).aktifDonem;
if (verifiedSemester !== semester) throw new Error('Semester changed during audit');
const report = { retrievedAt: new Date().toISOString(), semester, branchCount: branches.length, courseCount: [...courses.values()].reduce((n, c) => n + c.codes.length, 0), failures, entries: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))) };
const output = `${cache}/report.json`;
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, output, entries: undefined, states: Object.values(entries).reduce((a, e) => ({ ...a, [e.state]: (a[e.state] ?? 0) + 1 }), {}) }, null, 2));
if (failures.length) process.exitCode = 1;
