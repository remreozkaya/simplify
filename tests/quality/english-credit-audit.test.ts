import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseCurriculumDetail } from "@/lib/itu/curriculum/parsers/parseCurriculumDetail";
import { curriculumTotals, applyTranscriptImport } from "@/lib/curriculum/graduation";
import { emptyProgress } from "@/lib/curriculum/progress";
import { parseTranscriptMarkdown } from "@/lib/curriculum/transcript";
import { parseElectiveGroup } from "@/lib/itu/curriculum/parsers/parseElectiveGroup";

it("counts source English language credits in the graduation audit", () => {
  const html = readFileSync(new URL("../fixtures/itu/curriculum/detail.html", import.meta.url),"utf8");
  const curriculum = {...parseCurriculumDetail(html,1562,"BLGE_LS"),prerequisites:{},equivalenceRules:[],prerequisiteBranchesLoaded:[],prerequisiteDataAvailable:true,warnings:[],fetchedAt:"2026-10-05T00:00:00Z"};
  const parsed = parseTranscriptMarkdown("| Completed English Courses |\n| 202610 | 1 | MAT 103E | Mathematics I | 4 | AA |");
  const progress = applyTranscriptImport(curriculum,emptyProgress(1562),parsed).progress;
  // Source fixture marks Mathematics I (4) and Programming (4.5) English.
  expect(curriculumTotals(curriculum,progress)).toMatchObject({earnedEnglishCredit:4,requiredEnglishCredit:8.5});
});

it("normalizes English and Turkish curriculum language labels while preserving unknown labels", () => {
  const html = readFileSync(new URL("../fixtures/itu/curriculum/detail.html", import.meta.url),"utf8");
  for (const [source,expected] of [["İngilizce","EN"],["English","EN"],["Türkçe","TR"],["Turkish","TR"],["Unconfirmed","Unconfirmed"]]) {
    const parsed = parseCurriculumDetail(html.replaceAll("<td>English</td>",`<td>${source}</td>`),1562,"BLGE_LS");
    expect(parsed.semesters[0].items[0]).toMatchObject({language:expected});
  }
});

it("normalizes elective pool languages as well as compulsory course languages", () => {
  const html = readFileSync(new URL("../fixtures/itu/curriculum/elective.html", import.meta.url),"utf8");
  expect(parseElectiveGroup(html).courses.map(course=>course.language)).toEqual(["EN","EN"]);
});
