import type { Language } from "@/lib/i18n/translations";

/** UI placeholders, never coded course records. OBS leaves many of these bilingual labels untranslated. */
export function electivePlaceholderLabel(source: string, language: Language) {
  const semester = source.match(/^(\d+)\s*(?:\.\s*(?:yy|yarıyıl|dönem)|(?:st|nd|rd|th)\s*(?:Semester|Sem\.?))\s*/iu);
  const remainder = semester ? source.slice(semester[0].length) : source;
  const match = remainder.match(/^(?:(Sınırlı|Restricted|Limited|Rest\.)\s*|(Serbest|Free)\s*|(Teknik|Technical)\s*)?(?:Seçime\s*Bağlı(?:\s*Ders)?|Seçimli\s*Ders|Seçmeli(?:\s*Ders)?|Seçimlik(?:\s*Ders)?|Elective\s*(?:Course|Crse|Crs)?|Elect\.\s*(?:Course|Crse|Crs)?)(?:\s*[-.]?\s*([IVX]+))?\s*(?:\(([^)]+)\)|-\s*([A-Z]+))?\s*$/iu);
  if (!match) return source;
  const kind = match[1] ? "restricted" : match[2] ? "free" : match[3] ? "technical" : "elective";
  const labels = {
    tr: { restricted: "Sınırlı Seçmeli Ders", free: "Serbest Seçmeli Ders", technical: "Teknik Seçmeli Ders", elective: "Seçmeli Ders" },
    en: { restricted: "Restricted Elective Course", free: "Free Elective Course", technical: "Technical Elective Course", elective: "Elective Course" },
  };
  const n = Number(semester?.[1]);
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  const prefix = semester ? language === "tr" ? `${n}. Dönem ` : `${n}${suffix} Semester ` : "";
  const category = match[5] ?? match[6];
  return `${prefix}${labels[language][kind]}${match[4] ? ` ${match[4]}` : ""}${category ? ` (${category})` : ""}`;
}
