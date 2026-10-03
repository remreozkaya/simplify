import { describe, expect, it } from "vitest";
import { loadSharedTranscript, serializeSharedTranscript, sharedCourseProgress } from "@/lib/curriculum/transcriptStore";
import type { TranscriptCourseRecord } from "@/lib/curriculum/types";

const record: TranscriptCourseRecord = { term: "202510", crn: "1", courseCode: "MAT 103E", courseName: "Math", grade: "BA", countedCredit: 4, transcriptCredit: 4, completionStatus: "passed", source: "transcript", calculated: true };
const legacy = JSON.stringify({ plans: { "10": { importedCourses: [record] } } });

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
