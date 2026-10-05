import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn(), programs: vi.fn(), plans: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser, updateUser: mocks.updateUser } }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/itu/curriculum/services/getCurriculumCatalog', () => ({ getFacultyPrograms: mocks.programs }));
vi.mock('@/lib/itu/curriculum/services/getCurriculumPlans', () => ({ getCurriculumPlans: mocks.plans }));
import { saveProfileAction } from '@/app/(app)/profile/actions';
const enrollment = { id: 'main', type: 'main', facultyId: '10', facultyName: 'Faculty', educationLevel: 'undergraduate', planType: 'undergraduate', programCode: 'PROGRAM_A', programName: 'Program A', curriculumPlanId: 101, curriculumPlanName: '2025 plan' };
const input = { name: 'Test', surname: 'Student', birthdate: '', nickname: '', programEnrollments: [enrollment] };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.programs.mockResolvedValue([{ code: 'PROGRAM_A', name: 'Program A' }]);
  mocks.plans.mockResolvedValue([{ id: 101, title: '2025 plan' }]);
  mocks.updateUser.mockResolvedValue({ error: null });
});
it.each([null, { email_confirmed_at: null }])('rejects anonymous/unverified profile correction before upstream work', async user => {
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  expect((await saveProfileAction(input)).status).toBe('error');
  expect(mocks.updateUser).not.toHaveBeenCalled();
  expect(mocks.programs).not.toHaveBeenCalled();
});
it('corrects only the verified session user through the scoped auth client', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'current', email_confirmed_at: '2026-10-03' } }, error: null });
  expect((await saveProfileAction({ ...input, userId: 'victim' })).status).toBe('success');
  expect(mocks.updateUser).toHaveBeenCalledWith({ data: { profile: expect.objectContaining({ name: 'Test', surname: 'Student' }) } });
});
