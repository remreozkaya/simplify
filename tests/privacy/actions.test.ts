import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), signIn: vi.fn(), deleteUser: vi.fn(), signOut: vi.fn(), cookies: vi.fn(), admin: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser, signInWithPassword: mocks.signIn, signOut: mocks.signOut } }) }));
vi.mock('@/lib/legal/admin', () => ({ createDeletionClient: mocks.admin }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [{ name: 'sb-test-auth-token' }, { name: 'simplify-remember' }], delete: mocks.cookies }) }));
import { exportAccountAction, deleteAccountAction } from '@/app/privacy/actions';
const user = { id: 'session-owner', email: 'test@example.invalid', email_confirmed_at: '2026-01-01', created_at: '2026-01-01', user_metadata: { profile: { version: 2, name: 'Test', surname: 'Student', birthdate: '', nickname: '', programEnrollments: [], profileUpdatedAt: null }, secret: 'do not export' }, app_metadata: { provider: 'email' } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockReturnValue({ auth: { admin: { deleteUser: mocks.deleteUser } } });
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.signIn.mockResolvedValue({ data: { user }, error: null });
  mocks.deleteUser.mockResolvedValue({ error: null });
});
describe('authenticated privacy actions', () => {
  it('rejects anonymous export and deletion before touching admin API', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await exportAccountAction()).status).toBe('unauthorized');
    expect((await deleteAccountAction({ password: 'test-password', confirm: true })).status).toBe('unauthorized');
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it('rejects unverified accounts', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { ...user, email_confirmed_at: null } }, error: null });
    expect((await exportAccountAction()).status).toBe('unauthorized');
  });
  it('exports an explicit account allowlist without credentials or raw metadata', async () => {
    const result = await exportAccountAction();
    expect(result.status).toBe('success');
    expect(JSON.stringify(result)).not.toContain('do not export');
    expect(result.account?.id).toBe('session-owner');
    expect(result.account?.profile?.name).toBe('Test');
    expect(result.account?.profile?.surname).toBe('Student');
  });
  it('requires confirmation and rejects malformed input', async () => {
    expect((await deleteAccountAction({ password: '', confirm: false })).status).toBe('invalid');
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it('requires the current password and matching verified identity', async () => {
    mocks.signIn.mockResolvedValue({ data: { user: null }, error: new Error('sensitive detail') });
    expect((await deleteAccountAction({ password: 'wrong-password', confirm: true })).status).toBe('verification');
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it('rejects a different reauthenticated identity', async () => {
    mocks.signIn.mockResolvedValue({ data: { user: { ...user, id: 'different' } }, error: null });
    expect((await deleteAccountAction({ password: 'test-password', confirm: true })).status).toBe('verification');
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
  it('deletes only the session owner, ignores supplied target IDs and clears cookies', async () => {
    const result = await deleteAccountAction({ password: 'test-password', confirm: true, userId: 'victim' });
    expect(result.status).toBe('success');
    expect(mocks.deleteUser).toHaveBeenCalledWith('session-owner', false);
    expect(mocks.cookies).toHaveBeenCalledWith('sb-test-auth-token');
  });
  it('reports actual provider failure without claiming deletion or exposing details', async () => {
    mocks.deleteUser.mockResolvedValue({ error: new Error('token secret') });
    const result = await deleteAccountAction({ password: 'test-password', confirm: true });
    expect(result).toEqual({ status: 'error' });
    expect(mocks.cookies).not.toHaveBeenCalled();
  });
});

it('preserves saved legacy profile values without UI migration or extra fields', async () => {
  const legacy = { version: 1, name: 'Legacy', surname: 'Student', birthdate: '', nickname: '', profileUpdatedAt: null, programEnrollments: [{ id: 'minor', type: 'minor', programCode: 'TEST_YD', programName: 'Test minor', curriculumPlanId: 321, curriculumPlanName: 'Saved plan', secret: 'exclude-this' }] };
  mocks.getUser.mockResolvedValue({ data: { user: { ...user, user_metadata: { profile: legacy } } }, error: null });
  const result = await exportAccountAction();
  expect(result.account?.profile).toMatchObject({ version: 1, programEnrollments: [{ curriculumPlanId: 321, curriculumPlanName: 'Saved plan' }] });
  expect(JSON.stringify(result)).not.toContain('exclude-this');
});

it('reports unavailable deletion without pretending to delete an account', async () => {
  mocks.admin.mockReturnValue(null);
  expect(await deleteAccountAction({ password: 'test-password', confirm: true })).toEqual({ status: 'unavailable' });
  expect(mocks.signIn).not.toHaveBeenCalled();
  expect(mocks.deleteUser).not.toHaveBeenCalled();
});
