import { describe, expect, it } from "vitest";
import { resolveProgramMemberships } from "@/lib/program-restrictions/eligibility";
import { generateSchedules } from "@/lib/schedule/generator";
import { generatedScheduleToWeeklyProgram } from "@/lib/schedule/conversion";
import { createCrnBookmarklet, getLocalCreditTotal } from "@/lib/calendar/planActions";
import { calculateJpegExportRange, getPositionedBlocks } from "@/lib/calendar/exportJpeg";
import type { ProgramEnrollment } from "@/lib/profile/types";
import type { GeneratorCourse } from "@/lib/schedule/types";
import type { FacultyOption } from "@/types/calendar";

function enrollment(code: string, type: ProgramEnrollment["type"] = "main"): ProgramEnrollment {
  return {
    id: `enrollment-${code}`, type, facultyId: "selected-faculty", facultyName: "Faculty",
    educationLevel: "undergraduate", planType: type === "minor" ? "yandal" : type === "double-major" ? "cap" : "undergraduate",
    programCode: code, targetProgramCode: code, programName: "Program",
    curriculumPlanId: 1, curriculumPlanName: "Selected plan",
  };
}

// Synthetic CRNs distinguish independently selected sections. Restriction codes
// are literal official identities, rather than names inferred by the test.
const course: GeneratorCourse = {
  branchCode: "MAT", courseId: "mat-course", courseCode: "MAT 201", courseTitle: "Mathematics",
  sections: [
    { id: "main", crn: "00111", majorRestriction: "MAT_LS", meetings: [
      { id: "lecture", day: "Wednesday", startTime: "07:45", endTime: "09:15" },
      { id: "practice", day: "Friday", startTime: "11:10", endTime: "12:00" },
    ] },
    { id: "second-major", crn: "00222", majorRestriction: "SECE_LS", meetings: [
      { id: "second-meeting", day: "Saturday", startTime: "13:20", endTime: "14:10" },
    ] },
    { id: "minor", crn: "00333", majorRestriction: "KHE_YD", meetings: [
      { id: "minor-meeting", day: "Sunday", startTime: "21:10", endTime: "22:20" },
    ] },
  ],
};

function schedules(programs: ProgramEnrollment[], courses = [course]) {
  return generateSchedules(courses, { programMemberships: resolveProgramMemberships(programs) }).schedules;
}

describe("student scheduling generality", () => {
  it.each([
    { name: "mathematics main only", programs: [enrollment("MAT_LS")], crns: ["00111"] },
    { name: "a different main only", programs: [enrollment("SECE_LS")], crns: ["00222"] },
    { name: "main plus second major", programs: [enrollment("MAT_LS"), enrollment("SECE_LS", "double-major")], crns: ["00111", "00222"] },
    { name: "main plus independent minor", programs: [enrollment("MAT_LS"), enrollment("KHE_YD", "minor")], crns: ["00111", "00333"] },
    { name: "all three memberships", programs: [enrollment("MAT_LS"), enrollment("SECE_LS", "double-major"), enrollment("KHE_YD", "minor")], crns: ["00111", "00222", "00333"] },
    { name: "language variant remains a distinct identity", programs: [enrollment("MATE_LS")], crns: [] },
  ])("uses exact selected memberships for $name", ({ programs, crns }) => {
    const result = schedules(programs);
    expect(result.map((schedule) => schedule.selections[0].crn).sort()).toEqual(crns);
    expect(result.flatMap((schedule) => schedule.selections.map((selection) => selection.programEligibility)))
      .toEqual(crns.map(() => "eligible"));
  });

  it("preserves unresolved minor identities without granting their presumed parent program", () => {
    const programs = [enrollment("MAT_LS"), enrollment("MKN", "minor")];
    expect(resolveProgramMemberships(programs)).toMatchObject([
      { codes: ["MAT_LS"], resolved: true }, { rawCode: "MKN", codes: [], resolved: false },
    ]);
    // An unresolved optional membership does not displace a verified match.
    expect(schedules(programs).map((schedule) => schedule.selections[0].crn)).toEqual(["00111"]);
    const fallback = schedules(programs, [{ ...course, sections: [course.sections[1]] }]);
    expect(fallback.map((schedule) => ({ crn: schedule.selections[0].crn, status: schedule.selections[0].programEligibility, unknown: schedule.unknownRestrictionCount })))
      .toEqual([{ crn: "00222", status: "unknown", unknown: 1 }]);
  });

  it("does not infer permission from an unavailable restriction or a matching display name", () => {
    const programs = [{ ...enrollment("MAT_LS"), programName: "Chemical Engineering", programNameEn: "Chemical Engineering" }];
    const unknown = { ...course.sections[2], majorRestriction: "-" };
    expect(schedules(programs, [{ ...course, sections: [unknown] }])[0])
      .toMatchObject({ selections: [{ crn: "00333", programEligibility: "unknown" }], unknownRestrictionCount: 1 });
    expect(schedules(programs, [{ ...course, sections: [course.sections[2]] }])).toEqual([]);
  });

  it("keeps choices and metrics independent of display language and opaque enrollment/course IDs", () => {
    const programs = [enrollment("MAT_LS"), enrollment("KHE_YD", "minor")];
    const semantic = (result: ReturnType<typeof schedules>) => result.map((schedule) => ({
      crns: schedule.selections.map((selection) => selection.crn), metrics: schedule.metrics,
      score: schedule.score, unknown: schedule.unknownRestrictionCount,
    }));
    const renamedPrograms = programs.map((program, index) => ({
      ...program, id: `other-student-${index}`, facultyName: "Fakülte",
      programName: "Görüntülenen program", programNameTr: "Türkçe ad", programNameEn: "English label",
      curriculumPlanName: "Başka görüntü etiketi",
    }));
    const renamedCourse = { ...course, courseId: "opaque-new-id", courseTitle: "Matematik",
      sections: course.sections.map((section) => ({ ...section, id: `opaque-${section.id}` })),
    };
    expect(semantic(schedules(renamedPrograms, [renamedCourse]))).toEqual(semantic(schedules(programs)));
    expect(semantic(schedules(renamedPrograms, [renamedCourse])).map((value) => value.crns))
      .toEqual([["00333"], ["00111"]]);
  });

  it("carries selected meetings and current CRNs through conversion, credits, bookmarklet and export geometry", () => {
    const second: GeneratorCourse = {
      branchCode: "KIM", courseId: "kim-course", courseCode: "KIM 202", courseTitle: "Chemistry",
      sections: [course.sections[2]],
    };
    const selectedCourses = [{ ...course, sections: [course.sections[0]] }, second];
    const generated = schedules([enrollment("MAT_LS"), enrollment("KHE_YD", "minor")], selectedCourses);
    expect(generated).toHaveLength(1);
    const program = generatedScheduleToWeeklyProgram(generated[0], { id: "chosen-plan", name: "Chosen plan", updatedAt: "2026-10-26T00:00:00Z" });
    expect(program.courseBlocks.map(({ code, crn, day, startTime, endTime }) => ({ code, crn, day, startTime, endTime }))).toEqual([
      { code: "MAT 201", crn: "00111", day: "Wednesday", startTime: "07:45", endTime: "09:15" },
      { code: "MAT 201", crn: "00111", day: "Friday", startTime: "11:10", endTime: "12:00" },
      { code: "KIM 202", crn: "00333", day: "Sunday", startTime: "21:10", endTime: "22:20" },
    ]);
    const catalog: FacultyOption[] = selectedCourses.map((selected, index) => ({
      facultyCode: selected.branchCode, courses: [{ id: selected.courseId, code: selected.courseCode,
        title: selected.courseTitle, localCredits: index === 0 ? 3.5 : 2, sections: selected.sections }],
    }));
    expect(getLocalCreditTotal(program.courseSelections, catalog)).toBe(5.5);
    const reordered = [...program.courseSelections].reverse();
    const bookmark = createCrnBookmarklet(reordered, catalog);
    expect(bookmark.crns).toEqual(["00333", "00111"]);
    expect(bookmark.url).toContain('var crns=["00333","00111"]');
    const currentCatalog = catalog.map((branch) => ({ ...branch, courses: branch.courses.map((value) => ({
      ...value, sections: value.sections.map((section) => ({ ...section, crn: branch.facultyCode === "KIM" ? "00999" : section.crn })),
    })) }));
    expect(createCrnBookmarklet(reordered, currentCatalog).crns).toEqual(["00999", "00111"]);
    expect(calculateJpegExportRange(program.courseBlocks)).toEqual({ startMinutes: 450, endMinutes: 1350 });
    expect(getPositionedBlocks(program.courseBlocks).map(({ block, columnCount }) => [block.crn, block.day, columnCount]))
      .toEqual([["00111", "Wednesday", 1], ["00111", "Friday", 1], ["00333", "Sunday", 1]]);
  });
});
