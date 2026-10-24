import { NextResponse, type NextRequest } from "next/server";
import { courseInformationQuery } from "@/lib/itu/courseInformation.mjs";
import { getCourseInformation } from "@/lib/itu/services/getCourseInformation";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? "";
  const query = code.length <= 40 ? courseInformationQuery(code) : null;
  if (!query) return NextResponse.json({ state: "missing", url: null }, { status: 400 });
  try {
    const state = await getCourseInformation(code);
    return NextResponse.json({ state, url: state === "available" ? query.url : null });
  } catch {
    return NextResponse.json({ state: "unknown", url: null }, { status: 502 });
  }
}
