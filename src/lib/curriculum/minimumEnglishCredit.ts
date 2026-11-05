import type { ItuCurriculum } from "@/lib/itu/curriculum/types";

// Regular mixed-language undergraduate offerings. Keep this explicit: removing
// an E suffix would also misclassify fully English and international programs.
// Program identities: https://www.sis.itu.edu.tr/TR/obs-hakkinda/lisans-program-kodlari.php
// Credit rule: https://www.sis.itu.edu.tr/TR/mevzuat/lisans-yonetmelik.php, Article 31.
const MIXED_LANGUAGE_PROGRAMS = new Set([
  "FZT_LS", "FIZ_LS", "KIM_LS", "MTT_LS", "MAT_LS", "BIO_LS", "EUT_LS", "ICM_LS",
  "MIM_LS", "PEM_LS", "SBP_LS", "ELK_LS", "ELE_LS", "EHB_LS",
  "KOM_LS", "ROS_LS", "TEL_LS", "CEV_LS", "GEO_LS", "HTA_LS", "INS_LS",
  "IML_LS", "MAK_LS", "CHZ_LS", "JEF_LS", "JEO_LS", "MAD_LS",
  "PET_LS", "GID_LS", "KMM_LS", "MET_LS", "GEM_LS", "DEN_LS",
  "END_LS", "ISL_LS", "IBM_LS", "MTO_LS", "UCK_LS", "UZB_LS",
  "DUI_LS", "GMI_LS", "TEK_LS", "BLG_LS",
]);

/** Change only the minimum target; earned-credit and elective policy stay separate. */
export function minimumEnglishCredit(
  curriculum: ItuCurriculum,
  requirementCredit: number | null,
  publishedEnglishCredit: number | null,
): number | null {
  if (curriculum.planType && curriculum.planType !== "undergraduate") return publishedEnglishCredit;

  const titles = `${curriculum.title} ${curriculum.planTitle}`;
  // Explicit fully English metadata takes precedence over a historical code.
  if (/(?:%\s*100|100\s*%)\s*(?:İngilizce|English)|\(\s*(?:İngilizce|English)\s*\)/iu.test(titles)) return publishedEnglishCredit;
  const explicitlyMixed = /(?:%\s*30|30\s*%)\s*(?:İngilizce|English)/iu.test(titles);
  if (!explicitlyMixed && !MIXED_LANGUAGE_PROGRAMS.has(curriculum.programCode)) return publishedEnglishCredit;

  const total = curriculum.totalCredit ?? requirementCredit;
  return total !== null && Number.isFinite(total) && total >= 0 ? Math.ceil(total * 0.3) : null;
}
