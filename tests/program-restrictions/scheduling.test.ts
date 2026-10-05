import { describe, it, expect } from "vitest";
import { generateSchedules } from "@/lib/schedule/generator";
import { resolveProgramMemberships } from "@/lib/program-restrictions/eligibility";
import type { ProgramEnrollment } from "@/lib/profile/types";
import type { GeneratorCourse } from "@/lib/schedule/types";
const programs = (code: string) => resolveProgramMemberships([{id:code,type:"main",programCode:code} as ProgramEnrollment]);
const course: GeneratorCourse = {branchCode:"BLG",courseId:"BLG 101",courseCode:"BLG 101",courseTitle:"Example",sections:[
  {id:"restricted",crn:"1",majorRestriction:"BLGE_LS",meetings:[{id:"m1",day:"Monday",startTime:"09:00",endTime:"10:00"}]},
  {id:"eligible",crn:"2",majorRestriction:"BLG_LS",meetings:[{id:"m2",day:"Tuesday",startTime:"09:00",endTime:"10:00"}]},
  {id:"unknown",crn:"3",meetings:[{id:"m3",day:"Friday",startTime:"09:00",endTime:"10:00"}]},
]};
describe("restriction-aware generation",()=>{
  it("excludes a restricted CRN of the same course and prefers verified sections",()=>{
    const result=generateSchedules([course],{programMemberships:programs("BLG_LS")});
    expect(result.schedules.map(s=>s.selections[0].sectionId)).toEqual(["eligible"]);
    expect(result.schedules[0].selections[0].programEligibility).toBe("eligible");
  });
  it("explains a course with no permitted section, including pinned restricted sections",()=>{
    const result=generateSchedules([{...course,pinnedSectionId:"restricted"}],{programMemberships:programs("BLG_LS")});
    expect(result.schedules).toEqual([]);
    expect(result.restrictionBlockedCourses).toEqual(["BLG 101"]);
  });
  it("retains unknown as labeled fallback and preserves no-program behavior",()=>{
    const result=generateSchedules([{...course,sections:[course.sections[2]]}],{programMemberships:programs("BLG_LS")});
    expect(result.schedules[0].unknownRestrictionCount).toBe(1);
    expect(result.schedules[0].selections[0].programEligibility).toBe("unknown");
    expect(generateSchedules([course]).schedules).toHaveLength(3);
  });
  it("uses unknown fallback only if verified sections cannot form a collision-free assignment",()=>{
    const other={...course,courseId:"BLG 102",courseCode:"BLG 102",sections:[{...course.sections[1],id:"other"}]};
    const result=generateSchedules([course,other],{programMemberships:programs("BLG_LS")});
    expect(result.schedules).toHaveLength(1);
    expect(result.schedules[0].unknownRestrictionCount).toBe(1);
    expect(result.schedules[0].conflictCount).toBe(0);
  });
});

it("prefers eligible sections within a fallback schedule when another course is necessarily unknown", () => {
  const onlyUnknown = {...course,courseId:"BLG 103",courseCode:"BLG 103",sections:[{...course.sections[2], id:"forced-unknown",meetings:[{...course.sections[2].meetings[0],day:"Wednesday" as const}]}]};
  const mixed = {...course, sections:[{...course.sections[2],crn:"1"},course.sections[1]]};
  const result = generateSchedules([onlyUnknown,mixed], {programMemberships:programs("BLG_LS"),stopAfterFirst:true});
  expect(result.schedules[0].selections[1].sectionId).toBe("eligible");
  expect(result.schedules[0].unknownRestrictionCount).toBe(1);
});
