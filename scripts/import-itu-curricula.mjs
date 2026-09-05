import * as cheerio from "cheerio";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ORIGIN = "https://obs.itu.edu.tr";
const OUTPUT = resolve(process.cwd(), "src/data/itu/curriculum-catalog.json");
const TYPES = [{ planType: "undergraduate", obs: "lisans" }, { planType: "cap", obs: "cap" }, { planType: "yandal", obs: "yandal" }];
const cache = new Map();
const failures = [];
const clean = (value) => String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const wait = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }));
  return results;
}

async function request(url, options = {}, attempts = 3) {
  const key = `${options.method ?? "GET"}:${url}:${options.body ?? ""}`;
  if (cache.has(key)) return cache.get(key);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000), headers: { "user-agent": "Simplify curriculum importer", ...options.headers } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value = options.json ? await response.json() : await response.text();
      cache.set(key, value);
      await wait(180);
      return value;
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      await wait(400 * (2 ** attempt));
    }
  }
}

function facultiesFrom(html) {
  const $ = cheerio.load(html);
  return $("#akademikBirimId option").map((_, option) => {
    const name = clean($(option).text());
    return { id: clean($(option).attr("value")), name, nameTr: name };
  }).get().filter((item) => item.id);
}

const baseProgramIdFromCode = (code) => clean(code).toLocaleUpperCase("tr-TR").replace(/_(?:LS|YD)$/u, "").replace(/E$/u, "");
const offeringKey = (program) => `${program.facultyId}:${program.planType}:${program.code}`;
const planKey = (plan) => `${plan.planType}:${plan.programCode}:${plan.id}`;
const officialEnglishName = (code) => code === "ECNE_LS" ? "Economics (English)" : code === "ECN_YD" ? "Economics" : undefined;

function plansFrom(html, program) {
  const $ = cheerio.load(html);
  return $("a[href*='/DersPlan/DersPlanDetay/']").map((_, link) => {
    const href = $(link).attr("href");
    const id = Number(href?.match(/DersPlanDetay\/(\d+)/)?.[1]);
    const title = clean($(link).closest("tr").find("td").last().text());
    return id ? { id, curriculumPlanId: id, programCode: program.code, targetProgramId: program.baseProgramId, programName: program.name, facultyId: program.facultyId, planType: program.planType, title, nameTr: title, validityPeriod: title.match(/\d{4}-\d{4}.*$/)?.[0] ?? null, sourceUrl: new URL(href, ORIGIN).href } : null;
  }).get().filter(Boolean);
}

function detailFrom(html, plan) {
  const $ = cheerio.load(html);
  const associatedPrimaryPrograms = $("#dersPlanProgramList tbody tr").map((_, row) => {
    const cells = $(row).find("td");
    return { code: clean($(cells[0]).text()), name: clean($(cells[1]).text()) };
  }).get().filter((item) => item.code);
  const courses = $("table.datalist").not("#dersPlanProgramList").find("tbody tr").map((index, row) => {
    const cells = $(row).find("td");
    if (cells.length < 6) return null;
    const first = $(cells[0]);
    const groupId = Number(first.find("a[href*='_DersGrupSearch']").attr("href")?.match(/[?&]grupId=(\d+)/)?.[1]);
    return { kind: groupId ? "elective-slot" : "course", code: clean(first.find("a").first().text() || first.text()), title: clean($(cells[1]).text()), language: clean($(cells[2]).text()), requirementType: clean($(cells[3]).text()), credit: clean($(cells[4]).text()), ects: clean($(cells[5]).text()), ...(groupId ? { groupId } : {}), sourceIndex: index };
  }).get().filter((item) => item?.title);
  const associatedPrimaryProgramIds = associatedPrimaryPrograms.map((item) => baseProgramIdFromCode(item.code));
  return { ...plan, curriculumPlanName: clean($(".content-area h2").first().text()) || plan.title, associatedPrimaryPrograms, associatedPrimaryProgramIds, primaryProgramIds: associatedPrimaryProgramIds, ...(associatedPrimaryProgramIds.length === 1 ? { primaryProgramId: associatedPrimaryProgramIds[0] } : {}), ...(plan.planType === "cap" ? { capPlanId: plan.id } : {}), notes: $(".content-area p").map((_, p) => clean($(p).text())).get().filter(Boolean), courses, retrievedAt: new Date().toISOString() };
}

function electiveGroupFrom(html, groupId) {
  const $ = cheerio.load(html);
  return { id: groupId, title: clean($(".content-area h2").first().text()), courses: $("table tbody tr").map((_, row) => {
    const cells = $(row).find("td");
    const code = clean($(cells[0]).find("a").first().text() || $(cells[0]).text());
    const whole = clean($(cells[0]).text());
    return code ? { code, title: clean(whole.slice(whole.indexOf(code) + code.length)), language: clean($(cells[1]).text()), credit: clean($(cells[2]).text()), ects: clean($(cells[3]).text()) } : null;
  }).get().filter(Boolean) };
}

function prerequisiteBranchesFrom(html) {
  const $ = cheerio.load(html);
  const branches = {};
  $("select[name='DersBransKoduId'] option").each((_, option) => {
    const code = clean($(option).text()).toUpperCase();
    const id = Number($(option).attr("value"));
    if (/^[A-ZÇĞİÖŞÜ]{2,8}$/u.test(code) && id) branches[code] = id;
  });
  return branches;
}

function prerequisitesFrom(html) {
  const $ = cheerio.load(html);
  const records = [];
  $("table tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    const expressionCell = $(cells[2]).clone();
    expressionCell.find("br").replaceWith(" ");
    const rawExpression = clean(expressionCell.text());
    $(cells[0]).find("a").each((__, link) => records.push({ courseCode: clean($(link).text()), rawExpression, minimumCredits: clean($(cells[3]).text()) }));
  });
  return records;
}

async function main() {
  if (process.argv.includes("--prerequisites-only")) {
    const previous = JSON.parse(await readFile(OUTPUT, "utf8"));
    const branches = prerequisiteBranchesFrom(await request(`${ORIGIN}/public/GenelTanimlamalar/DersOnsartList`));
    const usedBranches = [...new Set(previous.plans.flatMap((plan) => plan.courses.flatMap((course) => course.kind === "course" ? [course.code.split(/\s|\d/)[0]] : [])))];
    const prerequisites = (await mapLimit(usedBranches, 3, async (branch) => {
      if (!branches[branch]) return [];
      try { return prerequisitesFrom(await request(`${ORIGIN}/public/GenelTanimlamalar/OnsartAra?DersBransKoduId=${branches[branch]}`)); }
      catch (error) { failures.push({ scope: `prerequisite:${branch}`, error: String(error) }); return []; }
    })).flat();
    const output = { ...previous, retrievedAt: new Date().toISOString(), prerequisites: prerequisites.length ? prerequisites : previous.prerequisites, failures };
    await writeFile(`${OUTPUT}.tmp`, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    await rename(`${OUTPUT}.tmp`, OUTPUT);
    console.log(JSON.stringify({ prerequisiteBranches: usedBranches.length, prerequisites: prerequisites.length, failed: failures.length }, null, 2));
    return;
  }
  const faculties = facultiesFrom(await request(`${ORIGIN}/public/DersPlan/`));
  if (!faculties.length) throw new Error("Official faculty response was empty; stored data was not replaced.");
  const programs = [];
  for (const faculty of faculties) for (const type of TYPES) {
    try {
      const body = new URLSearchParams({ birimId: faculty.id, planTipiKodu: type.obs });
      const rows = await request(`${ORIGIN}/public/DersPlan/GetAkademikProgramByBirimIdAndPlanTipi`, { method: "POST", body, json: true, headers: { "content-type": "application/x-www-form-urlencoded" } });
      for (const row of rows ?? []) {
        const code = clean(row?.programKodu);
        const name = clean(row?.programAdi);
        if (!code || !name) { failures.push({ scope: `${faculty.id}:${type.planType}`, error: "Malformed academic-program record" }); continue; }
        programs.push({ id: `${faculty.id}:${type.planType}:${code}`, baseProgramId: baseProgramIdFromCode(code), officialProgramCode: code, code, name, nameTr: name, ...(officialEnglishName(code) ? { nameEn: officialEnglishName(code) } : {}), facultyId: faculty.id, facultyName: faculty.name, planType: type.planType });
      }
    } catch (error) { failures.push({ scope: `${faculty.id}:${type.planType}`, error: String(error) }); }
  }
  const planStubs = (await mapLimit(programs, 3, async (program) => {
    try {
      const obs = TYPES.find((item) => item.planType === program.planType).obs;
      return plansFrom(await request(`${ORIGIN}/public/DersPlan/DersPlanlariList?PlanTipiKodu=${obs}&programKodu=${encodeURIComponent(program.code)}`), program);
    } catch (error) { failures.push({ scope: `${program.planType}:${program.code}`, error: String(error) }); return []; }
  })).flat();
  const uniquePlanStubs = [...new Map(planStubs.map((item) => [planKey(item), item])).values()];
  const plans = (await mapLimit(uniquePlanStubs, 4, async (plan, index) => {
    try {
      if (index > 0 && index % 100 === 0) console.log(`Imported ${index}/${uniquePlanStubs.length} plan details…`);
      return detailFrom(await request(plan.sourceUrl), plan);
    } catch (error) { failures.push({ scope: `plan:${plan.id}`, error: String(error) }); return null; }
  })).filter(Boolean);
  const electiveGroups = {};
  const groupIds = [...new Set(plans.flatMap((plan) => plan.courses.flatMap((course) => course.groupId ? [course.groupId] : [])))];
  await mapLimit(groupIds, 3, async (groupId) => {
    try { electiveGroups[groupId] = electiveGroupFrom(await request(`${ORIGIN}/public/DersPlan/_DersGrupSearch?grupId=${groupId}`), groupId); }
    catch (error) { failures.push({ scope: `elective:${groupId}`, error: String(error) }); }
  });
  let prerequisites = [];
  try {
    const branches = prerequisiteBranchesFrom(await request(`${ORIGIN}/public/GenelTanimlamalar/DersOnsartList`));
    const usedBranches = [...new Set(plans.flatMap((plan) => plan.courses.flatMap((course) => course.kind === "course" ? [course.code.split(/\s|\d/)[0]] : [])))];
    await mapLimit(usedBranches, 3, async (branch) => {
      if (!branches[branch]) return;
      try { prerequisites.push(...prerequisitesFrom(await request(`${ORIGIN}/public/GenelTanimlamalar/OnsartAra?DersBransKoduId=${branches[branch]}`))); }
      catch (error) { failures.push({ scope: `prerequisite:${branch}`, error: String(error) }); }
    });
  } catch (error) { failures.push({ scope: "prerequisite-branches", error: String(error) }); }
  if (!programs.length || !plans.length) throw new Error("Official curriculum response was temporarily empty; stored data was not replaced.");
  let previous = { plans: [] };
  try { previous = JSON.parse(await readFile(OUTPUT, "utf8")); } catch {}
  const old = new Map((previous.plans ?? []).map((item) => [planKey(item), item]));
  const imported = plans.filter((item) => !old.has(planKey(item))).length;
  const updated = plans.filter((item) => old.has(planKey(item)) && JSON.stringify({ ...old.get(planKey(item)), retrievedAt: null }) !== JSON.stringify({ ...item, retrievedAt: null })).length;
  const mergedFaculties = [...new Map([...(previous.faculties ?? []), ...faculties].map((item) => [item.id, item])).values()];
  const mergedPrograms = [...new Map([...(previous.programs ?? []), ...programs].map((item) => [offeringKey(item), item])).values()];
  const mergedPlans = [...new Map([...(previous.plans ?? []), ...plans].map((item) => [planKey(item), item])).values()];
  const output = { version: 1, sourceUrl: `${ORIGIN}/public/DersPlan/`, retrievedAt: new Date().toISOString(), faculties: mergedFaculties, programs: mergedPrograms, plans: mergedPlans, electiveGroups: { ...(previous.electiveGroups ?? {}), ...electiveGroups }, prerequisites: prerequisites.length ? prerequisites : (previous.prerequisites ?? []), failures };
  await writeFile(`${OUTPUT}.tmp`, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  await rename(`${OUTPUT}.tmp`, OUTPUT);
  console.log(JSON.stringify({ faculties: faculties.length, programs: programs.length, plans: plans.length, imported, updated, skipped: plans.length - imported - updated, failed: failures.length }, null, 2));
}

await main();
