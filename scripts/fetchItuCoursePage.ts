import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ITU_COURSE_URL =
  "https://obs.itu.edu.tr/public/DersProgram/DersProgramSearch";

const PROGRAM_LEVEL = "LS";
const COURSE_BRANCH_ID = 3;

// Fetch Course Page
async function fetchItuCoursePage(): Promise<string> {
    const url = new URL(ITU_COURSE_URL);
    
    // Search for the exact parameters
    url.searchParams.set(
        "programSeviyeTipiAnahtari",
        PROGRAM_LEVEL,
    );
    url.searchParams.set(
        "dersBransKoduId",
        COURSE_BRANCH_ID.toString(),
    )

    // temporary console log
    console.log(`Requesting: ${url.toString()}`);

    // Fetch with the correct method and headers
    const response = await fetch(url, {
        method: "GET",
        headers: {
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
            "User-Agent": "Mozilla/5.0",
        },
    });

    // control if response is ok
    if (!response.ok) {
        throw new Error(
            `İTÜ request failed: ${response.status} ${response.statusText}`,
        );
    }

    const html = await response.text();

    // if empty
    if (!html.trim()) {
        throw new Error("Empty response.");
    }

    return html;
}

async function saveHtmlToTempFile(html:string): Promise<string> {
    // Find the directory
    const outputDirectory = path.join(
        process.cwd(),
        "temp",
        "itu",
    );
    // Create the file
    const outputFile = path.join(
        outputDirectory,
        `course-code-${COURSE_BRANCH_ID}.html`,
    );

    await mkdir(outputDirectory, {
        recursive: true,
    });

    await writeFile(outputFile, html, {
        encoding: "utf-8",
    });
    return outputFile;
}

async function main() {
    try {
        const html = await fetchItuCoursePage();
        const outputFile = await saveHtmlToTempFile(html);
        // temporaray console log
        console.log(`Received ${html.length} characters.`);
        console.log(`Response saved to: ${outputFile}`);
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error(`Failed to fetch İTÜ data: ${error.message}`);
        }
        else {
            console.error("Failed to fetch İTÜ data:", error);
        }
        process.exitCode = 1;
    }
}

void main();