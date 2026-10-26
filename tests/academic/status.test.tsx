import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ status: 'saved', cacheFailed: false, language: 'en' }));
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>();
  return { ...actual, useState: (initial: unknown) => actual.useState(initial && typeof initial === 'object' && 'status' in initial
    ? { ...initial, ready: true, status: state.status, cacheFailed: state.cacheFailed } : initial) };
});
vi.mock('@/lib/i18n/client', () => ({ useLanguage: () => ({ language: state.language }) }));
import AcademicProvider from '@/components/academic/AcademicProvider';

it.each(['en', 'tr'])('keeps a successfully saved workspace free of routine status banners in %s', language => {
  state.language = language; state.status = 'saved'; state.cacheFailed = false;
  const html = renderToStaticMarkup(<AcademicProvider userId="fixture">Workspace</AcademicProvider>);
  expect(html).toContain('Workspace');
  expect(html).not.toContain('Saved to your account');
  expect(html).not.toContain('Hesabınıza kaydedildi');
  expect(html).not.toContain('<section');
});
it('retains actionable failures and recovery-storage warnings', () => {
  state.language = 'en'; state.status = 'error'; state.cacheFailed = false;
  const render = () => renderToStaticMarkup(<AcademicProvider userId="fixture">Workspace</AcademicProvider>);
  expect(render()).toContain('Account storage is unavailable');
  state.status = 'saved'; state.cacheFailed = true;
  expect(render()).toContain('Device recovery storage is unavailable');
  expect(render()).not.toContain('Saved to your account');
});
