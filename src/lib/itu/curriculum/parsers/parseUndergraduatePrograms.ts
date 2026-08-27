import * as cheerio from "cheerio";

import type { ItuUndergraduateProgram } from "@/lib/itu/curriculum/types";

const PROGRAM_CODE_PATTERN = /^[A-Z0-9_]{2,20}_LS$/;

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function deriveMajorName(programName: string): string {
  return clean(programName)
    .replace(/\s+Lisans(?:\s+Programı)?$/iu, "")
    .replace(/\s*\((?:İngilizce|English|%\s*30\s*İngilizce|%\s*100\s*İngilizce)\)\s*$/iu, "")
    .trim();
}

export function parseUndergraduatePrograms(html: string): ItuUndergraduateProgram[] {
  const $ = cheerio.load(html);
  const programs: ItuUndergraduateProgram[] = [];
  let faculty: string | undefined;

  $("table tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length === 1 || $(cells[0]).attr("colspan")) {
      faculty = clean($(cells[0]).text()) || faculty;
      return;
    }
    if (cells.length < 2) return;
    const code = clean($(cells[0]).find("strong").first().text() || $(cells[0]).text())
      .replace(/\s+/g, "")
      .toUpperCase();
    const name = clean($(cells[1]).text());
    if (!PROGRAM_CODE_PATTERN.test(code) || !name) return;
    programs.push({ code, name, major: deriveMajorName(name), ...(faculty ? { faculty } : {}) });
  });

  return [...new Map(programs.map((program) => [program.code, program])).values()].sort(
    (first, second) =>
      first.name.localeCompare(second.name, "tr") || first.code.localeCompare(second.code),
  );
}
