-- Apply before deploying the account-storage client. Official ITU data is unaffected.
create table public.academic_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_key text not null check (record_key in (
    'simplify-weekly-programs', 'simplify-selected-weekly-program',
    'simplify-schedule-generator-session', 'simplify-transcript-v1',
    'simplify-current-semester-v1', 'simplify-curriculum-progress-v1',
    'simplify-saved-curriculum-v1'
  )),
  payload jsonb not null check (octet_length(payload::text) <= 2097152),
  revision bigint not null default 1 check (revision > 0 and revision < 9007199254740991),
  schema_version integer not null default 1 check (schema_version = 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, record_key)
);
-- Allow canonical JSONB whitespace overhead; HTTP enforces 1 MiB of compact JSON.
-- JSON null is a durable tombstone and preserves revision history on reset.
alter table public.academic_records enable row level security;
revoke all on public.academic_records from anon, authenticated;
grant select, insert, update on public.academic_records to authenticated;
create policy academic_select on public.academic_records for select to authenticated
  using ((select auth.uid()) = user_id);
create policy academic_insert on public.academic_records for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy academic_update on public.academic_records for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.save_academic_record(p_key text, p_payload jsonb, p_revision bigint)
returns setof public.academic_records
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if p_revision = 0 then
    return query insert into public.academic_records (user_id, record_key, payload)
      values (auth.uid(), p_key, coalesce(p_payload, 'null'::jsonb))
      on conflict (user_id, record_key) do nothing returning *;
  elsif p_revision > 0 then
    return query update public.academic_records r
      set payload = coalesce(p_payload, 'null'::jsonb), revision = r.revision + 1, updated_at = now()
      where r.user_id = auth.uid() and r.record_key = p_key and r.revision = p_revision
      returning r.*;
  end if;
end;
$$;
revoke all on function public.save_academic_record(text, jsonb, bigint) from public, anon;
grant execute on function public.save_academic_record(text, jsonb, bigint) to authenticated;
