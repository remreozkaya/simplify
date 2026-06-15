import * as cheerio from "cheerio";

export type ParsedTable = {
  headers: string[];
  rows: string[][];
};

function normalizeText(value: string): string {
    return value.replace(/\s+/g, " ").trim();
}

export function parseCoursePage(html: string): parsedTable[] {
    const $ = cheerio.load(html);
    const tables: ParsedTable[] = [];

    $("table")

}