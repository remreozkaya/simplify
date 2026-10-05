import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const provider = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: provider.create }));
import { updateSession } from '@/lib/supabase/proxy';

describe('public legal pages bypass authentication providers', () => {
  it.each(['privacy', 'storage', 'terms', 'requests'])('allows %s with absent or existing session cookies without provider calls', async document => {
    for (const cookie of ['', 'sb-test-auth-token=invalid-test-cookie']) {
      const request = new NextRequest(`https://test.invalid/legal/${document}`, { headers: { cookie } });
      const response = await updateSession(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
      expect(response.headers.get('set-cookie')).toBeNull();
    }
    expect(provider.create).not.toHaveBeenCalled();
  });
});
