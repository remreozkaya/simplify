const LOCAL_SITE_URL = "http://localhost:3000";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase authentication is not configured. Add the required environment variables.",
    );
  }

  return { url, publishableKey };
}

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl.replace(/\/$/, "")}`;

  if (process.env.NODE_ENV !== "production") return LOCAL_SITE_URL;

  throw new Error(
    "NEXT_PUBLIC_SITE_URL must be configured in production for authentication emails.",
  );
}

export function createAuthCallbackUrl(nextPath: string) {
  const callback = new URL("/auth/callback", getSiteUrl());
  callback.searchParams.set("next", nextPath);
  return callback.toString();
}
