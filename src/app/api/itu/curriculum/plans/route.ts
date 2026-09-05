import { NextRequest, NextResponse } from "next/server";

import { curriculumProgramCodeSchema } from "@/lib/itu/curriculum/schemas";
import { getCurriculumPlans } from "@/lib/itu/curriculum/services/getCurriculumPlans";
import { ItuObsUpstreamError } from "@/lib/itu/errors";
import type { ItuPlanType } from "@/lib/itu/curriculum/types";

export async function GET(request: NextRequest) {
  const parsed = curriculumProgramCodeSchema.safeParse(
    request.nextUrl.searchParams.get("programCode"),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_PROGRAM_CODE", message: "A valid undergraduate program code is required." } },
      { status: 400 },
    );
  }
  const planType = request.nextUrl.searchParams.get("planType") as ItuPlanType | null;
  const primaryProgramCode = request.nextUrl.searchParams.get("primaryProgramCode") ?? undefined;
  if (!planType || !["undergraduate", "cap", "yandal"].includes(planType)) {
    return NextResponse.json({ error: { code: "INVALID_PLAN_TYPE", message: "A valid curriculum type is required." } }, { status: 400 });
  }
  try {
    return NextResponse.json({ plans: await getCurriculumPlans(parsed.data, planType, primaryProgramCode) });
  } catch (error: unknown) {
    const upstream = error instanceof ItuObsUpstreamError;
    return NextResponse.json(
      {
        error: {
          code: upstream ? "OBS_UNAVAILABLE" : "INTERNAL_ERROR",
          message: upstream
            ? "Curriculum versions are temporarily unavailable from İTÜ OBS."
            : "Curriculum versions could not be loaded.",
        },
      },
      { status: upstream ? 502 : 500 },
    );
  }
}
