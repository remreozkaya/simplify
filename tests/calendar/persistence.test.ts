import { describe, expect, it } from "vitest";

import { loadWeeklyPrograms, saveWeeklyPrograms, parseStoredWeeklyPrograms } from "@/lib/calendar/persistence";

describe("parseStoredWeeklyPrograms", () => {
  it("retains course details through saving and rejects invalid counts", () => {
    const block = {
      id: "course-1", code: "BLG 102E", title: "Programming",
      day: "Monday", startTime: "13:00", endTime: "14:59",
      teachingMethod: "Face to face", capacity: 40, enrolled: 0,
    };
    const [program] = parseStoredWeeklyPrograms(JSON.parse(JSON.stringify([
      { id: "program-1", name: "Saved", courseBlocks: [block,
        { ...block, id: "invalid", capacity: -1, enrolled: "20" }], courseSelections: [] },
    ])));
    expect(program.courseBlocks[0]).toMatchObject({
      teachingMethod: "Face to face", capacity: 40, enrolled: 0,
    });
    expect(program.courseBlocks[1]).toMatchObject({ capacity: undefined, enrolled: undefined });
  });

  it("migrates the former single-session selection shape", () => {
    const programs = parseStoredWeeklyPrograms([
      {
        id: "program-1",
        name: "Saved program",
        updatedAt: "2026-08-25T10:00:00.000Z",
        courseBlocks: [],
        courseSelections: [
          {
            id: "selection-1",
            facultyCode: "BLG",
            courseId: "BLG:BLG 102E",
            sessionId: "BLG:23713",
            courseBlockId: "course-1",
          },
        ],
      },
    ]);

    expect(programs[0].courseSelections[0]).toMatchObject({
      sectionId: "BLG:23713",
      courseBlockIds: ["course-1"],
    });
  });

  it("filters malformed programs, selections, and blocks without throwing", () => {
    expect(
      parseStoredWeeklyPrograms([
        null,
        { name: "missing id" },
        {
          id: "valid",
          name: "Valid",
          courseBlocks: [{ id: "broken" }],
          courseSelections: [{ id: 12 }],
        },
      ]),
    ).toMatchObject([
      {
        id: "valid",
        courseBlocks: [],
        courseSelections: [],
      },
    ]);
  });
});

it("preserves restriction raw text, semester and conflicting-source unknown across saved-data round trips", () => {
  const block = {id:"course",code:"BLG 101",title:"Course",day:"Monday",startTime:"09:00",endTime:"10:00",majorRestriction:"BLG_LS\nBLGE_LS",semester:"2026-2027 Güz Dönemi",programRestriction:{raw:"BLG_LS\nBLGE_LS",state:"unknown",codes:[],reason:"conflicting-source-values"}};
  const value = parseStoredWeeklyPrograms(JSON.parse(JSON.stringify([{id:"program",name:"Saved",courseBlocks:[block],courseSelections:[]}])))[0];
  expect(value.courseBlocks[0]).toMatchObject({majorRestriction:block.majorRestriction,semester:block.semester,programRestriction:block.programRestriction});
});

it("retains an explicitly verified unrestricted state rather than inferring it from raw blank text", () => {
  const block = {id:"course",code:"BLG 101",title:"Course",day:"Monday",startTime:"09:00",endTime:"10:00",programRestriction:{state:"unrestricted",codes:[],reason:"verified-source"}};
  const value = parseStoredWeeklyPrograms([{id:"program",name:"Saved",courseBlocks:[block],courseSelections:[]}])[0];
  expect(value.courseBlocks[0].programRestriction?.state).toBe("unrestricted");
  expect(parseStoredWeeklyPrograms([{id:"program",name:"Saved",courseBlocks:[{...block,programRestriction:undefined}],courseSelections:[]}])[0].courseBlocks[0].programRestriction?.state).toBe("unknown");
});


describe("weekly planner storage recovery", () => {
  it("preserves unreadable raw data rather than overwriting it", () => {
    const stored = "{broken JSON";
    const state = loadWeeklyPrograms({ getItem: () => stored });
    expect(state).toEqual({ programs: [], recoveryRequired: true });
    const writes: string[] = [];
    expect(saveWeeklyPrograms({ setItem: (_key, value) => writes.push(value) }, [], state.recoveryRequired)).toBe("recovery");
    expect(writes).toEqual([]);
  });
  it("preserves partially corrupted plans for export and recovery", () => {
    const state = loadWeeklyPrograms({ getItem: () => JSON.stringify([{ id: "p", name: "Keep", courseBlocks: [{ id: "broken" }], courseSelections: [] }]) });
    expect(state.programs[0].name).toBe("Keep");
    expect(state.recoveryRequired).toBe(true);
  });
  it("preserves invalid meeting collections rather than replacing them silently", () => {
    expect(loadWeeklyPrograms({ getItem: () => JSON.stringify([{ id: "p", name: "Keep", courseBlocks: "unreadable", courseSelections: [] }]) }).recoveryRequired).toBe(true);
  });
  it("returns an explicit failed-write status instead of throwing", () => {
    expect(saveWeeklyPrograms({ setItem: () => { throw new Error("Quota exceeded"); } }, [], false)).toBe("error");
  });
  it("reports denied reads rather than treating them as empty storage", () => {
    expect(loadWeeklyPrograms({ getItem: () => { throw new Error("denied"); } })).toEqual({ programs: [], recoveryRequired: true });
  });
  it("retains all meetings and identities through a saved round trip", () => {
    const raw = JSON.stringify([{ id: "p", name: "Keep", courseBlocks: [
      { id: "lecture", selectionId: "s", code: "MAT 101", title: "Math", crn: "12345", day: "Monday", startTime: "09:00", endTime: "10:00" },
      { id: "lab", selectionId: "s", code: "MAT 101", title: "Math", crn: "12345", day: "Tuesday", startTime: "11:00", endTime: "12:00" },
    ], courseSelections: [{ id: "s", facultyCode: "MAT", courseId: "MAT 101", sectionId: "12345", courseBlockIds: ["lecture", "lab"] }] }]);
    const state = loadWeeklyPrograms({ getItem: () => raw });
    expect(state.recoveryRequired).toBe(false);
    expect(state.programs[0].courseBlocks.map(block => block.id)).toEqual(["lecture", "lab"]);
    expect(state.programs[0].courseSelections[0].courseBlockIds).toEqual(["lecture", "lab"]);
  });
});
