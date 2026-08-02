-- Adds the franking_credit pivot column to v_income_summary. Split from
-- 0005's `alter type ... add value` into its own migration/transaction --
-- Postgres won't let a new enum value be used in the same transaction that
-- added it.
--
-- The new column is appended after amit_cost_base_increase rather than
-- alongside franked/unfranked where it reads naturally: `create or replace
-- view` only allows adding columns at the end of the select list, not
-- inserting one in the middle -- doing so shifts every later column's
-- position and Postgres rejects it as an implicit rename.

create or replace view public.v_income_summary
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
    as amit_cost_base_increase,
  coalesce(sum(c.amount) filter (where c.component_type::text = 'franking_credit'), 0)::text
    as franking_credit
from public.income_events e
left join public.income_components c on c.income_event_id = e.id
group by e.id;

grant select on public.v_income_summary to authenticated;
