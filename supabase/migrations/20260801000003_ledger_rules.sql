-- Grants, the append-only trigger, and the single write path onto the
-- ledger. RLS policies (0002) say which *rows* a command can touch; grants
-- say which *commands* are available at all. `auto_expose_new_tables` is
-- off for this project (see config.toml), so nothing here is implicit.

-- ---------------------------------------------------------------------------
-- Reference data: read-only for clients.
-- ---------------------------------------------------------------------------

grant select on public.instruments to authenticated;
grant select on public.instrument_prices to authenticated;

-- ---------------------------------------------------------------------------
-- User-owned tables: standard select/insert(/update) matching 0002's policies.
-- ---------------------------------------------------------------------------

grant select, insert, update on public.accounts to authenticated;
grant select, insert on public.import_sources to authenticated;
grant select, insert, update on public.staged_rows to authenticated;
grant select, insert, update on public.properties to authenticated;
grant select, insert on public.property_transactions to authenticated;
grant select, insert on public.depreciation_assets to authenticated;

-- ---------------------------------------------------------------------------
-- Ledger tables.
--
-- transactions: append-only (CLAUDE.md rule 2). No INSERT grant at all --
-- the only way a row is created is confirm_staged_row() below, which runs
-- as the function owner and so isn't limited by these client-facing grants
-- (CLAUDE.md rule 3: nothing reaches the ledger unreviewed). No DELETE,
-- ever. UPDATE is restricted to the one column a correction is allowed to
-- touch; the trigger below closes the gap a column grant can't (setting
-- superseded_by a second time).
-- ---------------------------------------------------------------------------

revoke insert, update, delete on public.transactions from authenticated, anon;
grant select on public.transactions to authenticated;
grant update (superseded_by) on public.transactions to authenticated;

-- parcels/disposals/income_events/income_components: derived-only
-- (CLAUDE.md rule 1). Select only, no client write path at all.
grant select on public.parcels to authenticated;
grant select on public.disposals to authenticated;
grant select on public.income_events to authenticated;
grant select on public.income_components to authenticated;

-- ---------------------------------------------------------------------------
-- Append-only enforcement trigger.
--
-- The column grant above stops clients naming other columns in an UPDATE,
-- but it can't stop a second UPDATE that only ever touches superseded_by --
-- e.g. un-superseding a transaction, or re-pointing it at a different
-- replacement. The trigger enforces the full rule: superseded_by may move
-- NULL -> non-NULL exactly once, and nothing else may change, ever.
-- ---------------------------------------------------------------------------

create function public.enforce_transaction_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.superseded_by is not null then
    raise exception 'transaction % is already superseded and cannot be modified', old.id;
  end if;

  if new.id <> old.id
     or new.user_id <> old.user_id
     or new.account_id <> old.account_id
     or new.instrument_id is distinct from old.instrument_id
     or new.type <> old.type
     or new.trade_date <> old.trade_date
     or new.settlement_date is distinct from old.settlement_date
     or new.quantity is distinct from old.quantity
     or new.unit_price is distinct from old.unit_price
     or new.brokerage <> old.brokerage
     or new.fees <> old.fees
     or new.currency <> old.currency
     or new.fx_rate_to_aud <> old.fx_rate_to_aud
     or new.source_id is distinct from old.source_id
     or new.external_ref is distinct from old.external_ref
     or new.created_at <> old.created_at
  then
    raise exception 'only superseded_by may be set on an existing transaction (append-only ledger)';
  end if;

  return new;
end;
$$;

create trigger transactions_append_only
  before update on public.transactions
  for each row execute function public.enforce_transaction_append_only();

-- ---------------------------------------------------------------------------
-- confirm_staged_row: the only path onto the transactions ledger.
--
-- Covers both CSV/email imports and manual entry -- manual entry creates a
-- staged_row against a synthetic `manual` import_source and confirms it the
-- same way, so there is exactly one write path to reason about.
--
-- SECURITY DEFINER bypasses RLS, so this function does its own auth.uid()
-- ownership check and fully schema-qualifies every identifier
-- (search_path = '' closes the standard SECURITY DEFINER search-path
-- injection footgun).
-- ---------------------------------------------------------------------------

create function public.confirm_staged_row(p_staged_row_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.staged_rows%rowtype;
  v_txn public.transactions%rowtype;
  v_parsed jsonb;
begin
  select * into v_row from public.staged_rows where id = p_staged_row_id;

  if not found then
    raise exception 'staged row % not found', p_staged_row_id;
  end if;

  if v_row.user_id <> auth.uid() then
    raise exception 'not authorized';
  end if;

  if v_row.status <> 'pending' then
    raise exception 'staged row % is not pending (status=%)', p_staged_row_id, v_row.status;
  end if;

  v_parsed := v_row.parsed_payload;
  if v_parsed is null then
    raise exception 'staged row % has no parsed payload', p_staged_row_id;
  end if;

  insert into public.transactions (
    user_id, account_id, instrument_id, type, trade_date, settlement_date,
    quantity, unit_price, brokerage, fees, currency, fx_rate_to_aud,
    source_id, external_ref
  ) values (
    v_row.user_id,
    (v_parsed ->> 'account_id')::uuid,
    nullif(v_parsed ->> 'instrument_id', '')::uuid,
    (v_parsed ->> 'type')::public.transaction_type,
    (v_parsed ->> 'trade_date')::date,
    nullif(v_parsed ->> 'settlement_date', '')::date,
    nullif(v_parsed ->> 'quantity', '')::numeric,
    nullif(v_parsed ->> 'unit_price', '')::numeric,
    coalesce((v_parsed ->> 'brokerage')::numeric, 0),
    coalesce((v_parsed ->> 'fees')::numeric, 0),
    coalesce(v_parsed ->> 'currency', 'AUD'),
    coalesce((v_parsed ->> 'fx_rate_to_aud')::numeric, 1),
    v_row.source_id,
    v_parsed ->> 'external_ref'
  )
  returning * into v_txn;

  update public.staged_rows
    set status = 'confirmed', transaction_id = v_txn.id
    where id = p_staged_row_id;

  return v_txn;
end;
$$;

revoke all on function public.confirm_staged_row(uuid) from public;
grant execute on function public.confirm_staged_row(uuid) to authenticated;
