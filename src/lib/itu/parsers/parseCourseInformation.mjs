import { load } from "cheerio";
import { courseInformationQuery } from "../courseInformation.mjs";

/** @param {string} html @param {string} code @returns {"available" | "missing" | "unknown"} */
export function parseCourseInformation(html, code) {
  const query = courseInformationQuery(code);
  if (!query) return "missing";
  const $ = load(html);
  const matches = $('a[href]').toArray().some(element => {
    const url = new URL($(element).attr('href') ?? '', 'https://obs.itu.edu.tr');
    if (url.origin !== 'https://obs.itu.edu.tr' || url.pathname !== '/public/DersKatalog/DersKatalogBilgiBransDersKodu') return false;
    if (url.searchParams.get('bransKodu') !== query.branch || url.searchParams.get('dersNo') !== query.number) return false;
    const rowCode = $(element).closest('tr').children('td').first().text();
    return rowCode.split(/\s*-\s*/).some(value => courseInformationQuery(value)?.key === query.key);
  });
  if (matches) return "available";
  // HTTP 500/error pages also occur for absent records; they are not proof of absence.
  const message = $('body').text().replace(/\s+/g, ' ').trim();
  if (/^(?:Ders bilgisi bulunamadı\.?|No course information found\.?)$/iu.test(message)) return "missing";
  return "unknown";
}
