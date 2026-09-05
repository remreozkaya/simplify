"use client";

import { useState } from "react";
import { localizeRuntimeMessage } from "@/lib/i18n";
import { useLanguage } from "@/lib/i18n/client";

type PasswordInputProps = {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  hint?: string;
};

export default function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  error,
  hint,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const { language, t } = useLanguage();
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-bold text-slate-800 dark:text-slate-100"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={autoComplete === "new-password" ? 8 : undefined}
          maxLength={128}
          autoComplete={autoComplete}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
          className={`h-12 w-full rounded-xl border bg-white px-3.5 pr-12 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 dark:bg-slate-950 dark:text-white ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
              : "border-slate-300 focus:border-blue-600 focus:ring-blue-600/10 dark:border-slate-700"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-slate-500 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-blue-600 dark:text-slate-400 dark:hover:text-white"
          aria-label={t(visible ? "authentication.hidePassword" : "authentication.showPassword", { label: label.toLocaleLowerCase(language === "tr" ? "tr-TR" : "en") })}
          aria-pressed={visible}
        >
          {visible ? (
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.9 10.9 0 0 1 12 4c5.3 0 9 5 9 8a8.8 8.8 0 0 1-1.7 3.6M6.6 6.6C4.3 8.1 3 10.5 3 12c0 3 3.7 8 9 8 1.2 0 2.3-.3 3.3-.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path d="M3 12c0-3 3.7-8 9-8s9 5 9 8-3.7 8-9 8-9-5-9-8Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          )}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600 dark:text-red-300">
          {localizeRuntimeMessage(language, error)}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {localizeRuntimeMessage(language, hint)}
        </p>
      ) : null}
    </div>
  );
}
