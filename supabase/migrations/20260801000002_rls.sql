-- Row-level security. With no server between the client and Postgres, this
-- is the only tenant isolation boundary -- see plan Context.
--
-- Every policy uses `(select auth.uid())` rather than bare `auth.uid()` so
-- the planner can hoist it into an InitPlan instead of re-evaluating per row.
--
-- Policies are written per-command, never `FOR ALL`. Absence of a policy is
-- denial -- that's deliberate for UPDATE/DELETE on ledger tables.

-- ---------------------------------------------------------------------------
-- Reference data: instruments, instrument_prices.
-- Shared across users. Readable by any authenticated user; writable only by
-- the table owner (migrations / service_role), never by client roles.
-- ---------------------------------------------------------------------------

alter table public.instruments enable row level security;
alter table public.instrument_prices enable row level security;

create policy instruments_select on public.instruments
  for select to authenticated
  using (true);

create policy instrument_prices_select on public.instrument_prices
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- User-owned tables: standard "select/insert own rows" shape.
-- ---------------------------------------------------------------------------

alter table public.accounts enable row level security;
alter table public.accounts force row level security;

create policy accounts_select on public.accounts
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy accounts_insert on public.accounts
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy accounts_update on public.accounts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.import_sources enable row level security;
alter table public.import_sources force row level security;

create policy import_sources_select on public.import_sources
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy import_sources_insert on public.import_sources
  for insert to authenticated
  with check (user_id = (select auth.uid()));

alter table public.staged_rows enable row level security;
alter table public.staged_rows force row level security;

create policy staged_rows_select on public.staged_rows
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy staged_rows_insert on public.staged_rows
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Rejecting a staged row is a status flip a user should be able to do
-- directly; confirming one is not (see 0003_ledger_rules.sql -- it must go
-- through confirm_staged_row so nothing reaches transactions unreviewed).
create policy staged_rows_reject on public.staged_rows
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pending')
  with check (user_id = (select auth.uid()) and status = 'rejected');

alter table public.properties enable row level security;
alter table public.properties force row level security;

create policy properties_select on public.properties
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy properties_insert on public.properties
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy properties_update on public.properties
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.property_transactions enable row level security;
alter table public.property_transactions force row level security;

create policy property_transactions_select on public.property_transactions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy property_transactions_insert on public.property_transactions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

alter table public.depreciation_assets enable row level security;
alter table public.depreciation_assets force row level security;

create policy depreciation_assets_select on public.depreciation_assets
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy depreciation_assets_insert on public.depreciation_assets
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Ledger tables: append-only / derived. Select-only for authenticated;
-- writes happen through grants + RPC, enforced in 0003_ledger_rules.sql.
-- ---------------------------------------------------------------------------

alter table public.transactions enable row level security;
alter table public.transactions force row level security;

create policy transactions_select on public.transactions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- No insert/delete policy: intentional. Writes only via confirm_staged_row
-- (SECURITY DEFINER, bypasses RLS as the function owner). The
-- superseded_by-only update policy sits alongside the append-only trigger
-- and column grant in 0003_ledger_rules.sql -- both are needed, the trigger
-- catches what the column grant alone cannot (setting it a second time).
create policy transactions_supersede on public.transactions
  for update to authenticated
  using (user_id = (select auth.uid()) and superseded_by is null)
  with check (user_id = (select auth.uid()));

alter table public.parcels enable row level security;
alter table public.parcels force row level security;

create policy parcels_select on public.parcels
  for select to authenticated
  using (user_id = (select auth.uid()));

-- No insert/update/delete policy for parcels: derived-only, enforced by RLS
-- absence here and by grants in 0003_ledger_rules.sql.

alter table public.disposals enable row level security;
alter table public.disposals force row level security;

create policy disposals_select on public.disposals
  for select to authenticated
  using (user_id = (select auth.uid()));

alter table public.income_events enable row level security;
alter table public.income_events force row level security;

create policy income_events_select on public.income_events
  for select to authenticated
  using (user_id = (select auth.uid()));

alter table public.income_components enable row level security;
alter table public.income_components force row level security;

create policy income_components_select on public.income_components
  for select to authenticated
  using (user_id = (select auth.uid()));
