import { z } from "zod";

const PROGRAM_CODE_PATTERN = /^[A-Z0-9_]{2,20}_LS$/;

export const curriculumProgramCodeSchema = z.preprocess(
  (value) =>
    typeof value === "string"
      ? value.replace(/\s+/g, "").toUpperCase()
      : value,
  z.string().regex(PROGRAM_CODE_PATTERN),
);

export const curriculumPlanIdSchema = z.coerce.number().int().positive();
export const curriculumGroupIdSchema = z.coerce.number().int().positive();
