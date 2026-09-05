"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  changePasswordAction,
  saveProfileAction,
} from "@/app/(app)/profile/actions";
import AuthMessage from "@/components/auth/AuthMessage";
import PasswordInput from "@/components/auth/PasswordInput";
import SubmitButton from "@/components/auth/SubmitButton";
import { useProfile } from "@/components/profile/ProfileProvider";
import { CURRICULUM_PROGRESS_STORAGE_KEY, parseCurriculumProgress } from "@/lib/curriculum/progress";
import { profileFullName, profileInitials, type EnrollmentType, type ProfileInput, type ProgramEnrollment } from "@/lib/profile/types";
import { orderedEnrollments, parseProfileInput, profileFieldErrors } from "@/lib/profile/validation";
import type { ItuCurriculumPlan, ItuFaculty, ItuUndergraduateProgram } from "@/lib/itu/curriculum/types";
import { changeEnrollmentFaculty, changeSecondaryEnrollmentType, reconcileMainProgramChange } from "@/lib/profile/enrollments";
import { useLanguage } from "@/lib/i18n/client";
import { localizedAcademicName, localizeRuntimeMessage, offeringDisplayName } from "@/lib/i18n";
import { INITIAL_PASSWORD_ACTION_STATE, INITIAL_PROFILE_ACTION_STATE, type ProfileActionState } from "@/lib/profile/actionState";

const inputClass = "mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

async function responseJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(value.error?.message ?? "The request failed.");
  return value;
}

function blankMain(): ProgramEnrollment {
  return { id: "main", type: "main", facultyId: "", facultyName: "", educationLevel: "undergraduate", planType: "undergraduate", programCode: "", programName: "", curriculumPlanId: 0, curriculumPlanName: "" };
}

function editableInput(profile: ReturnType<typeof useProfile>["profile"]): ProfileInput {
  const enrollments = orderedEnrollments(profile.programEnrollments);
  return {
    name: profile.name,
    surname: profile.surname,
    birthdate: profile.birthdate,
    nickname: profile.nickname,
    programEnrollments: enrollments.some((item) => item.type === "main") ? enrollments : [blankMain(), ...enrollments],
  };
}

function ProgramFields({
  enrollment,
  faculties,
  programs,
  plans,
  disabled,
  programsLoaded,
  plansLoaded,
  onChange,
  onRemove,
}: {
  enrollment: ProgramEnrollment;
  faculties: ItuFaculty[];
  programs: ItuUndergraduateProgram[];
  plans: ItuCurriculumPlan[];
  disabled: boolean;
  programsLoaded: boolean;
  plansLoaded: boolean;
  onChange: (enrollment: ProgramEnrollment) => void;
  onRemove?: () => void;
}) {
  const { language, t } = useLanguage();
  const enrollmentLabel = t(enrollment.type === "main" ? "academicPrograms.main" : enrollment.type === "double-major" ? "academicPrograms.doubleMajor" : "academicPrograms.minor");
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-800 dark:bg-blue-950 dark:text-blue-200">{enrollmentLabel}</span>
        {onRemove ? <button type="button" onClick={onRemove} className="text-sm font-bold text-red-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:text-red-300">{t("common.remove")}</button> : null}
      </div>
      {enrollment.selectionRequiresReview ? <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">{t("academicPrograms.selectionReview")}</p> : null}
      {!enrollment.facultyId ? <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">{t("academicPrograms.selectFacultyFirst")} {enrollment.programCode ? t("academicPrograms.selectionReview") : ""}</p>
        : disabled && enrollment.type !== "main" ? <p className="mt-3 text-xs font-semibold text-amber-700">{t("academicPrograms.completeMainFirst")}</p>
        : !programsLoaded ? <p className="mt-3 text-xs text-slate-500">{t("academicPrograms.loadingPrograms", { type: enrollmentLabel })}</p>
        : !programs.length ? <p className="mt-3 text-xs font-semibold text-amber-700">{t(enrollment.type === "double-major" ? "academicPrograms.noDoubleMajor" : enrollment.type === "minor" ? "academicPrograms.noMinor" : "academicPrograms.noUndergraduate")}</p>
        : enrollment.programCode && !plansLoaded ? <p className="mt-3 text-xs text-slate-500">{t("academicPrograms.loadingPlans")}</p>
        : enrollment.programCode && plansLoaded && !plans.length ? <p className="mt-3 text-xs font-semibold text-amber-700">{t("academicPrograms.noEligiblePlan")}</p>
        : null}
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {t("common.faculty")}
          <select value={enrollment.facultyId} onChange={(event) => {
            const faculty = faculties.find((item) => item.id === event.target.value);
            onChange(changeEnrollmentFaculty(enrollment, faculty));
          }} className={inputClass} required>
            <option value="">{t("academicPrograms.selectFaculty")}</option>
            {faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{localizedAcademicName(faculty, language)}</option>)}
          </select>
        </label>
        {enrollment.type !== "main" ? (
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {t("academicPrograms.enrollmentType")}
            <select value={enrollment.type} onChange={(event) => {
              const type = event.target.value as EnrollmentType;
              onChange(changeSecondaryEnrollmentType(enrollment, type as Exclude<EnrollmentType, "main">));
            }} className={inputClass}>
              <option value="double-major">{t("academicPrograms.doubleMajor")}</option>
              <option value="minor">{t("academicPrograms.minor")}</option>
            </select>
          </label>
        ) : null}
        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {t("common.program")}
          <select
            value={enrollment.programCode}
            onChange={(event) => {
              const program = programs.find((item) => item.code === event.target.value);
              onChange({ ...enrollment, programCode: program?.code ?? "", programName: program?.name ?? "", programNameTr: program?.nameTr, programNameEn: program?.nameEn, targetProgramCode: enrollment.type === "main" ? undefined : program?.code, curriculumPlanId: 0, curriculumPlanName: "", curriculumPlanNameTr: undefined, curriculumPlanNameEn: undefined, selectionRequiresReview: undefined });
            }}
            disabled={disabled || !enrollment.facultyId}
            className={inputClass}
          >
            <option value="">{t("academicPrograms.selectProgram")}</option>
            {programs.map((program) => <option key={program.id} value={program.code}>{offeringDisplayName(program, language)} · {program.code}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {t("common.curriculumPlan")}
          <select
            value={enrollment.curriculumPlanId || ""}
            onChange={(event) => {
              const plan = plans.find((item) => item.id === Number(event.target.value));
              onChange({ ...enrollment, curriculumPlanId: plan?.id ?? 0, curriculumPlanName: plan?.title ?? "", curriculumPlanNameTr: plan?.nameTr, curriculumPlanNameEn: plan?.nameEn, associatedPrimaryProgramCodes: plan?.associatedPrimaryProgramCodes, selectionRequiresReview: undefined });
            }}
            disabled={!enrollment.programCode || !plans.length}
            className={inputClass}
          >
            <option value="">{t("academicPrograms.selectPlan")}</option>
            {plans.map((plan) => <option key={`${plan.planType}:${plan.programCode}:${plan.id}`} value={plan.id}>{localizedAcademicName(plan, language)}{plan.isCurrent ? ` · ${t("common.current")}` : ""}</option>)}
          </select>
        </label>
      </div>
      {enrollment.curriculumPlanName ? <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t("academicPrograms.currentSelection", { name: localizedAcademicName({ name: enrollment.curriculumPlanName, nameTr: enrollment.curriculumPlanNameTr, nameEn: enrollment.curriculumPlanNameEn }, language) })}</p> : null}
    </div>
  );
}

function PasswordSection({ canChangePassword }: { canChangePassword: boolean }) {
  const { t } = useLanguage();
  const [state, action] = useActionState(changePasswordAction, INITIAL_PASSWORD_ACTION_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  if (!canChangePassword) {
    return <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">{t("profile.managedPassword")}</p>;
  }

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      <AuthMessage message={state.message} tone={state.status === "success" ? "success" : "error"} />
      <PasswordInput id="current-password" name="currentPassword" label={t("profile.currentPassword")} autoComplete="current-password" error={state.fieldErrors?.currentPassword} />
      <PasswordInput id="profile-new-password" name="newPassword" label={t("profile.newPassword")} autoComplete="new-password" error={state.fieldErrors?.newPassword} hint={t("profile.passwordHint")} />
      <PasswordInput id="profile-confirm-password" name="confirmPassword" label={t("profile.confirmPassword")} autoComplete="new-password" error={state.fieldErrors?.confirmPassword} />
      <div className="max-w-xs"><SubmitButton label={t("profile.changePassword")} pendingLabel={t("profile.changingPassword")} /></div>
    </form>
  );
}

export default function ProfilePage({ email, canChangePassword }: { email: string; canChangePassword: boolean }) {
  const { language, t } = useLanguage();
  const enrollmentLabel = (type: EnrollmentType) => t(type === "main" ? "academicPrograms.main" : type === "double-major" ? "academicPrograms.doubleMajor" : "academicPrograms.minor");
  const { profile, setProfile } = useProfile();
  const [draft, setDraft] = useState<ProfileInput>(() => editableInput(profile));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(editableInput(profile)));
  const [faculties, setFaculties] = useState<ItuFaculty[]>([]);
  const [programsByFilter, setProgramsByFilter] = useState<Record<string, ItuUndergraduateProgram[]>>({});
  const [plansByFilter, setPlansByFilter] = useState<Record<string, ItuCurriculumPlan[]>>({});
  const [programError, setProgramError] = useState("");
  const [feedback, setFeedback] = useState<ProfileActionState>(INITIAL_PROFILE_ACTION_STATE);
  const [removalMessage, setRemovalMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const dirty = JSON.stringify(draft) !== savedSnapshot;

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/itu/curriculum/faculties", { signal: controller.signal })
      .then((response) => responseJson<{ faculties: ItuFaculty[] }>(response))
      .then(({ faculties: loaded }) => setFaculties(loaded))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setProgramError(reason instanceof Error ? reason.message : t("profile.facultiesLoadError"));
      });
    return () => controller.abort();
  }, [t]);

  const mainProgramCode = draft.programEnrollments.find((item) => item.type === "main")?.programCode ?? "";
  const programFilters = useMemo(() => [...new Set(draft.programEnrollments.filter((item) => item.facultyId && (item.type === "main" || mainProgramCode)).map((item) => `${item.facultyId}:${item.planType}:${item.type === "main" ? "" : mainProgramCode}`))], [draft.programEnrollments, mainProgramCode]);
  useEffect(() => {
    programFilters.forEach((key) => {
      if (programsByFilter[key]) return;
      const [facultyId, planType, primaryProgramCode] = key.split(":");
      void fetch(`/api/itu/curriculum/programs?facultyId=${encodeURIComponent(facultyId)}&planType=${planType}${primaryProgramCode ? `&primaryProgramCode=${encodeURIComponent(primaryProgramCode)}` : ""}`)
        .then((response) => responseJson<{ programs: ItuUndergraduateProgram[] }>(response))
        .then(({ programs }) => setProgramsByFilter((current) => ({ ...current, [key]: programs })))
        .catch((reason: unknown) => setProgramError(reason instanceof Error ? reason.message : t("profile.programsLoadError")));
    });
  }, [programFilters, programsByFilter, t]);

  const selectedPlanFilters = useMemo(() => [...new Set(draft.programEnrollments.filter((item) => item.programCode).map((item) => `${item.programCode}:${item.planType}:${item.type === "main" ? "" : mainProgramCode}`))], [draft.programEnrollments, mainProgramCode]);
  useEffect(() => {
    selectedPlanFilters.forEach((key) => {
      if (plansByFilter[key]) return;
      const [programCode, planType, primaryProgramCode] = key.split(":");
      void fetch(`/api/itu/curriculum/plans?programCode=${encodeURIComponent(programCode)}&planType=${planType}${primaryProgramCode ? `&primaryProgramCode=${encodeURIComponent(primaryProgramCode)}` : ""}`)
        .then((response) => responseJson<{ plans: ItuCurriculumPlan[] }>(response))
        .then(({ plans }) => setPlansByFilter((current) => ({ ...current, [key]: plans })))
        .catch((reason: unknown) => setProgramError(reason instanceof Error ? reason.message : t("profile.plansLoadError")));
    });
  }, [plansByFilter, selectedPlanFilters, t]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const handleNavigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      const href = target?.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href === window.location.pathname) return;
      if (!window.confirm(t("profile.discardChanges"))) event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleNavigation, true);
    };
  }, [dirty, t]);

  function updateEnrollment(next: ProgramEnrollment) {
    setDraft((current) => {
      return { ...current, programEnrollments: next.type === "main" ? reconcileMainProgramChange(current.programEnrollments, next) : current.programEnrollments.map((item) => item.id === next.id ? next : item) };
    });
    setFeedback(INITIAL_PROFILE_ACTION_STATE);
  }

  function removeEnrollment(enrollment: ProgramEnrollment) {
    const progress = enrollment.curriculumPlanId ? parseCurriculumProgress(localStorage.getItem(CURRICULUM_PROGRESS_STORAGE_KEY), enrollment.curriculumPlanId) : null;
    const hasProgress = Boolean(progress && (Object.keys(progress.courses).length || progress.importedCourses?.length));
    if (hasProgress && !window.confirm(t("profile.removeProgram", { name: enrollment.programName }))) return;
    setDraft((current) => ({ ...current, programEnrollments: current.programEnrollments.filter((item) => item.id !== enrollment.id) }));
    setRemovalMessage(t("profile.removed", { type: enrollmentLabel(enrollment.type) }));
  }

  function submitProfile(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseProfileInput(draft);
    if (!parsed.success) {
      setFeedback({ status: "error", message: t("profile.checkFields"), fieldErrors: profileFieldErrors(parsed.error) });
      return;
    }
    startTransition(async () => {
      try {
        const result = await saveProfileAction(parsed.data);
        setFeedback(result);
        if (result.profile) {
          setProfile(result.profile);
          const next = editableInput(result.profile);
          setDraft(next);
          setSavedSnapshot(JSON.stringify(next));
          setRemovalMessage("");
        }
      } catch {
        setFeedback({ status: "error", message: "Your profile could not be saved right now. Try again." });
      }
    });
  }

  const initials = profileInitials({ ...profile, ...draft });
  const fullName = profileFullName({ ...profile, ...draft });
  const missing = [!draft.name && t("profile.nameField"), !draft.surname && t("profile.surnameField"), !draft.programEnrollments.some((item) => item.type === "main" && item.programCode && item.curriculumPlanId) && t("profile.mainProgramField")].filter(Boolean).join(", ");

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 dark:bg-slate-950 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[.22em] text-blue-700 dark:text-blue-300">{t("profile.eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">{t("profile.title")}</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">{t("profile.description")}</p>
        </header>

        <section className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-blue-600 text-lg font-black text-white">{initials || "—"}</div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-slate-950 dark:text-white">{fullName || t("profile.complete")}</h2>
            {draft.nickname ? <p className="text-sm text-slate-500 dark:text-slate-400">{draft.nickname}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {orderedEnrollments(draft.programEnrollments).filter((item) => item.programName).map((item) => <span key={item.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{enrollmentLabel(item.type)} · {item.facultyName || t("academicPrograms.facultyReview")} · {localizedAcademicName({ name: item.programName, nameTr: item.programNameTr, nameEn: item.programNameEn }, language)}</span>)}
            </div>
            {missing ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{t("profile.stillNeeded", { fields: missing })}</p> : null}
          </div>
        </section>

        <form onSubmit={submitProfile} className="space-y-5" noValidate>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <h2 className="text-xl font-black text-slate-950 dark:text-white">{t("profile.personalInformation")}</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {([
                ["name", t("profile.name"), "text", true, 80],
                ["surname", t("profile.surname"), "text", true, 80],
                ["birthdate", t("profile.birthdate"), "date", false, undefined],
                ["nickname", t("profile.nickname"), "text", false, 50],
              ] as const).map(([field, label, type, required, maxLength]) => (
                <label key={field} className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  {label}{!required ? <span className="font-normal text-slate-400"> · {t("common.optional")}</span> : null}
                  <input type={type} required={required} maxLength={maxLength} max={type === "date" ? new Date().toISOString().slice(0, 10) : undefined} value={draft[field]} onChange={(event) => { setDraft((current) => ({ ...current, [field]: event.target.value })); setFeedback(INITIAL_PROFILE_ACTION_STATE); }} aria-invalid={Boolean(feedback.fieldErrors?.[field])} aria-describedby={feedback.fieldErrors?.[field] ? `${field}-error` : undefined} className={inputClass} />
                  {feedback.fieldErrors?.[field] ? <span id={`${field}-error`} className="mt-1.5 block text-sm font-normal text-red-600 dark:text-red-300">{localizeRuntimeMessage(language, feedback.fieldErrors[field])}</span> : null}
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-xl font-black text-slate-950 dark:text-white">{t("profile.academicPrograms")}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("profile.mainFirst")}</p></div>
              <button type="button" onClick={() => setDraft((current) => ({ ...current, programEnrollments: [...current.programEnrollments, { id: `secondary-${Date.now()}`, type: "double-major", facultyId: "", facultyName: "", educationLevel: "undergraduate", planType: "cap", primaryProgramCode: mainProgramCode || undefined, programCode: "", programName: "", curriculumPlanId: 0, curriculumPlanName: "" }] }))} className="rounded-xl border border-blue-300 px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300">{t("profile.addSecondary")}</button>
            </div>
            <div className="mt-5 space-y-3">
              {orderedEnrollments(draft.programEnrollments).map((enrollment) => {
                const programKey = `${enrollment.facultyId}:${enrollment.planType}:${enrollment.type === "main" ? "" : mainProgramCode}`;
                const programs = programsByFilter[programKey] ?? [];
                const planKey = `${enrollment.programCode}:${enrollment.planType}:${enrollment.type === "main" ? "" : mainProgramCode}`;
                return <ProgramFields key={enrollment.id} enrollment={enrollment} faculties={faculties} programs={programs} plans={plansByFilter[planKey] ?? []} disabled={!faculties.length || (enrollment.type !== "main" && !mainProgramCode)} programsLoaded={Object.hasOwn(programsByFilter, programKey)} plansLoaded={Object.hasOwn(plansByFilter, planKey)} onChange={updateEnrollment} onRemove={enrollment.type === "main" ? undefined : () => removeEnrollment(enrollment)} />;
              })}
            </div>
            {programError ? <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{localizeRuntimeMessage(language, programError)}</p> : null}
            {feedback.fieldErrors?.programEnrollments ? <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">{localizeRuntimeMessage(language, feedback.fieldErrors.programEnrollments)}</p> : null}
            {removalMessage ? <p role="status" className="mt-3 text-sm text-slate-600 dark:text-slate-300">{removalMessage}</p> : null}
          </section>

          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={isPending || !dirty} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">{isPending ? t("common.saving") : t("common.saveChanges")}</button>
            {feedback.message ? <p role={feedback.status === "error" ? "alert" : "status"} className={`text-sm font-bold ${feedback.status === "error" ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>{localizeRuntimeMessage(language, feedback.message)}</p> : null}
          </div>
        </form>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <h2 className="text-xl font-black text-slate-950 dark:text-white">{t("profile.accountSecurity")}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("profile.signedInAs", { email })}</p>
          <div className="mt-5"><PasswordSection canChangePassword={canChangePassword} /></div>
        </section>
      </div>
    </main>
  );
}
