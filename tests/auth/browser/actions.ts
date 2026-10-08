import type { AuthActionState } from "@/lib/auth/types";
import { emailOnlySchema, getFieldErrors, loginSchema, resetPasswordSchema, signupSchema } from "@/lib/auth/validation";

// Fixture action only: never imports a provider or sends email.
export async function signupAction(_state: AuthActionState, data: FormData): Promise<AuthActionState> {
  const result = signupSchema.safeParse(Object.fromEntries(data));
  return result.success ? { status: "error", message: "Unable to create your account right now. Try again." } : { status: "error", message: "Check the highlighted fields and try again.", fieldErrors: getFieldErrors(result.error) };
}
export async function loginAction(_state: AuthActionState, data: FormData): Promise<AuthActionState> {
  const result = loginSchema.safeParse({ ...Object.fromEntries(data), remember: data.get("remember") === "on" });
  return result.success ? { status: "error", message: "Invalid email or password." } : { status: "error", message: "Check the highlighted fields and try again.", fieldErrors: getFieldErrors(result.error) };
}
export async function forgotPasswordAction(_state: AuthActionState, data: FormData): Promise<AuthActionState> {
  const result = emailOnlySchema.safeParse(Object.fromEntries(data));
  return result.success ? { status: "success", message: "If an account exists for this email, a password reset link has been sent." } : { status: "error", message: "Enter a valid email address.", fieldErrors: getFieldErrors(result.error) };
}
export async function resetPasswordAction(_state: AuthActionState, data: FormData): Promise<AuthActionState> {
  const result = resetPasswordSchema.safeParse(Object.fromEntries(data));
  return result.success ? { status: "error", message: "This password reset link is invalid or has expired." } : { status: "error", message: "Check the highlighted fields and try again.", fieldErrors: getFieldErrors(result.error) };
}
export async function resendVerificationAction(): Promise<AuthActionState> { return { status: "success", message: "Verification email sent." }; }

export async function changePasswordAction() { return { status: "success" as const, message: "Password changed." }; }
export async function saveProfileAction() { return { status: "error" as const, message: "Fixture profile action." }; }
export async function exportAccountAction() { return { status: "error" as const }; }
export async function deleteAccountAction() { return { status: "error" as const }; }
