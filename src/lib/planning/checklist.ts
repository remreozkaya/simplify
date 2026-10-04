import { parseStoredWeeklyPrograms } from '@/lib/calendar/persistence';
import { loadSharedTranscript } from '@/lib/curriculum/transcriptStore';
import { isProfileComplete, type UserProfile } from '@/lib/profile/types';
import { GENERATOR_SESSION_STORAGE_KEY, parseGeneratorSession, persistGeneratorSession, type PlanningMilestone } from '@/lib/schedule/session';

export type PlanningRecords = {
  transcript: string | null;
  legacyProgress: string | null;
  weeklyPrograms: string | null;
  generatorSession: string | null;
};

function parseJson(value: string | null): unknown {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
}

export function getPlanningCompletion(profile: UserProfile, records: PlanningRecords): boolean[] {
  const session = parseGeneratorSession(parseJson(records.generatorSession));
  return [
    isProfileComplete(profile),
    loadSharedTranscript(records.transcript, records.legacyProgress).courses.length > 0,
    Boolean(session?.completedPlanningSteps?.includes('semester') || (session?.source === 'semester-planner' && session.courses.length > 0)),
    Boolean(session?.completedPlanningSteps?.includes('generator')),
    parseStoredWeeklyPrograms(parseJson(records.weeklyPrograms)).some(program => program.courseBlocks.length > 0),
  ];
}

export function recordPlanningMilestone(step: PlanningMilestone, storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  try {
    const browser = storage ?? window.localStorage;
    const session = parseGeneratorSession(parseJson(browser.getItem(GENERATOR_SESSION_STORAGE_KEY))) ?? {
      version: 2 as const, courses: [], earliestStartTime: '', latestEndTime: '', excludedDays: [],
    };
    if (session.completedPlanningSteps?.includes(step)) return;
    persistGeneratorSession({ ...session, completedPlanningSteps: [...(session.completedPlanningSteps ?? []), step] }, browser);
  } catch {
    // A completed planning action remains usable when browser storage is unavailable.
  }
}
