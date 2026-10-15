import registry from "@/data/itu/academic-translations.json";
import type { Language } from "@/lib/i18n/translations";

const englishLabels: Readonly<Record<string, string>> = registry.labels;
const turkishLabels = new Map(Object.entries(englishLabels).map(([tr, en]) => [en, tr]));
const clean = (value: string) => value.replace(/\s+/g, " ").trim();

/** Exact source pairs from the public İTÜ catalogue; unknown names stay unchanged. */
export function officialAcademicLabel(value: string, language: Language) {
  const key = clean(value);
  return language === "en" ? englishLabels[key] ?? value : turkishLabels.get(key) ?? value;
}
