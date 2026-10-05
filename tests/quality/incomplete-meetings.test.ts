import { expect, it } from "vitest";
import { normalizeCoursePage } from "@/lib/itu/normalizers/normalizeCoursePage";
import { toCalendarCatalog } from "@/lib/itu/adapters/toCalendarCatalog";
import { generateConflictFreeSchedules } from "@/lib/schedule/generator";
import type { ItuCourseTableRow } from "@/lib/itu/types";

const lecture: ItuCourseTableRow = { crn:"90001",courseCode:"BLG 101E",courseTitle:"QA lecture and laboratory",day:"Monday",time:"09:00/10:00",majorRestriction:"BLGE_LS" };

// An incomplete CRN must not be
// certified conflict-free merely because its valid lecture survives parsing.
it.each([
  { name:"separate laboratory row has a missing time", rows:[lecture,{...lecture,day:"Wednesday",time:"-"}] },
  { name:"one time in a multi-session row is unresolved", rows:[{...lecture,day:"Monday Wednesday",time:"09:00/10:00 TBA"}] },
  { name:"missing laboratory precedes the valid lecture", rows:[{...lecture,day:"Wednesday",time:"-"},lecture] },
  { name:"three days have only two explicit time ranges", rows:[{...lecture,day:"Monday Wednesday Friday",time:"09:00/10:00 14:00/15:00"}] },
  { name:"a weekday is unresolved beside a valid weekday", rows:[{...lecture,day:"Monday TBA",time:"09:00/10:00"}] },
])("does not certify a schedule when $name", ({rows}) => {
  const raw = normalizeCoursePage(rows,3,"BLG","2026-10-05T00:00:00Z","QA semester");
  const catalog = toCalendarCatalog(raw);
  const offerings = catalog.courses.map(course=>({branchCode:"BLG",courseId:course.id,courseCode:course.code,courseTitle:course.title,sections:course.sections}));
  // Removing all incomplete sections, or rejecting the offering explicitly,
  // would satisfy this contract. Returning one verified schedule would not.
  expect(generateConflictFreeSchedules(offerings).schedules).toEqual([]);
});

it("retains an alternative complete CRN while excluding the incomplete CRN", () => {
  const catalog = normalizeCoursePage([lecture,{...lecture,day:"Wednesday",time:"-"},{...lecture,crn:"90002",day:"Tuesday"}],3,"BLG");
  expect(catalog.courses[0].sections.map(section=>section.crn)).toEqual(["90002"]);
});

it("ignores a separate explicitly identified exam row without losing a complete lecture", () => {
  const catalog = normalizeCoursePage([lecture,{...lecture,day:"Final Exam",time:"-"}],3,"BLG");
  expect(catalog.courses[0].sections[0].meetings).toEqual([{day:"Monday",startTime:"09:00",endTime:"10:00"}]);
});
