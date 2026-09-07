import AuthCard from "@/components/auth/AuthCard";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthCard titleKey="authentication.resetTitle">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
