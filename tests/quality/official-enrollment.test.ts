import { expect, it } from "vitest";
import sections from "../program-restrictions/fixtures/official-sections.json";
import { parseCoursePage } from "@/lib/itu/parsers/parseCoursePage";
import { normalizeCoursePage } from "@/lib/itu/normalizers/normalizeCoursePage";

it("retains the published enrolled count under the official Yazılan header", () => {
  // Attributed OBS extract retrieved 2026-10-05: CRN 12476 has capacity 95,
  // Yazılan 90. These literal values are read from its source HTML.
  const source = sections[0];
  const catalog = normalizeCoursePage(parseCoursePage(source.html),3,"BLG",`${source.retrievedAt}T00:00:00.000Z`,source.semester);
  const section = catalog.courses.find(x=>x.code==="BLG 231E")?.sections.find(x=>x.crn==="12476");
  expect(section?.capacity).toBe(95);
  expect(section?.enrolled).toBe(90);
});
