import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseConfig } from "@/lib/auth/config";
import { applySessionPersistence } from "@/lib/auth/cookies";

type ServerClientOptions = { remember?: boolean };

export async function createClient(options: ServerClientOptions = {}) {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseConfig();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
            cookieStore.set(
              name,
              value,
              applySessionPersistence(cookieOptions, options.remember),
            );
          });
        } catch {
          // Server Components cannot write cookies. The request Proxy refreshes
          // sessions and writes the resulting cookies before rendering them.
        }
      },
    },
  });
}
