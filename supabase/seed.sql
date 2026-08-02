-- Local dev seed: two users with overlapping instrument holdings, so the RLS
-- negative tests (see Makefile `db-test-rls` / plan Verification section)
-- have something real to try to leak across the tenant boundary.
--
-- Alice's data is deliberately dense enough to exercise every read path the
-- Flutter client hits: two accounts, a partially-depleted parcel (FIFO
-- SELL), a DRP, an entered distribution and a pending one, a foreign-currency
-- holding, and a superseded transaction. See CLAUDE.md for the domain rules
-- this stands in for.
--
-- auth.users / auth.identities are inserted directly, which is the standard
-- pattern for local-only seed data. Never do this against a hosted project.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'alice@example.com',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}'
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'bob@example.com',
    crypt('password123', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}'
  );

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values
  (
    gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '{"sub":"11111111-1111-1111-1111-111111111111","email":"alice@example.com"}',
    'email', now(), now(), now()
  ),
  (
    gen_random_uuid(), '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    '{"sub":"22222222-2222-2222-2222-222222222222","email":"bob@example.com"}',
    'email', now(), now(), now()
  );

-- Shared reference data.
insert into public.instruments (id, symbol, exchange, isin, name, kind, amit_flag) values
  ('a0000000-0000-0000-0000-000000000001', 'VAS', 'ASX', 'AU0000VAS001', 'Vanguard Australian Shares Index ETF', 'etf', true),
  ('a0000000-0000-0000-0000-000000000002', 'CBA', 'ASX', 'AU000000CBA7', 'Commonwealth Bank of Australia', 'share', false),
  ('a0000000-0000-0000-0000-000000000003', 'VOO', 'NYSEARCA', 'US9229083632', 'Vanguard S&P 500 ETF', 'etf', false);

-- All prices are the AUD closing price from the (hypothetical) EOD pricing
-- feed -- see CLAUDE.md "All amounts display in AUD". VOO's original
-- currency and the FX rate applied to its cost base come from the
-- transaction itself (currency, fx_rate_to_aud below), not from this table.
insert into public.instrument_prices (instrument_id, price_date, close, currency) values
  ('a0000000-0000-0000-0000-000000000001', current_date, 102.15, 'AUD'),
  ('a0000000-0000-0000-0000-000000000002', current_date, 172.40, 'AUD'),
  ('a0000000-0000-0000-0000-000000000003', current_date, 783.72, 'AUD');

-- ---------------------------------------------------------------------------
-- Alice: two accounts (a broker and a registry), so the same instrument
-- (VAS) can appear once per account and exercise the (instrument, account)
-- row grain the parcel engine itself uses.
-- ---------------------------------------------------------------------------

insert into public.accounts (id, user_id, kind, provider, display_name, base_currency) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'broker', 'commsec', 'CommSec 0421', 'AUD'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'registry', 'computershare', 'Computershare · SRN', 'AUD'),
  ('b0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'broker', 'stake', 'Stake US', 'USD');

insert into public.import_sources (id, user_id, kind, filename_or_message_id, status) values
  ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'manual', 'opening balance', 'processed'),
  ('c0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'csv', 'commsec-2024-fy.csv', 'processed'),
  ('c0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'email', 'vanguard-drp-mar-2026.eml', 'processed'),
  ('c0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
   'email', 'vanguard-jan-2026.eml', 'processed'),
  ('c0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
   'email', 'vanguard-jul-2025.eml', 'processed'),
  ('c0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111',
   'csv', 'stake-us-2024-fy.csv', 'processed'),
  ('c0000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111',
   'manual', 'corrected opening balance', 'processed');

insert into public.staged_rows (id, user_id, source_id, row_number, raw_payload, status) values
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'c0000000-0000-0000-0000-000000000002', 118, '{}'::jsonb, 'confirmed');

-- VAS at CommSec: opening BUY (120u), then a further BUY (80u), then a SELL
-- that partially depletes the older (opening) parcel via FIFO.
insert into public.transactions (
  id, user_id, account_id, instrument_id, type, trade_date, settlement_date,
  quantity, unit_price, brokerage, fees, currency, fx_rate_to_aud, source_id
) values
  (
    'd0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
    'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
    'BUY', '2019-11-14', '2019-11-16', 120, 68.45, 19.95, 0, 'AUD', 1,
    'c0000000-0000-0000-0000-000000000001'
  ),
  (
    'd0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
    'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
    'BUY', '2020-08-03', '2020-08-05', 80, 75.51, 19.95, 0, 'AUD', 1,
    'c0000000-0000-0000-0000-000000000001'
  ),
  (
    'd0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
    'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
    'SELL', '2024-05-02', '2024-05-04', 38, 96.55, 19.95, 0, 'AUD', 1,
    'c0000000-0000-0000-0000-000000000002'
  );

update public.staged_rows
  set transaction_id = 'd0000000-0000-0000-0000-000000000003'
  where id = 'e0000000-0000-0000-0000-000000000001';

-- VAS at Computershare (registry, DRP-only): a manual TRANSFER_IN carrying a
-- pre-existing cost base, then a DRP issue.
insert into public.transactions (
  id, user_id, account_id, instrument_id, type, trade_date, settlement_date,
  quantity, unit_price, brokerage, fees, currency, fx_rate_to_aud, source_id
) values
  (
    'd0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
    'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
    'TRANSFER_IN', '2021-06-21', '2021-06-23', 100, 91.02, 0, 0, 'AUD', 1,
    'c0000000-0000-0000-0000-000000000001'
  ),
  (
    'd0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
    'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
    'DRP', '2026-03-16', null, 48, 103.89, 0, 0, 'AUD', 1,
    'c0000000-0000-0000-0000-000000000003'
  );

-- Distributions on the Computershare VAS holding: one fully entered with
-- components (exercises v_income_summary's pivot), one still pending.
insert into public.transactions (
  id, user_id, account_id, instrument_id, type, trade_date, settlement_date,
  quantity, unit_price, brokerage, fees, currency, fx_rate_to_aud, source_id
) values
  (
    'd0000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111',
    'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
    'DISTRIBUTION', '2025-07-18', '2025-07-18', null, null, 0, 0, 'AUD', 1,
    'c0000000-0000-0000-0000-000000000005'
  ),
  (
    'd0000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111',
    'b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
    'DISTRIBUTION', '2026-01-19', '2026-01-19', null, null, 0, 0, 'AUD', 1,
    'c0000000-0000-0000-0000-000000000004'
  );

insert into public.income_events (
  id, user_id, transaction_id, instrument_id, account_id, record_date,
  payment_date, gross_amount, statement_ref, components_status
) values
  (
    'f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
    'd0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002', '2025-06-30', '2025-07-18',
    742.18, 'AMIT-2025-Q4', 'entered'
  ),
  (
    'f0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
    'd0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002', '2025-12-31', '2026-01-19',
    1842.36, null, 'pending'
  );

insert into public.income_components (user_id, income_event_id, component_type, amount) values
  ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', 'franked', 318.60),
  ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', 'unfranked', 104.22),
  ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-0000-0000-000000000001', 'franking_credit', 136.54);

-- CBA at CommSec: a plain open parcel, no distributions, so the holdings
-- table has a second row with nothing but a BUY behind it.
insert into public.transactions (
  id, user_id, account_id, instrument_id, type, trade_date, settlement_date,
  quantity, unit_price, brokerage, fees, currency, fx_rate_to_aud, source_id
) values (
  'd0000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111',
  'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
  'BUY', '2023-02-09', '2023-02-11', 65, 91.65, 19.95, 0, 'AUD', 1,
  'c0000000-0000-0000-0000-000000000001'
);

-- VOO at Stake US: USD-denominated, non-1 FX rate, so the client's FX
-- sub-line has something real to render. fx_rate_to_aud is the multiplier
-- that turns the native (USD) amount into AUD (see engine.ts
-- `totalNative.times(fxRate)`) -- i.e. AUD-per-USD, not the AUD/USD quote.
insert into public.transactions (
  id, user_id, account_id, instrument_id, type, trade_date, settlement_date,
  quantity, unit_price, brokerage, fees, currency, fx_rate_to_aud, source_id
) values (
  'd0000000-0000-0000-0000-000000000009', '11111111-1111-1111-1111-111111111111',
  'b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003',
  'BUY', '2023-09-12', '2023-09-14', 22, 452.10, 0, 9.99, 'USD', 1.5296,
  'c0000000-0000-0000-0000-000000000006'
);

-- A superseded correction: the CBA BUY above originally had the wrong
-- brokerage recorded, replayed and corrected. Proves v_active_transactions
-- filters superseded rows out.
insert into public.transactions (
  id, user_id, account_id, instrument_id, type, trade_date, settlement_date,
  quantity, unit_price, brokerage, fees, currency, fx_rate_to_aud, source_id
) values (
  'd0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
  'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
  'BUY', '2023-02-09', '2023-02-11', 65, 91.65, 29.95, 0, 'AUD', 1,
  'c0000000-0000-0000-0000-000000000007'
);

update public.transactions
  set superseded_by = 'd0000000-0000-0000-0000-00000000000a'
  where id = 'd0000000-0000-0000-0000-000000000008';

-- ---------------------------------------------------------------------------
-- Bob: kept separate on purpose -- no rows reference Alice's user_id
-- anywhere, so any leak the RLS tests find is a real policy bug.
-- ---------------------------------------------------------------------------

insert into public.accounts (id, user_id, kind, provider, display_name, base_currency) values
  ('b0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222',
   'broker', 'stake', 'Stake AU', 'AUD');
