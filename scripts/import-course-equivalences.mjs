import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeCourseCode } from "../src/lib/itu/courseCode.mjs";
import { mergeVerifiedScope } from "../src/lib/itu/equivalence/importState.mjs";
import { parseOfficialEquivalenceTable, parsePlanCourseCodes } from "../src/lib/itu/equivalence/parser.mjs";

const OBS_ORIGIN = "https://obs.itu.edu.tr";
const SOURCE_PATH = "/public/GenelTanimlamalar/DersPlanDenklikleri";
const SEARCH_PATH = "/public/GenelTanimlamalar/DersDenklikAra";
const BRANCHES_PATH = "/public/GenelTanimlamalar/GetDersBransKodlariByPlanId";
const PLAN_DETAIL_PATH = "/public/DersPlan/DersPlanDetay/";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const targetsPath = resolve(projectRoot, "src/data/itu/equivalence-targets.json");
const storePath = resolve(projectRoot, "src/data/itu/equivalences.json");
const requestCache = new Map();
let lastRequestAt = 0;

function option(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function throttledFetch(url, init = {}) {
  const cacheKey = `${init.method ?? "GET"}:${url}:${String(init.body ?? "")}`;
  if (requestCache.has(cacheKey)) return requestCache.get(cacheKey);
  const pending = (async () => {
    const wait = Math.max(0, 350 - (Date.now() - lastRequestAt));
    if (wait) await delay(wait);
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        lastRequestAt = Date.now();
        const response = await fetch(url, {
          ...init,
          headers: { "user-agent": "simplify-itu-equivalence-import/1.0", ...(init.headers ?? {}) },
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
      } catch (error) {
        lastError = error;
        if (attempt < 2) await delay(500 * (2 ** attempt));
      }
    }
    throw lastError;
  })();
  requestCache.set(cacheKey, pending);
  return pending;
}

async function postJson(pathname, values) {
  const body = new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)]));
  const text = await throttledFetch(new URL(pathname, OBS_ORIGIN), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body,
  });
  return JSON.parse(text);
}

function sourceUrl(target, branchId) {
  const url = new URL(SEARCH_PATH, OBS_ORIGIN);
  url.search = new URLSearchParams({
    ProgramId: String(target.programId),
    PlanTipiId: String(target.planTypeId),
    PlanId: String(target.planId),
    DersBransKoduId: String(branchId),
  }).toString();
  return url.toString();
}

function ruleId(target, targetCode) {
  const key = `${target.programCode}:${target.planId}:${normalizeCourseCode(targetCode)}`;
  return `itu-eq-${createHash("sha256").update(key).digest("hex").slice(0, 20)}`;
}

function toRule(target, branch, record, retrievedAt) {
  const alternatives = record.alternatives.map((alternative) => ({
    allOf: [alternative.normalized],
    officialCourseCodes: [alternative.official],
  }));
  const simple = alternatives.length === 1 ? record.alternatives[0] : undefined;
  return {
    id: ruleId(target, record.target.normalized),
    curriculumId: `${target.programCode}:${target.planId}`,
    programId: target.programId,
    programCode: target.programCode,
    planType: target.planType,
    planTypeId: target.planTypeId,
    planId: target.planId,
    branchCode: branch.dersBransKodu,
    targetCourseCode: record.target.normalized,
    targetCourseCodeOfficial: record.target.official,
    ...(simple ? {
      equivalentCourseCode: simple.normalized,
      equivalentCourseCodeOfficial: simple.official,
    } : {}),
    alternatives,
    relationshipType: "directional",
    sourceUrl: sourceUrl(target, branch.objectId),
    sourceLabel: "İTÜ OBS Course Equivalence",
    retrievedAt,
    verified: true,
    active: true,
  };
}

function inspectStore(store) {
  const plan = option("plan");
  const target = option("target");
  const equivalent = option("equivalent");
  const includeUnverified = process.argv.includes("--unverified");
  const normalizedTarget = target ? normalizeCourseCode(target) : null;
  const normalizedEquivalent = equivalent ? normalizeCourseCode(equivalent) : null;
  const rows = store.rules.filter((rule) =>
    (!plan || String(rule.planId) === plan) &&
    (!normalizedTarget || rule.targetCourseCode === normalizedTarget) &&
    (!normalizedEquivalent || rule.alternatives.some((alternative) => alternative.allOf.includes(normalizedEquivalent))) &&
    (includeUnverified || rule.verified),
  );
  console.table(rows.map((rule) => ({
    id: rule.id,
    plan: `${rule.programCode}/${rule.planId}`,
    target: rule.targetCourseCode,
    alternatives: rule.alternatives.map((alternative) => alternative.allOf.join(" + ")).join(" OR "),
    verified: rule.verified,
    active: rule.active,
    retrievedAt: rule.retrievedAt,
    sourceUrl: rule.sourceUrl,
  })));
  if (store.failures.length) console.table(store.failures);
}

async function main() {
  const store = JSON.parse(await readFile(storePath, "utf8"));
  if (process.argv.includes("--report")) {
    inspectStore(store);
    return;
  }
  const allTargets = JSON.parse(await readFile(targetsPath, "utf8"));
  const onlyPlan = option("plan");
  const targets = allTargets.filter((target) => !onlyPlan || String(target.planId) === onlyPlan);
  const nextRules = new Map(store.rules.map((rule) => [rule.id, rule]));
  const failures = [];
  let imported = 0;
  let stale = 0;

  for (const target of targets) {
    let branches, planCourseCodes;
    try {
      planCourseCodes = parsePlanCourseCodes(await throttledFetch(new URL(`${PLAN_DETAIL_PATH}${target.planId}`, OBS_ORIGIN)));
      if (!planCourseCodes.length) throw new Error("No curriculum course codes could be enumerated from OBS.");
      branches = await postJson(BRANCHES_PATH, { planId: target.planId });
      if (!Array.isArray(branches)) throw new Error("OBS returned an invalid branch list.");
    } catch (error) {
      failures.push({ programCode: target.programCode, planId: target.planId, sourceUrl: new URL(SOURCE_PATH, OBS_ORIGIN).toString(), attemptedAt: new Date().toISOString(), reason: String(error) });
      continue;
    }
    for (const branch of branches) {
      const retrievedAt = new Date().toISOString();
      const url = sourceUrl(target, branch.objectId);
      try {
        const html = await throttledFetch(url);
        if (!/<table\b/i.test(html) || !/(Plandaki Ders|Course in Plan)/i.test(html)) throw new Error("OBS returned an unrecognized or empty response.");
        const parsed = parseOfficialEquivalenceTable(html, planCourseCodes);
        if (parsed.failures.length) throw new Error(`${parsed.failures.length} row(s) could not be validated.`);
        const incoming = parsed.records.map((record) => toRule(target, branch, record, retrievedAt));
        const merged = mergeVerifiedScope([...nextRules.values()], incoming, { programCode: target.programCode, planId: target.planId, branchCode: branch.dersBransKodu }, retrievedAt);
        nextRules.clear();
        merged.rules.forEach((rule) => nextRules.set(rule.id, rule));
        stale += merged.stale;
        imported += incoming.length;
      } catch (error) {
        failures.push({ programCode: target.programCode, planId: target.planId, branchCode: branch.dersBransKodu, sourceUrl: url, attemptedAt: retrievedAt, reason: String(error) });
      }
    }
  }

  const nextStore = {
    version: 1,
    generatedAt: new Date().toISOString(),
    rules: [...nextRules.values()].sort((a, b) => a.planId - b.planId || a.targetCourseCode.localeCompare(b.targetCourseCode)),
    failures,
  };
  await writeFile(storePath, `${JSON.stringify(nextStore, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ targets: targets.length, imported, stale, failures: failures.length, totalRules: nextStore.rules.length }, null, 2));
  if (failures.length) process.exitCode = 1;
}

await main();
