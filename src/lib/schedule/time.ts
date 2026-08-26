const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function timeToMinutes(time: string): number {
  const normalized = time.trim();

  if (!TIME_PATTERN.test(normalized)) {
    throw new Error(`Invalid time value "${time}". Expected HH:MM.`);
  }

  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}
