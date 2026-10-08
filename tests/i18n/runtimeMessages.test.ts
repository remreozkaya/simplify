import { describe, expect, it } from "vitest";
import { localizeRuntimeMessage, translate } from "@/lib/i18n";
import { signupSchema } from "@/lib/auth/validation";
import { parseProfileInput } from "@/lib/profile/validation";
import { parseTranscriptMarkdown } from "@/lib/curriculum/transcript";

describe("runtime message localization", () => {
  it("uses mevcut for the existing password rather than geçerli for validity", () => {
    expect(translate("tr", "profile.currentPassword")).toBe("Mevcut parola");
    expect(localizeRuntimeMessage("tr", "Current password is required.")).toBe("Mevcut parola gereklidir.");
    expect(localizeRuntimeMessage("tr", "Current password is incorrect.")).toBe("Mevcut parola yanlış.");
    expect(localizeRuntimeMessage("tr", "Your current password is incorrect.")).toBe("Mevcut parolanız yanlış.");
    expect(localizeRuntimeMessage("tr", "New password must be different from your current password.")).toBe("Yeni parola mevcut parolanızdan farklı olmalıdır.");
  });
  it("gives unknown upstream failures a localized fallback while retaining diagnostics", () => {
    const message = "Gateway refused upstream request (OBS-429, BLG 101).";
    expect(localizeRuntimeMessage("tr", message, { fallback: true })).toBe(
      "İşlem tamamlanamadı. Ayrıntılar: Gateway refused upstream request (OBS-429, BLG 101).",
    );
    expect(localizeRuntimeMessage("en", message, { fallback: true })).toBe(
      "The request could not be completed. Details: Gateway refused upstream request (OBS-429, BLG 101).",
    );
    expect(localizeRuntimeMessage("tr", "Course offerings could not be loaded.", { fallback: true })).toBe(
      "Ders açılışları yüklenemedi.",
    );
    expect(localizeRuntimeMessage("tr", undefined, { fallback: true })).toBeUndefined();
    expect(localizeRuntimeMessage("tr", "Ders açılışları yüklenemedi.", { fallback: true })).toBe("Ders açılışları yüklenemedi.");
    expect(localizeRuntimeMessage("tr", "BLG dersleri geçici olarak kullanılamıyor.", { fallback: true })).toBe("BLG dersleri geçici olarak kullanılamıyor.");
    // General messages keep their existing behavior; error callers opt in.
    expect(localizeRuntimeMessage("tr", message)).toBe(message);
  });

  it("translates form requirements without losing their limits", () => {
    const result = signupSchema.safeParse({
      email: "bad",
      password: "short",
      confirmPassword: "other",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      for (const issue of result.error.issues) {
        expect(localizeRuntimeMessage("tr", issue.message)).not.toBe(
          issue.message,
        );
      }
    expect(
      localizeRuntimeMessage(
        "tr",
        "Name must contain no more than 80 characters.",
      ),
    ).toBe("Ad en fazla 80 karakter olabilir.");
    const profile = parseProfileInput({
      name: "",
      surname: "",
      nickname: "",
      birthdate: "2999-01-01",
      programEnrollments: [],
    });
    if (!profile.success)
      for (const issue of profile.error.issues) {
        expect(localizeRuntimeMessage("tr", issue.message)).not.toBe(
          issue.message,
        );
      }
  });

  it("keeps current validation and success messages in the selected language", () => {
    const warning = translate("tr", "semesterPlanner.invalidCredits", {
      max: 60,
    });
    expect(localizeRuntimeMessage("en", warning)).toBe(
      translate("en", "semesterPlanner.invalidCredits", { max: 60 }),
    );
    expect(localizeRuntimeMessage("en", "Profil kaydedildi.")).toBe(
      "Profile saved.",
    );
    expect(
      localizeRuntimeMessage(
        "tr",
        "This verification link is invalid or has expired.",
      ),
    ).toBe("Doğrulama bağlantısı geçersiz veya süresi dolmuş.");
  });

  it("preserves course codes and minimum requirements in import warnings", () => {
    const message =
      "Official equivalence for BLG 101 requires all of: BLG 111 + BLG 112.";
    expect(localizeRuntimeMessage("tr", message)).toBe(
      "BLG 101 resmî denkliği için şu derslerin tümü gerekir: BLG 111 + BLG 112.",
    );
    expect(
      localizeRuntimeMessage("tr", "BLG courses are temporarily unavailable."),
    ).toBe("BLG dersleri geçici olarak kullanılamıyor.");
    const parsed = parseTranscriptMarkdown(
      "Completed English Courses\n202601\t12345\tBLG 101\tCourse\t3\tZZ",
    );
    expect(localizeRuntimeMessage("tr", parsed.invalidRows[0].reason)).toBe(
      "Bilinmeyen not: ZZ.",
    );
  });

  it.each([
    ["Unknown grade: ZZ.", "Bilinmeyen not: ZZ."],
    ["Older duplicate attempt for MAT 101E; the most recent term is used.", "MAT 101E için eski tekrar kaydı; en güncel dönem kullanılır."],
    ["Official equivalence for BLG 101 requires all of: BLG 111 + BLG 112.", "BLG 101 resmî denkliği için şu derslerin tümü gerekir: BLG 111 + BLG 112."],
    ["This course could satisfy 3 curriculum requirements through equivalence.", "Bu ders denklik yoluyla 3 gerekliliği karşılayabilir."],
    ["The MAT catalog response is invalid.", "MAT katalog yanıtı geçersiz."],
  ])("roundtrips interpolated runtime message %s", (en, tr) => {
    expect(localizeRuntimeMessage("tr", en)).toBe(tr);
    expect(localizeRuntimeMessage("en", tr)).toBe(en);
  });
});
