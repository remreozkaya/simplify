import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseCurriculumDetail } from "@/lib/itu/curriculum/parsers/parseCurriculumDetail";
import { curriculumTotals, applyTranscriptImport } from "@/lib/curriculum/graduation";
import { emptyProgress } from "@/lib/curriculum/progress";
import { parseTranscriptMarkdown } from "@/lib/curriculum/transcript";
import { parseElectiveGroup } from "@/lib/itu/curriculum/parsers/parseElectiveGroup";
import type { ItuCurriculum } from "@/lib/itu/curriculum/types";

it.each([
  { requiredCode: "MAT 103E", requiredLanguage: "EN", completedCode: "MAT 103", completedLanguage: "TR", earnedEnglishCredit: 0, requiredEnglishCredit: 4 },
  { requiredCode: "MAT 103", requiredLanguage: "TR", completedCode: "MAT 103E", completedLanguage: "EN", earnedEnglishCredit: 4, requiredEnglishCredit: 0 },
])("uses the completed teaching language for $completedCode against $requiredCode", ({ requiredCode, requiredLanguage, completedCode, completedLanguage, earnedEnglishCredit, requiredEnglishCredit }) => {
  const curriculum: ItuCurriculum = {
    planId: 1, programCode: "QA_LS", title: "QA", planTitle: "QA",
    semesters: [{ semester: 1, items: [{ kind: "course", id: "math", semester: 1, code: requiredCode, title: "Math", language: requiredLanguage, requirementType: "compulsory", creditOptions: [4], ectsOptions: [6] }] }],
    prerequisites: {}, equivalenceRules: [], prerequisiteBranchesLoaded: [], prerequisiteDataAvailable: true, warnings: [], fetchedAt: "2026-10-08T00:00:00Z",
  };
  const parsed = parseTranscriptMarkdown(`| Completed English Courses |\n| 202610 | 1 | ${completedCode} | Math | 2 / 3 | AA |`);
  parsed.calculatedCourses[0].courseLanguage = completedLanguage;
  const progress = applyTranscriptImport(curriculum, emptyProgress(1), parsed).progress;
  expect(curriculumTotals(curriculum, progress)).toMatchObject({ earnedCredit: 4, earnedEnglishCredit, requiredEnglishCredit });
  expect(progress.courses[completedCode]).toMatchObject({ countedCredit: 2, transcriptCredit: 3, courseLanguage: completedLanguage });
});

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
