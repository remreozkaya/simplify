import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import {
  RECOVERY_COOKIE,
  RECOVERY_MAX_AGE,
  secureCookieOptions,
} from "@/lib/auth/cookies";
import { getSafeAuthCallbackPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function failurePath(nextPath: string) {
  return nextPath.startsWith("/reset-password")
    ? "/reset-password?error=invalid"
    : "/verify-email?error=invalid";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const nextPath = getSafeAuthCallbackPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const rawType = url.searchParams.get("type") as EmailOtpType | null;

  try {
    const supabase = await createClient({ remember: false });
    let error = null;

    if (code) {
      ({ error } = await supabase.auth.exchangeCodeForSession(code));
    } else if (tokenHash && rawType && EMAIL_OTP_TYPES.has(rawType)) {
      ({ error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: rawType,
      }));
    } else {
      return NextResponse.redirect(new URL(failurePath(nextPath), url.origin));
    }

    if (error) {
      return NextResponse.redirect(new URL(failurePath(nextPath), url.origin));
    }

    if (nextPath.startsWith("/reset-password")) {
      const cookieStore = await cookies();
      cookieStore.set(
        RECOVERY_COOKIE,
        "1",
        secureCookieOptions(RECOVERY_MAX_AGE),
      );
      return NextResponse.redirect(new URL(nextPath, url.origin));
    }

    // Email confirmation establishes a temporary PKCE session. End it so the
    // product flow remains verification -> explicit login -> application.
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL(nextPath, url.origin));
  } catch {
    return NextResponse.redirect(new URL(failurePath(nextPath), url.origin));
  }
}
