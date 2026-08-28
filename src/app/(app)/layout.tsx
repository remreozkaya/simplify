import AppNavigation from "@/components/AppNavigation";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <>
      <AppNavigation email={user.email ?? "Signed in"} />
      {children}
    </>
  );
}
