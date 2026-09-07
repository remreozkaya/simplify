import Link from "next/link";

import AuthCard from "@/components/auth/AuthCard";
import AuthMessage from "@/components/auth/AuthMessage";
import ResendVerificationForm from "@/components/auth/ResendVerificationForm";
import LocalizedText from "@/components/LocalizedText";

type VerifyEmailPageProps = {
  searchParams: Promise<{
    email?: string | string[];
    sent?: string | string[];
    verified?: string | string[];
    error?: string | string[];
  }>;
};

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const params = await searchParams;
  const email = Array.isArray(params.email) ? params.email[0] : params.email;
  const verified = params.verified === "1";
  const invalid = params.error === "invalid";

  if (verified) {
    return (
      <AuthCard titleKey="authentication.emailVerified">
        <div className="space-y-5">
          <AuthMessage
            tone="success"
            message="Your email is verified. You can now log in."
          />
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          >
            <LocalizedText translationKey="authentication.continueLogin" />
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      titleKey="authentication.verifyTitle"
      description={
        email ? (
          <LocalizedText
            translationKey="authentication.verifySent"
            values={{ email }}
          />
        ) : (
          <LocalizedText translationKey="authentication.verifyOpen" />
        )
      }
    >
      <div className="space-y-5">
        {invalid ? (
          <AuthMessage message="This verification link is invalid or has expired." />
        ) : null}
        <ResendVerificationForm email={email} allowEmailEntry={!email} />
        <div className="flex flex-col gap-3 text-center text-sm">
          <Link
            href="/login"
            className="font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
          >
            <LocalizedText translationKey="authentication.backLogin" />
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}
