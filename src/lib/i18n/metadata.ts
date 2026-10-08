import type { Language } from "@/lib/i18n";

export const localizedMetadata = {
  tr: {
    title: "Simplify · İTÜ Öğrenci Planlayıcısı",
    description: "Herkese açık İTÜ OBS verileriyle ders programınızı planlayın ve lisans ders planlarını inceleyin.",
  },
  en: {
    title: "Simplify · ITU Student Planner",
    description: "Plan schedules and explore undergraduate curricula with public ITU OBS data.",
  },
} satisfies Record<Language, { title: string; description: string }>;

export function applyLocalizedMetadata(language: Language, target: Document) {
  const metadata = localizedMetadata[language];
  if (target.title !== metadata.title) target.title = metadata.title;
  const description = target.querySelector('meta[name="description"]');
  if (description && description.getAttribute("content") !== metadata.description) {
    description.setAttribute("content", metadata.description);
  }
}
