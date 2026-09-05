import ProfilePage from "@/components/profile/ProfilePage";
import { requireUser } from "@/lib/auth/session";
import { providerSupportsPassword } from "@/lib/profile/password";

export default async function ProfileRoute() {
  const user = await requireUser("/profile");
  const canChangePassword = providerSupportsPassword(user.app_metadata);

  return <ProfilePage email={user.email ?? ""} canChangePassword={canChangePassword} />;
}
