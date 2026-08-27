import * as cheerio from "cheerio";

import type { ItuCurriculumPlan } from "@/lib/itu/curriculum/types";

export function parseCurriculumPlans(
  html: string,
  programCode: string,
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
      isCurrent: /(?:sonrası|after|ve sonrası|and after)/i.test(title),
    });
  });

  return [...new Map(plans.map((plan) => [plan.id, plan])).values()].sort(
    (first, second) => Number(second.isCurrent) - Number(first.isCurrent) || second.id - first.id,
  );
}
