import registry from "@/data/itu/academic-translations.json";
import catalog from "@/data/itu/curriculum-catalog.json";
import { describe, expect, it } from "vitest";
import { localizedAcademicName, localizedCourseTitle, localizedElectiveTitle } from "@/lib/i18n";

describe("official academic labels", () => {
  it("localizes existing Turkish-only profile names without resaving", () => {
    expect(localizedAcademicName({ name: "Bilgisayar Mühendisliği (İngilizce) Lisans" }, "en")).toBe("Computer Engineering (English) Undergraduate");
    expect(localizedAcademicName({ name: "Bilgisayar ve Bilişim Fakültesi" }, "en")).toBe("Faculty of Computer and Informatics Engineering");
  });
  it("uses the official translation of the screenshot's curriculum period", () => {
    expect(localizedAcademicName({ name: "Bilgisayar Mühendisliği Lisans Programı (%100 İngilizce) 2021-2022 / Güz ile 2024-2025 / Güz Dönemleri Arası" }, "en")).toBe("Computer Engineering Undergraduate Program (100% English) Between 2021-2022 / Fall and 2024-2025 / Fall Semesters");
  });
  it("covers every stored faculty and curriculum plan with official English labels", () => {
    const labels: Record<string, string> = registry.labels;
    for (const faculty of catalog.faculties) expect(labels[faculty.name], faculty.name).toBeTruthy();
    for (const plan of catalog.plans) expect(labels[plan.title], plan.title).toBeTruthy();
    expect(registry.failures).toEqual([]);
  });
  it("translates elective placeholders in both directions", () => {
    expect(localizedElectiveTitle({ title: "4.yy Seçime Bağlı Ders (ITB)" }, "en")).toBe("4th Semester Elective Course (ITB)");
    expect(localizedElectiveTitle({ title: "4th Semester Elective Course (ITB)" }, "tr")).toBe("4. Dönem Seçmeli Ders (ITB)");
  });
  it("retains course source titles in either interface language", () => {
    for (const language of ["en", "tr"] as const) {
      expect(localizedCourseTitle({ code: "MAT103", title: "Matematik I", nameEn: "Mathematics I" }, language)).toBe("Matematik I");
      expect(localizedCourseTitle({ code: "MAT103E", title: "Mathematics I", nameTr: "Matematik I" }, language)).toBe("Mathematics I");
    }
  });
});
