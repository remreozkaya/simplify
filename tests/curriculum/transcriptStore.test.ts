import { describe, expect, it } from "vitest";
import { loadSharedTranscript, serializeSharedTranscript, sharedCourseProgress, parseTranscriptHistory, mergeTranscriptHistory } from "@/lib/curriculum/transcriptStore";
import { parseTranscriptMarkdown } from "@/lib/curriculum/transcript";
import type { TranscriptCourseRecord } from "@/lib/curriculum/types";

const record: TranscriptCourseRecord = { term: "202510", crn: "1", courseCode: "MAT 103E", courseName: "Math", grade: "BA", countedCredit: 4, transcriptCredit: 4, completionStatus: "passed", source: "transcript", calculated: true };
const legacy = JSON.stringify({ plans: { "10": { importedCourses: [record] } } });

describe("semester attempt history", () => {
  const older = { ...record, term: "202410", grade: "FF" as const, completionStatus: "failed" as const };
  it("preserves earlier attempts from one import without changing graduation records", () => {
    const parsed = parseTranscriptMarkdown(`Completed English Courses\n202410\t1\tMAT 103E\tMath\t4\tFF\n202510\t2\tMAT 103E\tMath\t4\tBA`);
    expect(parsed.calculatedCourses).toHaveLength(1);
    expect(parsed.attempts).toHaveLength(2);
  });
  it("merges history by term and course, refreshes corrected metadata, and retains earlier terms", () => {
    const corrected = { ...record, grade: "AA" as const };
    const merged = mergeTranscriptHistory([older, record], [corrected]);
    expect(merged).toHaveLength(2);
    expect(merged.find(item => item.term === record.term)?.grade).toBe("AA");
    const value = serializeSharedTranscript([corrected], "2026-10-14T00:00:00.000Z", merged);
    expect(loadSharedTranscript(value, null).courses).toEqual([corrected]);
    expect(parseTranscriptHistory(value)).toEqual(merged);
  });
  it("falls back to existing courses when a saved transcript predates history support", () => {
    expect(parseTranscriptHistory(serializeSharedTranscript([record]))).toEqual([record]);
  });
});

describe("shared transcript migration", () => {
  it("preserves an explicitly empty shared transcript despite inactive legacy imports", () => {
    expect(loadSharedTranscript(serializeSharedTranscript([]), legacy)).toEqual({ courses: [], migrated: false });
  });
  it.each([null, "broken", JSON.stringify({ version: 1, courses: [] })])("migrates missing or invalid shared data: %s", (value) => {
    expect(loadSharedTranscript(value, legacy)).toEqual({ courses: [record], migrated: true });
  });
  it("retains the valid shared transcript instead of an older plan copy", () => {
    expect(loadSharedTranscript(serializeSharedTranscript([record]), legacy)).toEqual({ courses: [record], migrated: false });
  });
  it("supplies external prerequisite grades and earned credits without requirement assignments", () => {
    expect(sharedCourseProgress([record])["MAT 103E"]).toMatchObject({ state: "passed", grade: "BA", countedCredit: 4, transcriptCredit: 4 });
    expect(sharedCourseProgress([record])["MAT 103E"].matchedRequirementId).toBeUndefined();
  });
});
