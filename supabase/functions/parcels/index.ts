// Thin edge function: authenticate the caller, fetch their active
// transactions (optionally scoped to one instrument via a query param), run
// the pure engine, return parcels + disposals. No business logic lives here
// -- see ../_shared/engine.
//
// Reachable at {FUNCTIONS_URL}/parcels[?instrument_id=...] once
// `supabase functions serve` is running (see Makefile `fn-serve`). Omitting
// instrument_id computes the caller's whole portfolio in one call --
// openParcelsFor in the engine already keys by instrumentId, so this is
// just a matter of not filtering the fetch.
//
// incomeComponents/recordDate and disposalMethod/specificParcelIds are not
// populated below (the select only pulls transaction columns), so two engine
// branches never fire for callers of this endpoint yet: tax-deferred
// distribution components never move reduced_cost_base away from cost_base,
// and every SELL is resolved FIFO. Wire income_components and a disposal
// method into the fetch + query params before this endpoint can back a
// specific-identification UI or the reduced-cost-base column.

import { createClient } from "npm:@supabase/supabase-js@2";
import { computeParcelsAndDisposals } from "../_shared/engine/engine.ts";
import type { Transaction } from "../_shared/engine/types.ts";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing Authorization header" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const instrumentId = url.searchParams.get("instrument_id");

  // Forwards the caller's JWT so PostgREST/RLS -- not this function --
  // decides which rows are visible. This function never uses the service
  // role; it has no more access than the calling user already has.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  let query = supabase
    .from("v_active_transactions")
    .select(
      "id, account_id, instrument_id, type, trade_date, quantity, unit_price, brokerage, fees, currency, fx_rate_to_aud, superseded_by",
    );
  if (instrumentId) {
    query = query.eq("instrument_id", instrumentId);
  }
  const { data, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const transactions: Transaction[] = (data ?? []).map((row) => ({
    id: row.id,
    accountId: row.account_id,
    instrumentId: row.instrument_id,
    type: row.type,
    tradeDate: row.trade_date,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    brokerage: row.brokerage,
    fees: row.fees,
    currency: row.currency,
    fxRateToAud: row.fx_rate_to_aud,
    supersededBy: row.superseded_by,
  }));

  try {
    const result = computeParcelsAndDisposals(transactions);
    return new Response(JSON.stringify(result), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 422, headers: { "content-type": "application/json" } },
    );
  }
});
