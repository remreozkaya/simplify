import * as cheerio from "cheerio";

import { normalizeCourseCode } from "@/lib/itu/curriculum/prerequisiteExpression";
import { firstNumericValue, parseNumericOptions } from "@/lib/itu/curriculum/parsers/numbers";
import type { ItuElectiveCourse } from "@/lib/itu/curriculum/types";

export type ParsedElectiveGroup = { title: string; courses: ItuElectiveCourse[] };

function clean(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function parseElectiveGroup(html: string): ParsedElectiveGroup {
  const $ = cheerio.load(html);
  const courses: ItuElectiveCourse[] = [];
  $("table.datalist tbody tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 4) return;
    const code = normalizeCourseCode(clean($(cells[0]).find("a").first().text()));
    if (!/^[A-ZÇĞİÖŞÜ]{2,8}\s\d{2,5}[A-Z]{0,3}$/u.test(code)) return;
    const whole = clean($(cells[0]).text());
    const title = clean(whole.slice(whole.indexOf(code) + code.length));
    if (!title) return;
    courses.push({
      code,
      title,
      ...(clean($(cells[1]).text()) ? { language: clean($(cells[1]).text()) } : {}),
      creditOptions: parseNumericOptions($(cells[2]).text()),
      ectsOptions: parseNumericOptions($(cells[3]).text()),
      ...(firstNumericValue($(cells[4]).text()) !== undefined
        ? { theoryHours: firstNumericValue($(cells[4]).text()) }
        : {}),
      ...(firstNumericValue($(cells[5]).text()) !== undefined
        ? { tutorialHours: firstNumericValue($(cells[5]).text()) }
        : {}),
      ...(firstNumericValue($(cells[6]).text()) !== undefined
        ? { labHours: firstNumericValue($(cells[6]).text()) }
        : {}),
    });
  });
  return {
    title: clean($(".content-area h3").first().text()) || "Elective group",
    courses: [...new Map(courses.map((course) => [course.code, course])).values()].sort(
      (first, second) => first.code.localeCompare(second.code),
    ),
  };
}
