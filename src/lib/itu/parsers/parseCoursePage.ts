import { load, type Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";

import { ITU_COURSE_TABLE_HEADER_ALIASES } from "@/lib/itu/constants";
import { ituCourseTableRowSchema } from "@/lib/itu/schemas";
import type { ItuCourseTableRow } from "@/lib/itu/types";

type RowField = keyof ItuCourseTableRow;
type ColumnMap = Partial<Record<RowField, number>>;

const REQUIRED_FIELDS: RowField[] = [
  "crn",
  "courseCode",
  "courseTitle",
];

function normalizeHeader(value: string): string {
  return value
    .replace(/[\u00a0*:?]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getCellText(cell: Cheerio<AnyNode>): string {
  const clone = cell.clone();

  clone.find("br").replaceWith("\n");
  clone.find("div, p, li").prepend("\n").append("\n");

  return clone
    .text()
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function findFieldForHeader(header: string): RowField | null {
  const normalizedHeader = normalizeHeader(header);

  for (const [field, aliases] of Object.entries(
    ITU_COURSE_TABLE_HEADER_ALIASES,
  ) as [RowField, readonly string[]][]) {
    if (
      aliases.some(
        (alias) =>
          normalizedHeader === alias ||
          normalizedHeader.startsWith(`${alias} `),
      )
    ) {
      return field;
    }
  }

  return null;
}

function createColumnMap(headers: string[]): ColumnMap {
  const columnMap: ColumnMap = {};

  headers.forEach((header, index) => {
    const field = findFieldForHeader(header);

    if (field && columnMap[field] === undefined) {
      columnMap[field] = index;
    }
  });

  return columnMap;
}

function hasRequiredColumns(columnMap: ColumnMap): boolean {
  return REQUIRED_FIELDS.every(
    (field) => columnMap[field] !== undefined,
  );
}

export function parseCoursePage(html: string): ItuCourseTableRow[] {
  const $ = load(html);
  let foundScheduleTable = false;
  const parsedRows: ItuCourseTableRow[] = [];

  $("table").each((_, tableElement) => {
    const table = $(tableElement);
    const headerRow = table
      .find("thead tr")
      .first()
      .add(table.find("tr").has("th").first())
      .first();

    const headers = headerRow
      .find("th, td")
      .toArray()
      .map((cell) => getCellText($(cell)));

    const columnMap = createColumnMap(headers);

    if (!hasRequiredColumns(columnMap)) {
      return;
    }

    foundScheduleTable = true;

    const bodyRows = table.find("tbody tr").length
      ? table.find("tbody tr")
      : table.find("tr").slice(1);

    bodyRows.each((__, rowElement) => {
      const cells = $(rowElement).find("td").toArray();

      if (cells.length === 0) {
        return;
      }

      const read = (field: RowField): string | undefined => {
        const index = columnMap[field];

        return index === undefined || !cells[index]
          ? undefined
          : getCellText($(cells[index]));
      };

      const result = ituCourseTableRowSchema.safeParse({
        crn: read("crn"),
        courseCode: read("courseCode"),
        courseTitle: read("courseTitle"),
        teachingMethod: read("teachingMethod"),
        instructor: read("instructor"),
        building: read("building"),
        day: read("day"),
        time: read("time"),
        room: read("room"),
        capacity: read("capacity"),
        enrolled: read("enrolled"),
        reserved: read("reserved"),
        majorRestriction: read("majorRestriction"),
        classRestriction: read("classRestriction"),
        prerequisites: read("prerequisites"),
      });

      if (result.success) {
        parsedRows.push(result.data);
      }
    });
  });

  if (!foundScheduleTable) {
    throw new Error("No recognizable İTÜ course schedule table was found.");
  }

  return parsedRows;
}
