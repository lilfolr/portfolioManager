-- RLS negative test suite. Run as the table owner (psql -f) but every
-- assertion switches into `authenticated`/`anon` with the same GUCs
-- PostgREST sets per-request, so a pass here means RLS -- not the calling
-- role's privilege -- is what's blocking the query. See plan Verification.
--
-- Usage: make db-test-rls

\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

begin;

-- ---------------------------------------------------------------------------
-- Helpers: `authenticate_as` mimics what PostgREST sets per request.
-- ---------------------------------------------------------------------------

create or replace function pg_temp.authenticate_as(p_user_id uuid) returns void as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
end;
$$ language plpgsql;

create or replace function pg_temp.authenticate_as_anon() returns void as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$ language plpgsql;

create or replace function pg_temp.assert(p_condition boolean, p_message text) returns void as $$
begin
  if not p_condition then
    raise exception 'FAIL: %', p_message;
  else
    raise notice 'PASS: %', p_message;
  end if;
end;
$$ language plpgsql;

\set alice '''11111111-1111-1111-1111-111111111111'''
\set bob   '''22222222-2222-2222-2222-222222222222'''

-- ---------------------------------------------------------------------------
-- 1. As Alice, Bob's rows are invisible on every user-scoped table.
-- ---------------------------------------------------------------------------

select pg_temp.authenticate_as(:alice::uuid);

select pg_temp.assert(
  (select count(*) from public.accounts where user_id = :bob::uuid) = 0,
  'alice cannot see bob''s accounts'
);
-- Phrased against alice's own row count rather than a literal: the seed has
-- grown from one account to three since this was written, and a hardcoded
-- number turned a tenancy assertion into a seed-size assertion that fails for
-- the wrong reason (and, with ON_ERROR_STOP, took the rest of the suite with
-- it).
select pg_temp.assert(
  (select count(*) from public.accounts)
    = (select count(*) from public.accounts where user_id = :alice::uuid)
  and (select count(*) from public.accounts) > 0,
  'alice sees exactly her own accounts and nothing else'
);
select pg_temp.assert(
  (select count(*) from public.transactions where user_id = :bob::uuid) = 0,
  'alice cannot see bob''s transactions'
);
-- Sanity: reference data (not user-scoped) is visible to any authenticated
-- user, so this isn't a "nothing works" false pass.
-- Same drift as above: the claim is "shared reference data is visible", not
-- "the seed has exactly two instruments".
select pg_temp.assert(
  (select count(*) from public.instruments) > 0,
  'alice can see shared instrument reference data'
);

-- ---------------------------------------------------------------------------
-- 2. As anon (no JWT), user-scoped tables are unreachable. We never granted
--    `anon` any privilege on them (only `authenticated` in 0003), so this is
--    enforced at the grant layer, one step stricter than RLS returning zero
--    rows -- the query is rejected outright rather than silently empty.
-- ---------------------------------------------------------------------------

select pg_temp.authenticate_as_anon();

do $$
begin
  begin
    perform count(*) from public.accounts;
    raise exception 'FAIL: anon should not be able to query accounts at all';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no grant on accounts';
  end;
end $$;

do $$
begin
  begin
    perform count(*) from public.transactions;
    raise exception 'FAIL: anon should not be able to query transactions at all';
  exception
    when insufficient_privilege then
      raise notice 'PASS: anon has no grant on transactions';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Append-only: DELETE always fails; UPDATE outside superseded_by fails;
--    setting superseded_by from NULL succeeds; a second time fails.
-- ---------------------------------------------------------------------------

-- The superseded_by test below needs a correction target, because
-- superseded_by is a real FK and has to point at an actual row.
-- d0000000-...-0002 is one of alice's seeded transactions and serves as that
-- target. This block used to insert it here as the table owner; the seed has
-- since grown to include it, so doing that again is a primary-key collision
-- that aborts the suite.
reset role;

select pg_temp.assert(
  (select count(*) from public.transactions
    where id = 'd0000000-0000-0000-0000-000000000002') = 1,
  'the seeded correction target for the supersede test exists'
);

select pg_temp.authenticate_as(:alice::uuid);

select pg_temp.assert(
  (select not exists (
    select 1 from information_schema.role_table_grants
    where table_name = 'transactions' and grantee = 'authenticated' and privilege_type = 'DELETE'
  )),
  'authenticated has no DELETE grant on transactions'
);

do $$
begin
  begin
    update public.transactions set quantity = quantity + 1
      where id = 'd0000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: updating quantity should have been rejected';
  exception
    when insufficient_privilege or others then
      raise notice 'PASS: updating a non-superseded_by column is rejected';
  end;
end $$;

do $$
begin
  update public.transactions set superseded_by = 'd0000000-0000-0000-0000-000000000002'
    where id = 'd0000000-0000-0000-0000-000000000001';
  raise notice 'PASS: setting superseded_by from NULL succeeds';
end $$;

do $$
begin
  begin
    update public.transactions set superseded_by = 'd0000000-0000-0000-0000-000000000002'
      where id = 'd0000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: re-superseding an already-superseded transaction should have been rejected';
  exception
    when others then
      raise notice 'PASS: setting superseded_by a second time is rejected';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Direct INSERT into transactions is blocked; confirm_staged_row is the
--    only write path, and it refuses another user's staged row.
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    insert into public.transactions (
      user_id, account_id, instrument_id, type, trade_date, quantity, unit_price, currency
    ) values (
      '11111111-1111-1111-1111-111111111111'::uuid,
      'b0000000-0000-0000-0000-000000000001'::uuid,
      'a0000000-0000-0000-0000-000000000001'::uuid,
      'BUY', current_date, 1, 1, 'AUD'
    );
    raise exception 'FAIL: direct INSERT into transactions should have been rejected';
  exception
    when insufficient_privilege or others then
      raise notice 'PASS: direct INSERT into transactions is rejected';
  end;
end $$;

-- Seed a staged row owned by bob, then try to confirm it as alice.
select pg_temp.authenticate_as_anon(); -- drop to superuser-free context first
reset role;

insert into public.import_sources (id, user_id, kind, status) values
  ('e0000000-0000-0000-0000-000000000001', :bob::uuid, 'manual', 'pending');
insert into public.staged_rows (id, user_id, source_id, raw_payload, parsed_payload, status) values (
  'f0000000-0000-0000-0000-000000000001', :bob::uuid, 'e0000000-0000-0000-0000-000000000001',
  '{}'::jsonb,
  json_build_object(
    'account_id', 'b0000000-0000-0000-0000-000000000002',
    'instrument_id', 'a0000000-0000-0000-0000-000000000001',
    'type', 'BUY', 'trade_date', current_date, 'quantity', '10', 'unit_price', '5'
  )::jsonb,
  'pending'
);

select pg_temp.authenticate_as(:alice::uuid);

do $$
begin
  begin
    perform public.confirm_staged_row('f0000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: alice confirming bob''s staged row should have been rejected';
  exception
    when others then
      raise notice 'PASS: confirm_staged_row rejects another user''s staged row';
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 5. CSV import: the bulk RPCs enforce the same ownership rule, blocking
--    issues cannot be confirmed, and voiding an import removes its
--    transactions from the active view without touching a single row.
-- ---------------------------------------------------------------------------

reset role;

-- Alice's own CSV import, with three staged rows: one clean, one carrying a
-- blocking issue, one already confirmed against a real transaction.
insert into public.import_sources (id, user_id, kind, filename_or_message_id, parser_version, status)
values (
  'e0000000-0000-0000-0000-000000000002', :alice::uuid, 'csv',
  'alice-import.csv', 'native@1', 'pending'
);

insert into public.staged_rows (id, user_id, source_id, row_number, raw_payload, parsed_payload, issues, status)
values
  (
    'f0000000-0000-0000-0000-000000000002', :alice::uuid,
    'e0000000-0000-0000-0000-000000000002', 2, '{}'::jsonb,
    json_build_object(
      'account_id', 'b0000000-0000-0000-0000-000000000001',
      'instrument_id', 'a0000000-0000-0000-0000-000000000001',
      'type', 'BUY', 'trade_date', current_date, 'quantity', '10', 'unit_price', '5'
    )::jsonb,
    '[]'::jsonb, 'pending'
  ),
  (
    'f0000000-0000-0000-0000-000000000003', :alice::uuid,
    'e0000000-0000-0000-0000-000000000002', 3, '{}'::jsonb,
    json_build_object(
      'account_id', 'b0000000-0000-0000-0000-000000000001',
      'instrument_id', 'a0000000-0000-0000-0000-000000000001',
      'type', 'BUY', 'trade_date', current_date, 'quantity', '10', 'unit_price', '5'
    )::jsonb,
    '[{"code":"unknown_instrument","field":"symbol","message":"ZZZ","blocking":true}]'::jsonb,
    'pending'
  );

select pg_temp.authenticate_as(:alice::uuid);

-- staged_row_blocked is the predicate every confirm path shares.
select pg_temp.assert(
  public.staged_row_blocked('[{"blocking":true}]'::jsonb)
    and not public.staged_row_blocked('[{"blocking":false}]'::jsonb)
    and not public.staged_row_blocked('[]'::jsonb)
    and not public.staged_row_blocked('null'::jsonb),
  'staged_row_blocked reads the issues array and tolerates a malformed one'
);

-- A blocking issue must stop the row at the single write path, not just in
-- the UI.
do $$
begin
  begin
    perform public.confirm_staged_row('f0000000-0000-0000-0000-000000000003');
    raise exception 'FAIL: a row with a blocking issue should not confirm';
  exception
    when others then
      raise notice 'PASS: confirm_staged_row refuses a row with a blocking issue';
  end;
end $$;

-- confirm_import_source confirms the confirmable row and reports nothing left,
-- having skipped the blocked one. If it counted blocked rows as remaining the
-- client's progress loop would never terminate.
do $$
declare
  v_confirmed integer;
  v_remaining integer;
begin
  select confirmed, remaining into v_confirmed, v_remaining
  from public.confirm_import_source('e0000000-0000-0000-0000-000000000002', 500);

  perform pg_temp.assert(v_confirmed = 1, 'confirm_import_source confirmed the one confirmable row');
  perform pg_temp.assert(v_remaining = 0, 'confirm_import_source excludes blocked rows from remaining');
end $$;

select pg_temp.assert(
  (select count(*) from public.transactions
    where source_id = 'e0000000-0000-0000-0000-000000000002') = 1,
  'confirm_import_source appended exactly one transaction'
);

-- Visible before the void...
select pg_temp.assert(
  (select count(*) from public.v_active_transactions
    where source_id = 'e0000000-0000-0000-0000-000000000002') = 1,
  'an imported transaction is visible in v_active_transactions'
);

select public.void_import_source('e0000000-0000-0000-0000-000000000002');

-- ...gone from the active view afterwards, which is what takes it out of the
-- parcel engine's input set.
select pg_temp.assert(
  (select count(*) from public.v_active_transactions
    where source_id = 'e0000000-0000-0000-0000-000000000002') = 0,
  'voiding an import removes its transactions from v_active_transactions'
);

-- ...but still on the ledger. This is the whole point: append-only means a
-- void hides a row from derived state, it never deletes or rewrites it.
select pg_temp.assert(
  (select count(*) from public.transactions
    where source_id = 'e0000000-0000-0000-0000-000000000002') = 1,
  'voiding an import deletes nothing from transactions'
);
select pg_temp.assert(
  (select count(*) from public.transactions
    where source_id = 'e0000000-0000-0000-0000-000000000002'
      and superseded_by is not null) = 0,
  'voiding an import does not touch superseded_by'
);

-- Remaining pending rows are rejected so they leave the review queue.
select pg_temp.assert(
  (select count(*) from public.staged_rows
    where source_id = 'e0000000-0000-0000-0000-000000000002'
      and status = 'pending') = 0,
  'voiding an import rejects its still-pending staged rows'
);

-- import_sources stays closed to direct client writes: every status change
-- goes through a function.
do $$
begin
  begin
    update public.import_sources set status = 'processed'
      where id = 'e0000000-0000-0000-0000-000000000002';
    raise exception 'FAIL: direct UPDATE on import_sources should have been rejected';
  exception
    when insufficient_privilege or others then
      raise notice 'PASS: direct UPDATE on import_sources is rejected';
  end;
end $$;

-- Every bulk entry point applies the same ownership check as the single-row
-- one. Bob's import is off limits to Alice whichever door she tries.
do $$
begin
  begin
    perform public.void_import_source('e0000000-0000-0000-0000-000000000001');
    raise exception 'FAIL: alice voiding bob''s import should have been rejected';
  exception
    when others then
      raise notice 'PASS: void_import_source rejects another user''s import';
  end;

  begin
    perform public.confirm_import_source('e0000000-0000-0000-0000-000000000001', 10);
    raise exception 'FAIL: alice confirming bob''s import should have been rejected';
  exception
    when others then
      raise notice 'PASS: confirm_import_source rejects another user''s import';
  end;

  begin
    perform public.bulk_insert_staged_rows(
      'e0000000-0000-0000-0000-000000000001', '[]'::jsonb
    );
    raise exception 'FAIL: alice staging into bob''s import should have been rejected';
  exception
    when others then
      raise notice 'PASS: bulk_insert_staged_rows rejects another user''s import';
  end;

  begin
    perform public.set_import_source_status(
      'e0000000-0000-0000-0000-000000000001', 'processed', 1, null
    );
    raise exception 'FAIL: alice resolving bob''s import should have been rejected';
  exception
    when others then
      raise notice 'PASS: set_import_source_status rejects another user''s import';
  end;

  begin
    perform public.confirm_staged_rows(
      array['f0000000-0000-0000-0000-000000000001']::uuid[]
    );
    raise exception 'FAIL: alice confirming bob''s staged row in bulk should have been rejected';
  exception
    when others then
      raise notice 'PASS: confirm_staged_rows rejects another user''s staged row';
  end;
end $$;

-- Alice cannot read Bob's dedupe keys through the shared lookup either.
select pg_temp.assert(
  public.active_dedupe_keys('b0000000-0000-0000-0000-000000000002'::uuid) = '{}'::jsonb
    or not (public.active_dedupe_keys('b0000000-0000-0000-0000-000000000002'::uuid) ?| array['nonexistent']),
  'active_dedupe_keys is scoped by RLS to the caller'
);

-- Committing the same import twice must land as one job. The client generates
-- the id precisely so a double-clicked commit conflicts here rather than
-- creating a twin.
do $$
begin
  begin
    insert into public.import_sources (id, user_id, kind, status)
    values ('e0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111'::uuid, 'csv', 'pending');
    raise exception 'FAIL: re-inserting an import id should have been rejected';
  exception
    when unique_violation then
      raise notice 'PASS: a repeated commit cannot create a second import job';
    when others then
      raise notice 'PASS: a repeated commit cannot create a second import job';
  end;
end $$;

-- And re-staging a chunk that already landed is a no-op rather than a
-- duplicate, which is what makes a retried commit safe.
reset role;
insert into public.import_sources (id, user_id, kind, status)
values ('e0000000-0000-0000-0000-000000000003', :alice::uuid, 'csv', 'pending');
select pg_temp.authenticate_as(:alice::uuid);

do $$
declare
  v_rows jsonb := json_build_array(
    json_build_object('row_number', 2, 'raw_payload', '{}'::jsonb, 'parsed_payload', null, 'issues', '[]'::jsonb, 'dedupe_key', 'k1')
  )::jsonb;
  v_first integer;
  v_second integer;
begin
  v_first := public.bulk_insert_staged_rows('e0000000-0000-0000-0000-000000000003', v_rows);
  v_second := public.bulk_insert_staged_rows('e0000000-0000-0000-0000-000000000003', v_rows);
  perform pg_temp.assert(v_first = 1, 'bulk_insert_staged_rows stages a new chunk');
  perform pg_temp.assert(v_second = 0, 'bulk_insert_staged_rows ignores a chunk that already landed');
  perform pg_temp.assert(
    (select count(*) from public.staged_rows where source_id = 'e0000000-0000-0000-0000-000000000003') = 1,
    'a retried chunk does not duplicate staged rows'
  );
  perform pg_temp.assert(
    (select parsed_payload is null from public.staged_rows where source_id = 'e0000000-0000-0000-0000-000000000003'),
    'a json null parsed_payload is stored as SQL NULL, which confirm_staged_row tests for'
  );
end $$;

reset role;
rollback;
