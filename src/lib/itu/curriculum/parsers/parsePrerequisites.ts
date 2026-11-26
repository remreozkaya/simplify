import * as cheerio from "cheerio";

import { isValidCourseBranchCode, isValidCourseCode, normalizeCourseCode } from "@/lib/itu/courseCode.mjs";
import { ITU_EMPTY_CELL_VALUES } from "@/lib/itu/constants";
import { parsePrerequisiteExpression } from "@/lib/itu/curriculum/prerequisiteExpression";
import { firstNumericValue } from "@/lib/itu/curriculum/parsers/numbers";
import type { ItuCoursePrerequisite } from "@/lib/itu/curriculum/types";

function clean(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function parsePrerequisiteBranches(html: string) {
  const $ = cheerio.load(html);
  const options = $('select[name="DersBransKoduId"] option');
  if (!options.length) {
    throw new Error("İTÜ OBS returned an invalid prerequisite branch list.");
  }
  const branches: Record<string, number> = {};
  const unverifiedBranches = new Set<string>();
  let hasUnidentifiedBranch = false;
  options.each((_, option) => {
    const code = clean($(option).text()).toUpperCase();
    const rawId = $(option).attr("value")?.trim();
    if ((!rawId || rawId === "0" || rawId === "-1") &&
        /^(?:SELECT(?: (?:COURSE )?BRANCH CODE)?|(?:DERS BRANŞ KODU )?SEÇ[İI]N[İI]Z)?$/u.test(code)) return;
    if (!isValidCourseBranchCode(code)) {
      hasUnidentifiedBranch = true;
      return;
    }
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0 || (branches[code] && branches[code] !== id)) {
      unverifiedBranches.add(code);
      delete branches[code];
      return;
    }
    if (!unverifiedBranches.has(code)) branches[code] = id;
  });
  return { branches, unverifiedBranches, hasUnidentifiedBranch };
}

export function parsePrerequisites(html: string) {
  const $ = cheerio.load(html);
  const bodies = $("table tbody");
  if (!bodies.length) throw new Error("İTÜ OBS returned an invalid prerequisite table.");

  const records = new Map<string, ItuCoursePrerequisite>();
  let hasUnidentifiedCourse = false;
  bodies.children("tr").each((_, row) => {
    const cells = $(row).children("td");
    if (!cells.length) return;
    const anchors = $(cells[0])
      .find("a")
      .map((__, anchor) => $(anchor).text())
      .get();
    const codes = (anchors.length ? anchors : [$(cells[0]).text()]).map(normalizeCourseCode);
    const targets = codes.filter(isValidCourseCode);
    if (targets.length !== codes.length) hasUnidentifiedCourse = true;
    if (!targets.length) return;

    const expressionCell = $(cells[2]).clone();
    expressionCell.find("br").replaceWith(" ");
    const rawExpression = clean(
      expressionCell
        .contents()
        .map((__, node) => $(node).text())
        .get()
        .join(" "),
    );
    const rawCredits = clean($(cells[3]).text());
    const minimumCredits = firstNumericValue(rawCredits);
    let expression: ItuCoursePrerequisite["expression"];
    try {
      if (cells.length < 4 || (minimumCredits === undefined && !ITU_EMPTY_CELL_VALUES.has(rawCredits))) {
        expression = { kind: "unknown", raw: rawExpression || rawCredits };
      } else if (rawExpression) {
        expression = parsePrerequisiteExpression(rawExpression);
      }
    } catch {
      expression = { kind: "unknown", raw: rawExpression };
    }
    targets.forEach((courseCode) => {
      // A later valid row cannot resolve a separate unreadable row for the same course.
      if (records.get(courseCode)?.expression?.kind === "unknown") return;
      records.set(courseCode, {
        courseCode,
        ...(rawExpression ? { rawExpression } : {}),
        ...(expression ? { expression } : {}),
        ...(minimumCredits !== undefined ? { minimumCredits } : {}),
      });
    });
  });
  return { records: [...records.values()], hasUnidentifiedCourse };
}
