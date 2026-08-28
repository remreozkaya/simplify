import AuthCard from "@/components/auth/AuthCard";
import SignupForm from "@/components/auth/SignupForm";
import { redirectAuthenticatedUser } from "@/lib/auth/session";

export default async function SignupPage() {
  await redirectAuthenticatedUser();

  return (
    <AuthCard
      title="Create your Simplify account"
      description="Use your email and verify it before accessing the application."
    >
      <SignupForm />
    </AuthCard>
  );
}
