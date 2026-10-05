/** Canonicalize explicit source labels; retain unrecognized languages without guessing. */
export function normalizeCourseLanguage(value: string | undefined): string | undefined {
  const label = value?.replace(/\s+/g, " ").trim();
  if (!label) return undefined;
  const key = label.normalize("NFD").replace(/\p{M}/gu, "").replace(/ı/g, "i").toLowerCase();
  if (["en", "english", "ingilizce"].includes(key)) return "EN";
  if (["tr", "turkish", "turkce"].includes(key)) return "TR";
  return label;
}
