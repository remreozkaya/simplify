import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(),
  resend: vi.fn(), resetPasswordForEmail: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(),
  exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn(), revalidatePath: vi.fn(),
  cookieValues: new Map<string, string>(), setCookie: vi.fn(), deleteCookie: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => mocks.cookieValues.has(name) ? { name, value: mocks.cookieValues.get(name) } : undefined,
  getAll: () => [...mocks.cookieValues].map(([name, value]) => ({ name, value })),
  set: mocks.setCookie, delete: mocks.deleteCookie,
}) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { forgotPasswordAction, loginAction, logoutAction, resendVerificationAction, resetPasswordAction, signupAction } from "@/app/auth/actions";
import { GET as authCallback } from "@/app/auth/callback/route";
import { changePasswordAction } from "@/app/(app)/profile/actions";
import { RECOVERY_COOKIE, REMEMBER_COOKIE, REMEMBER_MAX_AGE, RESEND_COOKIE } from "@/lib/auth/cookies";

const idle = { status: "idle" as const };
const verified = { id: "disposable", email: "qa@example.test", email_confirmed_at: "2026-10-08", app_metadata: { provider: "email" } };
function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}
const login = (extra: Record<string, string> = {}) => form({ email: verified.email, password: "Current123!", ...extra });
const signup = (extra: Record<string, string> = {}) => form({ email: verified.email, password: "NewPassword123!", confirmPassword: "NewPassword123!", ...extra });
const reset = () => form({ password: "NewPassword123!", confirmPassword: "NewPassword123!" });
const change = () => form({ currentPassword: "Current123!", newPassword: "NewPassword123!", confirmPassword: "NewPassword123!" });
const rememberCases: Record<string, string>[] = [{}, { remember: "on" }];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.cookieValues.clear();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  mocks.createClient.mockResolvedValue({ auth: mocks });
  mocks.signInWithPassword.mockResolvedValue({ data: { user: verified }, error: null });
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: verified }, error: null });
  for (const method of [mocks.signOut, mocks.resend, mocks.resetPasswordForEmail, mocks.updateUser, mocks.exchangeCodeForSession, mocks.verifyOtp]) method.mockResolvedValue({ error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("isolated authentication action integration", () => {
  it("rejects malformed signup before creating a provider client", async () => {
    const result = await signupAction(idle, signup({ email: "invalid", password: "short", confirmPassword: "other" }));
    expect(result).toMatchObject({ status: "error", fieldErrors: { email: expect.any(String), password: expect.any(String), confirmPassword: expect.any(String) } });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("sends signup through the verification callback and redirects to the verification screen", async () => {
    await expect(signupAction(idle, signup())).rejects.toThrow("REDIRECT:/verify-email?sent=1&email=qa%40example.test");
    expect(mocks.signUp).toHaveBeenCalledWith({ email: verified.email, password: "NewPassword123!", options: { emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Fverify-email%3Fverified%3D1" } });
    expect(mocks.createClient).toHaveBeenCalledWith({ remember: false });
  });

  it("ends an accidental signup session when provider email confirmation is disabled", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: { access_token: "disposable" } }, error: null });
    await expect(signupAction(idle, signup())).rejects.toThrow("REDIRECT:/verify-email");
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it.each(rememberCases)("preserves safe destination and remember-cookie policy %j", async extra => {
    await expect(loginAction(idle, login({ ...extra, next: "/curriculum?plan=1" }))).rejects.toThrow("REDIRECT:/curriculum?plan=1");
    const remembered = extra.remember === "on";
    expect(mocks.createClient).toHaveBeenCalledWith({ remember: remembered });
    expect(mocks.setCookie).toHaveBeenCalledWith(REMEMBER_COOKIE, remembered ? "1" : "0", expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }));
    const options = mocks.setCookie.mock.calls[0][2];
    if (remembered) expect(options.maxAge).toBe(REMEMBER_MAX_AGE);
    else { expect(options).not.toHaveProperty("maxAge"); expect(options).not.toHaveProperty("expires"); }
  });

  it.each(["https://evil.example/", "//evil.example/", "/login"]) ("neutralizes unsafe login destination %s", async next => {
    await expect(loginAction(idle, login({ next }))).rejects.toThrow("REDIRECT:/");
  });

  it("ends an unverified login session before any application redirect or remember write", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { ...verified, email_confirmed_at: null } }, error: null });
    expect(await loginAction(idle, login())).toMatchObject({ status: "unverified", email: verified.email });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("reports invalid login credentials without exposing provider diagnostic text", async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: "invalid_credentials", message: "private provider diagnostic" } });
    expect(await loginAction(idle, login())).toEqual({ status: "error", message: "Invalid email or password." });
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });

  it("throttles verification resend using the cookie without calling the provider", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T10:00:00Z"));
    mocks.cookieValues.set(RESEND_COOKIE, String(Date.now() / 1000 - 5));
    expect(await resendVerificationAction(idle, form({ email: verified.email }))).toMatchObject({ status: "error", retryAfter: 25 });
    expect(mocks.resend).not.toHaveBeenCalled();
  });

  it("resends verification through the configured callback and starts cooldown", async () => {
    expect(await resendVerificationAction(idle, form({ email: verified.email }))).toMatchObject({ status: "success", retryAfter: 30 });
    expect(mocks.resend).toHaveBeenCalledWith(expect.objectContaining({ type: "signup", email: verified.email, options: { emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Fverify-email%3Fverified%3D1" } }));
    expect(mocks.setCookie).toHaveBeenCalledWith(RESEND_COOKIE, expect.any(String), expect.objectContaining({ maxAge: 30, httpOnly: true }));
  });

  it("requests recovery without revealing whether an account exists", async () => {
    expect(await forgotPasswordAction(idle, form({ email: verified.email }))).toEqual({ status: "success", message: "If an account exists for this email, a password reset link has been sent." });
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(verified.email, { redirectTo: "http://localhost:3000/auth/callback?next=%2Freset-password" });
  });

  it("refuses password reset without a recovery cookie", async () => {
    expect(await resetPasswordAction(idle, reset())).toMatchObject({ status: "error", message: "This password reset link is invalid or has expired." });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("refuses password reset with an expired provider session despite a recovery cookie", async () => {
    mocks.cookieValues.set(RECOVERY_COOKIE, "1");
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { code: "session_expired" } });
    expect(await resetPasswordAction(idle, reset())).toMatchObject({ status: "error", message: "This password reset link is invalid or has expired." });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("updates recovery password, ends the temporary session and removes auth cookies", async () => {
    mocks.cookieValues.set(RECOVERY_COOKIE, "1");
    mocks.cookieValues.set("sb-disposable-auth-token.0", "fixture");
    await expect(resetPasswordAction(idle, reset())).rejects.toThrow("REDIRECT:/reset-password?updated=1");
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "NewPassword123!" });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.deleteCookie.mock.calls.map(([name]) => name)).toEqual(expect.arrayContaining([RECOVERY_COOKIE, REMEMBER_COOKIE, "sb-disposable-auth-token.0"]));
  });

  it("rejects password change after session expiry before verifying or updating a password", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await changePasswordAction(idle, change())).toMatchObject({ status: "error", message: "Your session has expired. Sign in again to change your password." });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("requires the current password before updating it", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    expect(await changePasswordAction(idle, change())).toMatchObject({ status: "error", fieldErrors: { currentPassword: "Current password is incorrect." } });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("leaves provider-managed passwords unchanged", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { ...verified, app_metadata: { provider: "google" } } }, error: null });
    expect(await changePasswordAction(idle, change())).toEqual({ status: "error", message: "Your password is managed by your sign-in provider." });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("verifies current credentials and updates the password only for the session user", async () => {
    expect(await changePasswordAction(idle, change())).toEqual({ status: "success", message: "Password changed." });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: verified.email, password: "Current123!" });
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "NewPassword123!" });
    expect(mocks.signInWithPassword.mock.invocationCallOrder[0]).toBeLessThan(mocks.updateUser.mock.invocationCallOrder[0]);
  });

  it("logs out and removes only auth cookies while preserving preferences", async () => {
    for (const name of ["sb-disposable-auth-token", "sb-disposable-auth-token.1", "simplify-language"]) mocks.cookieValues.set(name, "fixture");
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.deleteCookie.mock.calls.map(([name]) => name)).toEqual(expect.arrayContaining([REMEMBER_COOKIE, RECOVERY_COOKIE, "sb-disposable-auth-token", "sb-disposable-auth-token.1"]));
    expect(mocks.deleteCookie).not.toHaveBeenCalledWith("simplify-language");
  });

  it("clears local auth cookies and returns to login even if provider signout throws", async () => {
    mocks.signOut.mockRejectedValue(new Error("provider offline"));
    mocks.cookieValues.set("sb-disposable-auth-token", "fixture");
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.deleteCookie).toHaveBeenCalledWith("sb-disposable-auth-token");
    expect(mocks.deleteCookie).toHaveBeenCalledWith(REMEMBER_COOKIE);
  });

  it("verifies a signup token then ends its temporary session", async () => {
    const response = await authCallback(new NextRequest("http://localhost:3000/auth/callback?token_hash=fixture&type=signup&next=%2Fverify-email%3Fverified%3D1"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/verify-email?verified=1");
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "fixture", type: "signup" });
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("opens a bounded recovery session after successful callback", async () => {
    const response = await authCallback(new NextRequest("http://localhost:3000/auth/callback?code=fixture&next=%2Freset-password"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/reset-password");
    expect(mocks.setCookie).toHaveBeenCalledWith(RECOVERY_COOKIE, "1", expect.objectContaining({ maxAge: 900, httpOnly: true }));
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("rejects expired recovery callback without creating a recovery cookie", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: { code: "otp_expired" } });
    const response = await authCallback(new NextRequest("http://localhost:3000/auth/callback?code=fixture&next=%2Freset-password"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/reset-password?error=invalid");
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
});
