-- FinanZen - fundacao para integracao com Open Finance
-- Execute depois de supabase/schema.sql.
--
-- As tabelas abaixo guardam somente identificadores e dados financeiros
-- normalizados. Credenciais do provedor e tokens de acesso NAO pertencem a
-- estas tabelas: mantenha-os nos secrets das Edge Functions ou em um cofre.

create extension if not exists pgcrypto;

create table if not exists public.open_finance_connections (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  provider                 text not null,
  provider_connection_id   text,
  institution_id           text,
  institution_name         text not null,
  institution_logo_url     text,
  consent_id               text,
  status                   text not null default 'pending'
                           check (status in ('pending', 'active', 'attention', 'expired', 'revoked', 'error')),
  consent_expires_at       timestamptz,
  last_synced_at           timestamptz,
  last_error_code          text,
  last_error_message       text,
  metadata                 jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (provider, provider_connection_id)
);

create index if not exists open_finance_connections_user_idx
  on public.open_finance_connections (user_id, status);

create table if not exists public.open_finance_accounts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  connection_id            uuid not null references public.open_finance_connections(id) on delete cascade,
  provider_account_id      text not null,
  type                     text not null default 'bank'
                           check (type in ('bank', 'savings', 'credit_card', 'investment', 'loan', 'other')),
  subtype                  text,
  name                     text not null,
  official_name            text,
  mask                     text,
  currency                 text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  current_balance          numeric(18, 2),
  available_balance        numeric(18, 2),
  credit_limit             numeric(18, 2),
  metadata                 jsonb not null default '{}'::jsonb,
  last_synced_at           timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (connection_id, provider_account_id)
);

create index if not exists open_finance_accounts_user_idx
  on public.open_finance_accounts (user_id, connection_id);

create table if not exists public.open_finance_transactions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  connection_id            uuid not null references public.open_finance_connections(id) on delete cascade,
  account_id               uuid not null references public.open_finance_accounts(id) on delete cascade,
  provider_transaction_id  text,
  deduplication_key        text not null,
  type                     text not null check (type in ('income', 'expense', 'transfer')),
  status                   text not null default 'posted'
                           check (status in ('pending', 'posted', 'voided')),
  amount                   numeric(18, 2) not null check (amount >= 0),
  currency                 text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  transaction_date         date not null,
  posted_at                timestamptz,
  description              text not null,
  raw_description          text,
  merchant_name            text,
  category_key             text,
  finanzen_transaction_id  text,
  metadata                 jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (connection_id, deduplication_key)
);

create unique index if not exists open_finance_transactions_provider_id_idx
  on public.open_finance_transactions (connection_id, provider_transaction_id)
  where provider_transaction_id is not null;

create index if not exists open_finance_transactions_user_date_idx
  on public.open_finance_transactions (user_id, transaction_date desc);

create index if not exists open_finance_transactions_account_date_idx
  on public.open_finance_transactions (account_id, transaction_date desc);

create table if not exists public.open_finance_sync_runs (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  connection_id            uuid not null references public.open_finance_connections(id) on delete cascade,
  trigger_source           text not null default 'manual'
                           check (trigger_source in ('initial', 'manual', 'webhook', 'scheduled')),
  status                   text not null default 'queued'
                           check (status in ('queued', 'running', 'succeeded', 'failed')),
  cursor_before            text,
  cursor_after             text,
  accounts_processed       integer not null default 0 check (accounts_processed >= 0),
  transactions_inserted    integer not null default 0 check (transactions_inserted >= 0),
  transactions_updated     integer not null default 0 check (transactions_updated >= 0),
  error_code               text,
  error_message            text,
  started_at               timestamptz,
  finished_at              timestamptz,
  created_at               timestamptz not null default now()
);

create index if not exists open_finance_sync_runs_connection_idx
  on public.open_finance_sync_runs (connection_id, created_at desc);

-- Caixa de entrada para idempotencia de webhooks. Nenhuma politica de leitura
-- e criada de proposito: somente o backend com service role pode acessa-la.
create table if not exists public.open_finance_webhook_events (
  id                       uuid primary key default gen_random_uuid(),
  provider                 text not null,
  provider_event_id        text not null,
  event_type               text not null,
  connection_reference     text,
  payload                  jsonb not null,
  status                   text not null default 'received'
                           check (status in ('received', 'processing', 'processed', 'failed', 'ignored')),
  error_message            text,
  received_at              timestamptz not null default now(),
  processed_at             timestamptz,
  unique (provider, provider_event_id)
);

-- Garante que um cliente nao consiga associar registros a uma conexao de
-- outro usuario, mesmo em uma futura gravacao feita pelo backend.
create or replace function public.open_finance_validate_owner()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  owner_id uuid;
begin
  select user_id into owner_id
  from public.open_finance_connections
  where id = new.connection_id;

  if owner_id is null or owner_id <> new.user_id then
    raise exception 'Open Finance connection owner mismatch';
  end if;

  if tg_table_name = 'open_finance_transactions' then
    if not exists (
      select 1 from public.open_finance_accounts
      where id = new.account_id
        and connection_id = new.connection_id
        and user_id = new.user_id
    ) then
      raise exception 'Open Finance account owner mismatch';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_open_finance_accounts_owner on public.open_finance_accounts;
create trigger trg_open_finance_accounts_owner
  before insert or update on public.open_finance_accounts
  for each row execute function public.open_finance_validate_owner();

drop trigger if exists trg_open_finance_transactions_owner on public.open_finance_transactions;
create trigger trg_open_finance_transactions_owner
  before insert or update on public.open_finance_transactions
  for each row execute function public.open_finance_validate_owner();

drop trigger if exists trg_open_finance_sync_runs_owner on public.open_finance_sync_runs;
create trigger trg_open_finance_sync_runs_owner
  before insert or update on public.open_finance_sync_runs
  for each row execute function public.open_finance_validate_owner();

drop trigger if exists trg_open_finance_connections_updated_at on public.open_finance_connections;
create trigger trg_open_finance_connections_updated_at
  before update on public.open_finance_connections
  for each row execute function public.set_updated_at();

drop trigger if exists trg_open_finance_accounts_updated_at on public.open_finance_accounts;
create trigger trg_open_finance_accounts_updated_at
  before update on public.open_finance_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_open_finance_transactions_updated_at on public.open_finance_transactions;
create trigger trg_open_finance_transactions_updated_at
  before update on public.open_finance_transactions
  for each row execute function public.set_updated_at();

alter table public.open_finance_connections enable row level security;
alter table public.open_finance_accounts enable row level security;
alter table public.open_finance_transactions enable row level security;
alter table public.open_finance_sync_runs enable row level security;
alter table public.open_finance_webhook_events enable row level security;

-- O navegador possui acesso somente de leitura aos proprios registros.
-- Criacao, atualizacao e revogacao passam obrigatoriamente pelas Edge Functions.
drop policy if exists "open_finance_connections_select_own" on public.open_finance_connections;
create policy "open_finance_connections_select_own"
  on public.open_finance_connections for select
  using (auth.uid() = user_id);

drop policy if exists "open_finance_accounts_select_own" on public.open_finance_accounts;
create policy "open_finance_accounts_select_own"
  on public.open_finance_accounts for select
  using (auth.uid() = user_id);

drop policy if exists "open_finance_transactions_select_own" on public.open_finance_transactions;
create policy "open_finance_transactions_select_own"
  on public.open_finance_transactions for select
  using (auth.uid() = user_id);

drop policy if exists "open_finance_sync_runs_select_own" on public.open_finance_sync_runs;
create policy "open_finance_sync_runs_select_own"
  on public.open_finance_sync_runs for select
  using (auth.uid() = user_id);

