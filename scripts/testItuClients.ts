import { writeFile } from "node:fs/promises";

import { fetchBranchesPage } from "../src/lib/itu/client/fetchBranchesPage";
import { fetchCoursePage } from "../src/lib/itu/client/fetchCoursePage";

async function main() {
  console.log("Fetching branches page...");

  const branchesHtml = await fetchBranchesPage();

  console.log({
    branchesHtmlLength: branchesHtml.length,
    startsWithHtml:
      branchesHtml.trimStart().startsWith("<"),
  });

  await writeFile(
    "branches-live.html",
    branchesHtml,
    "utf8",
  );

  console.log("Fetching course page for branch ID 310...");

  const courseHtml = await fetchCoursePage(310);

  console.log({
    courseHtmlLength: courseHtml.length,
    startsWithHtml:
      courseHtml.trimStart().startsWith("<"),
  });

  await writeFile(
    "course-310-live.html",
    courseHtml,
    "utf8",
  );

  console.log(
    "Saved branches-live.html and course-310-live.html.",
  );
}

main().catch((error: unknown) => {
  console.error("Client smoke test failed:", error);
  process.exitCode = 1;
});