const DEFAULT_AUTHENTICATED_PATH = "/";
const AUTH_CALLBACK_PATHS = new Set(["/verify-email", "/reset-password"]);

export function getSafeNextPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTHENTICATED_PATH,
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://simplify.invalid");
    if (parsed.origin !== "https://simplify.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function getSafeAuthCallbackPath(value: string | null | undefined) {
  const safePath = getSafeNextPath(value, "/verify-email");
  return AUTH_CALLBACK_PATHS.has(safePath.split(/[?#]/, 1)[0])
    ? safePath
    : "/verify-email";
}

export type RouteDecision =
  | { type: "allow" }
  | { type: "login"; next: string }
  | { type: "app" };

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth/callback",
];

function isPublicAuthPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function getRouteDecision(
  pathname: string,
  search: string,
  isAuthenticated: boolean,
): RouteDecision {
  if (isPublicAuthPath(pathname)) {
    if (
      isAuthenticated &&
      (pathname === "/login" || pathname === "/signup")
    ) {
      return { type: "app" };
    }
    return { type: "allow" };
  }

  if (!isAuthenticated) {
    return { type: "login", next: getSafeNextPath(`${pathname}${search}`) };
  }

  return { type: "allow" };
}
