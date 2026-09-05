"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signupAction } from "@/app/auth/actions";
import AuthMessage from "@/components/auth/AuthMessage";
import EmailInput from "@/components/auth/EmailInput";
import PasswordInput from "@/components/auth/PasswordInput";
import SubmitButton from "@/components/auth/SubmitButton";
import { INITIAL_AUTH_STATE } from "@/lib/auth/types";
import { useLanguage } from "@/lib/i18n/client";

export default function SignupForm() {
  const { t } = useLanguage();
  const [state, action] = useActionState(signupAction, INITIAL_AUTH_STATE);

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-5" noValidate>
        <AuthMessage message={state.message} />
        <EmailInput error={state.fieldErrors?.email} />
        <PasswordInput
          id="password"
          name="password"
          label={t("authentication.password")}
          autoComplete="new-password"
          error={state.fieldErrors?.password}
          hint={t("profile.passwordHint")}
        />
        <PasswordInput
          id="confirm-password"
          name="confirmPassword"
          label={t("authentication.confirmPassword")}
          autoComplete="new-password"
          error={state.fieldErrors?.confirmPassword}
        />
        <SubmitButton label={t("authentication.createAccount")} pendingLabel={t("authentication.creatingAccount")} />
      </form>

      <p className="text-center text-sm text-slate-600 dark:text-slate-300">
        {t("authentication.haveAccount")}{" "}
        <Link
          href="/login"
          className="font-black text-blue-700 hover:underline dark:text-blue-300"
        >
          {t("authentication.login")}
        </Link>
      </p>
    </div>
  );
}
