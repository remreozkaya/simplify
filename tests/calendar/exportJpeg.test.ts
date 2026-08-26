import { afterEach, describe, expect, it, vi } from "vitest";

import {
  calculateJpegExportRange,
  createWeeklyProgramJpegFilename,
  exportWeeklyProgramAsJpeg,
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
  });
});
