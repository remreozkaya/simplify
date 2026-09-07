import { describe, expect, it } from "vitest";
import { localizeRuntimeMessage, translate } from "@/lib/i18n";
import { signupSchema } from "@/lib/auth/validation";
import { parseProfileInput } from "@/lib/profile/validation";
import { parseTranscriptMarkdown } from "@/lib/curriculum/transcript";

describe("runtime message localization", () => {
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
});
