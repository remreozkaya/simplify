import { it, expect } from "vitest";
import { scheduleGenerationContextKey } from "@/lib/schedule/context";
import type { GeneratorCourse } from "@/lib/schedule/types";
const course: GeneratorCourse = {branchCode:"BLG",courseId:"course",courseCode:"BLG 101",courseTitle:"Course",sections:[{id:"section",crn:"12345",semester:"Fall",majorRestriction:"BLG_LS",meetings:[]}]};
it("invalidates derived results after restriction, semester or membership changes",()=>{
 const first=scheduleGenerationContextKey([course],[]);
 expect(scheduleGenerationContextKey([{...course,sections:[{...course.sections[0],majorRestriction:"BLGE_LS"}]}],[])).not.toBe(first);
 expect(scheduleGenerationContextKey([{...course,sections:[{...course.sections[0],semester:"Spring"}]}],[])).not.toBe(first);
 expect(scheduleGenerationContextKey([course],[{enrollmentId:"main",type:"main",rawCode:"BLG_LS",codes:["BLG_LS"],resolved:true}])).not.toBe(first);
 expect(scheduleGenerationContextKey(JSON.parse(JSON.stringify([course])),[])).toBe(first);
});
