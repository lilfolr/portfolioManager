-- franked/unfranked cover the cash distribution amounts, but a distribution
-- statement also states the franking credit attached to the franked amount
-- as its own figure -- it isn't always a fixed 30% of the franked amount
-- (base-rate entities use a lower company tax rate), so it must come from
-- the statement like every other component, not be computed client-side.
-- CLAUDE.md: facts stated on the source document are recorded, not derived.

alter type public.component_type add value 'franking_credit';

