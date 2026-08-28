import Link from "next/link";

import AuthCard from "@/components/auth/AuthCard";
import AuthMessage from "@/components/auth/AuthMessage";
import ResendVerificationForm from "@/components/auth/ResendVerificationForm";

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
      <AuthCard title="Email verified successfully">
        <div className="space-y-5">
          <AuthMessage
            tone="success"
            message="Your email is verified. You can now log in."
          />
          <Link
            href="/login"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          >
            Continue to Login
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verify your email"
      description={
        email
          ? `We've sent a verification link to ${email}.`
          : "Open the verification link in your email to activate your account."
      }
    >
      <div className="space-y-5">
        <AuthMessage
          tone={invalid ? "error" : "info"}
          message={
            invalid
              ? "This verification link is invalid or has expired."
              : "Check your inbox and verify your email before signing in."
          }
        />
        <ResendVerificationForm email={email} allowEmailEntry={!email} />
        <div className="flex flex-col gap-3 text-center text-sm">
          <Link
            href="/login"
            className="font-black text-blue-700 hover:underline dark:text-blue-300"
          >
            I&apos;ve verified my email — go to login
          </Link>
          <Link
            href="/login"
            className="font-semibold text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
          >
            Back to login
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}
