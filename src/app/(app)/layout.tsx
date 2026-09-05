import AppNavigation from "@/components/AppNavigation";
import ProfileProvider from "@/components/profile/ProfileProvider";
import { requireUser } from "@/lib/auth/session";
import { parseStoredProfile } from "@/lib/profile/validation";
import { readStoredCurriculumCatalog } from "@/lib/itu/curriculum/catalogStore";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const catalog = await readStoredCurriculumCatalog();
  const facultyNames = new Map(catalog?.faculties.map((faculty) => [faculty.id, faculty.name]) ?? []);
  const facultyByProgram = Object.fromEntries(catalog?.programs.map((program) => [program.code, { id: program.facultyId, name: facultyNames.get(program.facultyId) ?? program.facultyName }]) ?? []);
  const profile = parseStoredProfile(user.user_metadata.profile, facultyByProgram);

  return (
    <ProfileProvider initialProfile={profile}>
      <AppNavigation />
      {children}
    </ProfileProvider>
  );
}
