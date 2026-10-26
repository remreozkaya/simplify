import { describe, expect, it } from 'vitest';
import { validateRecord, MAX_DOCUMENT_BYTES } from '@/lib/academic/records';
import { ACADEMIC_KEYS } from '@/lib/academic/keys';

describe('academic document validation', () => {
  it('accepts existing versioned formats and durable reset tombstones', () => {
    const samples: Record<string, unknown> = {
      'simplify-weekly-programs': [{ id: 'p1', name: 'Plan', courseBlocks: [], courseSelections: [], updatedAt: '2026-10-26T00:00:00.000Z' }],
      'simplify-selected-weekly-program': 'p1',
      'simplify-schedule-generator-session': { version: 2, courses: [], earliestStartTime: '', latestEndTime: '', excludedDays: [] },
      'simplify-transcript-v1': { version: 1, courses: [], history: [], updatedAt: '2026-10-26T00:00:00.000Z' },
      'simplify-current-semester-v1': { version: 1, courses: [] },
      'simplify-curriculum-progress-v1': { version: 3, plans: {} },
      'simplify-saved-curriculum-v1': { version: 1, programCode: 'TEST', planId: 12, savedAt: '2026-10-26T00:00:00.000Z' },
    };
    expect(Object.keys(samples)).toEqual([...ACADEMIC_KEYS]);
    for (const [key, payload] of Object.entries(samples)) {
      expect(validateRecord(key, payload)).toBe(true);
      expect(validateRecord(key, null)).toBe(true);
    }
  });
  it('rejects unknown keys, malformed grades, incomplete plans and oversized UTF-8 payloads', () => {
    expect(validateRecord('simplify-theme', 'dark')).toBe(false);
    expect(validateRecord('simplify-weekly-programs', [{ id: 'x', name: 'bad', courseBlocks: [{ id: 'bad' }], courseSelections: [] }])).toBe(false);
    expect(validateRecord('simplify-current-semester-v1', { version: 1, courses: [{ courseCode: 'A', courseName: 'A', credit: 3, grade: 'FAKE' }] })).toBe(false);
    expect(validateRecord('simplify-selected-weekly-program', 'ş'.repeat(MAX_DOCUMENT_BYTES))).toBe(false);
  });
});

it('restores a selected weekly plan with URL precedence and safe fallback after deletion', async () => {
  const { resolveSelectedWeeklyProgram } = await import('@/lib/calendar/selectedProgram');
  const plans = [{ id: 'first' }, { id: 'second' }];
  expect(resolveSelectedWeeklyProgram(plans, null, '"second"')).toBe('second');
  expect(resolveSelectedWeeklyProgram(plans, 'first', '"second"')).toBe('first');
  expect(resolveSelectedWeeklyProgram(plans, 'deleted', '"deleted"')).toBe('first');
  expect(resolveSelectedWeeklyProgram([], null, null)).toBe('');
});
