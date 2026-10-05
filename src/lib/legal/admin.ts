import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '@/lib/auth/config';

/** Never import this module from client code or use a NEXT_PUBLIC credential. */
export function createDeletionClient() {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) return null;
  return createClient(getSupabaseConfig().url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
