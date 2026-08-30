import { NextResponse } from "next/server";

import { ItuObsUpstreamError } from "@/lib/itu/errors";
import { getUndergraduatePrograms } from "@/lib/itu/curriculum/services/getUndergraduatePrograms";

export async function GET() {
  try {
    return NextResponse.json({ programs: await getUndergraduatePrograms() });
  } catch (error: unknown) {
    const upstream = error instanceof ItuObsUpstreamError;
    return NextResponse.json(
      {
        error: {
          code: upstream ? "OBS_UNAVAILABLE" : "INTERNAL_ERROR",
          message: upstream
            ? "Undergraduate programs are temporarily unavailable from İTÜ OBS."
            : "Undergraduate programs could not be loaded.",
        },
      },
      { status: upstream ? 502 : 500 },
    );
  }
}
