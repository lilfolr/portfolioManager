import 'package:decimal/decimal.dart';

/// Quantities and money are [Decimal] end to end -- see CLAUDE.md's money
/// rules and `20260801000004_views.sql`'s comment on why every numeric
/// column is cast to text on the wire: `double` silently loses precision on
/// `numeric(20,8)` quantities. `double` is used only inside `format.dart`,
/// at the point of turning a figure into display text.
Decimal _div(Decimal a, Decimal b) => b == Decimal.zero
    ? Decimal.zero
    : (a / b).toDecimal(scaleOnInfinitePrecision: 10);

/// A brokerage/registry/property/cash account, as returned by `accounts`.
class AccountRef {
  const AccountRef({
    required this.id,
    required this.kind,
    required this.displayName,
  });

  final String id;
  final String kind;
  final String displayName;
}

/// A single share/ETF/fund position, one row per (instrument, account) --
/// the grain the parcel engine itself uses (parcels are scoped by
/// instrumentId + accountId; see `engine.ts`).
class Holding {
  const Holding({
    required this.instrumentId,
    required this.accountId,
    required this.symbol,
    required this.name,
    required this.exchange,
    required this.units,
    required this.costBase,
    required this.price,
    required this.accountDisplayName,
    this.fxSubLine,
  });

  final String instrumentId;
  final String accountId;
  final String symbol;
  final String name;
  final String exchange;
  final Decimal units;
  final Decimal costBase;

  /// Latest close, AUD (see `instrument_prices` -- the pricing feed is
  /// assumed to publish an AUD-denominated close for every instrument).
  final Decimal price;
  final String accountDisplayName;

  /// Present only for holdings whose acquisitions were in a foreign
  /// currency; built from the transaction's own stored `fx_rate_to_aud`,
  /// never a looked-up rate (CLAUDE.md: "store the rate used on the
  /// transaction itself. Never look it up later").
  final String? fxSubLine;

  Decimal get value => units * price;
  Decimal get gain => value - costBase;
  Decimal get gainPct => _div(gain, costBase) * Decimal.fromInt(100);
  Decimal get avgCost => _div(costBase, units);
}

/// A parcel (tax lot), as computed by the parcel engine.
class Parcel {
  const Parcel({
    required this.id,
    required this.openTransactionId,
    required this.acquiredDate,
    required this.originalQuantity,
    required this.remainingQuantity,
    required this.costBase,
    required this.reducedCostBase,
  });

  final String id;
  final String openTransactionId;
  final DateTime acquiredDate;
  final Decimal originalQuantity;
  final Decimal remainingQuantity;
  final Decimal costBase;
  final Decimal reducedCostBase;

  Decimal get perUnit => _div(costBase, remainingQuantity);
  bool get partiallyDepleted =>
      remainingQuantity > Decimal.zero && remainingQuantity < originalQuantity;
  bool get fullyDepleted => remainingQuantity == Decimal.zero;

  /// Date the CGT discount's 12-month holding period is reached. A date
  /// fact, not a tax conclusion -- `discount_eligible` itself is computed
  /// at disposal, not stored on the parcel (CLAUDE.md; `engine.ts`'s
  /// `isDiscountEligible`).
  DateTime get twelveMonthDate =>
      DateTime.utc(acquiredDate.year + 1, acquiredDate.month, acquiredDate.day);
}

enum TxnKind { csv, email, manual }

/// A single immutable transaction record, from `v_active_transactions`
/// joined to its import provenance.
class Txn {
  const Txn({
    required this.id,
    required this.tradeDate,
    required this.type,
    required this.quantity,
    required this.unitPrice,
    required this.amount,
    required this.kind,
    required this.source,
    required this.parcelInfo,
  });

  final String id;
  final DateTime tradeDate;
  final String type;
  final Decimal? quantity;
  final Decimal? unitPrice;
  final Decimal? amount;
  final TxnKind kind;

  /// e.g. `commsec-2024-fy.csv · row 118` -- `import_sources` joined to
  /// `staged_rows.row_number` where present.
  final String source;

  /// e.g. `P-0002 · FIFO`, or `components pending` for an unconfirmed
  /// distribution. Built by the repository from the parcel-engine result
  /// (opens) and `disposals` (sells) -- never invented client-side.
  final String parcelInfo;
}

/// A distribution/dividend income row, from `v_income_summary`.
class IncomeRow {
  const IncomeRow({
    required this.paymentDate,
    required this.financialYear,
    required this.type,
    required this.franked,
    required this.unfranked,
    required this.frankingCredit,
    required this.cash,
    required this.componentStatement,
    required this.pending,
  });

  final DateTime paymentDate;
  final int financialYear;
  final String type;
  final Decimal franked;
  final Decimal unfranked;
  final Decimal frankingCredit;
  final Decimal cash;
  final String? componentStatement;
  final bool pending;

  /// Units held at record date is not available -- it would require
  /// replaying parcel state as of a past date, which no view currently
  /// exposes. Rendered as `—` rather than derived; see plan's
  /// column-to-source mapping.
  String get unitsDisplay => '—';
}
