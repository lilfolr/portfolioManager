import type { EngineResult } from '../domain/wire';
import { supabase } from './supabase';

/**
 * Thin wrappers over the Supabase client. Port of `lib/data/api.dart`: one
 * function per read, no caching or composition logic here -- that is
 * react-query (per query) and `repository.ts` (per view model), respectively.
 *
 * Every read hits PostgREST/edge functions as the signed-in user, so RLS --
 * not this file -- is the tenant boundary (see
 * `supabase/migrations/20260801000002_rls.sql`).
 *
 * Numeric columns arrive as strings: the views cast every `numeric` to `::text`
 * precisely so a client never parses money as a float. Nothing here converts
 * them; that is `repository.ts`'s job, via `decimalFromWire`.
 */

export type Row = Record<string, unknown>;

/** PostgREST errors are returned, not thrown; surface them as exceptions. */
function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('Supabase returned no data');
  return result.data;
}

export async function fetchAccounts(): Promise<Row[]> {
  return unwrap(
    await supabase
      .from('accounts')
      .select('id, kind, provider, display_name, base_currency'),
  );
}

export async function fetchInstruments(): Promise<Row[]> {
  return unwrap(
    await supabase
      .from('instruments')
      .select('id, symbol, exchange, isin, name, kind, amit_flag'),
  );
}

export async function fetchLatestPrices(): Promise<Row[]> {
  return unwrap(
    await supabase
      .from('v_latest_prices')
      .select('instrument_id, price_date, close, currency'),
  );
}

/**
 * All of the caller's active (non-superseded) transactions, optionally scoped
 * to one instrument. `source_id` is joined against `fetchImportSources` /
 * `fetchStagedRows` client-side in the repository (rather than a PostgREST
 * embed through the view) to avoid depending on relationship inference across
 * a view boundary.
 */
export async function fetchActiveTransactions(
  instrumentId?: string,
): Promise<Row[]> {
  // One literal, not a concatenation: supabase-js parses the select list at the
  // type level, and a `string`-typed argument makes it infer an error type.
  // prettier-ignore
  let query = supabase
    .from('v_active_transactions')
    .select('id, account_id, instrument_id, type, trade_date, quantity, unit_price, brokerage, fees, currency, fx_rate_to_aud, source_id');
  if (instrumentId) query = query.eq('instrument_id', instrumentId);
  return unwrap(await query.order('trade_date'));
}

/**
 * Import provenance for the caller's transactions -- kind (csv/email/manual)
 * and the originating filename or message id.
 */
export async function fetchImportSources(): Promise<Row[]> {
  return unwrap(
    await supabase.from('import_sources').select('id, kind, filename_or_message_id'),
  );
}

/** Confirmed staged rows, for the CSV row number a transaction came from. */
export async function fetchStagedRows(): Promise<Row[]> {
  return unwrap(
    await supabase
      .from('staged_rows')
      .select('source_id, row_number, transaction_id')
      .eq('status', 'confirmed'),
  );
}

export async function fetchIncomeSummary(instrumentId?: string): Promise<Row[]> {
  let query = supabase.from('v_income_summary').select();
  if (instrumentId) query = query.eq('instrument_id', instrumentId);
  return unwrap(await query.order('payment_date'));
}

/**
 * Calls the `parcels` edge function -- the one place the parcel engine runs
 * (CLAUDE.md: "no IO, no database access" in the engine itself, so a thin edge
 * function wraps it). Omitting `instrumentId` computes the caller's whole
 * portfolio in one call.
 *
 * The instrument filter goes in the function name rather than an options field
 * because supabase-js's `invoke()` takes only `{ body, headers, method }` --
 * it has no `queryParameters`, unlike supabase_flutter. It builds the request
 * as `new URL(`${functionsUrl}/${name}`)`, which preserves a query string, and
 * the function reads `url.searchParams.get('instrument_id')`. Concatenating
 * here keeps the backend untouched.
 */
export async function fetchParcelsAndDisposals(
  instrumentId?: string,
): Promise<EngineResult> {
  const name = instrumentId
    ? `parcels?instrument_id=${encodeURIComponent(instrumentId)}`
    : 'parcels';
  const { data, error } = await supabase.functions.invoke<EngineResult>(name, {
    method: 'GET',
  });
  if (error) throw error;
  if (!data) throw new Error('parcels function returned no body');
  return data;
}

/**
 * Creates a manual import_source + staged_row in one atomic RPC call. Returns
 * the staged_row UUID, which must be passed to `confirmStagedRow` to promote it
 * to an immutable transaction.
 */
export async function insertManualStagedRow(payload: Row): Promise<string> {
  const { data, error } = await supabase.rpc('insert_manual_staged_row', {
    p_payload: payload,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Promotes a pending staged_row onto the immutable transactions ledger.
 * Returns the created transaction row.
 */
export async function confirmStagedRow(stagedRowId: string): Promise<Row> {
  const { data, error } = await supabase.rpc('confirm_staged_row', {
    p_staged_row_id: stagedRowId,
  });
  if (error) throw error;
  return data as Row;
}
