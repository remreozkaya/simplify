import type { AuthFieldErrors } from "@/lib/auth/validation";

export type AuthActionState = {
  status: "idle" | "error" | "success" | "unverified";
  message?: string;
  fieldErrors?: AuthFieldErrors;
  email?: string;
  retryAfter?: number;
};

export const INITIAL_AUTH_STATE: AuthActionState = { status: "idle" };
