import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/auth/config";
import { getSafeNextPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

function isVerifiedUser(user: User | null): user is User {
  return Boolean(user?.email && user.email_confirmed_at);
}

async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !isVerifiedUser(data.user)) return null;
  return data.user;
}

export async function requireUser(nextPath = "/") {
  const user = await getCurrentUser();
  if (user) return user;

  const safeNext = getSafeNextPath(nextPath);
  redirect(`/login?next=${encodeURIComponent(safeNext)}`);
}

export async function redirectAuthenticatedUser() {
  const user = await getCurrentUser();
  if (user) redirect("/");
}
