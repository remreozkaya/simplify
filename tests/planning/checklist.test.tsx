import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getPlanningCompletion, recordPlanningMilestone } from '@/lib/planning/checklist';
import { persistGeneratorSession, GENERATOR_SESSION_STORAGE_KEY } from '@/lib/schedule/session';
import { PlanningChecklistView } from '@/components/planning/PlanningChecklist';
import { translate } from '@/lib/i18n';
import { EMPTY_PROFILE } from '@/lib/profile/types';
import { serializeSharedTranscript } from '@/lib/curriculum/transcriptStore';

function storage(initial: Record<string, string> = {}) {
  const records = new Map(Object.entries(initial));
  return { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { records.set(key, value); } };
}
const profile = { ...EMPTY_PROFILE, name: 'Ada', surname: 'Lovelace', programEnrollments: [{ type: 'main' }] } as typeof EMPTY_PROFILE;
const session = { version: 2 as const, courses: [], earliestStartTime: '', latestEndTime: '', excludedDays: [] };
const transcript = serializeSharedTranscript([{ term: '202510', crn: '12345', courseCode: 'MAT 101', courseName: 'Math', grade: 'AA', countedCredit: 3, transcriptCredit: 3, completionStatus: 'passed', source: 'transcript', calculated: true }]);
const weeklyPrograms = JSON.stringify([{ id: 'p', name: 'Week', courseBlocks: [{ id: 'b', code: 'MAT 101', title: 'Math', day: 'Monday', startTime: '09:00', endTime: '10:00' }] }]);

// Catch visits/drafts being mistaken for completed work, and lost completion on session rewrites.
describe('planning completion', () => {
  it('leaves empty drafts and malformed browser data unfinished', () => {
    expect(getPlanningCompletion(EMPTY_PROFILE, { transcript: '{}', legacyProgress: null, weeklyPrograms: '[{}]', generatorSession: JSON.stringify(session) })).toEqual([false, false, false, false, false]);
  });
  it('recognizes saved work and successful planning milestones after reloading', () => {
    const browser = storage();
    recordPlanningMilestone('semester', browser);
    recordPlanningMilestone('generator', browser);
    expect(getPlanningCompletion(profile, { transcript, legacyProgress: null, weeklyPrograms, generatorSession: browser.getItem(GENERATOR_SESSION_STORAGE_KEY) })).toEqual([true, true, true, true, true]);
  });
  it('preserves milestones when the generator session is replaced', () => {
    const browser = storage();
    recordPlanningMilestone('generator', browser);
    persistGeneratorSession(session, browser);
    expect(JSON.parse(browser.getItem(GENERATOR_SESSION_STORAGE_KEY)!)).toMatchObject({ completedPlanningSteps: ['generator'], courses: [] });
  });
  it('keeps completed semester planning from a legacy handoff when preferences change', () => {
    const browser = storage({ [GENERATOR_SESSION_STORAGE_KEY]: JSON.stringify({ ...session, source: 'semester-planner', courses: [{ id: 'c', branchCode: 'MAT', courseId: 'MAT 101', pinnedSectionId: '' }] }) });
    persistGeneratorSession(session, browser);
    expect(getPlanningCompletion(EMPTY_PROFILE, { transcript: null, legacyProgress: null, weeklyPrograms: null, generatorSession: browser.getItem(GENERATOR_SESSION_STORAGE_KEY) })).toEqual([false, false, true, false, false]);
  });
  it('does not let unavailable storage break successful planning', () => {
    const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(() => recordPlanningMilestone('semester', blocked)).not.toThrow();
  });
});

it.each(['en', 'tr'] as const)('shows accessible progress and completed task states in %s', language => {
  const html = renderToStaticMarkup(createElement(PlanningChecklistView, { completed: [true, false, false, true, false], t: (key: string, parameters?: Record<string, string | number>) => translate(language, key, parameters) }));
  expect(html).toContain('aria-valuenow="2"');
  expect(html).toContain('aria-valuemax="5"');
  expect(html).toContain('href="/graduation-calculator"');
  expect(html).toContain(language === 'en' ? '2 of 5 completed' : '5 adımdan 2 tanesi tamamlandı');
  expect(html).toContain(language === 'en' ? 'Completed' : 'Tamamlandı');
});
it('removes the entire section when all tasks are complete', () => {
  expect(renderToStaticMarkup(createElement(PlanningChecklistView, { completed: [true, true, true, true, true], t: (key: string) => translate('en', key) }))).toBe('');
});
