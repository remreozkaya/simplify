import type { ProfileFieldErrors } from "@/lib/profile/validation";
import type { UserProfile } from "@/lib/profile/types";

export type ProfileActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: ProfileFieldErrors;
  profile?: UserProfile;
};

export const INITIAL_PROFILE_ACTION_STATE: ProfileActionState = { status: "idle" };

export type PasswordActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>;
};

export const INITIAL_PASSWORD_ACTION_STATE: PasswordActionState = { status: "idle" };
