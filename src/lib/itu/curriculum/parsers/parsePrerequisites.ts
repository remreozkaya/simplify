import * as cheerio from "cheerio";

import { normalizeCourseCode, parsePrerequisiteExpression } from "@/lib/itu/curriculum/prerequisiteExpression";
import { firstNumericValue } from "@/lib/itu/curriculum/parsers/numbers";
import type { ItuCoursePrerequisite } from "@/lib/itu/curriculum/types";

function clean(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function parsePrerequisiteBranches(html: string): Record<string, number> {
  const $ = cheerio.load(html);
  const branches: Record<string, number> = {};
  $('select[name="DersBransKoduId"] option').each((_, option) => {
    const code = clean($(option).text()).toUpperCase();
    const id = Number($(option).attr("value"));
    if (/^[A-ZÇĞİÖŞÜ]{2,8}$/u.test(code) && Number.isInteger(id) && id > 0) {
      branches[code] = id;
    }
  });
  return branches;
}

export function parsePrerequisites(html: string): ItuCoursePrerequisite[] {
  const $ = cheerio.load(html);
  const prerequisites: ItuCoursePrerequisite[] = [];
  $("table tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 4) return;
    const targets = $(cells[0])
      .find("a")
      .map((__, anchor) => normalizeCourseCode(clean($(anchor).text())))
      .get()
      .filter((code) => /^[A-ZÇĞİÖŞÜ]{2,8}\s\d{2,5}[A-Z]{0,3}$/u.test(code));
    const expressionCell = $(cells[2]).clone();
    expressionCell.find("br").replaceWith(" ");
    const rawExpression = clean(
      expressionCell
        .contents()
        .map((__, node) => $(node).text())
        .get()
        .join(" "),
    );
    const minimumCredits = firstNumericValue($(cells[3]).text());
    targets.forEach((courseCode) => {
      prerequisites.push({
        courseCode,
        ...(rawExpression
          ? {
              rawExpression,
              expression: parsePrerequisiteExpression(rawExpression),
            }
          : {}),
        ...(minimumCredits !== undefined ? { minimumCredits } : {}),
      });
    });
  });
  return prerequisites;
}
