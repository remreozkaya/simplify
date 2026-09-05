import Link from "next/link";
import { cookies } from "next/headers";

import AuthCard from "@/components/auth/AuthCard";
import AuthMessage from "@/components/auth/AuthMessage";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import LocalizedText from "@/components/LocalizedText";
import { RECOVERY_COOKIE } from "@/lib/auth/cookies";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    updated?: string | string[];
    error?: string | string[];
  }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const params = await searchParams;

  if (params.updated === "1") {
    return (
      <AuthCard title="Your password has been updated" titleKey="authentication.passwordUpdated">
        <div className="space-y-5">
          <AuthMessage
            tone="success"
            message="You can now log in with your new password."
          />
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"
          >
            <LocalizedText translationKey="authentication.returnLogin" />
          </Link>
        </div>
      </AuthCard>
    );
  }

  const cookieStore = await cookies();
  const invalid =
    params.error === "invalid" ||
    cookieStore.get(RECOVERY_COOKIE)?.value !== "1";

  if (invalid) {
    return (
      <AuthCard title="Reset link unavailable" titleKey="authentication.resetUnavailable">
        <div className="space-y-5">
          <AuthMessage message="This password reset link is invalid or has expired." />
          <Link
            href="/forgot-password"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"
          >
            <LocalizedText translationKey="authentication.requestAnother" />
          </Link>
          <p className="text-center text-sm">
            <Link
              href="/login"
              className="font-bold text-slate-600 hover:underline dark:text-slate-300"
            >
              <LocalizedText translationKey="authentication.backLogin" />
            </Link>
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Your reset link is single-use and expires automatically."
      titleKey="authentication.choosePassword"
      descriptionKey="authentication.choosePasswordDescription"
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
