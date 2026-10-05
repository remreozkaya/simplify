import { it, expect } from "vitest";
import { buildSemesterPlan } from "@/lib/semester-planner/planner";
import { emptyProgress } from "@/lib/curriculum/progress";
import type { SemesterPlannerProgram, SemesterPlannerOptions } from "@/lib/semester-planner/types";
import type { GeneratorCourse } from "@/lib/schedule/types";
function program(code:string,course:string,type: "main"|"double-major"|"minor"="main"):SemesterPlannerProgram {
  const curriculum = {planId:1, programCode:code,title:code,planTitle:code,semesters:[{semester:1,items:[{kind:"course" as const,id:course,semester:1,code:course,title:course,requirementType:"compulsory" as const,creditOptions:[3],ectsOptions:[5]}]}],prerequisites:{},equivalenceRules:[],prerequisiteBranchesLoaded:["BLG","MAT"],prerequisiteDataAvailable:true,warnings:[],fetchedAt:"2026-10-05T10:00:00Z"};
  return { enrollment:{id:code,type,programCode:code,programName:code,facultyId:"1",facultyName:"Faculty",educationLevel:"undergraduate",planType:type==="minor"?"yandal":type==="double-major"?"cap":"undergraduate",curriculumPlanId:1,curriculumPlanName:code}, curriculum, progress:emptyProgress(1)};
}
function offering(code:string,allowed:string|undefined,day:"Monday"|"Tuesday"="Monday"):GeneratorCourse {
  return {branchCode:code.split(" ")[0],courseId:code,courseCode:code,courseTitle:code,sections:[{id:code,crn:code,majorRestriction:allowed,meetings:[{id:code,day,startTime:"09:00",endTime:"10:00"}]}]};
}
const options=(offerings:GeneratorCourse[]):SemesterPlannerOptions=>({desiredCredits:6,maxCourses:2,priority:"balanced",availabilityMode:"published",knownBranchCodes:new Set(["BLG","MAT"]),offeredCourseCodes:new Set(offerings.map(c=>c.courseCode)),courseOfferings:offerings});
it("preserves both curriculum associations and picks collision-free permitted sections across two programs",()=>{
  const a=program("BLG_LS","BLG 101");const b=program("MAT_LS","MAT 101","double-major");
  const plan=buildSemesterPlan([a,b],options([offering("BLG 101","BLG_LS"),offering("MAT 101","MAT_LS","Tuesday")]));
  expect(plan.recommendations).toHaveLength(2);
  expect(plan.recommendations.every(c=>c.programEligibility==="eligible")).toBe(true);
  expect(plan.compatibleSectionConstraints).toHaveLength(2);
  expect(plan.programSummaries.every(p=>p.selectedCredits===3)).toBe(true);
});
it("excludes definitively restricted offerings and explains the outcome",()=>{
  const plan=buildSemesterPlan([program("BLG_LS","BLG 101")],options([offering("BLG 101","BLGE_LS")]));
  expect(plan.recommendations).toEqual([]);
  expect(plan.notices).toContainEqual({kind:"program-restriction-blocked",count:1});
});
it("marks unknown fallback separately from prerequisite confirmation",()=>{
  const plan=buildSemesterPlan([program("BLG_LS","BLG 101")],options([offering("BLG 101",undefined)]));
  expect(plan.recommendations[0].eligibility).toBe("confirmed");
  expect(plan.recommendations[0].programEligibility).toBe("unknown");
  expect(plan.notices).toContainEqual({kind:"program-restriction-unknown"});
});
it("reevaluates the same offerings after profile changes",()=>{
  const data=options([offering("BLG 101","BLGE_LS")]);
  expect(buildSemesterPlan([program("BLG_LS","BLG 101")],data).recommendations).toHaveLength(0);
  expect(buildSemesterPlan([program("BLGE_LS","BLG 101")],data).recommendations).toHaveLength(1);
});

it("deduplicates a shared course without inventing curriculum contributions from openness",()=>{
 const a=program("BLG_LS","BLG 101");const b=program("MAT_LS","BLG 101","double-major");
 const plan=buildSemesterPlan([a,b],options([offering("BLG 101","MAT_LS"),offering("MAT 999","BLG_LS","Tuesday")]));
 expect(plan.recommendations).toHaveLength(1);
 expect(plan.recommendations[0].contributions).toHaveLength(2);
 expect(plan.selectedCredits).toBe(3);
 expect(plan.programSummaries.every(p=>p.selectedCredits===3)).toBe(true);
 expect(plan.recommendations.some(c=>c.code==="MAT 999")).toBe(false);
});
it("includes a minor's own elective requirement through minor-only section permission",()=>{
 const a=program("BLG_LS","BLG 101");const b=program("KHE_YD","BLG 353E","minor");
 b.curriculum.semesters[0].items=[{kind:"elective-slot",id:"minor-elective",semester:1,title:"Minor elective",creditOptions:[3],ectsOptions:[5],courses:[{code:"BLG 353E",title:"Quantum Programming",creditOptions:[3],ectsOptions:[5]}]}];
 const plan=buildSemesterPlan([a,b],options([offering("BLG 101","BLG_LS"),offering("BLG 353E","KHE_YD","Tuesday")]));
 expect(plan.recommendations).toHaveLength(2);
 const elective=plan.recommendations.find(c=>c.code==="BLG 353E")!;
 expect(elective.programEligibility).toBe("eligible");
 expect(elective.contributions).toMatchObject([{enrollmentType:"minor",requirementKind:"elective"}]);
});
