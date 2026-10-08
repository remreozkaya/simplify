"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useAuthForm } from "@/hooks/useAuthForm";

import { resetPasswordAction } from "@/app/auth/actions";
import AuthMessage from "@/components/auth/AuthMessage";
import PasswordInput from "@/components/auth/PasswordInput";
import SubmitButton from "@/components/auth/SubmitButton";
import { INITIAL_AUTH_STATE } from "@/lib/auth/types";
import { useLanguage } from "@/lib/i18n/client";

export default function ResetPasswordForm() {
  const { t } = useLanguage();
  const formRef = useAuthForm();
  const [state, action] = useActionState(
    resetPasswordAction,
    INITIAL_AUTH_STATE,
  );

  return (
    <div className="space-y-5">
      <form ref={formRef} action={action} className="space-y-5" noValidate>
        <AuthMessage message={state.message} />
        <PasswordInput
          id="new-password"
          name="password"
          label={t("authentication.newPassword")}
          autoComplete="new-password"
          error={state.fieldErrors?.password}
          hint={t("profile.passwordHint")}
        />
        <PasswordInput
          id="confirm-new-password"
          name="confirmPassword"
          label={t("profile.confirmPassword")}
          autoComplete="new-password"
          error={state.fieldErrors?.confirmPassword}
        />
        <SubmitButton label={t("authentication.updatePassword")} pendingLabel={t("authentication.updatingPassword")} />
      </form>
      {state.message?.includes("invalid or has expired") ? (
        <p className="text-center text-sm">
          <Link
            href="/forgot-password"
            className="font-semibold text-blue-700 hover:underline dark:text-blue-300"
          >
            {t("authentication.requestAnother")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
