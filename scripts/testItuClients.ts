import { fetchBranchesPage } from "../src/lib/itu/client/fetchBranchesPage";
import { fetchCoursePage } from "../src/lib/itu/client/fetchCoursePage";
import { parseUndergraduateBranches } from "../src/lib/itu/parsers/parseUndergraduateBranches";
import { normalizeCoursePage } from "../src/lib/itu/normalizers/normalizeCoursePage";
import { parseCoursePage } from "../src/lib/itu/parsers/parseCoursePage";

async function main() {
  console.log("Fetching branches page...");

  const branchesPayload = await fetchBranchesPage();
  const branches = parseUndergraduateBranches(branchesPayload);

  console.log({
    branchCount: branches.length,
  });

  const branch = branches.find((candidate) => candidate.code === "BLG");

  if (!branch) {
    throw new Error("BLG was not present in the live branch response.");
  }

  console.log(`Fetching course page for ${branch.code} (${branch.id})...`);

  const courseHtml = await fetchCoursePage(branch.id);
  const rows = parseCoursePage(courseHtml);
  const catalog = normalizeCoursePage(rows, branch.id, branch.code);
  const multiMeetingSections = catalog.courses.flatMap((course) =>
    course.sections.filter((section) => section.meetings.length > 1),
  );

  console.log({
    courseHtmlLength: courseHtml.length,
    startsWithHtml:
      courseHtml.trimStart().startsWith("<"),
    parsedRows: rows.length,
    scheduledCourses: catalog.courses.length,
    multiMeetingSections: multiMeetingSections.length,
  });

  console.log("Live İTÜ OBS smoke test passed.");
}

main().catch((error: unknown) => {
  console.error("Client smoke test failed:", error);
  process.exitCode = 1;
});
