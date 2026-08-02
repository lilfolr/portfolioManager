/// Composes the raw reads in `api.dart` into the view models the screens
/// need. Each public function here is meant to sit behind one `QueryBuilder`
/// (see fquery) -- no widget should call `api.dart` directly.
library;

import 'package:decimal/decimal.dart';

import '../models/portfolio.dart';
import 'api.dart';

/// Parses the top bar's `'FY 2025–26'` label into the integer financial year
/// convention CLAUDE.md defines (`2026` == FY2025-26, 1 Jul 2025-30 Jun 2026):
/// the label's first year + 1.
int financialYearFromLabel(String label) {
  final match = RegExp(r'(\d{4})').firstMatch(label);
  if (match == null) return DateTime.now().year;
  return int.parse(match.group(1)!) + 1;
}

Decimal _decimal(dynamic v) =>
    v == null ? Decimal.zero : Decimal.parse(v.toString());
Decimal? _decimalOrNull(dynamic v) =>
    v == null ? null : Decimal.parse(v.toString());
DateTime _date(dynamic v) => DateTime.parse(v as String);

class _Parcel {
  _Parcel({
    required this.id,
    required this.instrumentId,
    required this.accountId,
    required this.openTransactionId,
    required this.acquiredDate,
    required this.originalQuantity,
    required this.remainingQuantity,
    required this.costBase,
    required this.reducedCostBase,
    required this.costBaseNative,
    required this.currency,
  });

  factory _Parcel.fromJson(Map<String, dynamic> j) => _Parcel(
    id: j['id'] as String,
    instrumentId: j['instrumentId'] as String,
    accountId: j['accountId'] as String,
    openTransactionId: j['openTransactionId'] as String,
    acquiredDate: _date(j['acquiredDate']),
    originalQuantity: _decimal(j['originalQuantity']),
    remainingQuantity: _decimal(j['remainingQuantity']),
    costBase: _decimal(j['costBase']),
    reducedCostBase: _decimal(j['reducedCostBase']),
    costBaseNative: _decimalOrNull(j['costBaseNative']),
    currency: j['currency'] as String,
  );

  final String id;
  final String instrumentId;
  final String accountId;
  final String openTransactionId;
  final DateTime acquiredDate;
  final Decimal originalQuantity;
  final Decimal remainingQuantity;
  final Decimal costBase;
  final Decimal reducedCostBase;
  final Decimal? costBaseNative;
  final String currency;
}

class _Disposal {
  _Disposal({
    required this.sellTransactionId,
    required this.parcelId,
    required this.discountEligible,
  });

  factory _Disposal.fromJson(Map<String, dynamic> j) => _Disposal(
    sellTransactionId: j['sellTransactionId'] as String,
    parcelId: j['parcelId'] as String,
    discountEligible: j['discountEligible'] as bool,
  );

  final String sellTransactionId;
  final String parcelId;
  final bool discountEligible;
}

Future<(List<_Parcel>, List<_Disposal>)> _fetchEngineResult({
  String? instrumentId,
}) async {
  final json = await fetchParcelsAndDisposals(instrumentId: instrumentId);
  final parcels = (json['parcels'] as List)
      .map((p) => _Parcel.fromJson(p as Map<String, dynamic>))
      .toList();
  final disposals = (json['disposals'] as List)
      .map((d) => _Disposal.fromJson(d as Map<String, dynamic>))
      .toList();
  return (parcels, disposals);
}

/// The Holdings screen's rows: one per (instrument, account) with an open
/// (non-zero remaining quantity) parcel, grouped and summed.
Future<List<Holding>> fetchHoldings() async {
  final results = await Future.wait([
    _fetchEngineResult(),
    fetchInstruments(),
    fetchAccounts(),
    fetchLatestPrices(),
  ]);
  final (parcels, _) = results[0] as (List<_Parcel>, List<_Disposal>);
  final instruments = {
    for (final i in results[1] as List<Map<String, dynamic>>) i['id']: i,
  };
  final accounts = {
    for (final a in results[2] as List<Map<String, dynamic>>) a['id']: a,
  };
  final prices = {
    for (final p in results[3] as List<Map<String, dynamic>>)
      p['instrument_id']: p,
  };

  final groups = <String, List<_Parcel>>{};
  for (final p in parcels) {
    if (p.remainingQuantity <= Decimal.zero) continue;
    groups.putIfAbsent('${p.instrumentId}|${p.accountId}', () => []).add(p);
  }

  final holdings = <Holding>[];
  for (final entry in groups.entries) {
    final group = entry.value;
    final instrumentId = group.first.instrumentId;
    final accountId = group.first.accountId;
    final instrument = instruments[instrumentId];
    final account = accounts[accountId];
    if (instrument == null || account == null) continue;

    final units = group.fold<Decimal>(
      Decimal.zero,
      (s, p) => s + p.remainingQuantity,
    );
    final costBase = group.fold<Decimal>(
      Decimal.zero,
      (s, p) => s + p.costBase,
    );
    final price = _decimal(prices[instrumentId]?['close']);

    String? fxSubLine;
    final foreign = group.where((p) => p.currency != 'AUD').toList();
    if (foreign.isNotEmpty) {
      final nativeCost = foreign.fold<Decimal>(
        Decimal.zero,
        (s, p) => s + (p.costBaseNative ?? Decimal.zero),
      );
      final foreignAudCost = foreign.fold<Decimal>(
        Decimal.zero,
        (s, p) => s + p.costBase,
      );
      final foreignUnits = foreign.fold<Decimal>(
        Decimal.zero,
        (s, p) => s + p.remainingQuantity,
      );
      if (nativeCost > Decimal.zero && foreignUnits > Decimal.zero) {
        final avgNative = (nativeCost / foreignUnits).toDecimal(
          scaleOnInfinitePrecision: 4,
        );
        final fxRate = (foreignAudCost / nativeCost).toDecimal(
          scaleOnInfinitePrecision: 4,
        );
        fxSubLine =
            '${foreign.first.currency} $avgNative avg cost · '
            'FX $fxRate to AUD at trade date';
      }
    }

    holdings.add(
      Holding(
        instrumentId: instrumentId,
        accountId: accountId,
        symbol: instrument['symbol'] as String,
        name: instrument['name'] as String,
        exchange: instrument['exchange'] as String,
        units: units,
        costBase: costBase,
        price: price,
        accountDisplayName: account['display_name'] as String,
        fxSubLine: fxSubLine,
      ),
    );
  }

  holdings.sort((a, b) => b.value.compareTo(a.value));
  return holdings;
}

Future<List<AccountRef>> fetchAccountRefs() async {
  final rows = await fetchAccounts();
  return [
    for (final r in rows)
      AccountRef(
        id: r['id'] as String,
        kind: r['kind'] as String,
        displayName: r['display_name'] as String,
      ),
  ];
}

/// All open parcels for one (instrument, account), oldest first (FIFO
/// disposal order) -- the Holding Detail screen's Parcels tab.
Future<List<Parcel>> fetchParcelsFor({
  required String instrumentId,
  required String accountId,
}) async {
  final (parcels, _) = await _fetchEngineResult(instrumentId: instrumentId);
  final scoped = parcels.where((p) => p.accountId == accountId).toList()
    ..sort((a, b) => a.acquiredDate.compareTo(b.acquiredDate));
  return [
    for (final p in scoped)
      Parcel(
        id: p.id,
        openTransactionId: p.openTransactionId,
        acquiredDate: p.acquiredDate,
        originalQuantity: p.originalQuantity,
        remainingQuantity: p.remainingQuantity,
        costBase: p.costBase,
        reducedCostBase: p.reducedCostBase,
      ),
  ];
}

const _openTypes = {'BUY', 'DRP', 'TRANSFER_IN'};

/// Transactions for one (instrument, account), newest first, with
/// provenance and parcel linkage resolved -- the Transactions tab.
Future<List<Txn>> fetchTxnsFor({
  required String instrumentId,
  required String accountId,
}) async {
  final results = await Future.wait([
    fetchActiveTransactions(instrumentId: instrumentId),
    fetchImportSources(),
    fetchStagedRows(),
    _fetchEngineResult(instrumentId: instrumentId),
  ]);
  final txnRows = (results[0] as List<Map<String, dynamic>>)
      .where((t) => t['account_id'] == accountId)
      .toList();
  final sources = {
    for (final s in results[1] as List<Map<String, dynamic>>) s['id']: s,
  };
  final stagedBySourceAndTxn = <String, int>{};
  for (final s in results[2] as List<Map<String, dynamic>>) {
    final txnId = s['transaction_id'];
    if (txnId == null) continue;
    stagedBySourceAndTxn['$txnId'] = s['row_number'] as int? ?? 0;
  }
  final (_, disposals) = results[3] as (List<_Parcel>, List<_Disposal>);
  final disposalsBySell = <String, List<_Disposal>>{};
  for (final d in disposals) {
    disposalsBySell.putIfAbsent(d.sellTransactionId, () => []).add(d);
  }

  final txns = <Txn>[];
  for (final row in txnRows) {
    final type = row['type'] as String;
    final sourceId = row['source_id'] as String?;
    final importSource = sourceId != null ? sources[sourceId] : null;
    final kind = switch (importSource?['kind']) {
      'csv' => TxnKind.csv,
      'email' => TxnKind.email,
      _ => TxnKind.manual,
    };
    final rowNumber = stagedBySourceAndTxn[row['id']];
    final sourceLabel = importSource == null
        ? 'manual entry'
        : rowNumber != null
        ? '${importSource['filename_or_message_id']} · row $rowNumber'
        : (importSource['filename_or_message_id'] as String? ?? '—');

    String parcelInfo;
    if (_openTypes.contains(type)) {
      parcelInfo = 'P-${(row['id'] as String).substring(0, 8)}';
    } else if (type == 'SELL') {
      final ds = disposalsBySell[row['id']] ?? const <_Disposal>[];
      parcelInfo = ds.isEmpty
          ? '—'
          : '${ds.map((d) => 'P-${d.parcelId.substring(0, 8)}').join(', ')} · FIFO';
    } else if (type == 'DISTRIBUTION' || type == 'DIVIDEND') {
      parcelInfo = 'components pending';
    } else {
      parcelInfo = '—';
    }

    txns.add(
      Txn(
        id: row['id'] as String,
        tradeDate: _date(row['trade_date']),
        type: type,
        quantity: _decimalOrNull(row['quantity']),
        unitPrice: _decimalOrNull(row['unit_price']),
        amount: row['quantity'] != null && row['unit_price'] != null
            ? _decimal(row['quantity']) * _decimal(row['unit_price'])
            : null,
        kind: kind,
        source: sourceLabel,
        parcelInfo: parcelInfo,
      ),
    );
  }

  txns.sort((a, b) => b.tradeDate.compareTo(a.tradeDate));
  return txns;
}

/// Everything the Holdings screen needs, fetched together so the screen sits
/// behind a single `QueryBuilder`.
class HoldingsScreenData {
  HoldingsScreenData({
    required this.holdings,
    required this.accounts,
    required this.incomeTotal,
    required this.frankingCreditTotal,
    required this.transactionCount,
    required this.latestPriceDate,
  });

  final List<Holding> holdings;
  final List<AccountRef> accounts;
  final Decimal incomeTotal;
  final Decimal frankingCreditTotal;
  final int transactionCount;
  final DateTime? latestPriceDate;
}

Future<HoldingsScreenData> fetchHoldingsScreenData(int financialYear) async {
  final results = await Future.wait([
    fetchHoldings(),
    fetchAccountRefs(),
    fetchIncomeSummary(),
    fetchActiveTransactions(),
    fetchLatestPrices(),
  ]);
  final holdings = results[0] as List<Holding>;
  final accounts = results[1] as List<AccountRef>;
  final incomeRows = results[2] as List<Map<String, dynamic>>;
  final txnRows = results[3] as List<Map<String, dynamic>>;
  final priceRows = results[4] as List<Map<String, dynamic>>;

  var incomeTotal = Decimal.zero;
  var frankingTotal = Decimal.zero;
  for (final r in incomeRows) {
    if (r['financial_year'] == financialYear) {
      incomeTotal += _decimal(r['gross_amount']);
      frankingTotal += _decimal(r['franking_credit']);
    }
  }

  DateTime? latestPriceDate;
  for (final p in priceRows) {
    final d = _date(p['price_date']);
    if (latestPriceDate == null || d.isAfter(latestPriceDate)) {
      latestPriceDate = d;
    }
  }

  return HoldingsScreenData(
    holdings: holdings,
    accounts: accounts,
    incomeTotal: incomeTotal,
    frankingCreditTotal: frankingTotal,
    transactionCount: txnRows.length,
    latestPriceDate: latestPriceDate,
  );
}

/// Everything the Holding Detail screen needs for one (instrument, account),
/// fetched together so the screen sits behind a single `QueryBuilder`.
class HoldingDetailData {
  HoldingDetailData({
    required this.symbol,
    required this.name,
    required this.exchange,
    required this.amitFlag,
    required this.accountDisplayName,
    required this.accountKind,
    required this.units,
    required this.costBase,
    required this.price,
    required this.parcels,
    required this.txns,
    required this.income,
  });

  final String symbol;
  final String name;
  final String exchange;
  final bool amitFlag;
  final String accountDisplayName;
  final String accountKind;
  final Decimal units;
  final Decimal costBase;
  final Decimal price;
  final List<Parcel> parcels;
  final List<Txn> txns;
  final List<IncomeRow> income;

  Decimal get value => units * price;
  Decimal get gain => value - costBase;
}

Future<HoldingDetailData> fetchHoldingDetail({
  required String instrumentId,
  required String accountId,
}) async {
  final results = await Future.wait([
    fetchInstruments(),
    fetchAccounts(),
    fetchLatestPrices(),
    fetchParcelsFor(instrumentId: instrumentId, accountId: accountId),
    fetchTxnsFor(instrumentId: instrumentId, accountId: accountId),
    fetchIncomeFor(instrumentId: instrumentId, accountId: accountId),
  ]);
  final instrument = (results[0] as List<Map<String, dynamic>>).firstWhere(
    (i) => i['id'] == instrumentId,
    orElse: () => throw Exception('instrument $instrumentId not found'),
  );
  final account = (results[1] as List<Map<String, dynamic>>).firstWhere(
    (a) => a['id'] == accountId,
    orElse: () => throw Exception('account $accountId not found'),
  );
  final price = (results[2] as List<Map<String, dynamic>>).where(
    (p) => p['instrument_id'] == instrumentId,
  );
  final parcels = results[3] as List<Parcel>;
  final txns = results[4] as List<Txn>;
  final income = results[5] as List<IncomeRow>;

  final open = parcels.where((p) => !p.fullyDepleted);
  final units = open.fold<Decimal>(
    Decimal.zero,
    (s, p) => s + p.remainingQuantity,
  );
  final costBase = open.fold<Decimal>(Decimal.zero, (s, p) => s + p.costBase);

  return HoldingDetailData(
    symbol: instrument['symbol'] as String,
    name: instrument['name'] as String,
    exchange: instrument['exchange'] as String,
    amitFlag: instrument['amit_flag'] as bool,
    accountDisplayName: account['display_name'] as String,
    accountKind: account['kind'] as String,
    units: units,
    costBase: costBase,
    price: price.isEmpty ? Decimal.zero : _decimal(price.first['close']),
    parcels: parcels,
    txns: txns,
    income: income,
  );
}

/// Distributions/dividends for one (instrument, account) -- the Income tab.
/// `v_income_summary` isn't account-scoped by the view itself, so this
/// filters client-side on the `account_id` column it does carry.
Future<List<IncomeRow>> fetchIncomeFor({
  required String instrumentId,
  required String accountId,
}) async {
  final rows = await fetchIncomeSummary(instrumentId: instrumentId);
  return [
    for (final r in rows)
      if (r['account_id'] == accountId)
        IncomeRow(
          paymentDate: _date(r['payment_date']),
          financialYear: r['financial_year'] as int,
          type: 'Distribution',
          franked: _decimal(r['franked']),
          unfranked: _decimal(r['unfranked']),
          frankingCredit: _decimal(r['franking_credit']),
          cash: _decimal(r['gross_amount']),
          componentStatement: r['statement_ref'] as String?,
          pending: r['components_status'] == 'pending',
        ),
  ]..sort((a, b) => b.paymentDate.compareTo(a.paymentDate));
}

// ---------------------------------------------------------------------------
// Manual transaction entry
// ---------------------------------------------------------------------------

/// A single open parcel as presented to the transaction-entry SELL panel.
/// Derived from the parcel engine response; not stored separately.
class OpenParcel {
  const OpenParcel({
    required this.id,
    required this.acquiredDate,
    required this.available,
    required this.costPerUnit,
    required this.discountEligible,
  });

  final String id;
  final DateTime acquiredDate;

  /// Remaining units available to be matched against a SELL.
  final Decimal available;

  /// Cost base ÷ remaining quantity, AUD.
  final Decimal costPerUnit;

  /// True if the parcel has been held for more than 12 months as of today.
  final bool discountEligible;
}

/// Fetches open parcels (remaining_quantity > 0) for a given symbol and
/// account, sorted oldest-first for FIFO display. Returns an empty list if
/// the symbol is not found in the instruments table.
Future<List<OpenParcel>> fetchOpenParcels({
  required String symbol,
  required String accountId,
}) async {
  final instruments = await fetchInstruments();
  final matches = instruments
      .cast<Map<String, dynamic>>()
      .where((i) => (i['symbol'] as String).toUpperCase() == symbol.toUpperCase())
      .toList();
  if (matches.isEmpty) return [];

  final instrumentId = matches.first['id'] as String;
  final json = await fetchParcelsAndDisposals(instrumentId: instrumentId);
  final raw = (json['parcels'] as List? ?? []).cast<Map<String, dynamic>>();

  final now = DateTime.now().toUtc();
  final result = <OpenParcel>[];
  for (final p in raw) {
    if (p['accountId'] != accountId) continue;
    final remaining = _decimal(p['remainingQuantity']);
    if (remaining <= Decimal.zero) continue;
    final costBase = _decimal(p['costBase']);
    final perUnit = (costBase / remaining).toDecimal(scaleOnInfinitePrecision: 10);
    final acquired = _date(p['acquiredDate'] as String);
    final twelveMonths =
        DateTime.utc(acquired.year + 1, acquired.month, acquired.day);
    result.add(OpenParcel(
      id: p['id'] as String,
      acquiredDate: acquired,
      available: remaining,
      costPerUnit: perUnit,
      discountEligible: now.isAfter(twelveMonths),
    ));
  }
  result.sort((a, b) => a.acquiredDate.compareTo(b.acquiredDate));
  return result;
}

/// Atomic manual-entry save: stages the payload, then immediately confirms
/// it through confirm_staged_row(). Returns the confirmed transaction's UUID.
///
/// The payload must include at minimum the fields confirm_staged_row()
/// reads from parsed_payload: account_id, instrument_id, type, trade_date.
/// Optional numeric fields (quantity, unit_price, brokerage, fees,
/// currency, fx_rate_to_aud, external_ref) are passed through as-is.
Future<String> submitManualTransaction(Map<String, dynamic> payload) async {
  final stagedRowId = await insertManualStagedRow(payload);
  final txn = await confirmStagedRow(stagedRowId);
  return txn['id'] as String;
}
