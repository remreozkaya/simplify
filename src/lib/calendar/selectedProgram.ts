/** URL selection wins; stale/deleted IDs fall back without changing saved plans. */
export function resolveSelectedWeeklyProgram(programs: readonly { id: string }[], requested: string | null, stored: string | null): string {
  let saved: unknown = null;
  try { saved = stored ? JSON.parse(stored) : null; } catch { /* Ignore invalid selection only. */ }
  return programs.find(program => program.id === requested)?.id
    ?? programs.find(program => program.id === saved)?.id
    ?? programs[0]?.id ?? '';
}
