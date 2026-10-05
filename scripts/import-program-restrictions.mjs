import { load } from "cheerio";
import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
export const sources = {
  obs: "https://obs.itu.edu.tr/public/GenelTanimlamalar/ProgramKodlariList?programSeviyeTipiId=2",
  sis: "https://www.sis.itu.edu.tr/TR/obs-hakkinda/lisans-program-kodlari.php",
};
const englishSource = "https://obs.itu.edu.tr/public/Home/SetLanguageSettings?culture=en-US&returnUrl=~%2FGenelTanimlamalar%2FProgramKodlariList%3FprogramSeviyeTipiId%3D2";
const endpoint = (action, params) => `https://obs.itu.edu.tr/public/DersProgram/${action}?${new URLSearchParams(params)}`;
export const scheduleUrl = (id) => endpoint("DersProgramSearch", { programSeviyeTipiAnahtari: "LS", dersBransKoduId: String(id) });
const clean = (value) => value.replace(/\s+/g, " ").trim();

export function parseProgramTable(html, allowDuplicateCodes = false) {
  const $ = load(html);
  const programs = [];
  $("tr").each((_, row) => {
    const cells = $(row).children("td");
    const code = clean(cells.eq(0).text());
    const name = clean(cells.eq(1).text());
    if (cells.length === 2 && /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(code) && name) programs.push({ code, name });
  });
  if (!programs.length || (!allowDuplicateCodes && new Set(programs.map(p => p.code)).size !== programs.length)) throw new Error("Invalid program source table");
  return programs;
}

export function parseSchedule(html) {
  const $ = load(html);
  const headers = $("thead tr").first().children("td,th").map((_, cell) => clean($(cell).text())).get();
  if (headers[0] !== "CRN" || headers[12] !== "Dersi Alabilen Programlar" || headers.length !== 15) throw new Error("Schedule restriction column changed or source is invalid");
  const rows = [];
  $("tbody tr").each((_, row) => {
    const cells = $(row).children("td");
    if (!cells.length) return;
    if (cells.length !== 15 || !/^\d+$/.test(clean(cells.eq(0).text()))) throw new Error("Invalid schedule row");
    const raw = clean(cells.eq(12).text());
    rows.push({ crn: clean(cells.eq(0).text()), courseCode: clean(cells.eq(1).text()), raw,
      tokens: raw && raw !== "-" ? raw.split(/[,\s]+/).filter(Boolean) : [] });
  });
  return rows;
}

export function buildRegistry(previous, catalog, official, legacy, schedules, semester, retrievedAt, english = []) {
  if (!semester || !schedules.length) throw new Error("Semester and schedule evidence required");
  const observed = new Map();
  const unknownValues = new Map();
  let rowCount = 0;
  for (const schedule of schedules) for (const row of schedule.rows) {
    rowCount++;
    if (!row.tokens.length) unknownValues.set(row.raw, (unknownValues.get(row.raw) ?? 0) + 1);
    for (const code of row.tokens) {
      if (!observed.has(code)) observed.set(code, []);
      observed.get(code).push({ semester, branch: schedule.branch, crn: row.crn, sourceUrl: schedule.sourceUrl });
    }
  }
  if (!rowCount) throw new Error("No schedule rows; refusing empty evidence refresh");
  const en = new Map(english.map(p => [p.code, p.name]));
  const prior = new Map(previous.programs.map(p => [p.code, p]));
  const programs = official.map(p => ({ ...prior.get(p.code), code: p.code, nameTr: p.name,
    ...(en.has(p.code) ? { nameEn: en.get(p.code), nameEnSource: englishSource } : {}),
    legacyCodes: [...new Set([...(prior.get(p.code)?.legacyCodes ?? []), ...legacy.filter(l => p.code === `${l.code}_LS`).map(l => l.code)])], source: sources.obs, verified: true }));
  const minors = catalog.programs.filter(p => p.planType === "yandal");
  const minorMappings = minors.map(p => {
    const observations = observed.get(p.code) ?? [];
    const old = previous.minorMappings?.find(m => m.curriculumCode === p.code && m.restrictionCode === p.code && m.verified);
    const planSources = catalog.plans.filter(plan => plan.programCode === p.code && plan.planType === "yandal").map(plan => plan.sourceUrl);
    // An alias needs an exact, unique official name match and literal schedule evidence.
    // In particular SIS repeats MKN for two faculties: that code remains unresolved.
    const aliases = observations.length ? legacy.filter(l => l.name === p.name
      && legacy.filter(other => other.code === l.code).length === 1
      && minors.filter(other => other.name === p.name).length === 1).map(l => l.code) : old?.legacyCodes ?? [];
    return { curriculumCode: p.code, restrictionCode: p.code, verified: observations.length > 0 || !!old,
      nameTr: p.name, ...(en.has(p.code) ? { nameEn: en.get(p.code), nameEnSource: englishSource } : {}), legacyCodes: aliases,
      sources: [...new Set([catalog.sourceUrl, ...planSources, ...(aliases.length ? [sources.sis] : []), ...(observations.length ? observations.map(o => o.sourceUrl) : old?.sources ?? [])])],
      observations: observations.length ? observations : old?.observations ?? [],
      ...(!observations.length && old ? { retainedFrom: previous.retrievedAt } : {}) };
  });
  const known = new Set([...programs.map(p => p.code), ...minorMappings.filter(m => m.verified).map(m => m.restrictionCode)]);
  return { ...previous, retrievedAt, sources, programs, legacyPrograms: legacy, minorMappings,
    observationSummary: { semester, branchCount: schedules.length, rowCount,
      unknownValues: [...unknownValues].map(([value, count]) => ({ value, count, meaning: "unknown" })),
      observedTokens: [...observed.keys()].sort(), unknownTokens: [...observed.keys()].filter(c => !known.has(c)).sort(),
      unresolvedLegacyProgramCodes: [...new Set(legacy.filter(p => !/Yandal/i.test(p.name) && !programs.some(m => m.legacyCodes.includes(p.code))).map(p => p.code))],
      unresolvedLegacyMinorCodes: [...new Set(legacy.filter(p => /Yandal/i.test(p.name) && !minorMappings.some(m => m.legacyCodes.includes(p.code))).map(p => p.code))],
      unrestrictedSentinels: [] } };
}

async function main() {
  const option = (name) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const fixture = option("source-dir");
  const output = resolve(option("output") ?? resolve(root, "src/data/itu/program-restrictions.json"));
  const catalog = JSON.parse(await readFile(resolve(root, "src/data/itu/curriculum-catalog.json"), "utf8"));
  const previous = JSON.parse(await readFile(output, "utf8"));
  const failures = [];
  async function obtain(file, url, optional = false) {
    try {
      if (fixture) return await readFile(resolve(fixture, file), "utf8");
      const response = await fetch(url, { signal: AbortSignal.timeout(25_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) { if (!optional) throw error; failures.push({ source: url, error: String(error) }); return null; }
  }
  // Required official identities must validate before any output is replaced.
  const official = parseProgramTable(await obtain("itu-programs.html", sources.obs));
  const legacy = parseProgramTable(await obtain("itu-sis.html", sources.sis), true);
  const branches = JSON.parse(await obtain("itu-branches.json", endpoint("SearchBransKoduByProgramSeviye", { programSeviyeTipiAnahtari: "LS" })));
  const semester = JSON.parse(await obtain("itu-semester.json", endpoint("GetAktifDonemByProgramSeviye", { programSeviyeTipiAnahtari: "LS" }))).aktifDonem;
  if (!Array.isArray(branches) || !branches.length || branches.some(b => !/^[A-Z0-9]+$/.test(b.dersBransKodu) || !Number.isInteger(b.bransKoduId))) throw new Error("Invalid branches");
  let english = [];
  const englishHtml = await obtain("itu-programs-en.html", englishSource, true);
  if (englishHtml && /Program Codes/.test(englishHtml)) english = parseProgramTable(englishHtml);
  const schedules = [];
  let cursor = 0;
  // Bound concurrency to four public requests, including during a full refresh.
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < branches.length) {
      const branch = branches[cursor++];
      const sourceUrl = scheduleUrl(branch.bransKoduId);
      const html = await obtain(`itu-sections/${branch.dersBransKodu}.html`, sourceUrl, true);
      if (!html) continue;
      try { schedules.push({ branch: branch.dersBransKodu, sourceUrl, rows: parseSchedule(html) }); }
      catch (error) { failures.push({ source: sourceUrl, error: String(error) }); }
    }
  }));
  schedules.sort((a, b) => a.branch.localeCompare(b.branch));
  const result = buildRegistry(previous, catalog, official, legacy, schedules, semester, new Date().toISOString(), english);
  result.refresh = { complete: failures.length === 0, failures, expectedBranches: branches.length };
  const temp = `${output}.tmp`;
  await writeFile(temp, JSON.stringify(result, null, 2) + "\n");
  await rename(temp, output);
  console.log(JSON.stringify({ programs: result.programs.length, minors: result.minorMappings.length, verifiedMinors: result.minorMappings.filter(m => m.verified).length, ...result.observationSummary, failures }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
