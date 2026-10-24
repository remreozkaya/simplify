import { normalizeCourseCode } from "./courseCode.mjs";

/** @param {string} code */
export function courseInformationQuery(code) {
  const match = normalizeCourseCode(code).match(/^([A-ZÇĞİÖŞÜ]{2,8}) (\d{2,5})([A-Z]{0,3})$/u);
  if (!match) return null;
  const [, branch, digits, suffix] = match;
  const number = digits + (suffix === "E" ? "" : suffix === "EL" ? "L" : suffix);
  return { branch, number, key: `${branch} ${number}`,
    url: `https://obs.itu.edu.tr/public/DersBilgi?${new URLSearchParams({ bransKodu: branch, dersNo: number })}` };
}
