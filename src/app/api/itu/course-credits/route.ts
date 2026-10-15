import { NextResponse, type NextRequest } from "next/server";
import { buildLocalCreditIndex } from "@/lib/itu/curriculum/localCredits";
import { readStoredCurriculumCatalog } from "@/lib/itu/curriculum/catalogStore";
import { courseLanguageVariants, isValidCourseCode, normalizeCourseCode } from "@/lib/itu/courseCode.mjs";

export async function GET(request: NextRequest) {
  const codes = request.nextUrl.searchParams.getAll("code");
  if (!codes.length || codes.length > 500 || codes.some(code => code.length > 30 || !isValidCourseCode(code))) {
    return NextResponse.json({ error: "Valid course codes are required." }, { status: 400 });
  }
  const catalog = await readStoredCurriculumCatalog();
  if (!catalog) return NextResponse.json({ error: "The course credit database is unavailable." }, { status: 503 });
  const index = buildLocalCreditIndex(catalog);
  const credits = Object.fromEntries([...new Set(codes.map(normalizeCourseCode))].map(code => {
    // Use language counterparts only when the exact course has no stored record.
    const matched = courseLanguageVariants(code).find(variant => index.has(variant));
    return [code, matched ? index.get(matched) ?? null : null];
  }));
  return NextResponse.json({ credits });
}
