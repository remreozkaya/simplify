const COURSE_CODE_PATTERN = /^([A-ZÇĞİÖŞÜ]{2,8})(\d{2,5}[A-Z]{0,3})$/u;

/**
 * Canonical course-code representation used by curriculum, transcript, and
 * official-equivalence imports. Meaningful suffixes are deliberately retained.
 *
 * @param {string} value
 */
export function normalizeCourseCode(value) {
  const normalized = value.replace(/\s+/g, "").toUpperCase();
  const match = normalized.match(COURSE_CODE_PATTERN);
  return match ? `${match[1]} ${match[2]}` : value.replace(/\s+/g, " ").trim().toUpperCase();
}

/** @param {string} value */
export function isValidCourseCode(value) {
  return COURSE_CODE_PATTERN.test(value.replace(/\s+/g, "").toUpperCase());
}

/**
 * Return the normalized code followed by its Turkish/English counterpart.
 * `E` is the language marker; laboratory `L` remains meaningful, so `L`
 * pairs with `EL` rather than being removed.
 *
 * @param {string} value
 * @returns {string[]}
 */
export function courseLanguageVariants(value) {
  const normalized = normalizeCourseCode(value);
  const match = normalized.match(/^([A-ZÇĞİÖŞÜ]{2,8})\s(\d{2,5})([A-Z]{0,3})$/u);
  if (!match) return [normalized];
  const [, branch, number, suffix] = match;
  const counterpartSuffix = suffix === "" ? "E" : suffix === "E" ? "" : suffix === "L" ? "EL" : suffix === "EL" ? "L" : null;
  return counterpartSuffix === null
    ? [normalized]
    : [normalized, `${branch} ${number}${counterpartSuffix}`];
}

/** @param {string} first @param {string} second */
export function areCourseLanguageVariants(first, second) {
  const normalizedSecond = normalizeCourseCode(second);
  return courseLanguageVariants(first).slice(1).includes(normalizedSecond);
}

/** @param {string} value @returns {"EN" | "TR" | undefined} */
export function courseLanguageFromCode(value) {
  const normalized = normalizeCourseCode(value);
  const suffix = normalized.match(/\d{2,5}([A-Z]{0,3})$/)?.[1];
  if (suffix === "E" || suffix === "EL") return "EN";
  if (suffix === "" || suffix === "L") return "TR";
  return undefined;
}
