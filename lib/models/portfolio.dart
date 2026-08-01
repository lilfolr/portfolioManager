/// A single share/ETF/fund holding, as shown on the Holdings screen.
class Holding {
  const Holding({
    required this.sym,
    required this.name,
    required this.units,
    required this.cost,
    required this.price,
    required this.source,
    this.sub,
  });

  final String sym;
  final String name;
  final int units;
  final double cost;
  final double price;
  final String source;

  /// Extra sub-line under the name, e.g. FX detail for USD-denominated
  /// holdings. Empty when not applicable.
  final String? sub;

  double get value => units * price;
  double get gain => value - cost;
  double get gainPct => gain / cost * 100;
  double get avgCost => cost / units;
}

/// A parcel (tax lot) within the currently viewed holding's detail screen.
class Parcel {
  const Parcel({
    required this.id,
    required this.date,
    required this.txn,
    required this.orig,
    required this.rem,
    required this.cost,
    required this.longTermEligible,
    required this.heldDate,
    required this.status,
    this.note,
  });

  final String id;
  final String date;
  final String txn;
  final int orig;
  final int rem;
  final double cost;
  final bool longTermEligible;
  final String heldDate;
  final String status;
  final String? note;

  double get perUnit => cost / rem;
  bool get partiallyDepleted => rem < orig;
}

/// A single immutable transaction record.
enum TxnKind { csv, email, manual }

class Txn {
  const Txn({
    required this.id,
    required this.date,
    required this.type,
    required this.units,
    required this.price,
    required this.amount,
    required this.kind,
    required this.source,
    required this.parcel,
  });

  final String id;
  final String date;
  final String type;
  final String units;
  final String price;
  final String amount;
  final TxnKind kind;
  final String source;
  final String parcel;
}

/// A distribution/income payment row.
class IncomeRow {
  const IncomeRow({
    required this.date,
    required this.type,
    required this.units,
    required this.franked,
    required this.unfranked,
    required this.frankingCredit,
    required this.cash,
    required this.componentStatement,
    this.pending = false,
  });

  final String date;
  final String type;
  final String units;
  final String franked;
  final String unfranked;
  final String frankingCredit;
  final String cash;
  final String componentStatement;
  final bool pending;
}
