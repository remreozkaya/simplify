import type { CookieOptions } from "@supabase/ssr";

export const REMEMBER_COOKIE = "simplify-remember";
export const RECOVERY_COOKIE = "simplify-password-recovery";
export const RESEND_COOKIE = "simplify-verification-resend";
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 365;
export const RECOVERY_MAX_AGE = 60 * 15;
export const RESEND_COOLDOWN_SECONDS = 30;

export function applySessionPersistence(
  options: CookieOptions,
  remember: boolean | undefined,
): CookieOptions {
  // All auth operations in this application run on the server; browser JS does
  // not need token access. Enforce these attributes on every provider write.
  const sessionOptions: CookieOptions = {
    ...options, httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/",
  };
  if (remember !== false) return sessionOptions;
  delete sessionOptions.maxAge;
  delete sessionOptions.expires;
  return sessionOptions;
}

export function secureCookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}
