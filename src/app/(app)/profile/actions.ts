"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { changePasswordSchema, providerSupportsPassword } from "@/lib/profile/password";
import { makeProfile, parseProfileInput, profileFieldErrors } from "@/lib/profile/validation";
import type { PasswordActionState, ProfileActionState } from "@/lib/profile/actionState";
import { createClient } from "@/lib/supabase/server";
import { getFacultyPrograms } from "@/lib/itu/curriculum/services/getCurriculumCatalog";
import { getCurriculumPlans } from "@/lib/itu/curriculum/services/getCurriculumPlans";
import { isPrimaryProgramEligible } from "@/lib/itu/curriculum/catalog";

export async function saveProfileAction(input: unknown): Promise<ProfileActionState> {
  const parsed = parseProfileInput(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted profile fields and try again.",
      fieldErrors: profileFieldErrors(parsed.error),
    };
  }

  const profile = makeProfile(parsed.data);
  try {
    const main = profile.programEnrollments.find((item) => item.type === "main")!;
    for (const enrollment of profile.programEnrollments) {
      const programs = await getFacultyPrograms(enrollment.facultyId, enrollment.planType);
      const officialProgram = programs.find((program) => program.code === enrollment.programCode);
      if (!officialProgram) {
        return { status: "error", message: "A selected program is not available for its faculty and curriculum type.", fieldErrors: { programEnrollments: "Review the faculty, program, and enrollment type selections." } };
      }
      enrollment.programName = officialProgram.name;
      enrollment.programNameTr = officialProgram.nameTr ?? officialProgram.name;
      enrollment.programNameEn = officialProgram.nameEn;
      enrollment.facultyName = officialProgram.faculty ?? enrollment.facultyName;
      const plans = await getCurriculumPlans(enrollment.programCode, enrollment.planType, enrollment.type === "main" ? undefined : main.programCode);
      const officialPlan = plans.find((plan) => plan.id === enrollment.curriculumPlanId);
      if (!officialPlan) {
        return { status: "error", message: "A selected curriculum plan is no longer eligible for this enrollment.", fieldErrors: { programEnrollments: "Select an available curriculum plan." } };
      }
      enrollment.curriculumPlanName = officialPlan.title;
      enrollment.curriculumPlanNameTr = officialPlan.nameTr ?? officialPlan.title;
      enrollment.curriculumPlanNameEn = officialPlan.nameEn;
      if (enrollment.type !== "main") {
        enrollment.primaryProgramCode = main.programCode;
        enrollment.targetProgramCode = enrollment.programCode;
        const associated = officialPlan.associatedPrimaryProgramCodes ?? [];
        if (!isPrimaryProgramEligible(associated, main.programCode)) {
          return { status: "error", message: "The selected secondary plan is not available to the main program.", fieldErrors: { programEnrollments: "Select a plan associated with the main program." } };
        }
        enrollment.associatedPrimaryProgramCodes = associated;
      }
      enrollment.selectionRequiresReview = undefined;
    }
    const supabase = await createClient();
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) return { status: "error", message: "Your session has expired. Sign in again to save your profile." };
    const { error } = await supabase.auth.updateUser({ data: { profile } });
    if (error) return { status: "error", message: "Your profile could not be saved right now. Try again." };
    revalidatePath("/", "layout");
    return { status: "success", message: "Profile saved.", profile };
  } catch {
    return { status: "error", message: "Your profile could not be saved right now. Try again." };
  }
}

function passwordErrors(error: z.ZodError): PasswordActionState["fieldErrors"] {
  const result: NonNullable<PasswordActionState["fieldErrors"]> = {};
  error.issues.forEach((issue) => {
    const field = issue.path[0] as keyof typeof result;
    if (!result[field]) result[field] = issue.message;
  });
  return result;
}

export async function changePasswordAction(
  _previousState: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Check the highlighted password fields.", fieldErrors: passwordErrors(parsed.error) };
  }

  try {
    const supabase = await createClient();
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user?.email) return { status: "error", message: "Your session has expired. Sign in again to change your password." };
    if (!providerSupportsPassword(data.user.app_metadata)) return { status: "error", message: "Your password is managed by your sign-in provider." };

    const verification = await supabase.auth.signInWithPassword({ email: data.user.email, password: parsed.data.currentPassword });
    if (verification.error) {
      return { status: "error", message: "Your current password is incorrect.", fieldErrors: { currentPassword: "Current password is incorrect." } };
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
    if (error) return { status: "error", message: "Your password could not be changed right now. Try again." };
    return { status: "success", message: "Password changed." };
  } catch {
    return { status: "error", message: "Your password could not be changed right now. Try again." };
  }
}
