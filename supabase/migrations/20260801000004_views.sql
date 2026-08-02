-- Views for simple derived reads. Anything that needs sequential state
-- (parcel balances, disposals, discount eligibility) belongs in the engine,
-- not here -- see supabase/functions/_shared/engine.
--
-- security_invoker = true on every view: without it, a view runs with the
-- privileges and RLS exposure of its owner (postgres), silently punching
-- through the RLS boundary these views sit on top of.
--
-- numeric/int columns are cast to text. PostgREST serialises `numeric` as an
-- unquoted JSON number, and Dart's jsonDecode turns that into a double --
-- silently losing precision on numeric(20,8) quantities and violating the
-- money rules at the client boundary. Casting here keeps the wire format a
-- string end to end.

create view public.v_active_transactions
  with (security_invoker = true) as
select
  id, user_id, account_id, instrument_id, type, trade_date, settlement_date,
  quantity::text as quantity,
  unit_price::text as unit_price,
  brokerage::text as brokerage,
  fees::text as fees,
  currency,
  fx_rate_to_aud::text as fx_rate_to_aud,
  financial_year, source_id, external_ref, created_at, superseded_by
from public.transactions
where superseded_by is null;

grant select on public.v_active_transactions to authenticated;

create view public.v_latest_prices
  with (security_invoker = true) as
select distinct on (instrument_id)
  instrument_id,
  price_date,
  close::text as close,
  currency
from public.instrument_prices
order by instrument_id, price_date desc;

grant select on public.v_latest_prices to authenticated;

-- Pivots income_components onto their income_event so the API can hand back
-- a single row per distribution/dividend, matching the shape the income tab
-- needs (franked/unfranked/franking credit/etc as columns).
create view public.v_income_summary
  with (security_invoker = true) as
select
  e.id as income_event_id,
  e.user_id,
  e.instrument_id,
  e.account_id,
  e.transaction_id,
  e.record_date,
  e.payment_date,
  e.financial_year,
  e.gross_amount::text as gross_amount,
  e.statement_ref,
  e.components_status,
  coalesce(sum(c.amount) filter (where c.component_type = 'franked'), 0)::text
    as franked,
  coalesce(sum(c.amount) filter (where c.component_type = 'unfranked'), 0)::text
    as unfranked,
  coalesce(sum(c.amount) filter (where c.component_type = 'foreign_income'), 0)::text
    as foreign_income,
  coalesce(sum(c.amount) filter (where c.component_type = 'foreign_tax_offset'), 0)::text
    as foreign_tax_offset,
  coalesce(sum(c.amount) filter (where c.component_type = 'discounted_capital_gain'), 0)::text
    as discounted_capital_gain,
  coalesce(sum(c.amount) filter (where c.component_type = 'non_discount_capital_gain'), 0)::text
    as non_discount_capital_gain,
  coalesce(sum(c.amount) filter (where c.component_type = 'tax_deferred'), 0)::text
    as tax_deferred,
  coalesce(sum(c.amount) filter (where c.component_type = 'cgt_concession'), 0)::text
    as cgt_concession,
  coalesce(sum(c.amount) filter (where c.component_type = 'amit_cost_base_increase'), 0)::text
    as amit_cost_base_increase
from public.income_events e
left join public.income_components c on c.income_event_id = e.id
group by e.id;

grant select on public.v_income_summary to authenticated;
