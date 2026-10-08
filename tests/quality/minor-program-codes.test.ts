import { expect, it } from "vitest";
import catalog from "@/data/itu/curriculum-catalog.json";
import { curriculumProgramCodeSchema } from "@/lib/itu/curriculum/schemas";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/itu/curriculum/plans/route";

it("accepts the exact minor identities supplied by the official curriculum catalog", () => {
  const minors = catalog.programs.filter(program => program.planType === "yandal");
  expect(minors.length).toBeGreaterThan(0);
  const rejected = minors.filter(program=>!curriculumProgramCodeSchema.safeParse(program.code).success).map(program=>program.code);
  // The selector and the plans/detail APIs must agree on program identity.
  expect(rejected).toEqual([]);
});

it("keeps unknown minor identities and URL-like inputs invalid", () => {
  for (const code of ["UNKNOWN_YD","FIZ_YD_NOT_OFFICIAL","https://example.com","BLG_DR"]) {
    expect(curriculumProgramCodeSchema.safeParse(code).success).toBe(false);
  }
});

it.each([
  { code: "MAT_YD_TE", ids: [1699, 1828, 1829] },
  { code: "MAT_YD_UY", ids: [1700, 1831, 1832, 1922] },
])("loads exact official plan versions for suffix variant $code", async ({ code, ids }) => {
  const response = await GET(new NextRequest(`http://localhost/api/itu/curriculum/plans?programCode=${code}&planType=yandal`));
  expect(response.status).toBe(200);
  const { plans } = await response.json();
  expect(plans.map((plan: { id: number }) => plan.id)).toEqual(ids);
  expect(plans.every((plan: { programCode: string; planType: string }) => plan.programCode === code && plan.planType === "yandal")).toBe(true);
});

it("returns the catalogued Physics minor plans associated with the chosen primary program", async () => {
  const response = await GET(new NextRequest("http://localhost/api/itu/curriculum/plans?programCode=FIZ_YD&planType=yandal&primaryProgramCode=BLGE_LS"));
  expect(response.status).toBe(200);
  const {plans} = await response.json();
  expect(plans.map((plan:{id:number})=>plan.id)).toEqual([1646,1824,1920]);
  expect(plans.every((plan:{planType:string;programCode:string;associatedPrimaryProgramCodes:string[]})=>plan.planType==="yandal"&&plan.programCode==="FIZ_YD"&&plan.associatedPrimaryProgramCodes.includes("BLGE_LS"))).toBe(true);
});
