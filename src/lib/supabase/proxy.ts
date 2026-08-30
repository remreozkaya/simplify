import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/auth/config";
import {
  applySessionPersistence,
  REMEMBER_COOKIE,
} from "@/lib/auth/cookies";
import { getRouteDecision } from "@/lib/auth/redirects";

export async function updateSession(request: NextRequest) {
  const configured = isSupabaseConfigured();
  let response = NextResponse.next({ request });
  let isAuthenticated = false;

  if (configured) {
    const { url, publishableKey } = getSupabaseConfig();
    const remember = request.cookies.get(REMEMBER_COOKIE)?.value !== "0";
    const supabase = createServerClient(url, publishableKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(
              name,
              value,
              applySessionPersistence(options, remember),
            ),
          );
        },
      },
    });

    const { data, error } = await supabase.auth.getClaims();
    isAuthenticated = !error && Boolean(data?.claims?.sub);

    if (
      isAuthenticated &&
      (request.nextUrl.pathname === "/login" ||
        request.nextUrl.pathname === "/signup")
    ) {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      isAuthenticated =
        !userError && Boolean(userData.user?.email_confirmed_at);
    }
  }

  const decision = getRouteDecision(
    request.nextUrl.pathname,
    request.nextUrl.search,
    isAuthenticated,
  );

  if (decision.type === "app") {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url));
    response.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie),
    );
    return redirectResponse;
  }

  if (decision.type === "login") {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", decision.next);
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) =>
      redirectResponse.cookies.set(cookie),
    );
    return redirectResponse;
  }

  return response;
}
