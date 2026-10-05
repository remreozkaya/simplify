"use client";

import { createElement } from "react";
import { useLanguage } from "@/lib/i18n/client";
import { programRestrictionLabel, type evaluateProgramEligibility } from "@/lib/program-restrictions/eligibility";

type Eligibility = ReturnType<typeof evaluateProgramEligibility>;

export default function ProgramRestrictionWarning({ eligibility }: { eligibility: Eligibility }) {
  const { language, t } = useLanguage();
  if (eligibility.status !== "ineligible") return null;

  const labels = eligibility.allowedCodes.map((code) => programRestrictionLabel(code, language));
  const prefix = t("courses.programRestrictionWarning");
  const className = "col-span-full rounded-lg bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900";

  // Native disclosure keeps a long list available to keyboard and screen-reader users.
  if (labels.length > 4) {
    return createElement("details", { className },
      createElement("summary", { className: "cursor-pointer" }, `${prefix} ${t("courses.allowedProgramCount", { count: labels.length })}`),
      createElement("p", { className: "mt-2" }, labels.join(", ")),
    );
  }
  return createElement("p", { className }, `${prefix} ${labels.join(", ")}`);
}
