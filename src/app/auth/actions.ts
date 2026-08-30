"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createAuthCallbackUrl } from "@/lib/auth/config";
import {
  RECOVERY_COOKIE,
  REMEMBER_COOKIE,
  REMEMBER_MAX_AGE,
  RESEND_COOKIE,
  RESEND_COOLDOWN_SECONDS,
  secureCookieOptions,
} from "@/lib/auth/cookies";
import {
  classifyAuthError,
  getLoginErrorMessage,
} from "@/lib/auth/errors";
import { getSafeNextPath } from "@/lib/auth/redirects";
import type { AuthActionState } from "@/lib/auth/types";
import {
  emailOnlySchema,
  getFieldErrors,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

function unexpectedMessage(action: string) {
  return `Unable to ${action} right now. Try again.`;
}

function clearLocalAuthCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore
    .getAll()
    .filter(
      ({ name }) => name.startsWith("sb-") && name.includes("-auth-token"),
    )
    .forEach(({ name }) => cookieStore.delete(name));
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    remember: formData.get("remember") === "on",
    next: formData.get("next")?.toString(),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  const { email, password, remember, next } = parsed.data;
  let result;

  try {
    const supabase = await createClient({ remember });
    result = await supabase.auth.signInWithPassword({ email, password });

    if (!result.error && !result.data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      return {
        status: "unverified",
        email,
        message: "Your email address has not been verified.",
      };
    }
  } catch {
    return { status: "error", message: unexpectedMessage("sign in") };
  }

  if (result.error) {
    const kind = classifyAuthError(result.error);
    if (kind === "unverified") {
      return {
        status: "unverified",
        email,
        message: "Your email address has not been verified.",
      };
    }
    return { status: "error", message: getLoginErrorMessage(kind) };
  }

  const cookieStore = await cookies();
  cookieStore.set(
    REMEMBER_COOKIE,
    remember ? "1" : "0",
    secureCookieOptions(remember ? REMEMBER_MAX_AGE : undefined),
  );
  revalidatePath("/", "layout");
  redirect(getSafeNextPath(next));
}

export async function signupAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  const { email, password } = parsed.data;

  try {
    const supabase = await createClient({ remember: false });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: createAuthCallbackUrl("/verify-email?verified=1"),
      },
    });

    if (error) {
      const kind = classifyAuthError(error);
      if (kind === "rate_limited") {
        return {
          status: "error",
          message: "Too many requests. Please wait before trying again.",
        };
      }

      // A generic response avoids revealing whether an account already exists.
      if (kind !== "invalid_credentials") {
        return {
          status: "error",
          message: unexpectedMessage("create your account"),
        };
      }
    }

    // Never allow sign-up to enter the application if confirmations were
    // accidentally disabled in the provider dashboard.
    if (data?.session) await supabase.auth.signOut();
  } catch {
    return {
      status: "error",
      message: unexpectedMessage("create your account"),
    };
  }

  redirect(`/verify-email?sent=1&email=${encodeURIComponent(email)}`);
}

export async function resendVerificationAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid email address.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  const cookieStore = await cookies();
  const lastSent = Number(cookieStore.get(RESEND_COOKIE)?.value ?? 0);
  const elapsed = Math.floor(Date.now() / 1000) - lastSent;
  if (lastSent && elapsed < RESEND_COOLDOWN_SECONDS) {
    return {
      status: "error",
      message: "Please wait before requesting another verification email.",
      email: parsed.data.email,
      retryAfter: RESEND_COOLDOWN_SECONDS - elapsed,
    };
  }

  cookieStore.set(
    RESEND_COOKIE,
    String(Math.floor(Date.now() / 1000)),
    secureCookieOptions(RESEND_COOLDOWN_SECONDS),
  );

  try {
    const supabase = await createClient({ remember: false });
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: {
        emailRedirectTo: createAuthCallbackUrl("/verify-email?verified=1"),
      },
    });

    if (error && classifyAuthError(error) === "rate_limited") {
      return {
        status: "error",
        email: parsed.data.email,
        message: "Please wait before requesting another verification email.",
        retryAfter: RESEND_COOLDOWN_SECONDS,
      };
    }
    if (error) {
      return {
        status: "error",
        email: parsed.data.email,
        message: unexpectedMessage("resend the verification email"),
        retryAfter: RESEND_COOLDOWN_SECONDS,
      };
    }
  } catch {
    return {
      status: "error",
      email: parsed.data.email,
      message: unexpectedMessage("resend the verification email"),
      retryAfter: RESEND_COOLDOWN_SECONDS,
    };
  }

  return {
    status: "success",
    email: parsed.data.email,
    message: "Verification email sent.",
    retryAfter: RESEND_COOLDOWN_SECONDS,
  };
}

export async function forgotPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter a valid email address.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  try {
    const supabase = await createClient({ remember: false });
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: createAuthCallbackUrl("/reset-password") },
    );
    if (error && classifyAuthError(error) !== "rate_limited") {
      return {
        status: "error",
        message: unexpectedMessage("send a reset link"),
      };
    }
  } catch {
    return {
      status: "error",
      message: unexpectedMessage("send a reset link"),
    };
  }

  return {
    status: "success",
    message:
      "If an account exists for this email, a password reset link has been sent.",
  };
}

export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: getFieldErrors(parsed.error),
    };
  }

  const cookieStore = await cookies();
  if (cookieStore.get(RECOVERY_COOKIE)?.value !== "1") {
    return {
      status: "error",
      message: "This password reset link is invalid or has expired.",
    };
  }

  try {
    const supabase = await createClient({ remember: false });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return {
        status: "error",
        message: "This password reset link is invalid or has expired.",
      };
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) {
      const kind = classifyAuthError(error);
      return {
        status: "error",
        message:
          kind === "expired"
            ? "This password reset link is invalid or has expired."
            : unexpectedMessage("update your password"),
      };
    }

    await supabase.auth.signOut();
  } catch {
    return {
      status: "error",
      message: unexpectedMessage("update your password"),
    };
  }

  cookieStore.delete(RECOVERY_COOKIE);
  cookieStore.delete(REMEMBER_COOKIE);
  clearLocalAuthCookies(cookieStore);
  revalidatePath("/", "layout");
  redirect("/reset-password?updated=1");
}

export async function logoutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } finally {
    const cookieStore = await cookies();
    cookieStore.delete(REMEMBER_COOKIE);
    cookieStore.delete(RECOVERY_COOKIE);
    clearLocalAuthCookies(cookieStore);
    revalidatePath("/", "layout");
  }
  redirect("/login");
}
