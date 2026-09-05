"use client";

import Link from "next/link";
import { useActionState } from "react";

import { forgotPasswordAction } from "@/app/auth/actions";
import AuthMessage from "@/components/auth/AuthMessage";
import EmailInput from "@/components/auth/EmailInput";
import SubmitButton from "@/components/auth/SubmitButton";
import { INITIAL_AUTH_STATE } from "@/lib/auth/types";
import { useLanguage } from "@/lib/i18n/client";

export default function ForgotPasswordForm() {
  const { t } = useLanguage();
  const [state, action] = useActionState(
    forgotPasswordAction,
    INITIAL_AUTH_STATE,
  );

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-5" noValidate>
        <AuthMessage
          message={state.message}
          tone={state.status === "success" ? "success" : "error"}
        />
        <EmailInput error={state.fieldErrors?.email} />
        <SubmitButton label={t("authentication.sendReset")} pendingLabel={t("authentication.sendingLink")} />
      </form>
      <p className="text-center text-sm">
        <Link
          href="/login"
          className="font-black text-blue-700 hover:underline dark:text-blue-300"
        >
          {t("authentication.backLogin")}
        </Link>
      </p>
    </div>
  );
}
