"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useProfile } from "@/components/profile/ProfileProvider";
import { loadWeeklyPrograms, WEEKLY_PROGRAMS_STORAGE_KEY } from "@/lib/calendar/persistence";
import { GRADES, type Grade } from "@/lib/curriculum/grades";
import { CURRICULUM_PROGRESS_EVENT, CURRICULUM_PROGRESS_STORAGE_KEY, parseCurriculumProgress } from "@/lib/curriculum/progress";
import {
  CURRENT_SEMESTER_EVENT, CURRENT_SEMESTER_STORAGE_KEY,
  currentSemesterGpa, groupTranscriptSemesters, parseCurrentSemester, serializeCurrentSemester, semesterTermLabel, importWeeklySemesterCourses,
  resolveSemesterCourseCredits, projectedOverallGpa, displayedGpaChange,
  type CurrentSemesterCourse,
} from "@/lib/curriculum/semesters";
import { loadSharedTranscript, parseTranscriptHistory, SHARED_TRANSCRIPT_EVENT, SHARED_TRANSCRIPT_STORAGE_KEY } from "@/lib/curriculum/transcriptStore";
import { calculateGpa } from "@/lib/curriculum/transcript";
import { responseJson } from "@/lib/http/responseJson";
import { formatNumber, localizedCourseTitle } from "@/lib/i18n";
import { useLanguage } from "@/lib/i18n/client";
import type { ItuCurriculum, ItuElectiveCourse } from "@/lib/itu/curriculum/types";
import { courseLanguageVariants, normalizeCourseCode } from "@/lib/itu/courseCode.mjs";

const panel = "rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-600 dark:bg-slate-950 dark:text-white";
const cell = "px-4 py-3 text-left";

function subscribe(callback: () => void) {
  const events = ["storage", SHARED_TRANSCRIPT_EVENT, CURRICULUM_PROGRESS_EVENT, CURRENT_SEMESTER_EVENT];
  events.forEach(event => window.addEventListener(event, callback));
  return () => events.forEach(event => window.removeEventListener(event, callback));
}

function useStoredValue(key: string) {
  return useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(key); } catch { return null; }
  }, () => null);
}

export default function MySemesters() {
  const { profile } = useProfile();
  const { language, t } = useLanguage();
  const currentValue = useStoredValue(CURRENT_SEMESTER_STORAGE_KEY);
  const transcriptValue = useStoredValue(SHARED_TRANSCRIPT_STORAGE_KEY);
  const progressValue = useStoredValue(CURRICULUM_PROGRESS_STORAGE_KEY);
  const weeklyValue = useStoredValue(WEEKLY_PROGRAMS_STORAGE_KEY);
  const weeklyPrograms = useMemo(() => loadWeeklyPrograms({ getItem: () => weeklyValue }).programs, [weeklyValue]);
  const [weeklyProgramId, setWeeklyProgramId] = useState("");
  const weeklyProgram = weeklyPrograms.find(program => program.id === weeklyProgramId) ?? weeklyPrograms[0];
  const storedCurrent = useMemo(() => parseCurrentSemester(currentValue), [currentValue]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const addButton = useRef<HTMLButtonElement>(null);
  const transcript = useMemo(() => loadSharedTranscript(transcriptValue, progressValue).courses, [transcriptValue, progressValue]);
  const semesters = useMemo(() => {
    const history = parseTranscriptHistory(transcriptValue);
    return groupTranscriptSemesters(history.length ? history : transcript);
  }, [transcriptValue, transcript]);
  const [storageError, setStorageError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; curricula: ItuCurriculum[]; failed: boolean }>({ key: "", curricula: [], failed: false });
  const enrollments = profile.programEnrollments;
  const requestKey = JSON.stringify([enrollments, retry]);
  const loading = enrollments.length > 0 && loaded.key !== requestKey;
  const [creditLookup, setCreditLookup] = useState<{ key: string; credits: Record<string, number | null>; failed: boolean }>({ key: "", credits: {}, failed: false });
  const creditCodes = [...new Set([
    ...storedCurrent.map(course => course.courseCode),
    ...(weeklyProgram ? importWeeklySemesterCourses([], weeklyProgram, new Map()).map(course => course.courseCode) : []),
  ].map(normalizeCourseCode))].sort();
  const creditKey = JSON.stringify(creditCodes);

  useEffect(() => {
    const codes = JSON.parse(creditKey) as string[];
    if (!codes.length) return;
    const controller = new AbortController();
    const parameters = new URLSearchParams();
    codes.forEach(code => parameters.append("code", code));
    void fetch(`/api/itu/course-credits?${parameters}`, { signal: controller.signal })
      .then(response => responseJson<{ credits: Record<string, number | null> }>(response))
      .then(({ credits }) => {
        if (!controller.signal.aborted) setCreditLookup({ key: creditKey, credits, failed: false });
      }).catch(() => {
        if (!controller.signal.aborted) setCreditLookup({ key: creditKey, credits: {}, failed: true });
      });
    return () => controller.abort();
  }, [creditKey, retry]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled(enrollments.map(async enrollment => {
      const parameters = new URLSearchParams({ programCode: enrollment.programCode, planType: enrollment.planType });
      if (enrollment.primaryProgramCode) parameters.set("primaryProgramCode", enrollment.primaryProgramCode);
      const response = await fetch(`/api/itu/curriculum/${enrollment.curriculumPlanId}?${parameters}`, { signal: controller.signal });
      const { curriculum } = await responseJson<{ curriculum: ItuCurriculum }>(response);
      return curriculum;
    })).then(results => {
      if (controller.signal.aborted) return;
      setLoaded({ key: requestKey, curricula: results.flatMap(result => result.status === "fulfilled" ? [result.value] : []), failed: results.some(result => result.status === "rejected") });
    });
    return () => controller.abort();
  }, [enrollments, requestKey]);

  const curriculumCourses = useMemo(() => {
    const courses = new Map<string, ItuElectiveCourse>();
    if (loaded.key === requestKey) loaded.curricula.forEach(curriculum => curriculum.semesters.forEach(semester => semester.items.forEach(item => {
      (item.kind === "course" ? [item] : item.courses).forEach(course => courses.set(normalizeCourseCode(course.code), course));
    })));
    return courses;
  }, [loaded, requestKey]);
  const current = useMemo(() => resolveSemesterCourseCredits(storedCurrent, curriculumCourses, creditLookup.key === creditKey ? creditLookup.credits : {}), [storedCurrent, curriculumCourses, creditLookup, creditKey]);

  const candidates = useMemo(() => {
    const passed = new Set(transcript.filter(course => course.completionStatus === "passed").map(course => normalizeCourseCode(course.courseCode)));
    const courses = new Map<string, ItuElectiveCourse>();
    if (loaded.key !== requestKey) return courses;
    for (const curriculum of loaded.curricula) {
      const progress = parseCurriculumProgress(progressValue, curriculum.planId);
      Object.entries(progress.courses).forEach(([code, course]) => {
        if (course.state === "passed") passed.add(normalizeCourseCode(course.courseCode ?? code));
      });
    }
    for (const curriculum of loaded.curricula) {
      for (const semester of curriculum.semesters) {
        for (const item of semester.items) {
          for (const course of item.kind === "course" ? [item] : item.courses) {
            const code = normalizeCourseCode(course.code);
            if (!courseLanguageVariants(code).some(variant => passed.has(variant)) && course.creditOptions.length) {
              courses.set(code, { ...course, code });
            }
          }
        }
      }
    }
    return new Map([...courses].sort(([a], [b]) => a.localeCompare(b)));
  }, [loaded, requestKey, progressValue, transcript]);

  function save(courses: CurrentSemesterCourse[]) {
    try {
      localStorage.setItem(CURRENT_SEMESTER_STORAGE_KEY, serializeCurrentSemester(courses));
      window.dispatchEvent(new Event(CURRENT_SEMESTER_EVENT));
      setStorageError(false);
    } catch { setStorageError(true); }
  }

  function selectCourse(code: string) {
    const course = candidates.get(code);
    if (!course || current.some(selected => selected.courseCode === code)) return;
    const selected: CurrentSemesterCourse = { courseCode: code, courseName: course.title, credit: course.creditOptions.length === 1 ? course.creditOptions[0] : null, grade: null };
    save([...current, selected]);
    closePicker();
  }

  function closePicker() {
    setPickerOpen(false);
    setSearch("");
    addButton.current?.focus();
  }

  function importWeeklyCourses() {
    if (!weeklyProgram) return;
    save(resolveSemesterCourseCredits(importWeeklySemesterCourses(current, weeklyProgram, curriculumCourses), curriculumCourses, creditLookup.key === creditKey ? creditLookup.credits : {}));
  }

  const number = (value: number) => formatNumber(language, value);
  const gpa = (value: number | null) => value === null ? "—" : formatNumber(language, value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const available = [...candidates.values()].filter(course => !current.some(selected => selected.courseCode === course.code));
  const matches = available.filter(course => `${course.code} ${localizedCourseTitle(course, language)}`.toLocaleLowerCase(language).includes(search.toLocaleLowerCase(language).trim()));
  const missingCredits = current.some(course => course.credit === null);
  const summary = (count: number, credits: number | null) => t("semesters.coursesCredits", { courses: count, credits: credits === null ? "—" : number(credits) });
  const headers = ["common.courseCode", "common.courseName", "common.credit", "common.grade"];
  const overallGpa = calculateGpa(transcript);
  const projectedGpa = projectedOverallGpa(transcript, current);
  const gpaChange = displayedGpaChange(overallGpa, projectedGpa);

  return (
    <div className="space-y-8 text-slate-950 dark:text-slate-100">
      <details open className={panel}>
        <summary className="cursor-pointer rounded-2xl p-4 focus-visible:outline-2 focus-visible:outline-blue-600 sm:p-5">
          <span className="ml-2 text-lg font-semibold">{t("semesters.current")}</span>
          <span className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-300">{summary(current.length, current.some(course => course.credit === null) ? null : current.reduce((total, course) => total + (course.credit ?? 0), 0))}</span>
            <span className="flex flex-wrap items-center gap-x-6 gap-y-3" aria-live="polite">
              <span className="flex flex-col gap-1">
                <span className="text-xs text-slate-500 dark:text-slate-400">{t("semesters.projectedGpa")}</span>
                <strong className="text-2xl leading-7 font-semibold tracking-tight tabular-nums text-blue-700 dark:text-blue-300">{gpa(currentSemesterGpa(current))}</strong>
              </span>
              <span className="flex flex-col gap-1.5 border-l border-slate-200 pl-4 dark:border-slate-700">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("semesters.overallGpa")}</span>
                <span className="flex flex-wrap items-center gap-4">
                  <span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400"><span className="sr-only">{t("semesters.currentOverallGpa")}</span><span aria-hidden="true">{t("common.current")}</span></span>
                    <span className="mt-1 block text-2xl leading-7 font-semibold tracking-tight tabular-nums">{gpa(overallGpa)}</span>
                  </span>
                  <span aria-hidden="true" className="text-xl text-slate-400 dark:text-slate-500">→</span>
                  <span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400"><span className="sr-only">{t("semesters.projectedOverallGpa")}</span><span aria-hidden="true">{t("semesters.projected")}</span></span>
                    <span className="mt-1 block text-2xl leading-7 font-semibold tracking-tight tabular-nums text-blue-700 dark:text-blue-300">{gpa(projectedGpa)}</span>
                  </span>
                  {gpaChange !== null ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${gpaChange > 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : gpaChange < 0 ? "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                    <span className="sr-only">{t("semesters.gpaChange")}: </span>{gpaChange > 0 ? "+" : gpaChange < 0 ? "−" : ""}{gpa(Math.abs(gpaChange))}
                  </span> : null}
                </span>
              </span>
            </span>
          </span>
        </summary>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800 sm:p-4">
          {loaded.failed ? <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-300">{t("semesters.loadError")} <button type="button" className="underline" onClick={() => setRetry(value => value + 1)}>{t("semesters.retry")}</button></p> : null}
          {missingCredits ? <p role="status" className="mb-4 text-sm text-slate-600 dark:text-slate-300">{t(creditLookup.key !== creditKey ? "semesters.loadingCredits" : "semesters.unavailableCredits")}{creditLookup.failed ? <> <button type="button" className="underline" onClick={() => setRetry(value => value + 1)}>{t("semesters.retry")}</button></> : null}</p> : null}
          {storageError ? <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-300">{t("semesters.storageError")}</p> : null}
          {current.length ? <div className="mb-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm [&_th]:py-2 [&_td]:py-2 [&_select]:py-1.5 [&_button]:py-1.5">
              <caption className="sr-only">{t("semesters.current")}</caption>
              <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300"><tr>{headers.map(header => <th scope="col" key={header} className={cell}>{t(header)}</th>)}<th scope="col" className={cell}><span className="sr-only">{t("common.remove")}</span></th></tr></thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {current.map((course, row) => {
                  const candidate = candidates.get(course.courseCode);
                  return <tr key={course.courseCode}>
                    <td className={`${cell} whitespace-nowrap font-medium`}>{course.courseCode}</td>
                    <td className={cell}>{candidate ? localizedCourseTitle(candidate, language) : course.courseName}</td>
                    <td className={`${cell} tabular-nums`}>{course.credit === null ? "—" : number(course.credit)}</td>
                    <td className={cell}><select className={`${input} min-w-32`} aria-label={t("semesters.gradeSelection", { code: course.courseCode })} value={course.grade ?? ""} onChange={event => save(current.map((value, index) => index === row ? { ...value, grade: (event.target.value || null) as Grade | null } : value))}>
                      <option value="">{t("semesters.selectGrade")}</option>
                      {GRADES.map(grade => <option key={grade} value={grade}>{grade}</option>)}
                    </select></td>
                    <td className={cell}><button type="button" className="rounded-lg px-3 py-2 text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 dark:text-red-300 dark:hover:bg-red-950" aria-label={t("semesters.removeCourse", { code: course.courseCode })} onClick={() => save(current.filter((_, index) => index !== row))}>{t("common.remove")}</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div> : <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">{t("semesters.emptyCurrent")}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button ref={addButton} type="button" aria-expanded={pickerOpen} aria-controls="semester-course-picker" onClick={() => pickerOpen ? closePicker() : setPickerOpen(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{t("semesters.addCourseButton")}</button>
            {weeklyPrograms.length > 1 ? <select className={`${input} sm:max-w-xs`} aria-label={t("semesters.weeklyPlan")} value={weeklyProgram?.id ?? ""} onChange={event => setWeeklyProgramId(event.target.value)}>
              {weeklyPrograms.map(program => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select> : null}
            <button type="button" disabled={!weeklyProgram || loading || !(weeklyProgram.courseBlocks.length || weeklyProgram.courseSelections.some(selection => selection.sectionId))} onClick={importWeeklyCourses} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50">{t("semesters.importWeekly")}</button>
            {!weeklyPrograms.length ? <Link href="/weekly-planner" className="text-sm font-semibold text-blue-700 underline dark:text-blue-300">{t("navigation.weeklyPlanner")}</Link> : null}
          </div>
          {pickerOpen ? <section id="semester-course-picker" aria-label={t("semesters.addCourseButton")} className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700" onKeyDown={event => { if (event.key === "Escape") closePicker(); }}>
            <div className="mb-3 flex items-center gap-3">
              <input autoFocus type="search" className={input} aria-label={t("semesters.searchCourses")} placeholder={t("semesters.searchCourses")} value={search} onChange={event => setSearch(event.target.value)} />
              <button type="button" onClick={closePicker} className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">{t("semesters.closePicker")}</button>
            </div>
            {!enrollments.length ? <Link href="/profile" className="text-sm font-semibold text-blue-700 underline dark:text-blue-300">{t("navigation.viewProfile")}</Link> : loading ? <p role="status" className="text-sm">{t("semesters.loading")}</p> : <ul className="max-h-72 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
              {matches.map(course => <li key={course.code}><button type="button" className="w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-slate-800" onClick={() => selectCourse(course.code)}><strong className="mr-3">{course.code}</strong>{localizedCourseTitle(course, language)}</button></li>)}
              {!matches.length ? <li className="p-3 text-sm text-slate-500 dark:text-slate-400">{t("semesters.noAvailable")}</li> : null}
            </ul>}
          </section> : null}
        </div>
      </details>

      <section aria-labelledby="previous-semesters" className="space-y-4">
        <h2 id="previous-semesters" className="text-xl font-semibold">{t("semesters.previous")}</h2>
        {!semesters.length ? <p className={`${panel} p-6 text-sm text-slate-600 dark:text-slate-300`}>{t("semesters.emptyHistory")} <Link href="/graduation-calculator" className="font-semibold text-blue-700 underline dark:text-blue-300">{t("navigation.graduationCalculator")}</Link></p> : semesters.map(semester => (
          <details key={semester.term} className={panel}>
            <summary className="cursor-pointer rounded-2xl p-5 focus-visible:outline-2 focus-visible:outline-blue-600 sm:p-6">
              <span className="ml-2 font-semibold">{semesterTermLabel(semester.term, language)}</span>
              <span className="mt-2 flex flex-wrap justify-between gap-3 text-sm text-slate-600 dark:text-slate-300">
                <span>{summary(semester.courses.length, semester.courses.reduce((total, course) => total + course.transcriptCredit, 0))}</span>
                <span>{t("semesters.gpa")}: <strong className="tabular-nums text-slate-950 dark:text-white">{gpa(semester.gpa)}</strong></span>
              </span>
            </summary>
            <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">{semesterTermLabel(semester.term, language)}</caption>
                <thead className="bg-slate-50 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300"><tr>{headers.map(header => <th scope="col" key={header} className={cell}>{t(header)}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">{semester.courses.map((course, index) => <tr key={`${course.courseCode}-${index}`}>
                  <td className={`${cell} whitespace-nowrap font-medium`}>{course.courseCode}</td>
                  <td className={cell}>{course.courseName}</td>
                  <td className={`${cell} tabular-nums`}>{number(course.transcriptCredit)}</td>
                  <td className={`${cell} font-medium`}>{course.grade}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
