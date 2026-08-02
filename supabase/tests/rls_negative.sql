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
select pg_temp.assert(
  (select count(*) from public.accounts) = 1,
  'alice sees exactly her own account'
);
select pg_temp.assert(
  (select count(*) from public.transactions where user_id = :bob::uuid) = 0,
  'alice cannot see bob''s transactions'
);
-- Sanity: reference data (not user-scoped) is visible to any authenticated
-- user, so this isn't a "nothing works" false pass.
select pg_temp.assert(
  (select count(*) from public.instruments) = 2,
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

-- A correction target for the superseded_by test below. superseded_by is a
-- real FK, so it has to point at an actual row; inserted as the owner since
-- this isn't the thing under test here.
reset role;
insert into public.transactions (
  id, user_id, account_id, instrument_id, type, trade_date, settlement_date,
  quantity, unit_price, brokerage, fees, currency, fx_rate_to_aud, source_id
) values (
  'd0000000-0000-0000-0000-000000000002', :alice::uuid,
  'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  'BUY', '2020-08-03', '2020-08-05', 80, 75.51, 19.95, 0, 'AUD', 1,
  'c0000000-0000-0000-0000-000000000001'
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

reset role;
rollback;
