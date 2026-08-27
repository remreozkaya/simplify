import { NextRequest, NextResponse } from "next/server";

import {
  curriculumPlanIdSchema,
  curriculumProgramCodeSchema,
} from "@/lib/itu/curriculum/schemas";
import { getCurriculum } from "@/lib/itu/curriculum/services/getCurriculum";
import { getCurriculumPlans } from "@/lib/itu/curriculum/services/getCurriculumPlans";
import { ItuObsUpstreamError } from "@/lib/itu/errors";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ planId: string }> },
) {
  const { planId: rawPlanId } = await context.params;
  const planId = curriculumPlanIdSchema.safeParse(rawPlanId);
  const programCode = curriculumProgramCodeSchema.safeParse(
    request.nextUrl.searchParams.get("programCode"),
  );
  if (!planId.success || !programCode.success) {
    return NextResponse.json(
      { error: { code: "INVALID_CURRICULUM", message: "A valid plan and undergraduate program are required." } },
      { status: 400 },
    );
  }
  try {
    const plans = await getCurriculumPlans(programCode.data);
    if (!plans.some((plan) => plan.id === planId.data)) {
      return NextResponse.json(
        { error: { code: "PLAN_NOT_FOUND", message: "This plan does not belong to the selected program." } },
        { status: 404 },
      );
    }
    return NextResponse.json({
      curriculum: await getCurriculum(planId.data, programCode.data),
    });
  } catch (error: unknown) {
    const upstream = error instanceof ItuObsUpstreamError;
    return NextResponse.json(
      {
        error: {
          code: upstream ? "OBS_UNAVAILABLE" : "INTERNAL_ERROR",
          message: upstream
            ? "The curriculum is temporarily unavailable from İTÜ OBS."
            : "The curriculum could not be loaded.",
        },
      },
      { status: upstream ? 502 : 500 },
    );
  }
}
