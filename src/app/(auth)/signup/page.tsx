import AuthCard from "@/components/auth/AuthCard";
import LocalizedText from "@/components/LocalizedText";
import SignupForm from "@/components/auth/SignupForm";
import { redirectAuthenticatedUser } from "@/lib/auth/session";

export default async function SignupPage() {
  await redirectAuthenticatedUser();

  return (
    <AuthCard
      titleKey="authentication.signupTitle"
      description={
        <LocalizedText translationKey="authentication.signupDescription" />
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
