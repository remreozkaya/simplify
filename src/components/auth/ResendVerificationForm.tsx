"use client";

import { useActionState, useEffect, useState } from "react";

import { resendVerificationAction } from "@/app/auth/actions";
import AuthMessage from "@/components/auth/AuthMessage";
import { INITIAL_AUTH_STATE } from "@/lib/auth/types";

type ResendVerificationFormProps = {
  email?: string;
  allowEmailEntry?: boolean;
};

function ResendButton({
  pending,
  initialSeconds,
  disabled,
}: {
  pending: boolean;
  initialSeconds: number;
  disabled: boolean;
}) {
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (initialSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [initialSeconds]);

  return (
    <button
      type="submit"
      disabled={pending || remaining > 0 || disabled}
      className="h-11 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-950"
    >
      {pending
        ? "Sending…"
        : remaining > 0
          ? `Resend in ${remaining}s`
          : "Resend verification email"}
    </button>
  );
}

export default function ResendVerificationForm({
  email,
  allowEmailEntry = false,
}: ResendVerificationFormProps) {
  const [state, action, pending] = useActionState(
    resendVerificationAction,
    INITIAL_AUTH_STATE,
  );

  return (
    <form action={action} className="space-y-3">
      {allowEmailEntry ? (
        <div>
          <label
            htmlFor="resend-email"
            className="mb-2 block text-sm font-bold text-slate-800 dark:text-slate-100"
          >
            Email
          </label>
          <input
            id="resend-email"
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            defaultValue={state.email ?? email}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>
      ) : (
        <input type="hidden" name="email" value={state.email ?? email ?? ""} />
      )}

      <AuthMessage
        message={state.message}
        tone={state.status === "success" ? "success" : "error"}
      />
      <ResendButton
        key={`${state.status}-${state.retryAfter ?? 0}`}
        pending={pending}
        initialSeconds={state.retryAfter ?? 0}
        disabled={!email && !allowEmailEntry}
      />
    </form>
  );
}
