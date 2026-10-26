import { describe, expect, it } from "vitest";

import { isPrimaryProgramEligible, parseFaculties, parseFacultyPrograms } from "@/lib/itu/curriculum/catalog";
import { mergeImportedRecords } from "@/lib/itu/curriculum/importState";

describe("official curriculum catalog", () => {
  it("imports every faculty option and associates typed programs with stable IDs", () => {
    const faculties = parseFaculties(`<select id="akademikBirimId"><option value="">Seçiniz</option><option value="10">İşletme Fakültesi</option><option value="28">Bilgisayar ve Bilişim Fakültesi</option></select>`);
    expect(faculties.map((item) => item.id)).toEqual(["28", "10"]);
    expect(parseFacultyPrograms([{ programKodu: "ECN_YD", programAdi: "Ekonomi (Yandal)" }], faculties[1], "yandal")[0]).toMatchObject({ facultyId: "10", planType: "yandal", code: "ECN_YD" });
  });

  it("enforces official associated-program restrictions without inventing missing restrictions", () => {
    expect(isPrimaryProgramEligible(["MAT_LS", "MATE_LS"], "MAT_LS")).toBe(true);
    expect(isPrimaryProgramEligible(["MAT_LS"], "END_LS")).toBe(false);
    expect(isPrimaryProgramEligible(undefined, "END_LS")).toBeUndefined();
    expect(isPrimaryProgramEligible([], "END_LS")).toBeUndefined();
  });

  it("is idempotent and keeps valid records when an incoming response is empty", () => {
    const stored = [{ id: 1, value: "valid", retrievedAt: "old" }];
    expect(mergeImportedRecords(stored, []).records).toEqual(stored);
    expect(mergeImportedRecords(stored, [{ ...stored[0], retrievedAt: "new" }])).toMatchObject({ imported: 0, updated: 0, skipped: 1 });
  });
});
