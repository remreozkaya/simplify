import { getCourseById, getSectionById } from "@/lib/calendar/catalog";
import type { CourseSelection, FacultyOption } from "@/types/calendar";

export function getLocalCreditTotal(
  selections: CourseSelection[],
  catalog: FacultyOption[],
): number | null {
  const counted = new Set<string>();
  let total = 0;
  for (const selection of selections) {
    if (!selection.courseId) continue;
    const key = JSON.stringify([selection.facultyCode, selection.courseId]);
    if (counted.has(key)) continue;
    counted.add(key);
    const credit = getCourseById(catalog, selection.facultyCode, selection.courseId)?.localCredits;
    if (typeof credit !== "number" || !Number.isFinite(credit) || credit < 0) return null;
    total += credit;
  }
  return total;
}

export function createCrnBookmarklet(selections: CourseSelection[], catalog: FacultyOption[]): {
  url: string | null;
  crns: string[];
  error: "invalidCrn" | null;
} {
  const selected = selections.filter((selection) => selection.courseId || selection.sectionId);
  if (!selected.length) return { url: null, crns: [], error: null };
  const crns: string[] = [];
  for (const selection of selected) {
    const section = getSectionById(
      getCourseById(catalog, selection.facultyCode, selection.courseId),
      selection.sectionId,
    );
    if (!section || typeof section.crn !== "string" || !/^\d+$/.test(section.crn)) {
      return { url: null, crns: [], error: "invalidCrn" };
    }
    crns.push(section.crn);
  }
  // Only submit after filling inputs; on Simplify the first submit is Sign Out.
  const script = `(function(){var crns=${JSON.stringify(crns)};var inputs=document.querySelectorAll("input[type='number']");var index=0;function isVisible(element){for(var current=element;current;current=current.parentElement){var style=window.getComputedStyle(current);if(style.display==="none"||style.visibility==="hidden")return false;}return true;}inputs.forEach(function(input){if(isVisible(input)&&index<crns.length){input.value=crns[index];input.dispatchEvent(new Event("input",{bubbles:true}));index++;}});if(!index)return;setTimeout(function(){var submit=document.querySelector('button[type="submit"]:not([disabled])');if(submit)submit.click();setTimeout(function(){var footer=document.querySelector(".card-footer.d-flex.justify-content-end");if(footer){var buttons=footer.getElementsByTagName("button");if(buttons.length>1)buttons[1].click();}},50);},50);})();`;
  return { url: `javascript:${script}`, crns, error: null };
}
