import { ituBranchSchema } from "@/lib/itu/schemas";
import type { ItuBranch } from "@/lib/itu/types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function getBranchEntries(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
    throw new Error("The İTÜ branch response is not a list.");
  }

  for (const key of ["branches", "data", "items", "result"]) {
    const value = payload[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  throw new Error("The İTÜ branch response does not contain a branch list.");
}

function readBranch(entry: unknown): ItuBranch | null {
  if (!isRecord(entry)) {
    return null;
  }

  const result = ituBranchSchema.safeParse({
    id:
      entry.bransKoduId ??
      entry.dersBransKoduId ??
      entry.id,
    code:
      entry.dersBransKodu ??
      entry.bransKodu ??
      entry.code,
    name:
      entry.bransKoduAdi ??
      entry.dersBransKoduAdi ??
      entry.name,
  });

  return result.success ? result.data : null;
}

export function parseUndergraduateBranches(
  payload: unknown,
): ItuBranch[] {
  const uniqueBranches = new Map<string, ItuBranch>();

  for (const entry of getBranchEntries(payload)) {
    const branch = readBranch(entry);

    if (!branch || uniqueBranches.has(branch.code)) {
      continue;
    }

    uniqueBranches.set(branch.code, branch);
  }

  return [...uniqueBranches.values()].sort((first, second) =>
    first.code.localeCompare(second.code, "tr"),
  );
}
