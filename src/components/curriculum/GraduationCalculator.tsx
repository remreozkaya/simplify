"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import ProgramTabs, { programPanelId, programTabId } from "@/components/curriculum/ProgramTabs";
import { useProfile } from "@/components/profile/ProfileProvider";
import { applyTranscriptImport, calculateProgramGpa, curriculumTotals, progressForRequirement, type CourseMatchIssue, type RequirementProgress } from "@/lib/curriculum/graduation";
import { CURRICULUM_PROGRESS_STORAGE_KEY, parseCurriculumProgress, persistCurriculumProgress, resetImportedProgress } from "@/lib/curriculum/progress";
import { parseSavedCurriculum, SAVED_CURRICULUM_STORAGE_KEY } from "@/lib/curriculum/selection";
import { calculateGpa, parseTranscriptMarkdown, type TranscriptParseResult } from "@/lib/curriculum/transcript";
import { mergeTranscriptCourses, parseSharedTranscript, persistSharedTranscript, SHARED_TRANSCRIPT_STORAGE_KEY, transcriptFromLegacyProgress, transcriptFromLegacyProgressStore, transcriptParseResult } from "@/lib/curriculum/transcriptStore";
import type { CurriculumProgress, TranscriptCourseRecord } from "@/lib/curriculum/types";
import { type ProgramEnrollment } from "@/lib/profile/types";
import { orderedEnrollments } from "@/lib/profile/validation";
import type { ItuCurriculum, ItuCurriculumItem, ItuUndergraduateProgram } from "@/lib/itu/curriculum/types";
import { groupCurriculum } from "@/lib/curriculum/grouping";
import { useLanguage } from "@/lib/i18n/client";
import { formatNumber, localizedAcademicName, localizeRuntimeMessage } from "@/lib/i18n";

type ImportReport = {
  parsed: TranscriptParseResult;
  matched: TranscriptCourseRecord[];
  unmatched: CourseMatchIssue[];
  ambiguous: CourseMatchIssue[];
};

type ProgramAudit = {
  enrollment: ProgramEnrollment;
  curriculum: ItuCurriculum;
  program: ItuUndergraduateProgram | null;
  progress: CurriculumProgress;
};

async function responseJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(value.error?.message ?? "The request failed.");
  return value;
}

function graduationCredit(item: ItuCurriculumItem, completed: RequirementProgress) {
  void completed;
  return item.creditOptions[0] ?? 0;
}

function StatusIcon({ complete }: { complete: boolean }) {
  const { t } = useLanguage();
  return <span aria-label={t(complete ? "common.completed" : "common.incomplete")} className={`inline-grid size-6 place-items-center rounded-full text-sm font-black ${complete ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>{complete ? "✓" : "×"}</span>;
}

function withoutTranscriptCopy(progress: CurriculumProgress): CurriculumProgress {
  return { ...progress, importedCourses: [] };
}

function ProgramAuditSection({ audit, report }: { audit: ProgramAudit; report?: ImportReport }) {
  const { language, t } = useLanguage();
  const value = (number: number) => formatNumber(language, number, { maximumFractionDigits: 2 });
  const { curriculum, enrollment, program, progress } = audit;
  const totals = curriculumTotals(curriculum, progress);
  const programGpa = calculateProgramGpa(curriculum, progress);
  const completion = totals.requiredCourses ? Math.min(100, Math.round((totals.earnedCourses / totals.requiredCourses) * 100)) : 0;

  return (
    <article className="space-y-4" aria-labelledby={`audit-${enrollment.id}`}>
      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">{t(enrollment.type === "main" ? "academicPrograms.main" : enrollment.type === "double-major" ? "academicPrograms.doubleMajor" : "academicPrograms.minor")}</p>
          <h2 id={`audit-${enrollment.id}`} className="mt-1 text-2xl font-black">{program ? localizedAcademicName(program, language) : enrollment.programName || curriculum.title}</h2>
          <p className="mt-1 text-sm text-slate-300">{enrollment.facultyName} · {curriculum.planTitle}{curriculum.validityPeriod ? ` · ${curriculum.validityPeriod}` : ""}</p>
        </div>
        <div className="min-w-40 self-center">
          <div className="flex items-center justify-between text-xs font-bold"><span>{t("graduationCalculator.completion")}</span><span>{formatNumber(language, completion)}%</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${completion}%` }} /></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div><p className="text-xs font-bold uppercase text-slate-500">{t("graduationCalculator.requirements")}</p><p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{totals.earnedCourses} / {totals.requiredCourses}</p></div>
          <div><p className="text-xs font-bold uppercase text-slate-500">{t("graduationCalculator.countedCredits")}</p><p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{value(totals.earnedCredit)} / {value(totals.requiredCredit)}</p></div>
          <div><p className="text-xs font-bold uppercase text-slate-500">{t("graduationCalculator.englishCredits")}</p><p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{value(totals.earnedEnglishCredit)} / {value(totals.requiredEnglishCredit)}</p></div>
          <div className="xl:text-right"><p className="text-xs font-bold uppercase text-slate-500">{t("graduationCalculator.programGpa")}</p><p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{programGpa === null ? "—" : formatNumber(language, programGpa, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("graduationCalculator.programGpaDescription")}</p></div>
        </div>
        {report && (report.unmatched.length || report.ambiguous.length) ? <details className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"><summary className="cursor-pointer font-bold">{t("curriculum.coursesNeedReview", { count: report.unmatched.length + report.ambiguous.length })}</summary><ul className="mt-2 space-y-1">{[...report.unmatched, ...report.ambiguous].map((issue, index) => <li key={`${issue.record.courseCode}-${index}`}><strong>{issue.record.courseCode}</strong>: {issue.reason}</li>)}</ul></details> : null}
      </section>

      {curriculum.semesters.map((semester) => {
        const semesterRows = semester.items.map((item) => ({ item, completed: progressForRequirement(item, progress) }));
        const passed = semesterRows.filter(({ completed }) => completed?.course.state === "passed");
        const earned = passed.reduce((sum, { item, completed }) => sum + (completed ? graduationCredit(item, completed) : 0), 0);
        const required = semester.items.reduce((sum, item) => sum + (item.creditOptions[0] ?? 0), 0);
        return (
          <details key={semester.semester} open className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-blue-600 sm:px-6">
              <span className="text-lg font-black text-slate-950 dark:text-white">{curriculum.planType === "undergraduate" || !curriculum.planType ? `${semester.semester}. ${t("common.semester")}` : semester.semester === 99 ? t("curriculum.otherRequirements") : t("curriculum.group", { number: semester.semester })}</span>
              <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{passed.length}/{semester.items.length} · {t("curriculum.creditsSummary", { earned: value(earned), required: value(required) })}</span>
            </summary>
            <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[1080px] border-collapse text-sm">
                <thead><tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">{["graduationCalculator.term", "graduationCalculator.crn", "graduationCalculator.requirement", "graduationCalculator.satisfiedBy", "graduationCalculator.actualCourse", "common.grade", "graduationCalculator.countedCredits", "graduationCalculator.transcriptCredit", "common.status"].map((heading) => <th key={heading} className="p-3">{t(heading)}</th>)}</tr></thead>
                <tbody>{semesterRows.map(({ item, completed }) => {
                  const isPassed = completed?.course.state === "passed";
                  const equivalent = completed?.satisfaction.satisfactionType === "equivalence" || completed?.satisfaction.satisfactionType === "language-equivalence";
                  const actualCodes = completed?.satisfaction.satisfiedByCourseCodes.join(" + ") ?? "";
                  const transcriptCredit = completed?.courses.reduce((sum, course) => sum + (course.transcriptCredit ?? course.countedCredit ?? 0), 0) ?? 0;
                  return <tr key={item.id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-3">{completed?.courses.map((course) => course.term).filter(Boolean).join(" + ") ?? ""}</td>
                    <td className="p-3">{completed?.courses.map((course) => course.crn).filter(Boolean).join(" + ") ?? ""}</td>
                    <td className="p-3"><span className="font-black">{item.kind === "course" ? item.code : item.title}</span><span className="block text-xs text-slate-500">{item.title}</span></td>
                    <td className="p-3 font-bold">{actualCodes}{equivalent ? <span className="ml-2 rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black uppercase text-blue-800">{t("graduationCalculator.equivalent")}</span> : null}</td>
                    <td className="p-3">{completed?.courses.map((course) => course.courseName).filter(Boolean).join(" + ") ?? ""}</td>
                    <td className="p-3 font-bold">{completed?.courses.map((course) => course.grade).filter(Boolean).join(" + ") ?? ""}</td>
                    <td className="p-3">{completed ? value(graduationCredit(item, completed)) : ""}</td>
                    <td className="p-3">{completed ? value(transcriptCredit) : ""}</td>
                    <td className="p-3"><StatusIcon complete={isPassed} /></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </details>
        );
      })}
    </article>
  );
}

export default function GraduationCalculator() {
  const { profile } = useProfile();
  const { language, t } = useLanguage();
  const value = (number: number) => formatNumber(language, number, { maximumFractionDigits: 2 });
  const configuredEnrollments = useMemo(() => orderedEnrollments(profile.programEnrollments), [profile.programEnrollments]);
  const [input, setInput] = useState("");
  const [audits, setAudits] = useState<ProgramAudit[]>([]);
  const [activeEnrollmentId, setActiveEnrollmentId] = useState("");
  const [sharedTranscript, setSharedTranscript] = useState<TranscriptCourseRecord[]>([]);
  const [reports, setReports] = useState<Record<string, ImportReport>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = parseSavedCurriculum(localStorage.getItem(SAVED_CURRICULUM_STORAGE_KEY));
    const enrollments = configuredEnrollments.length
      ? configuredEnrollments
      : saved ? [{ id: "legacy-main", type: "main" as const, facultyId: "", facultyName: "Faculty requires review", educationLevel: "undergraduate" as const, planType: "undergraduate" as const, programCode: saved.programCode, programName: saved.programCode, curriculumPlanId: saved.planId, curriculumPlanName: `Plan ${saved.planId}` }] : [];
    if (!enrollments.length) {
      const frame = requestAnimationFrame(() => setLoading(false));
      return () => cancelAnimationFrame(frame);
    }

    const controller = new AbortController();
    void Promise.all(enrollments.map((enrollment) => fetch(`/api/itu/curriculum/${enrollment.curriculumPlanId}?programCode=${encodeURIComponent(enrollment.programCode)}&planType=${enrollment.planType}${enrollment.primaryProgramCode ? `&primaryProgramCode=${encodeURIComponent(enrollment.primaryProgramCode)}` : ""}`, { signal: controller.signal }).then((response) => responseJson<{ curriculum: ItuCurriculum }>(response))))
    .then((rawCurriculumResponses) => {
      const curriculumResponses = rawCurriculumResponses.map(({ curriculum }) => ({ curriculum: groupCurriculum(curriculum) }));
      const stored = curriculumResponses.map(({ curriculum }) => parseCurriculumProgress(localStorage.getItem(CURRICULUM_PROGRESS_STORAGE_KEY), curriculum.planId));
      let transcript = parseSharedTranscript(localStorage.getItem(SHARED_TRANSCRIPT_STORAGE_KEY));
      if (!transcript.length) {
        transcript = transcriptFromLegacyProgressStore(localStorage.getItem(CURRICULUM_PROGRESS_STORAGE_KEY));
        if (!transcript.length) transcript = transcriptFromLegacyProgress(stored);
        if (transcript.length) persistSharedTranscript(transcript);
      }
      const parsed = transcriptParseResult(transcript);
      const nextAudits = curriculumResponses.map(({ curriculum }, index) => {
        const evaluated = transcript.length ? applyTranscriptImport(curriculum, stored[index], parsed).progress : stored[index];
        const progress = withoutTranscriptCopy(evaluated);
        persistCurriculumProgress(progress);
        const enrollment = enrollments[index];
        return { enrollment, curriculum, progress, program: { id: `${enrollment.facultyId}:${enrollment.planType}:${enrollment.programCode}`, baseProgramId: enrollment.programCode.replace(/_(?:LS|YD)$/u, ""), officialProgramCode: enrollment.programCode, code: enrollment.programCode, name: enrollment.programName, nameTr: enrollment.programNameTr ?? enrollment.programName, nameEn: enrollment.programNameEn, major: enrollment.programName, facultyId: enrollment.facultyId, faculty: enrollment.facultyName, planType: enrollment.planType } };
      });
      setSharedTranscript(transcript);
      setAudits(nextAudits);
      setActiveEnrollmentId((current) => nextAudits.some((audit) => audit.enrollment.id === current)
        ? current
        : nextAudits.find((audit) => audit.enrollment.type === "main")?.enrollment.id ?? nextAudits[0]?.enrollment.id ?? "");
      setLoading(false);
    }).catch((reason: unknown) => {
      if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : "Your academic programs could not be loaded."); setLoading(false); }
    });
    return () => controller.abort();
  }, [configuredEnrollments]);

  const calculated = sharedTranscript.filter((course) => course.calculated);
  const nonCalculated = sharedTranscript.filter((course) => !course.calculated);
  const gpa = calculateGpa(calculated);
  const calculatedCredit = calculated.reduce((sum, course) => sum + course.transcriptCredit, 0);
  const activeAudit = audits.find((audit) => audit.enrollment.id === activeEnrollmentId) ?? audits[0];
  const activeId = activeAudit?.enrollment.id ?? "";
  const lastReport = reports[activeId] ?? Object.values(reports)[0];

  function importCourses() {
    if (!audits.length) return;
    const parsed = parseTranscriptMarkdown(input);
    const allRecords = [...parsed.calculatedCourses, ...parsed.nonCalculatedCourses];
    const nextReports: Record<string, ImportReport> = {};
    if (!allRecords.length && parsed.invalidRows.length) {
      audits.forEach((audit) => {
        nextReports[audit.enrollment.id] = { parsed, matched: [], unmatched: [], ambiguous: [] };
      });
      setReports(nextReports);
      return;
    }
    const mergedTranscript = mergeTranscriptCourses(sharedTranscript, allRecords);
    const mergedParsed = transcriptParseResult(mergedTranscript);
    const nextAudits = audits.map((audit) => {
      const result = applyTranscriptImport(audit.curriculum, audit.progress, mergedParsed);
      const progress = withoutTranscriptCopy(result.progress);
      persistCurriculumProgress(progress);
      nextReports[audit.enrollment.id] = { parsed, matched: result.matched, unmatched: result.unmatched, ambiguous: result.ambiguous };
      return { ...audit, progress };
    });
    persistSharedTranscript(mergedTranscript);
    setSharedTranscript(mergedTranscript);
    setAudits(nextAudits);
    setReports(nextReports);
  }

  function resetImported() {
    if (!window.confirm(t("graduationCalculator.resetConfirm"))) return;
    const nextAudits = audits.map((audit) => {
      const progress = withoutTranscriptCopy(resetImportedProgress(audit.progress));
      persistCurriculumProgress(progress);
      return { ...audit, progress };
    });
    persistSharedTranscript([]);
    setSharedTranscript([]);
    setAudits(nextAudits);
    setReports({});
  }

  if (loading) return <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{t("graduationCalculator.loadingPrograms")}</div>;
  if (error) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{localizeRuntimeMessage(language, error)}</div>;
  if (!audits.length) return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-950 shadow-sm">
      <h2 className="text-xl font-black">{t("graduationCalculator.completeProfile")}</h2>
      <p className="mt-2 text-sm">{t("graduationCalculator.completeProfileDescription")}</p>
      <Link href="/profile" className="mt-4 inline-flex rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white">{t("graduationCalculator.openProfile")}</Link>
    </section>
  );

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <label htmlFor="transcript-input" className="text-lg font-black text-slate-950 dark:text-white">{t("graduationCalculator.sharedTranscript")}</label>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("graduationCalculator.sharedDescription")}</p>
        <textarea id="transcript-input" value={input} onChange={(event) => setInput(event.target.value)} rows={10} placeholder={"İngilizce Tamamlanan Dersler\nDönem\tCRN\tDers Kodu\tDers Adı\tKredi\tNot"} className="mt-4 w-full rounded-xl border border-slate-300 bg-white p-4 font-mono text-sm text-slate-800 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={importCourses} disabled={!input.trim()} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">{t("graduationCalculator.importCourses")}</button>
          <button type="button" onClick={() => setInput("")} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">{t("graduationCalculator.clearInput")}</button>
          <button type="button" onClick={resetImported} disabled={!sharedTranscript.length} className="rounded-xl border border-red-300 bg-red-50 px-5 py-3 text-sm font-black text-red-800 disabled:opacity-50">{t("graduationCalculator.resetImported")}</button>
        </div>
        {lastReport ? <div className="mt-5" aria-live="polite"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs font-bold uppercase text-slate-500">{t("graduationCalculator.parsedCourses")}</p><p className="text-2xl font-black">{lastReport.parsed.calculatedCourses.length + lastReport.parsed.nonCalculatedCourses.length}</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs font-bold uppercase text-slate-500">{t("graduationCalculator.programsEvaluated")}</p><p className="text-2xl font-black">{audits.length}</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs font-bold uppercase text-slate-500">{t("graduationCalculator.rowsAttention")}</p><p className="text-2xl font-black">{lastReport.parsed.invalidRows.length + lastReport.parsed.duplicateRows.length}</p></div></div>{lastReport.parsed.invalidRows.length || lastReport.parsed.duplicateRows.length ? <details className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"><summary className="cursor-pointer font-bold">{t("graduationCalculator.reviewRows")}</summary><ul className="mt-2 space-y-1">{[...lastReport.parsed.invalidRows, ...lastReport.parsed.duplicateRows].map((issue, index) => <li key={`${issue.line}-${index}`}><strong>{t("common.line")} {issue.line}</strong>: {localizeRuntimeMessage(language, issue.reason)}</li>)}</ul></details> : null}</div> : null}
        {sharedTranscript.length ? <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs font-bold uppercase text-slate-500">{t("graduationCalculator.transcriptCourses")}</p><p className="text-2xl font-black">{sharedTranscript.length}</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs font-bold uppercase text-slate-500">{t("graduationCalculator.transcriptCredits")}</p><p className="text-2xl font-black">{value(calculatedCredit)}</p></div><div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs font-bold uppercase text-slate-500">{t("graduationCalculator.gpaOnce")}</p><p className="text-2xl font-black">{gpa === null ? "—" : formatNumber(language, gpa, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div></div> : null}
      </section>

      {audits.length > 1 ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
          <div className="mb-4">
            <p className="text-xs font-black uppercase tracking-[.18em] text-blue-700 dark:text-blue-300">{t("curriculum.yourPrograms")}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("curriculum.independentAudit")}</p>
          </div>
          <ProgramTabs enrollments={audits.map((audit) => audit.enrollment)} activeEnrollmentId={activeId} onSelect={setActiveEnrollmentId} />
        </section>
      ) : null}

      {activeAudit ? audits.length > 1 ? (
        <div role="tabpanel" id={programPanelId(activeId)} aria-labelledby={programTabId(activeId)}>
          <ProgramAuditSection key={activeId} audit={activeAudit} report={reports[activeId]} />
        </div>
      ) : <ProgramAuditSection key={activeId} audit={activeAudit} report={reports[activeId]} /> : null}

      {nonCalculated.length ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="text-xl font-black">{t("graduationCalculator.nonCalculated")}</h2><p className="mt-1 text-sm text-slate-500">{t("graduationCalculator.nonCalculatedDescription")}</p><ul className="mt-4 grid gap-2 sm:grid-cols-2">{nonCalculated.map((course) => <li key={`${course.courseCode}-${course.term}`} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950"><strong>{course.courseCode}</strong> · {course.courseName}<span className="block text-xs text-slate-500">{course.term} · CRN {course.crn} · {course.grade}</span></li>)}</ul></section> : null}
    </div>
  );
}
