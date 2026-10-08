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
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* The in-memory preference still applies. */
  }
}

function valueAtPath(language: Language, key: string): string | undefined {
  let value: unknown = translations[language];
  for (const part of key.split(".")) {
    if (!value || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === "string" ? value : undefined;
}

export function translate(
  language: Language,
  key: string,
  parameters: Record<string, string | number> = {},
) {
  const template =
    valueAtPath(language, key) ?? valueAtPath(DEFAULT_LANGUAGE, key);
  if (!template) {
    if (process.env.NODE_ENV !== "production")
      console.warn(`Missing translation: ${language}.${key}`);
    return key;
  }
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(parameters[name] ?? `{${name}}`),
  );
}

export function localeFor(language: Language) {
  return language === "tr" ? "tr-TR" : "en";
}

export function formatNumber(
  language: Language,
  value: number,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(localeFor(language), options).format(value);
}

export function formatDate(
  language: Language,
  value: string | number | Date,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(localeFor(language), options).format(
    new Date(value),
  );
}

const weekdayIndex: Record<string, number> = {
  Sunday: 4,
  Monday: 5,
  Tuesday: 6,
  Wednesday: 7,
  Thursday: 8,
  Friday: 9,
  Saturday: 10,
};

export function localizedWeekday(
  language: Language,
  day: string,
  width: "long" | "short" = "long",
) {
  const date = new Date(Date.UTC(2026, 0, weekdayIndex[day] ?? 5));
  return new Intl.DateTimeFormat(localeFor(language), {
    weekday: width,
    timeZone: "UTC",
  }).format(date);
}

export function localizedCurriculumSection(
  language: Language,
  planType: "undergraduate" | "cap" | "yandal" | undefined,
  section: number,
) {
  if (!planType || planType === "undergraduate")
    return language === "tr" ? `${section}. Dönem` : `Semester ${section}`;
  if (section === 99)
    return translate(language, "curriculum.otherRequirements");
  return translate(language, "curriculum.group", { number: section });
}

type LocalizedName = {
  nameTr?: string;
  nameEn?: string;
  name?: string;
  title?: string;
  code?: string;
  officialProgramCode?: string;
};

export function localizedAcademicName(
  value: LocalizedName,
  language: Language,
) {
  return [
    language === "tr" ? value.nameTr : value.nameEn,
    language === "tr" ? value.nameEn : value.nameTr,
    value.name,
    value.title,
    value.officialProgramCode,
    value.code,
  ].find((name) => name?.trim()) ?? "";
}

export function offeringDisplayName(
  value: LocalizedName & { planType?: "undergraduate" | "cap" | "yandal" },
  language: Language,
) {
  const name = localizedAcademicName(value, language)
    .replace(/\s+Lisans(?:\s+Programı)?$/iu, "")
    .replace(/\s*\(Yandal\)\s*$/iu, "");
  if (value.planType === "cap")
    return `${name} – ${translate(language, "academicPrograms.suffixDoubleMajor")}`;
  if (value.planType === "yandal")
    return `${name} – ${translate(language, "academicPrograms.suffixMinor")}`;
  return name;
}

export function validLanguage(value: unknown): value is Language {
  return value === "tr" || value === "en";
}

export { localizeRuntimeMessage } from "@/lib/i18n/runtimeMessages";
