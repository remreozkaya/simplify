import { describe, it, expect } from "vitest";
import { parseProgramRestriction, resolveProgramMemberships, evaluateProgramEligibility } from "@/lib/program-restrictions/eligibility";
import type { ProgramEnrollment } from "@/lib/profile/types";
const enrollment = (code: string, type: ProgramEnrollment["type"] = "main") => ({ id: code, type, programCode: code, targetProgramCode: code, planType: type === "minor" ? "yandal" : type === "double-major" ? "cap" : "undergraduate" } as ProgramEnrollment);
const check = (raw: string | undefined, programs: ProgramEnrollment[]) => evaluateProgramEligibility(parseProgramRestriction(raw), resolveProgramMemberships(programs)).status;
describe("section program eligibility", () => {
  it("uses exact codes and preserves language variants", () => {
    expect(check("BLG_LS", [enrollment("BLG_LS")])).toBe("eligible");
    expect(check("BLGE_LS", [enrollment("BLG_LS")])).toBe("ineligible");
    expect(check("CEN_LS", [enrollment("BLGE_LS")])).toBe("ineligible");
    expect(check("XBLG_LS", [enrollment("BLG_LS")])).toBe("ineligible");
    expect(check("MAT_YD_TE", [enrollment("MAT_YD", "minor")])).toBe("ineligible");
  });
  it("matches any membership including second major and independently verified minor", () => {
    expect(check("SECE_LS", [enrollment("BLG_LS"), enrollment("SECE_LS", "double-major")])).toBe("eligible");
    expect(check("KHE_YD", [enrollment("BLG_LS"), enrollment("KHE_YD", "minor")])).toBe("eligible");
    expect(check("BLG_LS", [enrollment("KHE_YD", "minor")])).toBe("ineligible");
  });
  it("does not let absent optional programs disable a selected main", () => {
    expect(check("BLGE_LS", [enrollment("BLG_LS"), enrollment("", "minor")])).toBe("ineligible");
    expect(check("BLGE_LS", [])).toBe("unknown");
  });
  it("keeps unresolved memberships conservative but accepts a known match", () => {
    expect(check("SECE_LS", [enrollment("BLG_LS"), enrollment("UNKNOWN", "minor")])).toBe("unknown");
    expect(check("BLG_LS", [enrollment("BLG_LS"), enrollment("UNKNOWN", "minor")])).toBe("eligible");
    expect(check("MAT_LS", [enrollment("MAT_YD", "minor")])).toBe("ineligible");
    expect(check("MAT_LS", [enrollment("MKN", "minor")])).toBe("unknown");
  });
  it("preserves raw values and unknown well-formed codes with delimiters", () => {
    const raw = " BLG_LS, BLGE_LS; BLG_LS | NEW_LS / KHE_YD\nSECE_LS ";
    expect(parseProgramRestriction(raw)).toMatchObject({ raw, state: "allowlist", codes: ["BLG_LS", "BLGE_LS", "NEW_LS", "KHE_YD", "SECE_LS"] });
    expect(check("NEW_LS", [enrollment("BLG_LS")])).toBe("ineligible");
  });
  it("does not infer unrestricted from unavailable or malformed values", () => {
    for (const raw of [undefined, "", "-", "--", "ALL", "BLG_LS, nonsense", "BLG"]) expect(parseProgramRestriction(raw).state).toBe("unknown");
    expect(evaluateProgramEligibility({ state: "unrestricted", codes: [], raw: "verified upstream unrestricted" }, resolveProgramMemberships([enrollment("BLG_LS")])).status).toBe("eligible");
  });
  it("resolves only explicit verified legacy mappings without mutating profile classification", () => {
    const cap = enrollment("BLG", "double-major");
    expect(resolveProgramMemberships([cap])[0]).toMatchObject({type:"double-major", codes:["BLG_LS"],resolved:true});
    expect(cap.planType).toBe("cap");
    expect(resolveProgramMemberships([enrollment("SORM", "minor")])[0].resolved).toBe(false);
  });
});
