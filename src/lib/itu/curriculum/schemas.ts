import { z } from "zod";
import catalog from "@/data/itu/curriculum-catalog.json";

const PROGRAM_CODE_PATTERN = /^[A-Z0-9_]{2,20}_LS$/;
const MINOR_PROGRAM_CODES = new Set(
  catalog.programs.filter((program) => program.planType === "yandal").map((program) => program.code),
);

export const curriculumProgramCodeSchema = z.preprocess(
  (value) =>
    typeof value === "string"
      ? value.replace(/\s+/g, "").toUpperCase()
      : value,
  z.string().refine((code) => PROGRAM_CODE_PATTERN.test(code) || MINOR_PROGRAM_CODES.has(code)),
);

export const curriculumPlanIdSchema = z.coerce.number().int().positive();
export const curriculumGroupIdSchema = z.coerce.number().int().positive();
