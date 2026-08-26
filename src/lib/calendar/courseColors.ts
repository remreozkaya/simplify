export const COURSE_COLOR_STYLES = [
  {
    block: "border-sky-300 bg-sky-100/90 hover:bg-sky-100",
    heading: "text-sky-950",
    body: "text-sky-800",
  },
  {
    block: "border-emerald-300 bg-emerald-100/90 hover:bg-emerald-100",
    heading: "text-emerald-950",
    body: "text-emerald-800",
  },
  {
    block: "border-amber-300 bg-amber-100/90 hover:bg-amber-100",
    heading: "text-amber-950",
    body: "text-amber-800",
  },
  {
    block: "border-violet-300 bg-violet-100/90 hover:bg-violet-100",
    heading: "text-violet-950",
    body: "text-violet-800",
  },
  {
    block: "border-rose-300 bg-rose-100/90 hover:bg-rose-100",
    heading: "text-rose-950",
    body: "text-rose-800",
  },
  {
    block: "border-cyan-300 bg-cyan-100/90 hover:bg-cyan-100",
    heading: "text-cyan-950",
    body: "text-cyan-800",
  },
  {
    block: "border-orange-300 bg-orange-100/90 hover:bg-orange-100",
    heading: "text-orange-950",
    body: "text-orange-800",
  },
  {
    block: "border-indigo-300 bg-indigo-100/90 hover:bg-indigo-100",
    heading: "text-indigo-950",
    body: "text-indigo-800",
  },
] as const;

function stableHash(value: string): number {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

export function getCourseColorStyle(
  selectionId: string,
  orderedSelectionIds: string[],
) {
  const selectionIndex = orderedSelectionIds.indexOf(selectionId);
  const colorIndex =
    selectionIndex >= 0 ? selectionIndex : stableHash(selectionId);

  return COURSE_COLOR_STYLES[colorIndex % COURSE_COLOR_STYLES.length];
}
