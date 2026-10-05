import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { translate } from '@/lib/i18n';
import { EMPTY_PROFILE } from '@/lib/profile/types';
import { planningTools } from '@/lib/navigation';
import { legalCopy } from '@/lib/legal/copy';
const state = vi.hoisted(() => ({ language: 'tr' as 'tr' | 'en' }));
vi.mock('@/lib/i18n/client', () => ({ useLanguage: () => ({ language: state.language, t: (key: string) => translate(state.language, key) }) }));
vi.mock('@/components/profile/ProfileProvider', () => ({ useProfile: () => ({ profile: EMPTY_PROFILE }) }));
import Home from '@/app/(app)/page';

it.each(['tr', 'en'] as const)('keeps all planning tools accessible on the redesigned %s home without the legal banner', language => {
  state.language = language;
  const html = renderToStaticMarkup(createElement(Home));
  for (const tool of planningTools) expect(html).toContain(`href="${tool.href}"`);
  expect(html).toContain(language === 'tr' ? 'Akademik hayatın.' : 'Your academic life.');
  expect(html).not.toContain(legalCopy[language].notices.planner);
  expect(html).not.toContain(translate(language, 'home.localWorkspace'));
  expect(html.match(/<h1\b/g)).toHaveLength(1);
});
