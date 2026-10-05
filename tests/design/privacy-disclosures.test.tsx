import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ language: 'tr' as 'tr' | 'en' }));
vi.mock('@/lib/i18n/client', () => ({ useLanguage: () => ({ language: state.language }) }));
import PageShell from '@/components/PageShell';
import { legalCopy } from '@/lib/legal/copy';

it.each(['tr', 'en'] as const)('does not insert a page-wide planner notice in %s', language => {
  state.language = language;
  const html = renderToStaticMarkup(<PageShell title="Planner">Tools</PageShell>);
  expect(html).not.toContain(legalCopy[language].notices.planner);
  expect(html).not.toContain('<aside');
  expect(html).toContain('Tools');
});
