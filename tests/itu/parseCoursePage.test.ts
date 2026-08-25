import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { parseCoursePage } from "@/lib/itu/parsers/parseCoursePage";

const fixture = readFileSync(
  new URL("../fixtures/itu/course-page.html", import.meta.url),
  "utf8",
);

describe("parseCoursePage", () => {
  it("maps the OBS schedule table while preserving multi-value cell boundaries", () => {
    const rows = parseCoursePage(fixture);

    expect(rows).toHaveLength(6);
    expect(rows[0]).toMatchObject({
      crn: "23713",
      courseCode: "BLG 102E",
      instructor: "Ali Çakmak",
      building: "MED\nEEB",
      day: "Monday\nPerşembe",
      time: "13:00/14:59\n13.30 – 16.29",
      room: "123\nZ-16",
    });
  });

  it("supports Turkish headers", () => {
    const rows = parseCoursePage(`
      <table><thead><tr>
        <th>CRN</th><th>Ders Kodu</th><th>Ders Adı</th>
        <th>Öğretim Elemanı</th><th>Gün</th><th>Saat</th><th>Derslik</th>
      </tr></thead><tbody><tr>
        <td>101</td><td>MAT 101</td><td>Matematik I</td>
        <td>Örnek Hoca</td><td>Çarşamba</td><td>10:00/11:50</td><td>D201</td>
      </tr></tbody></table>
    `);

    expect(rows[0]).toMatchObject({
      courseCode: "MAT 101",
      courseTitle: "Matematik I",
      instructor: "Örnek Hoca",
      day: "Çarşamba",
    });
  });

  it("rejects an unrecognizable page instead of silently returning no courses", () => {
    expect(() => parseCoursePage("<html><p>maintenance</p></html>")).toThrow(
      /schedule table/i,
    );
  });
});
