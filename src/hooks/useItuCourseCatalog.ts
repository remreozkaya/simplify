"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ITU_CACHE_REVALIDATE_SECONDS } from "@/lib/itu/constants";
import { isCatalogFresh, markCatalogUnavailable, mergeSemesterCatalog, parseCalendarCatalog } from "@/lib/itu/services/semesterCache";

import type { FacultyOption } from "@/types/calendar";

type ItuBranch = {
  id: number;
  code: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseBranches(value: unknown): ItuBranch[] {
  if (!isRecord(value) || !Array.isArray(value.branches)) {
    throw new Error("The branches API returned an invalid response.");
  }

  const branches = value.branches.filter(
    (branch): branch is ItuBranch =>
      isRecord(branch) &&
      typeof branch.id === "number" &&
      Number.isInteger(branch.id) &&
      branch.id > 0 &&
      typeof branch.code === "string" &&
      branch.code.length > 0,
  );

  if (branches.length !== value.branches.length) {
    throw new Error("The branches API returned malformed branch data.");
  }

  return [...branches].sort((first, second) =>
    first.code.localeCompare(second.code, "tr"),
  );
}

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body: unknown = await response.json();

    if (
      isRecord(body) &&
      isRecord(body.error) &&
      typeof body.error.message === "string"
    ) {
      return body.error.message;
    }
  } catch {
    // Use the stable fallback when an upstream response body is malformed.
  }

  return fallback;
}

export function useItuCourseCatalog() {
  const [branches, setBranches] = useState<ItuBranch[]>([]);
  const [catalogByCode, setCatalogByCode] = useState<
    Record<string, FacultyOption>
  >({});
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);
  const [loadingBranchCodes, setLoadingBranchCodes] = useState<Set<string>>(
    new Set(),
  );
  const [error, setError] = useState<string | null>(null);
  const [unavailableBranchCodes, setUnavailableBranchCodes] = useState<Set<string>>(new Set());
  const [failedBranchCode, setFailedBranchCode] = useState<string | null>(null);
  const [branchRequestVersion, setBranchRequestVersion] = useState(0);
  const inFlightBranchCodes = useRef<Set<string>>(new Set());
  const catalogRef = useRef(catalogByCode);

  useEffect(() => {
    catalogRef.current = catalogByCode;
  }, [catalogByCode]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBranches() {
      try {
        setIsLoadingBranches(true);
        setError(null);
        setFailedBranchCode(null);

        const response = await fetch("/api/itu/branches", {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            await readErrorMessage(
              response,
              "İTÜ course branches could not be loaded.",
            ),
          );
        }

        setBranches(parseBranches((await response.json()) as unknown));
      } catch (requestError: unknown) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "İTÜ course branches could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingBranches(false);
        }
      }
    }

    void loadBranches();

    return () => controller.abort();
  }, [branchRequestVersion]);

  const loadBranch = useCallback(
    async (branchCode: string, force = false): Promise<void> => {
      const normalizedBranchCode = branchCode.trim().toUpperCase();

      if (
        !normalizedBranchCode ||
        (!force && isCatalogFresh(catalogRef.current[normalizedBranchCode])) ||
        inFlightBranchCodes.current.has(normalizedBranchCode)
      ) {
        return;
      }

      const branch = branches.find(
        (candidate) => candidate.code === normalizedBranchCode,
      );

      if (!branch) {
        setError(`No İTÜ branch was found for ${normalizedBranchCode}.`);
        setFailedBranchCode(null);
        return;
      }

      inFlightBranchCodes.current.add(normalizedBranchCode);
      setLoadingBranchCodes((current) =>
        new Set(current).add(normalizedBranchCode),
      );
      setError(null);
      setFailedBranchCode(null);

      try {
        const parameters = new URLSearchParams({
          branchId: branch.id.toString(),
          branchCode: branch.code,
        });
        const response = await fetch(
          `/api/itu/courses?${parameters.toString()}`,
          { method: "GET", cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error(
            await readErrorMessage(
              response,
              `${normalizedBranchCode} courses could not be loaded.`,
            ),
          );
        }

        const catalog = parseCalendarCatalog(
          (await response.json()) as unknown,
          normalizedBranchCode,
        );

        const next = mergeSemesterCatalog(catalogRef.current, catalog);
        catalogRef.current = next;
        setCatalogByCode(next);
        setUnavailableBranchCodes((current) => {
          const available = new Set(current);
          available.delete(normalizedBranchCode);
          return available;
        });
      } catch (requestError: unknown) {
        setUnavailableBranchCodes((current) => new Set(current).add(normalizedBranchCode));
        setFailedBranchCode(normalizedBranchCode);
        setError(
          requestError instanceof Error
            ? requestError.message
            : `${normalizedBranchCode} courses could not be loaded.`,
        );
      } finally {
        inFlightBranchCodes.current.delete(normalizedBranchCode);
        setLoadingBranchCodes((current) => {
          const next = new Set(current);
          next.delete(normalizedBranchCode);
          return next;
        });
      }
    },
    [branches],
  );

  useEffect(() => {
    const refreshLoadedBranches = () => {
      if (document.visibilityState === "hidden") return;
      for (const code of Object.keys(catalogRef.current)) void loadBranch(code);
    };
    const interval = window.setInterval(refreshLoadedBranches, ITU_CACHE_REVALIDATE_SECONDS * 1000);
    window.addEventListener("focus", refreshLoadedBranches);
    document.addEventListener("visibilitychange", refreshLoadedBranches);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshLoadedBranches);
      document.removeEventListener("visibilitychange", refreshLoadedBranches);
    };
  }, [loadBranch]);

  const retryBranches = useCallback(() => {
    setBranchRequestVersion((current) => current + 1);
  }, []);

  const retryFailedBranch = useCallback(() => {
    if (failedBranchCode) {
      void loadBranch(failedBranchCode, true);
    }
  }, [failedBranchCode, loadBranch]);

  const courseCatalog = useMemo<FacultyOption[]>(
    () =>
      branches.map(
        (branch) =>
          (catalogByCode[branch.code] && unavailableBranchCodes.has(branch.code)
            ? markCatalogUnavailable(catalogByCode[branch.code])
            : catalogByCode[branch.code]) ?? {
            facultyCode: branch.code,
            courses: [],
          },
      ),
    [branches, catalogByCode, unavailableBranchCodes],
  );
  const loadedBranchCodes = useMemo(
    () => new Set(Object.keys(catalogByCode)),
    [catalogByCode],
  );

  const isBranchLoading = useCallback(
    (branchCode: string) => loadingBranchCodes.has(branchCode),
    [loadingBranchCodes],
  );

  return {
    branches,
    courseCatalog,
    loadedBranchCodes,
    isLoadingBranches,
    isBranchLoading,
    loadBranch,
    retryBranches,
    retryFailedBranch,
    failedBranchCode,
    error,
  };
}
