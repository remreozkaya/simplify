import { meetingsOverlap } from "@/lib/schedule/conflicts";
import { minutesToTime, timeToMinutes } from "@/lib/schedule/time";
import { days, type CourseBlock, type Day, type WeeklyProgram } from "@/types/calendar";

const EXPORT_WIDTH = 1800;
const LEFT_GUTTER = 120;
const RIGHT_GUTTER = 48;
const TOP_HEADER = 170;
const DAY_HEADER_HEIGHT = 62;
const HALF_HOUR_HEIGHT = 42;
const LEGEND_ITEM_HEIGHT = 52;

const JPEG_COLORS = [
  { background: "#e0f2fe", border: "#7dd3fc", text: "#0c4a6e" },
  { background: "#d1fae5", border: "#6ee7b7", text: "#064e3b" },
  { background: "#fef3c7", border: "#fcd34d", text: "#78350f" },
  { background: "#ede9fe", border: "#c4b5fd", text: "#4c1d95" },
  { background: "#ffe4e6", border: "#fda4af", text: "#881337" },
  { background: "#cffafe", border: "#67e8f9", text: "#164e63" },
  { background: "#ffedd5", border: "#fdba74", text: "#7c2d12" },
  { background: "#e0e7ff", border: "#a5b4fc", text: "#312e81" },
] as const;

type ExportRange = {
  startMinutes: number;
  endMinutes: number;
};

export type PositionedBlock = {
  block: CourseBlock;
  column: number;
  columnCount: number;
};

export function createWeeklyProgramJpegFilename(name: string): string {
  const slug = name
    .trim()
    .toLocaleLowerCase("en-US")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "weekly-program";

  return `simplify-${slug}.jpg`;
}

export function calculateJpegExportRange(
  courseBlocks: readonly CourseBlock[],
): ExportRange {
  if (courseBlocks.length === 0) {
    return { startMinutes: 8 * 60, endMinutes: 20 * 60 };
  }

  const earliest = Math.min(
    ...courseBlocks.map((block) => timeToMinutes(block.startTime)),
  );
  const latest = Math.max(
    ...courseBlocks.map((block) => timeToMinutes(block.endTime)),
  );

  return {
    startMinutes: Math.min(8 * 60, Math.floor(earliest / 30) * 30),
    endMinutes: Math.max(20 * 60, Math.ceil(latest / 30) * 30),
  };
}

export function getPositionedBlocks(
  courseBlocks: readonly CourseBlock[],
): PositionedBlock[] {
  return days.flatMap((day) => {
    const dayBlocks = courseBlocks
      .filter((block) => block.day === day)
      .sort(
        (first, second) =>
          timeToMinutes(first.startTime) - timeToMinutes(second.startTime) ||
          timeToMinutes(first.endTime) - timeToMinutes(second.endTime),
      );
    const positionedBlocks: PositionedBlock[] = [];
    const unvisitedBlocks = new Set(dayBlocks);

    while (unvisitedBlocks.size > 0) {
      const firstBlock = unvisitedBlocks.values().next().value as CourseBlock;
      const overlapGroup: CourseBlock[] = [];
      const queue = [firstBlock];

      unvisitedBlocks.delete(firstBlock);

      while (queue.length > 0) {
        const currentBlock = queue.shift();

        if (!currentBlock) {
          continue;
        }

        overlapGroup.push(currentBlock);

        unvisitedBlocks.forEach((candidate) => {
          if (meetingsOverlap(currentBlock, candidate)) {
            unvisitedBlocks.delete(candidate);
            queue.push(candidate);
          }
        });
      }

      const columns: CourseBlock[][] = [];
      const assignments = overlapGroup.map((block) => {
        let column = columns.findIndex((columnBlocks) =>
          columnBlocks.every(
            (candidate) => !meetingsOverlap(candidate, block),
          ),
        );

        if (column === -1) {
          column = columns.length;
          columns.push([]);
        }

        columns[column].push(block);
        return { block, column };
      });
      const columnCount = Math.max(1, columns.length);

      positionedBlocks.push(
        ...assignments.map((assignment) => ({
          ...assignment,
          columnCount,
        })),
      );
    }

    return positionedBlocks;
  });
}

function roundedRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function truncateText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
): string {
  if (context.measureText(value).width <= maxWidth) {
    return value;
  }

  let truncated = value;

  while (
    truncated.length > 1 &&
    context.measureText(`${truncated}…`).width > maxWidth
  ) {
    truncated = truncated.slice(0, -1);
  }

  return `${truncated}…`;
}

function getSelectionOrder(program: WeeklyProgram): string[] {
  const ordered = program.courseSelections.map((selection) => selection.id);

  program.courseBlocks.forEach((block) => {
    const selectionId = block.selectionId ?? block.id;

    if (!ordered.includes(selectionId)) {
      ordered.push(selectionId);
    }
  });

  return ordered;
}

export function exportWeeklyProgramAsJpeg(program: WeeklyProgram): string {
  const range = calculateJpegExportRange(program.courseBlocks);
  const halfHourRows = (range.endMinutes - range.startMinutes) / 30;
  const calendarHeight = halfHourRows * HALF_HOUR_HEIGHT;
  const selectionOrder = getSelectionOrder(program);
  const legendBlocks = selectionOrder.flatMap((selectionId) => {
    const block = program.courseBlocks.find(
      (candidate) => (candidate.selectionId ?? candidate.id) === selectionId,
    );
    return block ? [block] : [];
  });
  const legendHeight =
    legendBlocks.length > 0
      ? 78 + legendBlocks.length * LEGEND_ITEM_HEIGHT
      : 40;
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height =
    TOP_HEADER + DAY_HEADER_HEIGHT + calendarHeight + legendHeight + 56;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("JPEG export is not supported by this browser.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#111827";
  context.font = "700 46px system-ui, sans-serif";
  context.fillText(program.name, LEFT_GUTTER, 72);
  context.fillStyle = "#6b7280";
  context.font = "24px system-ui, sans-serif";
  context.fillText("Weekly Program · Simplify", LEFT_GUTTER, 112);
  context.fillText(
    `Exported ${new Date().toLocaleDateString("en-GB")}`,
    LEFT_GUTTER,
    145,
  );

  const gridTop = TOP_HEADER + DAY_HEADER_HEIGHT;
  const calendarWidth = EXPORT_WIDTH - LEFT_GUTTER - RIGHT_GUTTER;
  const dayWidth = calendarWidth / days.length;

  context.fillStyle = "#f8fafc";
  context.fillRect(
    LEFT_GUTTER,
    TOP_HEADER,
    calendarWidth,
    DAY_HEADER_HEIGHT,
  );
  context.strokeStyle = "#d1d5db";
  context.lineWidth = 2;
  context.strokeRect(
    LEFT_GUTTER,
    TOP_HEADER,
    calendarWidth,
    DAY_HEADER_HEIGHT + calendarHeight,
  );
  context.fillStyle = "#374151";
  context.font = "700 22px system-ui, sans-serif";
  context.textAlign = "center";
  days.forEach((day, index) => {
    const x = LEFT_GUTTER + index * dayWidth;
    context.fillText(day, x + dayWidth / 2, TOP_HEADER + 39);
    context.beginPath();
    context.moveTo(x, TOP_HEADER);
    context.lineTo(x, gridTop + calendarHeight);
    context.stroke();
  });

  context.textAlign = "right";
  context.font = "18px system-ui, sans-serif";
  for (let index = 0; index <= halfHourRows; index += 1) {
    const minutes = range.startMinutes + index * 30;
    const y = gridTop + index * HALF_HOUR_HEIGHT;
    context.strokeStyle = minutes % 60 === 0 ? "#d1d5db" : "#e5e7eb";
    context.lineWidth = minutes % 60 === 0 ? 2 : 1;
    context.beginPath();
    context.moveTo(LEFT_GUTTER, y);
    context.lineTo(EXPORT_WIDTH - RIGHT_GUTTER, y);
    context.stroke();

    if (index < halfHourRows) {
      context.fillStyle = minutes % 60 === 0 ? "#4b5563" : "#9ca3af";
      context.fillText(minutesToTime(minutes), LEFT_GUTTER - 14, y + 6);
    }
  }

  const positionedBlocks = getPositionedBlocks(program.courseBlocks);

  positionedBlocks.forEach(({ block, column, columnCount }) => {
    const dayIndex = days.indexOf(block.day as Day);
    const columnWidth = dayWidth / columnCount;
    const x = LEFT_GUTTER + dayIndex * dayWidth + column * columnWidth + 4;
    const y =
      gridTop +
      ((timeToMinutes(block.startTime) - range.startMinutes) / 30) *
        HALF_HOUR_HEIGHT +
      3;
    const width = columnWidth - 8;
    const height = Math.max(
      28,
      ((timeToMinutes(block.endTime) - timeToMinutes(block.startTime)) / 30) *
        HALF_HOUR_HEIGHT -
        6,
    );
    const selectionId = block.selectionId ?? block.id;
    const colorIndex = Math.max(0, selectionOrder.indexOf(selectionId));
    const color = JPEG_COLORS[colorIndex % JPEG_COLORS.length];

    roundedRectangle(context, x, y, width, height, 10);
    context.fillStyle = color.background;
    context.fill();
    context.strokeStyle = color.border;
    context.lineWidth = 2;
    context.stroke();

    context.save();
    roundedRectangle(context, x + 2, y + 2, width - 4, height - 4, 8);
    context.clip();
    context.textAlign = "left";
    context.fillStyle = color.text;
    context.font = "700 18px system-ui, sans-serif";
    context.fillText(
      truncateText(
        context,
        `${block.code}${block.crn ? ` · ${block.crn}` : ""}`,
        width - 20,
      ),
      x + 10,
      y + 23,
    );

    if (height >= 52) {
      context.font = "16px system-ui, sans-serif";
      context.fillText(
        `${block.startTime}–${block.endTime}`,
        x + 10,
        y + 46,
      );
    }

    if (height >= 76 && (block.building || block.room)) {
      context.fillText(
        truncateText(
          context,
          [block.building, block.room].filter(Boolean).join(" · "),
          width - 20,
        ),
        x + 10,
        y + 68,
      );
    }
    context.restore();
  });

  const legendTop = gridTop + calendarHeight + 48;
  context.textAlign = "left";
  context.fillStyle = "#111827";
  context.font = "700 26px system-ui, sans-serif";
  context.fillText("Course details", LEFT_GUTTER, legendTop);

  legendBlocks.forEach((block, index) => {
    const y = legendTop + 34 + index * LEGEND_ITEM_HEIGHT;
    const selectionId = block.selectionId ?? block.id;
    const colorIndex = Math.max(0, selectionOrder.indexOf(selectionId));
    const color = JPEG_COLORS[colorIndex % JPEG_COLORS.length];
    context.fillStyle = color.background;
    context.strokeStyle = color.border;
    context.lineWidth = 2;
    roundedRectangle(context, LEFT_GUTTER, y, 28, 28, 6);
    context.fill();
    context.stroke();
    context.fillStyle = "#111827";
    context.font = "700 19px system-ui, sans-serif";
    context.fillText(
      `${block.code}${block.crn ? ` · ${block.crn}` : ""}`,
      LEFT_GUTTER + 44,
      y + 20,
    );
    context.fillStyle = "#4b5563";
    context.font = "17px system-ui, sans-serif";
    context.fillText(
      truncateText(
        context,
        [block.title, block.instructor ?? "Instructor TBA"]
          .filter(Boolean)
          .join(" · "),
        EXPORT_WIDTH - LEFT_GUTTER * 2 - 280,
      ),
      LEFT_GUTTER + 280,
      y + 20,
    );
  });

  const filename = createWeeklyProgramJpegFilename(program.name);
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/jpeg", 0.92);
  document.body.appendChild(link);
  link.click();
  link.remove();

  return filename;
}
