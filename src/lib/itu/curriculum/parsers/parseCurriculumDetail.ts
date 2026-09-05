import * as cheerio from "cheerio";

import { normalizeCourseCode } from "@/lib/itu/curriculum/prerequisiteExpression";
import { firstNumericValue, parseNumericOptions } from "@/lib/itu/curriculum/parsers/numbers";
import type {
  ItuCurriculumItem,
  ParsedCurriculum,
} from "@/lib/itu/curriculum/types";

function clean(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function parseCurriculumDetail(
  html: string,
  planId: number,
  programCode: string,
): ParsedCurriculum {
  const $ = cheerio.load(html);
  const semesters: ParsedCurriculum["semesters"] = [];

  $("table.datalist").each((_, table) => {
    const heading = clean(
      $(table).find("h2").first().text() || $(table).prevAll("h2").first().text(),
    );
    const semesterMatch = heading.match(/(\d+)\s*\.?\s*(?:yarıyıl|yariyil|semester)/i);
    if (!semesterMatch && $(table).attr("id") === "dersPlanProgramList") return;
    const semester = semesterMatch ? Number(semesterMatch[1]) : 1;
    const items: ItuCurriculumItem[] = [];

    $(table)
      .find("tbody tr")
      .each((rowIndex, row) => {
        const cells = $(row).find("td");
        if (cells.length < 6) return;
        const firstCell = $(cells[0]);
        const electiveLink = firstCell.find('a[href*="_DersGrupSearch"]').first();
        const groupMatch = electiveLink.attr("href")?.match(/[?&]grupId=(\d+)/i);
        const title = clean($(cells[1]).text());
        if (!title) return;
        const creditOptions = parseNumericOptions($(cells[4]).text());
        const ectsOptions = parseNumericOptions($(cells[5]).text());
        const category = clean($(cells[9]).text()) || undefined;

        if (electiveLink.length || /^(?:dersler|courses)$/i.test(clean(firstCell.text()))) {
          items.push({
            kind: "elective-slot",
            id: `elective:${semester}:${groupMatch?.[1] ?? "unknown"}:${rowIndex}`,
            semester,
            title,
            creditOptions,
            ectsOptions,
            ...(category ? { category } : {}),
            ...(groupMatch ? { groupId: Number(groupMatch[1]) } : {}),
            courses: [],
          });
          return;
        }

        const rawCode = clean(firstCell.find("a").first().text() || firstCell.text());
        if (!rawCode) return;
        const code = normalizeCourseCode(rawCode);
        const requirement = clean($(cells[3]).text()).toLocaleUpperCase("tr-TR");
        const language = clean($(cells[2]).text()) || undefined;
        const theoryHours = firstNumericValue($(cells[6]).text());
        const tutorialHours = firstNumericValue($(cells[7]).text());
        const labHours = firstNumericValue($(cells[8]).text());
        items.push({
          kind: "course",
          id: `course:${semester}:${code.replace(/\s+/g, "-")}:${rowIndex}`,
          semester,
          code,
          title,
          ...(language ? { language } : {}),
          requirementType: /^(?:S|E|SEÇMELİ|SECIMLIK|ELECTIVE)$/u.test(requirement)
            ? "elective"
            : "compulsory",
          creditOptions,
          ectsOptions,
          ...(theoryHours !== undefined ? { theoryHours } : {}),
          ...(tutorialHours !== undefined ? { tutorialHours } : {}),
          ...(labHours !== undefined ? { labHours } : {}),
          ...(category ? { category } : {}),
        });
      });

    semesters.push({ semester, items });
  });

  const bodyText = clean($(".content-area").text());
  const totalCreditMatch = bodyText.match(/(?:Toplam Kredi|Total Credit)\s*:?\s*([\d.,]+)/i);
  const totalEctsMatch = bodyText.match(/(?:Toplam AKTS|Total ECTS)\s*:?\s*([\d.,]+)/i);
  const notes = $(".content-area p")
    .map((_, element) => clean($(element).text()))
    .get()
    .filter((text) => text && !/(?:Toplam Kredi|Total Credit)/i.test(text));
  const associatedPrimaryProgramCodes = $("#dersPlanProgramList tbody tr")
    .map((_, row) => clean($(row).find("td").first().text()))
    .get()
    .filter(Boolean);
  const planTitle = clean($(".content-area h2").first().text()) || `Plan ${planId}`;

  return {
    planId,
    programCode,
    title: clean($(".content-area h1").first().text()) || programCode,
    planTitle,
    semesters: semesters.sort((a, b) => a.semester - b.semester),
    ...(totalCreditMatch ? { totalCredit: firstNumericValue(totalCreditMatch[1]) } : {}),
    ...(totalEctsMatch ? { totalEcts: firstNumericValue(totalEctsMatch[1]) } : {}),
    ...(notes.length ? { note: notes.join(" ") } : {}),
    ...(associatedPrimaryProgramCodes.length ? { associatedPrimaryProgramCodes } : {}),
    sourceUrl: `https://obs.itu.edu.tr/public/DersPlan/DersPlanDetay/${planId}`,
    ...(planTitle.match(/\d{4}-\d{4}[^]*$/)?.[0] ? { validityPeriod: planTitle.match(/\d{4}-\d{4}[^]*$/)?.[0].trim() } : {}),
  };
}
