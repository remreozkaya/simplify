import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';

const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const key = 'simplify-selected-weekly-program';
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  // Reproduce Supabase's authenticated role and auth.uid() claim boundary.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth, public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
    insert into auth.users values ('${a}'), ('${b}');
  `);
  await db.exec(readFileSync(new URL('../../supabase/migrations/202610260001_academic_records.sql', import.meta.url), 'utf8'));
}, 30000);
afterAll(async () => { await db?.close(); });
async function asUser(id: string) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec('set role authenticated');
}
async function save(revision: number, payload: unknown = 'saved') {
  return db.query<{ revision: number; payload: unknown }>('select * from public.save_academic_record($1, $2::jsonb, $3)', [key, payload === null ? null : JSON.stringify(payload), revision]);
}

it('enforces RLS, atomic revision checks, reset tombstones and deletion cascade in PostgreSQL', async () => {
  await asUser(a);
  expect((await save(0)).rows).toMatchObject([{ revision: 1, payload: 'saved' }]);
  expect((await save(0, 'racing first write')).rows).toEqual([]);
  expect((await save(9, 'stale')).rows).toEqual([]);
  expect((await save(1, null)).rows).toMatchObject([{ revision: 2, payload: null }]);
  expect((await save(1, 'stale after reset')).rows).toEqual([]);

  await asUser(b);
  expect((await db.query('select * from public.academic_records')).rows).toEqual([]);
  expect((await db.query('update public.academic_records set payload = $1::jsonb where user_id = $2 returning *', ['"spoof"', a])).rows).toEqual([]);
  await expect(db.query('insert into public.academic_records(user_id,record_key,payload) values ($1,$2,$3::jsonb)', [a, key, '"spoof"'])).rejects.toThrow();
  expect((await save(0, 'B private')).rows).toMatchObject([{ revision: 1, payload: 'B private' }]);
  await expect(db.query('update public.academic_records set user_id = $1 where user_id = $2', [a, b])).rejects.toThrow();
  await expect(db.exec('delete from public.academic_records')).rejects.toThrow();

  await db.exec('reset role; set role anon');
  await expect(db.exec('select * from public.academic_records')).rejects.toThrow();
  await expect(save(0)).rejects.toThrow();
  await db.exec('reset role');
  await db.query('delete from auth.users where id = $1', [a]);
  const remaining = await db.query<{ user_id: string }>('select user_id from public.academic_records');
  expect(remaining.rows).toEqual([{ user_id: b }]);
});
