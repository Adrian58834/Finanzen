-- FinanZen - Sincronização em Nuvem (Supabase)
-- Rode este SQL no "SQL Editor" do seu projeto Supabase.
-- Depois copie a Project URL e a chave "anon public" para js/sync-config.js.

begin;

create table if not exists public.finanzen_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Atualiza updated_at para auditoria; conflitos são controlados pela coluna revision.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_finanzen_updated_at on public.finanzen_data;
create trigger trg_finanzen_updated_at
  before update on public.finanzen_data
  for each row execute function public.set_updated_at();

-- Segurança: cada usuário só acessa a própria linha
alter table public.finanzen_data enable row level security;

drop policy if exists "finanzen_select_own" on public.finanzen_data;
create policy "finanzen_select_own"
  on public.finanzen_data for select
  using (auth.uid() = user_id);

drop policy if exists "finanzen_insert_own" on public.finanzen_data;
create policy "finanzen_insert_own"
  on public.finanzen_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "finanzen_update_own" on public.finanzen_data;
create policy "finanzen_update_own"
  on public.finanzen_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Histórico de segurança: arquiva a versão anterior antes de cada atualização.
-- Mantém as 30 versões mais recentes de cada usuário.
create table if not exists public.finanzen_data_history (
  history_id        bigint generated always as identity primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  data              jsonb not null,
  settings          jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  archived_at       timestamptz not null default now()
);

create index if not exists idx_finanzen_history_user_archived
  on public.finanzen_data_history (user_id, archived_at desc);

alter table public.finanzen_data_history enable row level security;

drop policy if exists "finanzen_history_select_own" on public.finanzen_data_history;
create policy "finanzen_history_select_own"
  on public.finanzen_data_history for select
  using (auth.uid() = user_id);

create or replace function public.archive_finanzen_data()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.finanzen_data_history (user_id, data, settings, source_updated_at)
  values (old.user_id, old.data, old.settings, old.updated_at);

  delete from public.finanzen_data_history
  where user_id = old.user_id
    and history_id not in (
      select history_id
      from public.finanzen_data_history
      where user_id = old.user_id
      order by archived_at desc, history_id desc
      limit 30
    );

  return new;
end;
$$;

drop trigger if exists trg_archive_finanzen_data on public.finanzen_data;
create trigger trg_archive_finanzen_data
  before update on public.finanzen_data
  for each row execute function public.archive_finanzen_data();

-- Optimistic concurrency: all new writes go through this authenticated RPC.
alter table public.finanzen_data add column if not exists revision bigint not null default 1;

create or replace function public.finanzen_compare_and_set(
  expected_user_id uuid, expected_revision bigint, next_data jsonb, next_settings jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  current_row public.finanzen_data%rowtype;
begin
  if owner_id is null or owner_id is distinct from expected_user_id then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(next_data) is distinct from 'object'
     or jsonb_typeof(next_settings) is distinct from 'object' then
    raise exception 'Invalid document';
  end if;
  -- Covers simultaneous first inserts as well as updates for this user.
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  select * into current_row from public.finanzen_data where user_id = owner_id for update;
  if found then
    if expected_revision is distinct from current_row.revision then
      return jsonb_build_object('conflict', true);
    end if;
    update public.finanzen_data
      set data = next_data, settings = next_settings, revision = revision + 1
      where user_id = owner_id returning * into current_row;
  else
    if expected_revision is not null then
      return jsonb_build_object('conflict', true);
    end if;
    insert into public.finanzen_data(user_id, data, settings)
      values(owner_id, next_data, next_settings) returning * into current_row;
  end if;
  return jsonb_build_object('conflict', false, 'row',
    jsonb_build_object('updated_at', current_row.updated_at, 'revision', current_row.revision));
end;
$$;

revoke all on function public.finanzen_compare_and_set(uuid, bigint, jsonb, jsonb) from public, anon;
grant execute on function public.finanzen_compare_and_set(uuid, bigint, jsonb, jsonb) to authenticated;
-- Old app versions fail safely instead of bypassing the revision check.
drop policy if exists "finanzen_insert_own" on public.finanzen_data;
drop policy if exists "finanzen_update_own" on public.finanzen_data;

commit;
