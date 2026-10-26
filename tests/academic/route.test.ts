import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), read: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: mocks.getUser },
  from: () => ({ select: () => ({ eq: mocks.read }) }), rpc: mocks.rpc,
}) }));
import { GET, PUT } from '@/app/api/academic-records/route';
const owner = '11111111-1111-4111-8111-111111111111';
function request(method = 'GET', input?: unknown, expected = owner) {
  return new Request('https://simplify.test/api/academic-records', { method,
    headers: { 'x-simplify-account': expected, 'content-type': 'application/json', origin: 'https://simplify.test' },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: owner, email_confirmed_at: '2026-10-26' } }, error: null });
  mocks.read.mockResolvedValue({ data: [], error: null });
  mocks.rpc.mockResolvedValue({ data: [{ record_key: 'simplify-weekly-programs', payload: [], revision: 1 }], error: null });
});
describe('verified academic storage boundary', () => {
  it('rejects anonymous/unverified sessions and switched-cookie account assertions', async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    expect((await GET(request())).status).toBe(401);
    mocks.getUser.mockResolvedValueOnce({ data: { user: { id: owner } }, error: null });
    expect((await GET(request())).status).toBe(401);
    expect((await PUT(request('PUT', { key: 'simplify-weekly-programs', payload: [], revision: 0 }, 'other-account'))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('reads only the verified owner and returns explicit private cache headers', async () => {
    const response = await GET(request());
    expect(await response.json()).toEqual({ userId: owner, records: [] });
    expect(mocks.read).toHaveBeenCalledWith('user_id', owner);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
  it('ignores a supplied ownership target and writes through revision comparison', async () => {
    const response = await PUT(request('PUT', { key: 'simplify-weekly-programs', payload: [], revision: 0, user_id: 'victim' }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('save_academic_record', { p_key: 'simplify-weekly-programs', p_payload: [], p_revision: 0 });
  });
  it('returns conflict rather than overwriting stale records', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect((await PUT(request('PUT', { key: 'simplify-weekly-programs', payload: [], revision: 2 }))).status).toBe(409);
  });
  it('rejects invalid documents, oversized bodies and cross-origin writes', async () => {
    expect((await PUT(request('PUT', { key: 'simplify-theme', payload: 'dark', revision: 0 }))).status).toBe(400);
    const foreign = request('PUT', {});
    foreign.headers.set('origin', 'https://foreign.test');
    expect((await PUT(foreign)).status).toBe(403);
    const huge = request('PUT', { payload: 'x'.repeat(1100000) });
    expect((await PUT(huge)).status).toBe(413);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('reports missing database setup without a successful empty result', async () => {
    mocks.read.mockResolvedValue({ data: null, error: { code: '42P01', message: 'secret detail' } });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('secret detail');
  });
});
