export type AuthErrorKind =
  | "invalid_credentials"
  | "unverified"
  | "rate_limited"
  | "expired"
  | "unavailable";

type ProviderError = { message?: string; code?: string; status?: number };

export function classifyAuthError(error: ProviderError | null): AuthErrorKind {
  if (!error) return "unavailable";

  const message = error.message?.toLowerCase() ?? "";
  const code = error.code?.toLowerCase() ?? "";

  if (
    code.includes("email_not_confirmed") ||
    message.includes("email not confirmed")
  ) {
    return "unverified";
  }
  if (
    error.status === 429 ||
    code.includes("rate_limit") ||
    message.includes("rate limit") ||
    message.includes("security purposes")
  ) {
    return "rate_limited";
  }
  if (
    code.includes("expired") ||
    message.includes("expired") ||
    message.includes("invalid token")
  ) {
    return "expired";
  }
  if (
    error.status === 400 ||
    code.includes("invalid_credentials") ||
    message.includes("invalid login credentials")
  ) {
    return "invalid_credentials";
  }
  return "unavailable";
}

export function getLoginErrorMessage(kind: AuthErrorKind) {
  switch (kind) {
    case "invalid_credentials":
      return "Invalid email or password.";
    case "unverified":
      return "Your email address has not been verified.";
    case "rate_limited":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return "Unable to sign in right now. Try again.";
  }
}
