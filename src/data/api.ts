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
function unwrap<T>(result: {
  data: T | null;
  error: { message: string } | null;
}): T {
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
    await supabase
      .from('import_sources')
      .select('id, kind, filename_or_message_id'),
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

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

/** Where a user's uploaded files live. The storage policies key tenancy off
 * the first path segment, so it must be the caller's uid. */
export function importObjectPath(
  userId: string,
  importId: string,
  filename: string,
): string {
  // Anything outside this set can produce a path segment the bucket treats
  // structurally (a slash) or that round-trips badly through a URL.
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
  return `${userId}/${importId}/${safe || 'import.csv'}`;
}

/** Uploads the raw file, which is what `import_sources.raw_blob_ref` will
 * point at. Retaining it is what makes a reprocess after a parser fix possible
 * without going back to the user (CLAUDE.md rule 6). */
export async function uploadImportFile(
  path: string,
  file: Blob,
): Promise<string> {
  const { error } = await supabase.storage
    .from('imports')
    .upload(path, file, { contentType: 'text/csv', upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

/** Cleans up an upload the user abandoned before committing. */
export async function removeImportFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from('imports').remove([path]);
  if (error) throw new Error(error.message);
}

export interface ImportRequest {
  importId: string;
  storagePath: string;
  filename: string;
  accountId: string;
  profileId?: string;
}

/**
 * Calls the `import-csv` edge function. `commit: false` parses and reports,
 * writing nothing; `commit: true` creates the import_source and its staged
 * rows.
 *
 * Parsing is server-side so the same code path can back registry email
 * ingestion later, and so the raw blob is always the thing that was parsed.
 */
async function invokeImport(
  request: ImportRequest,
  commit: boolean,
): Promise<Row> {
  const { data, error } = await supabase.functions.invoke<Row>('import-csv', {
    method: 'POST',
    body: { ...request, commit },
  });
  if (error) {
    // Edge function failures carry the useful part in the response body, not
    // in the FunctionsHttpError message ("Edge Function returned a non-2xx
    // status code"), so dig it out.
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      try {
        const body = (await context.json()) as { error?: string };
        if (body?.error) throw new Error(body.error);
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== '') {
          throw parseError;
        }
      }
    }
    throw error;
  }
  if (!data) throw new Error('import-csv returned no body');
  return data;
}

export const previewImport = (request: ImportRequest): Promise<Row> =>
  invokeImport(request, false);

export const commitImport = (request: ImportRequest): Promise<Row> =>
  invokeImport(request, true);

/** Every import job with its staged-row tally, newest first. */
export async function fetchImportJobs(): Promise<Row[]> {
  // prettier-ignore
  return unwrap(
    await supabase
      .from('v_import_jobs')
      .select('id, kind, filename_or_message_id, imported_at, status, parser_version, raw_blob_ref, content_hash, row_count, error_message, staged_total, staged_pending, staged_confirmed, staged_rejected, staged_blocked, staged_with_issues')
      .order('imported_at', { ascending: false }),
  );
}

/**
 * Staged rows for the review queue, paginated -- PostgREST caps a response at
 * `max_rows` (1000, see supabase/config.toml), so an import larger than that
 * has to be walked rather than fetched whole.
 */
export async function fetchStagedRowsForReview(args: {
  sourceId?: string;
  status?: string;
  from: number;
  to: number;
}): Promise<Row[]> {
  // prettier-ignore
  let query = supabase
    .from('staged_rows')
    .select('id, source_id, row_number, raw_payload, parsed_payload, issues, dedupe_key, status, transaction_id');
  if (args.sourceId) query = query.eq('source_id', args.sourceId);
  if (args.status) query = query.eq('status', args.status);
  return unwrap(await query.order('row_number').range(args.from, args.to));
}

/** Confirms a hand-picked selection. All-or-nothing: these are rows a person
 * ticked one at a time, so a partial success is worse than a clean failure. */
export async function confirmStagedRows(ids: string[]): Promise<Row[]> {
  const { data, error } = await supabase.rpc('confirm_staged_rows', {
    p_ids: ids,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

/**
 * Confirms up to `limit` still-pending rows of one import and reports how many
 * remain.
 *
 * Takes a source id rather than a list so confirming a 10,000-row import does
 * not put 10,000 UUIDs on the wire. Batched so the caller can drive a real
 * progress indicator and so each call stays inside the statement timeout.
 */
export async function confirmImportSource(
  sourceId: string,
  limit = 500,
): Promise<{ confirmed: number; remaining: number }> {
  const { data, error } = await supabase.rpc('confirm_import_source', {
    p_source_id: sourceId,
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  const row = (data as Row[] | null)?.[0];
  return {
    confirmed: Number(row?.confirmed ?? 0),
    remaining: Number(row?.remaining ?? 0),
  };
}

/** Rejecting is a status flip the RLS policy allows directly (see
 * `staged_rows_reject`); only confirming needs the RPC. */
export async function rejectStagedRows(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from('staged_rows')
    .update({ status: 'rejected' })
    .in('id', ids)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
}

/** Rejects every pending row of one import without listing their ids. */
export async function rejectImportSource(sourceId: string): Promise<void> {
  const { error } = await supabase
    .from('staged_rows')
    .update({ status: 'rejected' })
    .eq('source_id', sourceId)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
}

/**
 * Discards a whole import. Nothing is deleted: the job is marked voided, which
 * drops its transactions out of `v_active_transactions` and therefore out of
 * the parcel engine's input set, while the rows themselves stay in
 * `transactions` as the record of what happened.
 */
export async function voidImportSource(sourceId: string): Promise<void> {
  const { error } = await supabase.rpc('void_import_source', {
    p_source_id: sourceId,
  });
  if (error) throw new Error(error.message);
}

export async function fetchIncomeSummary(
  instrumentId?: string,
): Promise<Row[]> {
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
