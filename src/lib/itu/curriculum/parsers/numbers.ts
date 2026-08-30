export function parseNumericOptions(value: string): number[] {
  const normalized = value.replace(/\u00a0/g, " ").trim();
  if (!normalized || /^(?:-|--|—)$/.test(normalized)) return [];
  const values = normalized
    .split("/")
    .map((part) => Number(part.replace(/\s+/g, "").replace(",", ".")))
    .filter((number) => Number.isFinite(number));
  return [...new Set(values)];
}

export function firstNumericValue(value: string): number | undefined {
  return parseNumericOptions(value)[0];
}
