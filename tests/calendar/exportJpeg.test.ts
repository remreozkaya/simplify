import { afterEach, describe, expect, it, vi } from "vitest";

import {
  calculateJpegExportRange,
  createWeeklyProgramJpegFilename,
  exportWeeklyProgramAsJpeg,
  getPositionedBlocks,
} from "@/lib/calendar/exportJpeg";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("weekly program JPEG export", () => {
  it("creates a safe JPEG filename", () => {
    expect(createWeeklyProgramJpegFilename("  Fall / Program #1  ")).toBe(
      "simplify-fall-program-1.jpg",
    );
    expect(createWeeklyProgramJpegFilename("   ")).toBe(
      "simplify-weekly-program.jpg",
    );
  });

  it("uses the normal calendar range for an empty program", () => {
    expect(calculateJpegExportRange([])).toEqual({
      startMinutes: 8 * 60,
      endMinutes: 20 * 60,
    });
  });

  it("expands the export range for early and late meetings", () => {
    expect(
      calculateJpegExportRange([
        {
          id: "early",
          code: "BLG 101",
          title: "Course",
          day: "Monday",
          startTime: "07:45",
          endTime: "08:45",
        },
        {
          id: "late",
          code: "MAT 101",
          title: "Course",
          day: "Tuesday",
          startTime: "19:30",
          endTime: "20:20",
        },
      ]),
    ).toEqual({ startMinutes: 7 * 60 + 30, endMinutes: 20 * 60 + 30 });
  });

  it("keeps non-conflicting meetings full-width on a day with a conflict", () => {
    const conflictingMeeting = {
      id: "conflict-1",
      code: "BLG 101",
      title: "Course",
      day: "Monday" as const,
      startTime: "09:00",
      endTime: "10:00",
    };
    const secondConflictingMeeting = {
      ...conflictingMeeting,
      id: "conflict-2",
      code: "MAT 101",
      startTime: "09:30",
      endTime: "10:30",
    };
    const nonConflictingMeeting = {
      ...conflictingMeeting,
      id: "non-conflict",
      code: "FIZ 101",
      startTime: "13:00",
      endTime: "14:00",
    };

    const positionedBlocks = getPositionedBlocks([
      conflictingMeeting,
      secondConflictingMeeting,
      nonConflictingMeeting,
    ]);

    expect(
      positionedBlocks.find(({ block }) => block.id === "conflict-1"),
    ).toMatchObject({ columnCount: 2 });
    expect(
      positionedBlocks.find(({ block }) => block.id === "conflict-2"),
    ).toMatchObject({ columnCount: 2 });
    expect(
      positionedBlocks.find(({ block }) => block.id === "non-conflict"),
    ).toMatchObject({ column: 0, columnCount: 1 });
  });

  it("renders a local canvas and triggers a JPEG download", () => {
    const click = vi.fn();
    const appendChild = vi.fn();
    const context = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      measureText: (value: string) => ({ width: value.length * 8 }),
      save: vi.fn(),
      clip: vi.fn(),
      restore: vi.fn(),
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "left",
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
      toDataURL: vi.fn(() => "data:image/jpeg;base64,exported"),
    };
    const link = {
      download: "",
      href: "",
      click,
      remove: vi.fn(),
    };

    vi.stubGlobal("document", {
      createElement: (tagName: string) =>
        tagName === "canvas" ? canvas : link,
      body: { appendChild },
    });

    const filename = exportWeeklyProgramAsJpeg({
      id: "program-1",
      name: "My Program",
      updatedAt: "2026-08-26T00:00:00.000Z",
      courseSelections: [
        {
          id: "selection-1",
          facultyCode: "BLG",
          courseId: "BLG 101",
          sectionId: "BLG:12345",
          courseBlockIds: ["block-1"],
        },
      ],
      courseBlocks: [
        {
          id: "block-1",
          selectionId: "selection-1",
          code: "BLG 101",
          title: "Introduction to Computing",
          crn: "12345",
          day: "Monday",
          startTime: "09:30",
          endTime: "11:30",
          room: "A-101",
          instructor: "Ada Lovelace",
        },
      ],
    });

    expect(filename).toBe("simplify-my-program.jpg");
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.92);
    expect(link).toMatchObject({
      download: "simplify-my-program.jpg",
      href: "data:image/jpeg;base64,exported",
    });
    expect(appendChild).toHaveBeenCalledWith(link);
    expect(click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
    const renderedText = () => context.fillText.mock.calls.map(([text]) => text);
    expect(renderedText()).toContain("Haftalık Program · Simplify");
    expect(renderedText()).toContain("Pazartesi");
    expect(renderedText()).toContain("Ders bilgileri");
    expect(renderedText().some((text) => String(text).startsWith("Dışa aktarılma tarihi:"))).toBe(true);

    context.fillText.mockClear();
    exportWeeklyProgramAsJpeg({
      id: "empty", name: "X".repeat(500), updatedAt: "", courseSelections: [], courseBlocks: [],
    }, "en");
    expect(renderedText()).toContain("Weekly Program · Simplify");
    expect(renderedText()).toContain("Monday");
    expect(renderedText()).toContain("Course details");
    const heading = context.fillText.mock.calls[0];
    expect(context.measureText(String(heading[0])).width + Number(heading[1])).toBeLessThanOrEqual(canvas.width - 48);
    context.fillText.mockClear();
    exportWeeklyProgramAsJpeg({
      id: "multi", name: "Çalışma planı", updatedAt: "", courseSelections: [], courseBlocks: [
        { id: "lecture", selectionId: "shared", code: "MAT 101", title: "Çok uzun ders adı ".repeat(30), day: "Monday", startTime: "07:30", endTime: "08:30" },
        { id: "lab", selectionId: "shared", code: "MAT 101", title: "Çok uzun ders adı ".repeat(30), day: "Tuesday", startTime: "21:30", endTime: "22:30" },
      ],
    }, "tr");
    expect(renderedText()).toContain("07:30–08:30");
    expect(renderedText()).toContain("21:30–22:30");
    // One legend entry represents both recurring meetings of the same course.
    expect(renderedText().filter(text => text === "MAT 101")).toHaveLength(3);
    expect(context.fillText.mock.calls.every(([text, x]) => Number(x) + context.measureText(String(text)).width <= canvas.width)).toBe(true);
    const missingInstructor = {
      id: "tba", name: "Program", updatedAt: "", courseSelections: [], courseBlocks: [
        { id: "single", code: "MAT 101", title: "Math", day: "Monday" as const, startTime: "09:00", endTime: "10:00" },
      ],
    };
    context.fillText.mockClear();
    exportWeeklyProgramAsJpeg(missingInstructor, "tr");
    expect(renderedText()).toContain("Math · Öğretim elemanı: Belirtilmedi");
    context.fillText.mockClear();
    exportWeeklyProgramAsJpeg(missingInstructor, "en");
    expect(renderedText()).toContain("Math · Instructor: TBA");




  });
});
