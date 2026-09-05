import { NextResponse } from "next/server";

import { getCurriculumFaculties } from "@/lib/itu/curriculum/services/getCurriculumCatalog";

export async function GET() {
  try {
    return NextResponse.json({ faculties: await getCurriculumFaculties() });
  } catch {
    return NextResponse.json({ error: { code: "OBS_UNAVAILABLE", message: "Faculties are temporarily unavailable from İTÜ OBS." } }, { status: 502 });
  }
}
