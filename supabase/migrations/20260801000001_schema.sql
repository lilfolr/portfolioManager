-- Core ledger schema: accounts, instruments, transactions, derived parcels/
-- disposals, income, property, and import provenance.
--
-- Transactions are the source of truth; parcels and disposals are derived
-- and are not written to directly (see 0002_rls.sql and 0003_ledger_rules.sql
-- for the enforcement). See CLAUDE.md for the domain rules this encodes.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.account_kind as enum ('broker', 'registry', 'property', 'cash');

create type public.instrument_kind as enum ('share', 'etf', 'reit', 'lic');

create type public.transaction_type as enum (
  'BUY', 'SELL', 'DRP', 'DIVIDEND', 'DISTRIBUTION', 'SPLIT', 'CONSOLIDATION',
  'RETURN_OF_CAPITAL', 'DEMERGER', 'TRANSFER_IN', 'TRANSFER_OUT', 'INTEREST',
  'EXPENSE'
);

create type public.component_type as enum (
  'franked', 'unfranked', 'foreign_income', 'foreign_tax_offset',
  'discounted_capital_gain', 'non_discount_capital_gain', 'tax_deferred',
  'cgt_concession', 'amit_cost_base_increase'
);

create type public.income_component_status as enum ('pending', 'entered');

create type public.import_kind as enum ('csv', 'email', 'manual');

create type public.import_source_status as enum ('pending', 'processed', 'error');

create type public.staged_row_status as enum ('pending', 'confirmed', 'rejected');

create type public.depreciation_method as enum ('prime_cost', 'diminishing_value');

-- ---------------------------------------------------------------------------
-- Accounts and instruments
-- ---------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  kind public.account_kind not null,
  provider text,
  display_name text not null,
  base_currency text not null default 'AUD',
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index accounts_user_id_idx on public.accounts (user_id);

-- Reference data, shared across users. Not user-scoped.
create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  exchange text not null,
  isin text,
  name text not null,
  kind public.instrument_kind not null,
  amit_flag boolean not null default false,
  created_at timestamptz not null default now(),
  unique (symbol, exchange)
);

create table public.instrument_prices (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments (id),
  price_date date not null,
  close numeric(20, 6) not null,
  currency text not null,
  unique (instrument_id, price_date)
);

create index instrument_prices_instrument_id_idx on public.instrument_prices (instrument_id);

-- ---------------------------------------------------------------------------
-- Import provenance
-- ---------------------------------------------------------------------------

create table public.import_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  kind public.import_kind not null,
  filename_or_message_id text,
  imported_at timestamptz not null default now(),
  raw_blob_ref text,
  parser_version text,
  status public.import_source_status not null default 'pending',
  unique (id, user_id)
);

create index import_sources_user_id_idx on public.import_sources (user_id);

create table public.staged_rows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  source_id uuid not null references public.import_sources (id),
  row_number integer,
  raw_payload jsonb not null,
  parsed_payload jsonb,
  confidence numeric(4, 3),
  status public.staged_row_status not null default 'pending',
  transaction_id uuid,
  created_at timestamptz not null default now(),
  foreign key (source_id, user_id) references public.import_sources (id, user_id)
);

create index staged_rows_user_id_idx on public.staged_rows (user_id);
create index staged_rows_source_id_idx on public.staged_rows (source_id);
create index staged_rows_status_idx on public.staged_rows (status);

-- ---------------------------------------------------------------------------
-- Transactions: the immutable event log
-- ---------------------------------------------------------------------------

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  account_id uuid not null,
  instrument_id uuid references public.instruments (id),
  type public.transaction_type not null,
  trade_date date not null,
  settlement_date date,
  quantity numeric(20, 8),
  unit_price numeric(20, 4),
  brokerage numeric(20, 4) not null default 0,
  fees numeric(20, 4) not null default 0,
  currency text not null default 'AUD',
  fx_rate_to_aud numeric(20, 8) not null default 1,
  financial_year integer generated always as (
    case
      when extract(month from trade_date) >= 7
        then extract(year from trade_date)::int + 1
      else extract(year from trade_date)::int
    end
  ) stored,
  source_id uuid references public.import_sources (id),
  external_ref text,
  created_at timestamptz not null default now(),
  superseded_by uuid references public.transactions (id),
  foreign key (account_id, user_id) references public.accounts (id, user_id)
);

create index transactions_user_id_idx on public.transactions (user_id);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_instrument_id_idx on public.transactions (instrument_id);
create index transactions_active_idx on public.transactions (instrument_id, user_id)
  where superseded_by is null;

-- ---------------------------------------------------------------------------
-- Parcels and disposals: derived, not written directly by clients.
--
-- Compute-on-read is canonical (see supabase/functions/_shared/engine). These
-- tables exist so a future materialisation pass has somewhere to land
-- without a migration rewrite; they are not populated by this migration set.
--
-- A parcel is opened 1:1 by a BUY/DRP transaction, so its id is simply that
-- transaction's id -- deterministic, no separate id generation needed, and
-- stable across recomputation (see plan gap #4: the UI cites parcel ids like
-- P-0002 as durable references).
-- ---------------------------------------------------------------------------

create table public.parcels (
  id uuid primary key references public.transactions (id),
  user_id uuid not null references auth.users (id),
  instrument_id uuid not null references public.instruments (id),
  account_id uuid not null,
  acquired_date date not null,
  original_quantity numeric(20, 8) not null,
  remaining_quantity numeric(20, 8) not null,
  cost_base numeric(20, 4) not null,
  reduced_cost_base numeric(20, 4) not null,
  cost_base_native numeric(20, 4),
  currency text not null default 'AUD',
  foreign key (account_id, user_id) references public.accounts (id, user_id)
);

create index parcels_user_id_idx on public.parcels (user_id);
create index parcels_instrument_id_idx on public.parcels (instrument_id);

create table public.disposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  sell_transaction_id uuid not null references public.transactions (id),
  parcel_id uuid not null references public.parcels (id),
  sell_date date not null,
  financial_year integer generated always as (
    case
      when extract(month from sell_date) >= 7
        then extract(year from sell_date)::int + 1
      else extract(year from sell_date)::int
    end
  ) stored,
  quantity numeric(20, 8) not null,
  proceeds numeric(20, 4) not null,
  cost_base_used numeric(20, 4) not null,
  gain_loss numeric(20, 4) not null,
  discount_eligible boolean not null
);

create index disposals_user_id_idx on public.disposals (user_id);
create index disposals_parcel_id_idx on public.disposals (parcel_id);
create index disposals_sell_transaction_id_idx on public.disposals (sell_transaction_id);

-- ---------------------------------------------------------------------------
-- Income and its components
-- ---------------------------------------------------------------------------

create table public.income_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  transaction_id uuid references public.transactions (id),
  instrument_id uuid not null references public.instruments (id),
  account_id uuid not null,
  record_date date,
  payment_date date not null,
  financial_year integer generated always as (
    case
      when extract(month from payment_date) >= 7
        then extract(year from payment_date)::int + 1
      else extract(year from payment_date)::int
    end
  ) stored,
  gross_amount numeric(20, 4) not null,
  statement_ref text,
  components_status public.income_component_status not null default 'pending',
  foreign key (account_id, user_id) references public.accounts (id, user_id)
);

create index income_events_user_id_idx on public.income_events (user_id);
create index income_events_instrument_id_idx on public.income_events (instrument_id);

create table public.income_components (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  income_event_id uuid not null references public.income_events (id),
  component_type public.component_type not null,
  amount numeric(20, 4) not null
);

create index income_components_user_id_idx on public.income_components (user_id);
create index income_components_income_event_id_idx on public.income_components (income_event_id);

-- ---------------------------------------------------------------------------
-- Property
-- ---------------------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  address text not null,
  acquisition_date date not null,
  purchase_price numeric(20, 4) not null,
  acquisition_costs numeric(20, 4) not null default 0,
  ownership_share numeric(5, 4) not null default 1.0,
  income_producing_from date,
  unique (id, user_id)
);

create index properties_user_id_idx on public.properties (user_id);

create table public.property_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  property_id uuid not null,
  date date not null,
  category text not null,
  amount numeric(20, 4) not null,
  description text,
  -- Repair vs improvement is a tax classification with consequences the app
  -- must never infer (CLAUDE.md rule 4) -- always user-asserted.
  capital_flag boolean not null,
  receipt_source_id uuid references public.import_sources (id),
  financial_year integer generated always as (
    case
      when extract(month from date) >= 7
        then extract(year from date)::int + 1
      else extract(year from date)::int
    end
  ) stored,
  foreign key (property_id, user_id) references public.properties (id, user_id)
);

create index property_transactions_user_id_idx on public.property_transactions (user_id);
create index property_transactions_property_id_idx on public.property_transactions (property_id);

create table public.depreciation_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  property_id uuid not null,
  description text not null,
  cost numeric(20, 4) not null,
  acquired_date date not null,
  method public.depreciation_method not null,
  effective_life numeric(6, 2),
  pool boolean not null default false,
  foreign key (property_id, user_id) references public.properties (id, user_id)
);

create index depreciation_assets_user_id_idx on public.depreciation_assets (user_id);
create index depreciation_assets_property_id_idx on public.depreciation_assets (property_id);

-- staged_rows.transaction_id can only be added now that transactions exists.
alter table public.staged_rows
  add constraint staged_rows_transaction_id_fkey
  foreign key (transaction_id) references public.transactions (id);
