import { z } from "zod";

import { passwordSchema } from "@/lib/auth/validation";

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).superRefine((value, context) => {
  if (value.newPassword !== value.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match." });
  }
  if (value.currentPassword && value.newPassword === value.currentPassword) {
    context.addIssue({ code: "custom", path: ["newPassword"], message: "New password must be different from your current password." });
  }
});

export function providerSupportsPassword(appMetadata: Record<string, unknown>) {
  const providers = appMetadata.providers;
  return appMetadata.provider === "email" || (Array.isArray(providers) && providers.includes("email"));
}
