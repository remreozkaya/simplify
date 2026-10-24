"use client";

import { useEffect, useState } from "react";
import { courseInformationQuery } from "@/lib/itu/courseInformation.mjs";
import { useLanguage } from "@/lib/i18n/client";

type State = "loading" | "available" | "missing" | "unknown";

export function CourseInformationStatus({ code, state }: { code: string; state: State }) {
  const { t } = useLanguage();
  const query = courseInformationQuery(code);
  if (state === "available" && query) {
    return <a href={query.url} target="_blank" rel="noopener noreferrer"
      title={t("weeklyPlanner.openCourseInformation")}
      className="rounded-sm text-blue-600 underline decoration-blue-300 underline-offset-4 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
      {code}<span aria-hidden="true" className="ml-1 text-sm">↗</span>
      <span className="sr-only"> · {t("weeklyPlanner.openCourseInformation")}</span>
    </a>;
  }
  return <span>{code}<span role="status" className="mt-1 block text-xs font-normal text-gray-500">
    {t(!query || state === "missing" ? "weeklyPlanner.courseInformationMissing" :
      state === "loading" ? "weeklyPlanner.courseInformationLoading" : "weeklyPlanner.courseInformationUnknown")}
  </span></span>;
}

export default function CourseInformationLink({ code }: { code: string }) {
  const [result, setResult] = useState<{ code: string; state: State } | null>(null);
  const valid = courseInformationQuery(code) !== null;
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    async function check() {
      try {
        const response = await fetch(`/api/itu/course-information?${new URLSearchParams({ code })}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Course information unavailable");
        const data: unknown = await response.json();
        const state = typeof data === "object" && data !== null && "state" in data ? data.state : null;
        if (state !== "available" && state !== "missing") throw new Error("Invalid course information");
        if (active) setResult({ code, state });
      } catch {
        if (active) setResult({ code, state: "unknown" });
      } finally { clearTimeout(timeout); }
    }
    void check();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [code, valid]);
  return <CourseInformationStatus code={code} state={!valid ? "missing" : result?.code === code ? result.state : "loading"} />;
}
