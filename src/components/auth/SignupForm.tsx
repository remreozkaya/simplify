"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signupAction } from "@/app/auth/actions";
import AuthMessage from "@/components/auth/AuthMessage";
import EmailInput from "@/components/auth/EmailInput";
import PasswordInput from "@/components/auth/PasswordInput";
import SubmitButton from "@/components/auth/SubmitButton";
import { INITIAL_AUTH_STATE } from "@/lib/auth/types";

export default function SignupForm() {
  const [state, action] = useActionState(signupAction, INITIAL_AUTH_STATE);

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-5" noValidate>
        <AuthMessage message={state.message} />
        <EmailInput error={state.fieldErrors?.email} />
        <PasswordInput
          id="password"
          name="password"
          label="Password"
          autoComplete="new-password"
          error={state.fieldErrors?.password}
          hint="Use at least 8 characters."
        />
        <PasswordInput
          id="confirm-password"
          name="confirmPassword"
          label="Confirm Password"
          autoComplete="new-password"
          error={state.fieldErrors?.confirmPassword}
        />
        <SubmitButton label="Create Account" pendingLabel="Creating account…" />
      </form>

      <p className="text-center text-sm text-slate-600 dark:text-slate-300">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-black text-blue-700 hover:underline dark:text-blue-300"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
