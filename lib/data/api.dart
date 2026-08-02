/// Thin wrappers over `Supabase.instance.client`. One function per read, no
/// caching or composition logic here -- that's `fquery` (per query) and
/// `portfolio_repository.dart` (per view model), respectively. Every read
/// hits PostgREST/edge functions as the signed-in user, so RLS -- not this
/// file -- is the tenant boundary (see `supabase/migrations/0002_rls.sql`).
library;

import 'package:supabase_flutter/supabase_flutter.dart';

SupabaseClient get _client => Supabase.instance.client;

Future<List<Map<String, dynamic>>> fetchAccounts() async {
  final rows = await _client
      .from('accounts')
      .select('id, kind, provider, display_name, base_currency');
  return List<Map<String, dynamic>>.from(rows as List);
}

Future<List<Map<String, dynamic>>> fetchInstruments() async {
  final rows = await _client
      .from('instruments')
      .select('id, symbol, exchange, isin, name, kind, amit_flag');
  return List<Map<String, dynamic>>.from(rows as List);
}

Future<List<Map<String, dynamic>>> fetchLatestPrices() async {
  final rows = await _client
      .from('v_latest_prices')
      .select('instrument_id, price_date, close, currency');
  return List<Map<String, dynamic>>.from(rows as List);
}

/// All of the caller's active (non-superseded) transactions, optionally
/// scoped to one instrument. `source_id` is joined against
/// [fetchImportSources]/[fetchStagedRows] client-side in the repository
/// (rather than a PostgREST embed through the view) to avoid depending on
/// relationship inference across a view boundary.
Future<List<Map<String, dynamic>>> fetchActiveTransactions({
  String? instrumentId,
}) async {
  var query = _client
      .from('v_active_transactions')
      .select(
        'id, account_id, instrument_id, type, trade_date, quantity, unit_price, '
        'brokerage, fees, currency, fx_rate_to_aud, source_id',
      );
  if (instrumentId != null) {
    query = query.eq('instrument_id', instrumentId);
  }
  final rows = await query.order('trade_date');
  return List<Map<String, dynamic>>.from(rows as List);
}

/// Import provenance for the caller's transactions -- kind (csv/email/manual)
/// and the originating filename or message id.
Future<List<Map<String, dynamic>>> fetchImportSources() async {
  final rows = await _client
      .from('import_sources')
      .select('id, kind, filename_or_message_id');
  return List<Map<String, dynamic>>.from(rows as List);
}

/// Confirmed staged rows, for the CSV row number a transaction came from.
Future<List<Map<String, dynamic>>> fetchStagedRows() async {
  final rows = await _client
      .from('staged_rows')
      .select('source_id, row_number, transaction_id')
      .eq('status', 'confirmed');
  return List<Map<String, dynamic>>.from(rows as List);
}

Future<List<Map<String, dynamic>>> fetchIncomeSummary({
  String? instrumentId,
}) async {
  var query = _client.from('v_income_summary').select();
  if (instrumentId != null) {
    query = query.eq('instrument_id', instrumentId);
  }
  final rows = await query.order('payment_date');
  return List<Map<String, dynamic>>.from(rows as List);
}

/// Calls the `parcels` edge function -- the one place the parcel engine
/// runs (CLAUDE.md: "no IO, no database access" in the engine itself, so a
/// thin edge function wraps it). Omitting [instrumentId] computes the
/// caller's whole portfolio in one call.
Future<Map<String, dynamic>> fetchParcelsAndDisposals({
  String? instrumentId,
}) async {
  // A non-2xx response throws FunctionException (functions_client), so
  // reaching here means `data` is the decoded `{parcels, disposals}` body.
  final res = await _client.functions.invoke(
    'parcels',
    queryParameters: instrumentId != null
        ? {'instrument_id': instrumentId}
        : null,
  );
  return Map<String, dynamic>.from(res.data as Map);
}

/// Creates a manual import_source + staged_row in one atomic RPC call.
/// Returns the staged_row UUID, which must be passed to [confirmStagedRow]
/// to promote it to an immutable transaction.
Future<String> insertManualStagedRow(Map<String, dynamic> payload) async {
  final result = await _client.rpc(
    'insert_manual_staged_row',
    params: {'p_payload': payload},
  );
  return result as String;
}

/// Promotes a pending staged_row onto the immutable transactions ledger.
/// Returns the created transaction row as a raw map.
Future<Map<String, dynamic>> confirmStagedRow(String stagedRowId) async {
  final result = await _client.rpc(
    'confirm_staged_row',
    params: {'p_staged_row_id': stagedRowId},
  );
  return Map<String, dynamic>.from(result as Map);
}
