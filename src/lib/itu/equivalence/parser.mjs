import * as cheerio from "cheerio";

import { isValidCourseCode, normalizeCourseCode } from "../courseCode.mjs";

function clean(value) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function leadingCourseCode(value, knownCourseCodes = []) {
  const cleaned = clean(value);
  const compact = cleaned.replace(/^([A-ZÇĞİÖŞÜ]{2,8})\s+/u, "$1");
  const known = knownCourseCodes
    .map((code) => ({ normalized: normalizeCourseCode(code), compact: normalizeCourseCode(code).replace(/\s+/g, "") }))
    .filter((course) => compact.startsWith(course.compact))
    .sort((first, second) => second.compact.length - first.compact.length)[0];
  if (known) return { normalized: known.normalized, official: known.normalized };
  const match = cleaned.match(/^([A-ZÇĞİÖŞÜ]{2,8})\s*(\d{2,5}[A-Z]{0,3})(?=\s|[A-ZÇĞİÖŞÜ]|$)/u);
  if (!match) return null;
  const official = `${match[1]} ${match[2]}`;
  return isValidCourseCode(official) ? { normalized: normalizeCourseCode(official), official } : null;
}

function cellLines($, cell) {
  const html = $(cell).html() ?? "";
  return html
    .split(/<br\s*\/?\s*>/i)
    .map((fragment) => clean(cheerio.load(fragment).text()))
    .filter(Boolean);
}

/**
 * Parse the official "Plandaki Ders / Denk Dersler" response. Each listed
 * equivalent is an OR alternative; no reverse or transitive rule is created.
 */
export function parseOfficialEquivalenceTable(html, knownTargetCourseCodes = []) {
  const $ = cheerio.load(html);
  const records = [];
  const failures = [];
  $("tbody tr").each((rowIndex, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) return;
    const target = leadingCourseCode($(cells[0]).text(), knownTargetCourseCodes);
    if (!target) {
      failures.push({ row: rowIndex + 1, reason: "Target course code could not be parsed.", raw: clean($(cells[0]).text()) });
      return;
    }
    const alternatives = cellLines($, cells[1]).map((line) => leadingCourseCode(line)).filter(Boolean);
    if (!alternatives.length) {
      failures.push({ row: rowIndex + 1, reason: "No valid equivalent course code was found.", raw: clean($(cells[1]).text()) });
      return;
    }
    records.push({ target, alternatives });
  });
  const consolidated = new Map();
  records.forEach((record) => {
    const existing = consolidated.get(record.target.normalized);
    if (!existing) {
      consolidated.set(record.target.normalized, record);
      return;
    }
    const alternatives = new Map([...existing.alternatives, ...record.alternatives].map((alternative) => [alternative.normalized, alternative]));
    consolidated.set(record.target.normalized, { ...existing, alternatives: [...alternatives.values()] });
  });
  return { records: [...consolidated.values()], failures };
}

export function parsePlanCourseCodes(html) {
  const $ = cheerio.load(html);
  const codes = [];
  $("table.datalist tbody tr").each((_, row) => {
    const first = clean($(row).find("td").first().find("a").first().text() || $(row).find("td").first().text());
    if (/^(?:Dersler|Courses)$/i.test(first)) return;
    const code = leadingCourseCode(first);
    if (code) codes.push(code.normalized);
  });
  return [...new Set(codes)];
}
