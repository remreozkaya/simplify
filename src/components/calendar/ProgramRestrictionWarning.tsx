"use client";

import { createElement, useState } from "react";
import { useLanguage } from "@/lib/i18n/client";
import { programRestrictionLabel, type evaluateProgramEligibility } from "@/lib/program-restrictions/eligibility";

type Eligibility = ReturnType<typeof evaluateProgramEligibility>;

export default function ProgramRestrictionWarning({ eligibility }: { eligibility: Eligibility }) {
  const { language, t } = useLanguage();
  const [dismissed, setDismissed] = useState(false);
  if (eligibility.status !== "ineligible" || dismissed) return null;

  const labels = eligibility.allowedCodes.map((code) => programRestrictionLabel(code, language));
  const prefix = t("courses.programRestrictionWarning");
  const className = "col-start-2 col-end-[-2] row-start-2 flex w-fit max-w-full items-start gap-2 rounded-md bg-amber-50 px-2 py-1 text-xs leading-5 text-amber-900";

  // Native disclosure keeps a long list available to keyboard and screen-reader users.
  const content = labels.length > 4
    ? createElement("details", { className: "min-w-0" },
      createElement("summary", { className: "cursor-pointer" }, `${prefix} ${t("courses.allowedProgramCount", { count: labels.length })}`),
      createElement("p", { className: "mt-1" }, labels.join(", ")),
    )
    : createElement("p", { className: "min-w-0" }, `${prefix} ${labels.join(", ")}`);

  return createElement("div", { className }, content,
    createElement("button", {
      type: "button",
      "aria-label": t("courses.dismissProgramRestrictionWarning"),
      onClick: () => setDismissed(true),
      className: "flex h-5 w-5 shrink-0 items-center justify-center rounded text-amber-700 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
    }, createElement("svg", { viewBox: "0 0 20 20", "aria-hidden": true, className: "h-3.5 w-3.5" },
      createElement("path", { d: "M5 5l10 10M15 5L5 15", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" }),
    )),
  );
}
