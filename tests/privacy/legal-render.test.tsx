import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ language: 'tr' as 'tr' | 'en' }));
vi.mock('@/lib/i18n/client', () => ({ useLanguage: () => ({ language: state.language, t: (key: string) => key }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/app/auth/actions', () => ({ signupAction: vi.fn() }));
vi.mock('@/app/privacy/actions', () => ({ exportAccountAction: vi.fn(), deleteAccountAction: vi.fn() }));
import SignupForm from '@/components/auth/SignupForm';
import LegalPage from '@/components/legal/LegalPage';
import { LEGAL_DOCUMENTS } from '@/lib/legal/config';
import { legalCopy } from '@/lib/legal/copy';
import { PLANNER_STORAGE_KEYS } from '@/lib/legal/browserStorage';

describe('bilingual public legal markup', () => {
  it.each(['tr', 'en'] as const)('renders substantive %s content, draft status, storage entries and working controls', language => {
    state.language = language;
    for (const document of LEGAL_DOCUMENTS) {
      const html = renderToStaticMarkup(createElement(LegalPage, { document, sourceDates: { catalog: '2026-09-02', equivalences: '2026-09-01' } }));
      expect(html).toContain(legalCopy[language].titles[document]);
      expect(html).toContain(legalCopy[language].draft);
      expect(html).toContain('href="#main-content"');
      expect(html).not.toMatch(/<iframe|<script[^>]*src=["']https?:/);
      if (document === 'storage') {
        for (const key of PLANNER_STORAGE_KEYS) expect(html).toContain(key);
        expect(html).toContain(legalCopy[language].controls.exportLocal);
        expect(html).toContain(legalCopy[language].controls.clear);
      }
      if (document === 'requests') {
        expect(html).toContain(legalCopy[language].contact.unavailable);
        expect(html).not.toContain('mailto:');
      }
    }
  });
});

it.each(['tr', 'en'] as const)('shows the %s signup notice separately from terms without blanket consent', language => {
  state.language = language;
  const html = renderToStaticMarkup(createElement(SignupForm));
  expect(html).toContain(legalCopy[language].notices.account);
  expect(html).toContain('href="/legal/privacy"');
  expect(html).toContain('href="/legal/terms"');
  expect(html).not.toContain('type="checkbox"');
});
