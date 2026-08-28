import AuthCard from "@/components/auth/AuthCard";
import LoginForm from "@/components/auth/LoginForm";
import { getSafeNextPath } from "@/lib/auth/redirects";
import { redirectAuthenticatedUser } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await redirectAuthenticatedUser();
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <AuthCard
      title="Welcome back"
      description="Log in to continue to your Simplify workspace."
    >
      <LoginForm nextPath={getSafeNextPath(rawNext)} />
    </AuthCard>
  );
}
