import { describe, expect, it } from 'vitest';
import operator from '@/lib/legal/operator.json';
import { legalLaunchBlockers } from '@/lib/legal/readiness.mjs';
import { legalCopy, legalSections } from '@/lib/legal/copy';
import { LEGAL_DOCUMENTS } from '@/lib/legal/config';

function configured() {
  const config = JSON.parse(JSON.stringify(operator));
  config.controllerName = 'Test Controller';
  config.postalAddress = 'Test postal address';
  config.privacyEmail = 'privacy@test.invalid';
  config.effectiveDate = '2026-10-03';
  for (const provider of ['hosting', 'authentication', 'email']) config[provider] = { name: 'Test provider', locations: 'Test location' };
  for (const record of ['account', 'logs', 'requests', 'backups']) config.retention[record] = { tr: 'Doğrulanmış politika', en: 'Confirmed policy' };
  config.transferDisclosure = { tr: 'Doğrulanmış mekanizma', en: 'Confirmed mechanism' };
  for (const review of Object.keys(config.reviews)) config.reviews[review] = true;
  return config;
}
const env = { SUPABASE_SECRET_KEY: 'test-only', NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-only', NEXT_PUBLIC_SITE_URL: 'https://test.invalid' };
describe('legal launch guard and translations', () => {
  it('fails closed for unresolved owner facts and credentials', () => {
    const blockers = legalLaunchBlockers(operator, {});
    expect(blockers).toContain('operator.controllerName');
    expect(blockers).toContain('operator.privacyEmail');
    expect(blockers).toContain('operator.reviews.internationalTransfers');
    expect(blockers).toContain('server.SUPABASE_SECRET_KEY (account deletion)');
  });
  it('requires English and Turkish retention and transfer information', () => {
    const config = configured();
    config.retention.logs.en = null;
    config.transferDisclosure.tr = null;
    expect(legalLaunchBlockers(config, env)).toEqual(['operator.retention.logs.en', 'operator.transferDisclosure.tr']);
  });
  it('accepts complete facts but rejects public admin credentials and placeholder contact', () => {
    expect(legalLaunchBlockers(configured(), env)).toEqual([]);
    expect(legalLaunchBlockers(configured(), { ...env, NEXT_PUBLIC_SUPABASE_SECRET_KEY: 'do-not-print' })).toContain('public admin credential is forbidden');
    const config = configured(); config.privacyEmail = 'privacy@example.com';
    expect(legalLaunchBlockers(config, env)).toContain('operator.privacyEmail');
  });
  it('provides equivalent sections and controls in both languages', () => {
    function keys(value: unknown, prefix = ''): string[] {
      if (!value || typeof value !== 'object') return [prefix];
      return Object.entries(value).flatMap(([key, item]) => keys(item, `${prefix}.${key}`));
    }
    expect(keys(legalCopy.tr)).toEqual(keys(legalCopy.en));
    for (const document of LEGAL_DOCUMENTS) {
      const tr = legalSections(document, 'tr'); const en = legalSections(document, 'en');
      expect(tr.map(section => section.paragraphs.length)).toEqual(en.map(section => section.paragraphs.length));
      expect(tr.every(section => section.title && section.paragraphs.every(Boolean))).toBe(true);
      expect(en.every(section => section.title && section.paragraphs.every(Boolean))).toBe(true);
    }
  });
});
