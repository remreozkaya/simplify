"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { FacultyOption } from "@/types/calendar";

type ItuBranch = {
  id: number;
  code: string;
};

type BranchesApiResponse = {
  branches: ItuBranch[];
};

type CoursesApiResponse = {
  catalog: FacultyOption;
};

export function useItuCourseCatalog() {
  const [branches, setBranches] = useState<ItuBranch[]>([]);

  const [catalogByCode, setCatalogByCode] = useState<
    Record<string, FacultyOption>
  >({});

  const [isLoadingBranches, setIsLoadingBranches] =
    useState(true);

  const [loadingBranchCodes, setLoadingBranchCodes] =
    useState<Set<string>>(new Set());

  const [error, setError] = useState<string | null>(null);

  const inFlightBranchCodes = useRef<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadBranches() {
      try {
        setIsLoadingBranches(true);
        setError(null);

        const response = await fetch("/api/itu/branches", {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Branch request failed with status ${response.status}.`,
          );
        }

        const data =
          (await response.json()) as BranchesApiResponse;

        if (!Array.isArray(data.branches)) {
          throw new Error(
            "The branches API returned an invalid response.",
          );
        }

        const sortedBranches = [...data.branches].sort(
          (first, second) =>
            first.code.localeCompare(second.code),
        );

        setBranches(sortedBranches);
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
            : "Course branches could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingBranches(false);
        }
      }
    }

    void loadBranches();

    return () => {
      controller.abort();
    };
  }, []);

  const loadBranch = useCallback(
    async (branchCode: string): Promise<void> => {
      const normalizedBranchCode = branchCode
        .trim()
        .toUpperCase();

      if (!normalizedBranchCode) {
        return;
      }

      if (catalogByCode[normalizedBranchCode]) {
        return;
      }

      if (
        inFlightBranchCodes.current.has(
          normalizedBranchCode,
        )
      ) {
        return;
      }

      const branch = branches.find(
        (currentBranch) =>
          currentBranch.code === normalizedBranchCode,
      );

      if (!branch) {
        setError(
          `No İTÜ branch was found for ${normalizedBranchCode}.`,
        );

        return;
      }

      inFlightBranchCodes.current.add(
        normalizedBranchCode,
      );

      setLoadingBranchCodes((currentCodes) => {
        const nextCodes = new Set(currentCodes);
        nextCodes.add(normalizedBranchCode);
        return nextCodes;
      });

      setError(null);

      try {
        const parameters = new URLSearchParams({
          branchId: branch.id.toString(),
          branchCode: branch.code,
        });

        const response = await fetch(
          `/api/itu/courses?${parameters.toString()}`,
          {
            method: "GET",
          },
        );

        if (!response.ok) {
          throw new Error(
            `${normalizedBranchCode} courses could not be loaded. ` +
              `Status: ${response.status}.`,
          );
        }

        const data =
          (await response.json()) as CoursesApiResponse;

        if (
          !data.catalog ||
          data.catalog.facultyCode !==
            normalizedBranchCode ||
          !Array.isArray(data.catalog.courses)
        ) {
          throw new Error(
            `The ${normalizedBranchCode} catalogue response is invalid.`,
          );
        }

        setCatalogByCode((currentCatalog) => ({
          ...currentCatalog,
          [normalizedBranchCode]: data.catalog,
        }));
      } catch (requestError: unknown) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : `${normalizedBranchCode} courses could not be loaded.`,
        );
      } finally {
        inFlightBranchCodes.current.delete(
          normalizedBranchCode,
        );

        setLoadingBranchCodes((currentCodes) => {
          const nextCodes = new Set(currentCodes);
          nextCodes.delete(normalizedBranchCode);
          return nextCodes;
        });
      }
    },
    [branches, catalogByCode],
  );

  const courseCatalog = useMemo<FacultyOption[]>(
    () =>
      branches.map((branch) => {
        return (
          catalogByCode[branch.code] ?? {
            facultyCode: branch.code,
            courses: [],
          }
        );
      }),
    [branches, catalogByCode],
  );

  const isBranchLoading = useCallback(
    (branchCode: string) =>
      loadingBranchCodes.has(branchCode),
    [loadingBranchCodes],
  );

  return {
    branches,
    courseCatalog,
    isLoadingBranches,
    isBranchLoading,
    loadBranch,
    error,
  };
}