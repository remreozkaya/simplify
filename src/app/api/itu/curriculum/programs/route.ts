import { NextRequest, NextResponse } from "next/server";

import { ItuObsUpstreamError } from "@/lib/itu/errors";
import { getFacultyPrograms } from "@/lib/itu/curriculum/services/getCurriculumCatalog";
import type { ItuPlanType } from "@/lib/itu/curriculum/types";
import { getCurriculumPlans } from "@/lib/itu/curriculum/services/getCurriculumPlans";

export async function GET(request: NextRequest) {
  const facultyId = request.nextUrl.searchParams.get("facultyId")?.trim();
  const planType = request.nextUrl.searchParams.get("planType") as ItuPlanType | null;
  const primaryProgramCode = request.nextUrl.searchParams.get("primaryProgramCode") ?? undefined;
  if (!facultyId || !planType || !["undergraduate", "cap", "yandal"].includes(planType)) {
    return NextResponse.json({ error: { code: "INVALID_FILTER", message: "Select a valid faculty and plan type." } }, { status: 400 });
  }
  try {
    const programs = await getFacultyPrograms(facultyId, planType);
    if (planType === "undergraduate" || !primaryProgramCode) return NextResponse.json({ programs });
    const eligibility = await Promise.all(programs.map(async (program) => ({ program, eligible: (await getCurriculumPlans(program.code, planType, primaryProgramCode)).length > 0 })));
    return NextResponse.json({ programs: eligibility.filter((item) => item.eligible).map((item) => item.program) });
  } catch (error: unknown) {
    const upstream = error instanceof ItuObsUpstreamError;
    return NextResponse.json(
      {
        error: {
          code: upstream ? "OBS_UNAVAILABLE" : "INTERNAL_ERROR",
          message: upstream
            ? "Programs are temporarily unavailable from İTÜ OBS."
            : "Programs could not be loaded.",
        },
      },
      { status: upstream ? 502 : 500 },
    );
  }
}
