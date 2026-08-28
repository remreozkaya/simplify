"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction } from "@/app/auth/actions";
import AuthMessage from "@/components/auth/AuthMessage";
import EmailInput from "@/components/auth/EmailInput";
import PasswordInput from "@/components/auth/PasswordInput";
import ResendVerificationForm from "@/components/auth/ResendVerificationForm";
import SubmitButton from "@/components/auth/SubmitButton";
import { INITIAL_AUTH_STATE } from "@/lib/auth/types";

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, action] = useActionState(loginAction, INITIAL_AUTH_STATE);

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-5" noValidate>
        <input type="hidden" name="next" value={nextPath} />
        <AuthMessage message={state.message} />
        <EmailInput error={state.fieldErrors?.email} />
        <PasswordInput
          id="password"
          name="password"
          label="Password"
          autoComplete="current-password"
          error={state.fieldErrors?.password}
        />

        <div className="flex items-center justify-between gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2.5 font-medium text-slate-700 dark:text-slate-300">
            <input
              name="remember"
              type="checkbox"
              className="size-4 rounded border-slate-300 accent-blue-600"
            />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="font-bold text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-300"
          >
            Forgot password?
          </Link>
        </div>

        <SubmitButton label="Log In" pendingLabel="Signing in…" />
      </form>

      {state.status === "unverified" ? (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-sm leading-6 text-amber-900 dark:text-amber-100">
            Check your inbox and verify your email before signing in.
          </p>
          <ResendVerificationForm email={state.email} />
        </div>
      ) : null}

      <p className="text-center text-sm text-slate-600 dark:text-slate-300">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-black text-blue-700 hover:underline dark:text-blue-300"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
