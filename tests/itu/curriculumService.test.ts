import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";

vi.mock("@/lib/itu/curriculum/client/fetchCurriculumDetail", () => ({ fetchCurriculumDetailPage: vi.fn() }));
vi.mock("@/lib/itu/curriculum/client/fetchElectiveGroup", () => ({ fetchElectiveGroupPage: vi.fn() }));
vi.mock("@/lib/itu/curriculum/client/fetchPrerequisites", () => ({ fetchPrerequisiteBranchesPage: vi.fn(), fetchPrerequisitesPage: vi.fn() }));

import { fetchCurriculumDetailPage } from "@/lib/itu/curriculum/client/fetchCurriculumDetail";
import { fetchElectiveGroupPage } from "@/lib/itu/curriculum/client/fetchElectiveGroup";
import { fetchPrerequisiteBranchesPage } from "@/lib/itu/curriculum/client/fetchPrerequisites";
import { getCurriculum } from "@/lib/itu/curriculum/services/getCurriculum";
import { applyTranscriptImport, curriculumTotals, progressForRequirement } from "@/lib/curriculum/graduation";
import { emptyProgress } from "@/lib/curriculum/progress";
import { parseTranscriptMarkdown } from "@/lib/curriculum/transcript";

const fixture = (name: string) => readFileSync(join(process.cwd(), "tests/fixtures/itu/curriculum", name), "utf8");

it("restores ISP 101 from official group 9127 and counts it for Computer Engineering plan 1562", async () => {
  vi.mocked(fetchCurriculumDetailPage).mockResolvedValue(fixture("detail.html").replaceAll("11778", "9127"));
  vi.mocked(fetchElectiveGroupPage).mockResolvedValue(fixture("elective-incomplete-codes.html"));
  vi.mocked(fetchPrerequisiteBranchesPage).mockRejectedValue(new Error("Prerequisites unavailable"));
  const curriculum = await getCurriculum(1562, "BLGE_LS");
  const slot = curriculum.semesters.flatMap((semester) => semester.items).find((item) => item.kind === "elective-slot" && item.groupId === 9127)!;
  const parsed = parseTranscriptMarkdown("Completed English Courses\n202520\t20527\tISP101\tİspanyolca I\t3\tAA");
  const result = applyTranscriptImport(curriculum, emptyProgress(1562), parsed);
  expect(result.unmatched).toEqual([]);
  expect(progressForRequirement(slot, result.progress, curriculum)).toMatchObject({ code: "ISP 101", course: { state: "passed", grade: "AA" } });
  expect(curriculumTotals(curriculum, result.progress)).toMatchObject({ earnedCourses: 1, earnedCredit: 3 });
});
