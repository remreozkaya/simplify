import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { MAX_DOCUMENT_BYTES, validateRecord } from '@/lib/academic/records';
import { ACADEMIC_KEYS } from '@/lib/academic/keys';

const writeSchema = z.object({ key: z.enum(ACADEMIC_KEYS), payload: z.unknown(), revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1) });
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
async function session(request: Request) {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at) return { response: reply({ error: 'unauthorized' }, 401) };
  if (request.headers.get('x-simplify-account') !== data.user.id) return { response: reply({ error: 'account_changed' }, 403) };
  return { client, userId: data.user.id };
}

export async function GET(request: Request) {
  try {
    const auth = await session(request);
    if (auth.response) return auth.response;
    const { data, error } = await auth.client.from('academic_records')
      .select('record_key,payload,revision,schema_version,updated_at').eq('user_id', auth.userId);
    if (error) return reply({ userId: auth.userId, error: 'storage_unavailable' }, 503);
    return reply({ userId: auth.userId, records: data });
  } catch { return reply({ error: 'storage_unavailable' }, 503); }
}

/** Bound the stream, not just Content-Length, which can be missing or misleading. */
async function readBody(request: Request) {
  const max = MAX_DOCUMENT_BYTES + 4096;
  if (Number(request.headers.get('content-length')) > max) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) return undefined;
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); throw new RangeError(); }
    chunks.push(value);
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(buffer));
}

export async function PUT(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return reply({ error: 'invalid_origin' }, 403);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply({ error: 'invalid_content_type' }, 415);
    const auth = await session(request);
    if (auth.response) return auth.response;
    let body: unknown;
    try { body = await readBody(request); }
    catch (error) { return reply({ error: error instanceof RangeError ? 'too_large' : 'invalid_record' }, error instanceof RangeError ? 413 : 400); }
    const parsed = writeSchema.safeParse(body);
    if (!parsed.success || !validateRecord(parsed.data.key, parsed.data.payload)) return reply({ userId: auth.userId, error: 'invalid_record' }, 400);
    const { key, payload, revision } = parsed.data;
    const { data, error } = await auth.client.rpc('save_academic_record', { p_key: key, p_payload: payload, p_revision: revision });
    if (error) return reply({ userId: auth.userId, error: 'storage_unavailable' }, 503);
    if (!Array.isArray(data) || data.length !== 1) return reply({ userId: auth.userId, error: 'conflict' }, 409);
    return reply({ userId: auth.userId, record: data[0] });
  } catch { return reply({ error: 'storage_unavailable' }, 503); }
}
