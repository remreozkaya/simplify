import { NextResponse } from "next/server";

import { ItuObsUpstreamError } from "@/lib/itu/errors";
import { ituBranchesApiResponseSchema } from "@/lib/itu/schemas";
import { getUndergraduateBranches } from "@/lib/itu/services/getUndergraduateBranches";

export async function GET() {
  try {
    const branches = await getUndergraduateBranches();

    return NextResponse.json(
      ituBranchesApiResponseSchema.parse({ branches }),
    );
  } catch (error: unknown) {
    const isUpstreamError = error instanceof ItuObsUpstreamError;

    return NextResponse.json(
      {
        error: {
          code: isUpstreamError ? "OBS_UNAVAILABLE" : "INTERNAL_ERROR",
          message: isUpstreamError
            ? "İTÜ course branches are temporarily unavailable."
            : "The course branches could not be loaded.",
        },
      },
      { status: isUpstreamError ? 502 : 500 },
    );
  }
}
