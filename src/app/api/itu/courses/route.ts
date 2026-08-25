import { NextResponse, type NextRequest } from "next/server";

import { toCalendarCatalog } from "@/lib/itu/adapters/toCalendarCatalog";
import {
  ItuBranchMismatchError,
  ItuObsUpstreamError,
} from "@/lib/itu/errors";
import { ituCoursesQuerySchema } from "@/lib/itu/schemas";
import { getCoursesByBranch } from "@/lib/itu/services/getCoursesByBranch";

export async function GET(request: NextRequest) {
  const result = ituCoursesQuerySchema.safeParse({
    branchId: request.nextUrl.searchParams.get("branchId"),
    branchCode: request.nextUrl.searchParams.get("branchCode"),
  });

  if (!result.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_QUERY",
          message: "A valid branchId and branchCode are required.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const catalog = await getCoursesByBranch(result.data);

    return NextResponse.json({
      catalog: toCalendarCatalog(catalog),
    });
  } catch (error: unknown) {
    if (error instanceof ItuBranchMismatchError) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_BRANCH",
            message: error.message,
          },
        },
        { status: 400 },
      );
    }

    const isUpstreamError = error instanceof ItuObsUpstreamError;

    return NextResponse.json(
      {
        error: {
          code: isUpstreamError ? "OBS_UNAVAILABLE" : "INTERNAL_ERROR",
          message: isUpstreamError
            ? `${result.data.branchCode} courses are temporarily unavailable.`
            : "The course catalog could not be loaded.",
        },
      },
      { status: isUpstreamError ? 502 : 500 },
    );
  }
}
