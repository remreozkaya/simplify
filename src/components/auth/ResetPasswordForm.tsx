"use client";

import Link from "next/link";
import { useActionState } from "react";

import { resetPasswordAction } from "@/app/auth/actions";
import AuthMessage from "@/components/auth/AuthMessage";
import PasswordInput from "@/components/auth/PasswordInput";
import SubmitButton from "@/components/auth/SubmitButton";
import { INITIAL_AUTH_STATE } from "@/lib/auth/types";

export default function ResetPasswordForm() {
  const [state, action] = useActionState(
    resetPasswordAction,
    INITIAL_AUTH_STATE,
  );

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-5" noValidate>
        <AuthMessage message={state.message} />
        <PasswordInput
          id="new-password"
          name="password"
          label="New Password"
          autoComplete="new-password"
          error={state.fieldErrors?.password}
          hint="Use at least 8 characters."
        />
        <PasswordInput
          id="confirm-new-password"
          name="confirmPassword"
          label="Confirm New Password"
          autoComplete="new-password"
          error={state.fieldErrors?.confirmPassword}
        />
        <SubmitButton label="Update Password" pendingLabel="Updating password…" />
      </form>
      {state.message?.includes("invalid or has expired") ? (
        <p className="text-center text-sm">
          <Link
            href="/forgot-password"
            className="font-black text-blue-700 hover:underline dark:text-blue-300"
          >
            Request another reset link
          </Link>
        </p>
      ) : null}
    </div>
  );
}
