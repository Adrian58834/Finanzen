-- FinanZen - Sincronização em Nuvem (Supabase)
-- Rode este SQL no "SQL Editor" do seu projeto Supabase.
-- Depois copie a Project URL e a chave "anon public" para js/sync-config.js.

create table if not exists public.finanzen_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Atualiza updated_at a cada gravação (usado no last-write-wins)
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
