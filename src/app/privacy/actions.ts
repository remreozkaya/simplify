'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createDeletionClient } from '@/lib/legal/admin';
import { exportStoredProfile } from '@/lib/legal/profileExport';
import { REMEMBER_COOKIE, RECOVERY_COOKIE, RESEND_COOKIE } from '@/lib/auth/cookies';

export async function exportAccountAction() {
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    const user = data.user;
    if (error || !user?.email_confirmed_at) return { status: 'unauthorized' as const };
    return { status: 'success' as const, account: {
      id: user.id, email: user.email, createdAt: user.created_at,
      emailConfirmedAt: user.email_confirmed_at,
      profile: exportStoredProfile(user.user_metadata.profile),
    } };
  } catch {
    return { status: 'error' as const };
  }
}

export async function deleteAccountAction(input: unknown) {
  const parsed = z.object({ password: z.string().min(1).max(1024), confirm: z.literal(true) }).safeParse(input);
  if (!parsed.success) return { status: 'invalid' as const };
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getUser();
    const user = data.user;
    if (error || !user?.email || !user.email_confirmed_at) return { status: 'unauthorized' as const };
    const admin = createDeletionClient();
    if (!admin) return { status: 'unavailable' as const };
    const verification = await client.auth.signInWithPassword({ email: user.email, password: parsed.data.password });
    if (verification.error || verification.data.user?.id !== user.id || !verification.data.user.email_confirmed_at) {
      return { status: 'verification' as const };
    }
    // This schema has only Auth user metadata: no application tables or uploaded objects.
    // Hard-delete the authenticated user, including metadata and identities. Never accept a target ID.
    const deletion = await admin.auth.admin.deleteUser(user.id, false);
    if (deletion.error) return { status: 'error' as const };
    // Deletion may already invalidate the session; local cookies must still be cleared.
    try { await client.auth.signOut({ scope: 'global' }); } catch { /* User is already deleted. */ }
    const cookieStore = await cookies();
    for (const { name } of cookieStore.getAll()) {
      if (name.startsWith('sb-') || [REMEMBER_COOKIE, RECOVERY_COOKIE, RESEND_COOKIE].includes(name)) cookieStore.delete(name);
    }
    return { status: 'success' as const };
  } catch {
    return { status: 'error' as const };
  }
}
