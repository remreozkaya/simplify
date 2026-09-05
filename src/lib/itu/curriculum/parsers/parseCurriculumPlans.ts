import * as cheerio from "cheerio";

import type { ItuCurriculumPlan, ItuPlanType } from "@/lib/itu/curriculum/types";

export function parseCurriculumPlans(
  html: string,
  programCode: string,
  planType: ItuPlanType = "undergraduate",
): ItuCurriculumPlan[] {
  const $ = cheerio.load(html);
  const plans: ItuCurriculumPlan[] = [];

  $("table tbody tr").each((_, row) => {
    const link = $(row).find('a[href*="/DersPlanDetay/"]').first();
    const match = link.attr("href")?.match(/\/DersPlanDetay\/(\d+)/);
    const cells = $(row).find("td");
    const title = cells.last().text().replace(/\s+/g, " ").trim();
    if (!match || !title) return;
    plans.push({
      id: Number(match[1]),
      programCode,
      title,
      nameTr: title,
      isCurrent: /(?:sonrası|after|ve sonrası|and after)/i.test(title),
      planType,
      validityPeriod: title.match(/\d{4}-\d{4}[^]*$/)?.[0]?.trim(),
      sourceUrl: `https://obs.itu.edu.tr/public/DersPlan/DersPlanDetay/${match[1]}`,
    });
  });

  return [...new Map(plans.map((plan) => [plan.id, plan])).values()].sort(
    (first, second) => Number(second.isCurrent) - Number(first.isCurrent) || second.id - first.id,
  );
}
