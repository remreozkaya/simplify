import { translations, type Language } from "@/lib/i18n/translations";
export type { Language } from "@/lib/i18n/translations";

export const LANGUAGE_STORAGE_KEY = "simplify-language";
export const DEFAULT_LANGUAGE: Language = "tr";

export function resolveLanguage(saved: unknown): Language {
  return validLanguage(saved) ? saved : DEFAULT_LANGUAGE;
}

export function applyLanguagePreference(
  language: Language,
  root: { lang: string },
  storage?: { setItem: (key: string, value: string) => void },
) {
  root.lang = language;
  try { storage?.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* The in-memory preference still applies. */ }
}

function valueAtPath(language: Language, key: string): string | undefined {
  let value: unknown = translations[language];
  for (const part of key.split(".")) {
    if (!value || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === "string" ? value : undefined;
}

export function translate(language: Language, key: string, parameters: Record<string, string | number> = {}) {
  const template = valueAtPath(language, key) ?? valueAtPath(DEFAULT_LANGUAGE, key);
  if (!template) {
    if (process.env.NODE_ENV !== "production") console.warn(`Missing translation: ${language}.${key}`);
    return key;
  }
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(parameters[name] ?? `{${name}}`));
}

export function localeFor(language: Language) {
  return language === "tr" ? "tr-TR" : "en";
}

export function formatNumber(language: Language, value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(localeFor(language), options).format(value);
}

export function formatDate(language: Language, value: string | number | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(localeFor(language), options).format(new Date(value));
}

const weekdayIndex: Record<string, number> = { Sunday: 4, Monday: 5, Tuesday: 6, Wednesday: 7, Thursday: 8, Friday: 9, Saturday: 10 };

export function localizedWeekday(language: Language, day: string, width: "long" | "short" = "long") {
  const date = new Date(Date.UTC(2026, 0, weekdayIndex[day] ?? 5));
  return new Intl.DateTimeFormat(localeFor(language), { weekday: width, timeZone: "UTC" }).format(date);
}

export function localizedCurriculumSection(language: Language, planType: "undergraduate" | "cap" | "yandal" | undefined, section: number) {
  if (!planType || planType === "undergraduate") return language === "tr" ? `${section}. Dönem` : `Semester ${section}`;
  if (section === 99) return translate(language, "curriculum.otherRequirements");
  return translate(language, "curriculum.group", { number: section });
}

type LocalizedName = { nameTr?: string; nameEn?: string; name?: string; title?: string; code?: string; officialProgramCode?: string };

export function localizedAcademicName(value: LocalizedName, language: Language) {
  return (language === "tr" ? value.nameTr : value.nameEn)
    ?? (language === "tr" ? value.nameEn : value.nameTr)
    ?? value.name
    ?? value.title
    ?? value.officialProgramCode
    ?? value.code
    ?? "";
}

export function offeringDisplayName(value: LocalizedName & { planType?: "undergraduate" | "cap" | "yandal" }, language: Language) {
  const name = localizedAcademicName(value, language)
    .replace(/\s+Lisans(?:\s+Programı)?$/iu, "")
    .replace(/\s*\(Yandal\)\s*$/iu, "");
  if (value.planType === "cap") return `${name} – ${translate(language, "academicPrograms.suffixDoubleMajor")}`;
  if (value.planType === "yandal") return `${name} – ${translate(language, "academicPrograms.suffixMinor")}`;
  return name;
}

export function validLanguage(value: unknown): value is Language {
  return value === "tr" || value === "en";
}

const turkishRuntimeMessages: Record<string, string> = {
  "Email is required.": "E-posta gereklidir.", "Enter a valid email address.": "Geçerli bir e-posta adresi girin.",
  "Password is required.": "Parola gereklidir.", "Passwords do not match.": "Parolalar eşleşmiyor.",
  "Current password is required.": "Geçerli parola gereklidir.", "Current password is incorrect.": "Geçerli parola yanlış.",
  "Use at least 8 characters.": "En az 8 karakter kullanın.", "Check the highlighted fields and try again.": "Vurgulanan alanları kontrol edip yeniden deneyin.",
  "Check the highlighted password fields.": "Vurgulanan parola alanlarını kontrol edin.", "Your email address has not been verified.": "E-posta adresiniz doğrulanmamış.",
  "This password reset link is invalid or has expired.": "Bu parola sıfırlama bağlantısı geçersiz veya süresi dolmuş.",
  "You can now log in with your new password.": "Artık yeni parolanızla giriş yapabilirsiniz.",
  "Your email is verified. You can now log in.": "E-postanız doğrulandı. Artık giriş yapabilirsiniz.",
  "Check your inbox and verify your email before signing in.": "Giriş yapmadan önce gelen kutunuzu kontrol edin ve e-postanızı doğrulayın.",
  "Your session has expired. Sign in again to save your profile.": "Oturumunuz sona erdi. Profilinizi kaydetmek için yeniden giriş yapın.",
  "Your profile could not be saved right now. Try again.": "Profiliniz şu anda kaydedilemedi. Yeniden deneyin.", "Profile saved.": "Profil kaydedildi.",
  "Password changed.": "Parola değiştirildi.", "The request failed.": "İstek başarısız oldu.",
  "Faculties could not be loaded.": "Fakülteler yüklenemedi.", "Programs could not be loaded.": "Programlar yüklenemedi.",
  "Curriculum plans could not be loaded.": "Ders planları yüklenemedi.", "Curriculum versions could not be loaded.": "Ders planı sürümleri yüklenemedi.",
  "Curriculum could not be loaded from İTÜ OBS.": "Müfredat İTÜ OBS'den yüklenemedi.", "Your academic programs could not be loaded.": "Akademik programlarınız yüklenemedi.",
  "Term must be numeric.": "Dönem sayısal olmalıdır.", "CRN must be numeric.": "CRN sayısal olmalıdır.", "Course code is required.": "Ders kodu gereklidir.",
  "Course name is required.": "Ders adı gereklidir.", "Course code is invalid.": "Ders kodu geçersiz.", "Credit must be a number or counted/transcript pair.": "Kredi bir sayı veya sayılan/transkript çifti olmalıdır.",
  "Course row appears outside a recognized section.": "Ders satırı tanınan bir bölümün dışında görünüyor.",
};

export function localizeRuntimeMessage(language: Language, message?: string) {
  if (!message || language === "en") return message;
  return turkishRuntimeMessages[message] ?? message;
}
