import { describe, expect, it } from "vitest";
import { applyTranscriptImport, calculateProgramGpa, curriculumTotals } from "@/lib/curriculum/graduation";
import { emptyProgress } from "@/lib/curriculum/progress";
import { parseTranscriptMarkdown, calculateGpa } from "@/lib/curriculum/transcript";
import { mergeTranscriptCourses } from "@/lib/curriculum/transcriptStore";
import { buildSemesterPlan } from "@/lib/semester-planner/planner";
import { generateConflictFreeSchedules } from "@/lib/schedule/generator";
import { generatedScheduleToWeeklyProgram } from "@/lib/schedule/conversion";
import { parseStoredWeeklyPrograms } from "@/lib/calendar/persistence";
import { resolveProgramMemberships } from "@/lib/program-restrictions/eligibility";
import type { SemesterPlannerProgram } from "@/lib/semester-planner/types";
import type { GeneratorCourse } from "@/lib/schedule/types";

// Synthetic academic rules: this is a cross-module contract, not institutional policy.
function program(id: number, type: "main" | "double-major" | "minor", codes: string[]): SemesterPlannerProgram {
  const planType = type === "main" ? "undergraduate" : type === "minor" ? "yandal" : "cap";
  const curriculum: SemesterPlannerProgram["curriculum"] = { planId: id, programCode: "BLGE_LS", title: "QA", planTitle: "QA", planType,
    semesters: [{ semester: 1, items: codes.map(code => ({kind: "course" as const, id: `${id}:${code}`, semester: 1, code, title: code, requirementType: "compulsory" as const, creditOptions:[3], ectsOptions:[6]})) }],
    prerequisites: {}, equivalenceRules: [], prerequisiteBranchesLoaded:["BLG"], prerequisiteDataAvailable:true, warnings:[], fetchedAt:"2026-10-05T00:00:00Z" };
  return { curriculum, progress: emptyProgress(id), enrollment: { id:String(id), type, facultyId:"1",facultyName:"QA", educationLevel:"undergraduate",planType,programCode:type === "minor" ? "UNVERIFIED_MINOR" : "BLGE_LS", programName:"QA", curriculumPlanId:id,curriculumPlanName:"QA" } };
}
function offering(code: string, crn: string, meetings: GeneratorCourse["sections"][number]["meetings"]): GeneratorCourse {
  return { branchCode:"BLG",courseId:code,courseCode:code,courseTitle:code,sections:[{id:crn,crn,majorRestriction:"BLGE_LS",meetings}] };
}

describe("independent academic workflow checks", () => {
  it("keeps the latest repeated attempt and calculates weighted GPA once across program audits", () => {
    const imported = parseTranscriptMarkdown(`| Completed English Courses |\n| 202510 | 1 | BLG 101E | Intro | 3 | FF |\n| 202610 | 2 | BLG 101E | Intro | 3 | AA |\n| 202610 | 3 | BLG 102E | Next | 4 | BB |`);
    const older = parseTranscriptMarkdown(`| Completed English Courses |\n| 202410 | 4 | BLG 101E | Intro | 3 | CC |`);
    const shared = mergeTranscriptCourses(imported.calculatedCourses, older.calculatedCourses);
    expect(shared).toHaveLength(2);
    expect(shared.find(x => x.courseCode === "BLG 101E")?.grade).toBe("AA");
    // 3*4 + 4*3 = 24 grade points over 7 credits, not 10 or 13 credits.
    expect(calculateGpa(shared)).toBeCloseTo(24 / 7, 10);
    for (const type of ["main", "double-major", "minor"] as const) {
      const p = program(1, type, ["BLG 101E", "BLG 102E"]);
      p.progress = applyTranscriptImport(p.curriculum,p.progress,{...imported,calculatedCourses:shared}).progress;
      // Curriculum requirement credits are 3+3; GPA weights remain transcript 3+4.
      expect(curriculumTotals(p.curriculum,p.progress)).toMatchObject({earnedCourses:2,earnedCredit:6,requiredCredit:6});
      expect(calculateProgramGpa(p.curriculum,p.progress)).toBeCloseTo(24 / 7, 10);
    }
  });

  it("counts a three-program shared course once and retains every weekly session through save/load", () => {
    const programs = [program(1,"main",["BLG 101E","BLG 102E"]),program(2,"double-major",["BLG 101E"]),program(3,"minor",["BLG 101E"])];
    const offerings = [
      offering("BLG 101E","101",[{id:"lecture",day:"Monday",startTime:"09:00",endTime:"10:00"},{id:"lab",day:"Wednesday",startTime:"14:00",endTime:"15:00"}]),
      offering("BLG 102E","102",[{id:"next",day:"Monday",startTime:"10:00",endTime:"11:00"}]),
    ];
    const memberships = resolveProgramMemberships(programs.map(x=>x.enrollment));
    const plan = buildSemesterPlan(programs,{desiredCredits:6,maxCourses:2,priority:"balanced",availabilityMode:"published",knownBranchCodes:new Set(["BLG"]),offeredCourseCodes:new Set(["BLG 101E","BLG 102E"]),courseOfferings:offerings,programMemberships:memberships});
    expect(plan.selectedCredits).toBe(6);
    expect(plan.selectedEcts).toBe(12);
    expect(plan.combinedRemainingCredits).toBe(6);
    expect(plan.recommendations.find(x=>x.code==="BLG 101E")?.contributions).toHaveLength(3);
    const schedules = generateConflictFreeSchedules(offerings.map(x=>({...x,pinnedSectionId:plan.compatibleSectionConstraints.find(c=>c.courseId===x.courseId)?.sectionId})),{programMemberships:memberships});
    expect(schedules.schedules).toHaveLength(1);
    expect(schedules.schedules[0]).toMatchObject({conflictCount:0,totalConflictMinutes:0});
    const weekly = generatedScheduleToWeeklyProgram(schedules.schedules[0],{id:"isolated",name:"QA"});
    const restored = parseStoredWeeklyPrograms(JSON.parse(JSON.stringify([weekly])));
    expect(restored[0].courseSelections).toHaveLength(2);
    expect(restored[0].courseBlocks).toHaveLength(3);
    expect(restored[0].courseBlocks.map(x=>[x.day,x.startTime,x.endTime])).toEqual([["Monday","09:00","10:00"],["Wednesday","14:00","15:00"],["Monday","10:00","11:00"]]);
  });
});
