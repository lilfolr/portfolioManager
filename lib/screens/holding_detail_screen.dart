import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';

import '../data/portfolio_repository.dart';
import '../format.dart';
import '../models/portfolio.dart';
import '../theme/ledger_theme.dart';
import '../widgets/source_chip.dart';

enum _Tab { parcels, txns, inc }

/// The holding-detail screen: header, key figures, and three tabs
/// (Parcels / Transactions / Income) for one (instrument, account) pair,
/// selected from the Holdings table.
class HoldingDetailScreen extends StatefulWidget {
  const HoldingDetailScreen({
    super.key,
    required this.fy,
    required this.wide,
    required this.horizontalPadding,
    required this.instrumentId,
    required this.accountId,
    required this.symbol,
    required this.onBack,
    required this.onAddTransaction,
    this.fetchData = fetchHoldingDetail,
  });

  final String fy;
  final bool wide;
  final double horizontalPadding;
  final String? instrumentId;
  final String? accountId;
  final String? symbol;
  final VoidCallback onBack;
  final VoidCallback onAddTransaction;

  /// Overridable for tests, which can't reach a live Supabase instance --
  /// defaults to the real repository read.
  final Future<HoldingDetailData> Function({
    required String instrumentId,
    required String accountId,
  })
  fetchData;

  @override
  State<HoldingDetailScreen> createState() => _HoldingDetailScreenState();
}

class _HoldingDetailScreenState extends State<HoldingDetailScreen> {
  _Tab _tab = _Tab.parcels;
  Future<HoldingDetailData>? _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(HoldingDetailScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.instrumentId != widget.instrumentId ||
        oldWidget.accountId != widget.accountId) {
      _load();
    }
  }

  // A plain Future/FutureBuilder, not fquery's QueryBuilder: this screen's
  // Future is created fresh in a rebuild triggered from a DIFFERENT widget
  // (tapping a Holdings row), so this QueryBuilder mounts here for the
  // first time as a direct consequence of that ancestor's setState. fquery's
  // observer calls setState synchronously from its own didChangeDependencies
  // in that situation, which Flutter rejects ("framework is locked") because
  // the newly-mounting element isn't yet in the active build's scope.
  // FutureBuilder sets its state from a .then() callback -- always a later
  // microtask, never synchronously during mount -- so the hazard doesn't
  // arise. HoldingsScreen doesn't have this problem: its QueryBuilder mounts
  // once, at the app root, in the one buildScope call that's always safe.
  void _load() {
    final instrumentId = widget.instrumentId;
    final accountId = widget.accountId;
    _future = instrumentId == null || accountId == null
        ? null
        : widget.fetchData(instrumentId: instrumentId, accountId: accountId);
  }

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);

    if (widget.instrumentId == null || widget.accountId == null) {
      return Padding(
        padding: EdgeInsets.all(widget.horizontalPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GestureDetector(
              onTap: widget.onBack,
              child: Text(
                '‹ Holdings',
                style: LedgerText.mono(
                  size: 11.5,
                  color: c.textMuted,
                  tabular: false,
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'Select a holding from the Holdings table to see its detail.',
              style: LedgerText.sans(size: 13, color: c.textMuted),
            ),
          ],
        ),
      );
    }

    return FutureBuilder<HoldingDetailData>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(48),
              child: CircularProgressIndicator(),
            ),
          );
        }
        if (snapshot.hasError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(48),
              child: Text('Could not load this holding: ${snapshot.error}'),
            ),
          );
        }
        return _DetailBody(
          data: snapshot.data!,
          fy: widget.fy,
          wide: widget.wide,
          hPad: widget.horizontalPadding,
          tab: _tab,
          onTabChanged: (t) => setState(() => _tab = t),
          onBack: widget.onBack,
          onAddTransaction: widget.onAddTransaction,
        );
      },
    );
  }
}

class _DetailBody extends StatelessWidget {
  const _DetailBody({
    required this.data,
    required this.fy,
    required this.wide,
    required this.hPad,
    required this.tab,
    required this.onTabChanged,
    required this.onBack,
    required this.onAddTransaction,
  });

  final HoldingDetailData data;
  final String fy;
  final bool wide;
  final double hPad;
  final _Tab tab;
  final ValueChanged<_Tab> onTabChanged;
  final VoidCallback onBack;
  final VoidCallback onAddTransaction;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    final posColor = c.positive;
    final negColor = c.negative;
    final gain = data.gain;
    final gainPct = data.costBase == Decimal.zero
        ? Decimal.zero
        : (gain / data.costBase).toDecimal(scaleOnInfinitePrecision: 6) *
              Decimal.fromInt(100);
    final financialYear = financialYearFromLabel(fy);
    final incomeForFy = data.income
        .where((i) => i.financialYear == financialYear)
        .fold<Decimal>(Decimal.zero, (s, i) => s + i.cash);
    final pendingCount = data.income.where((i) => i.pending).length;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(hPad, 20, hPad, 0),
            child: GestureDetector(
              onTap: onBack,
              child: Text(
                '‹ Holdings',
                style: LedgerText.mono(
                  size: 11.5,
                  color: c.textMuted,
                  tabular: false,
                ),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(hPad, 12, hPad, 18),
            child: Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.start,
              spacing: 20,
              runSpacing: 12,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 12,
                      children: [
                        Text(
                          data.symbol,
                          style: LedgerText.mono(
                            size: 24,
                            weight: FontWeight.w500,
                            letterSpacing: -0.24,
                            color: c.textStrong,
                          ),
                        ),
                        Text(
                          data.name,
                          style: LedgerText.sans(size: 15, color: c.textStrong),
                        ),
                      ],
                    ),
                    const SizedBox(height: 9),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        PlainTag(label: data.exchange),
                        if (data.amitFlag)
                          const PlainTag(label: 'Unit trust · AMIT'),
                        SourceDotChip(
                          label: data.accountDisplayName,
                          dotColor: c.sourceDot(data.accountDisplayName),
                        ),
                      ],
                    ),
                  ],
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _btn(c, 'Export parcels'),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: onAddTransaction,
                      child: _btn(c, 'Add transaction', primary: true),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(hPad, 0, hPad, 18),
            child: Wrap(
              spacing: wide ? 38 : 18,
              runSpacing: 14,
              children: [
                _key(c, 'UNITS', quantity(data.units)),
                _key(c, 'COST BASE', moneyD(data.costBase)),
                _key(
                  c,
                  'AVG COST',
                  data.units == Decimal.zero
                      ? '—'
                      : moneyD(
                          (data.costBase / data.units).toDecimal(
                            scaleOnInfinitePrecision: 6,
                          ),
                        ),
                ),
                _key(c, 'MARKET VALUE', moneyD(data.value)),
                _key(
                  c,
                  'UNREALISED',
                  signedMoneyD(gain),
                  trailing: signedPctD(gainPct),
                  color: gain >= Decimal.zero ? posColor : negColor,
                ),
                _key(c, 'INCOME · $fy', moneyD(incomeForFy)),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: hPad),
            child: Row(
              children: [
                _tabBtn(c, 'Parcels', '${data.parcels.length}', _Tab.parcels),
                _tabBtn(c, 'Transactions', '${data.txns.length}', _Tab.txns),
                _tabBtn(c, 'Income', '${data.income.length}', _Tab.inc),
              ],
            ),
          ),
          Container(height: 1, color: c.borderSidebar),
          switch (tab) {
            _Tab.parcels => _ParcelsTab(hPad: hPad, parcels: data.parcels),
            _Tab.txns => _TxnsTab(hPad: hPad, txns: data.txns),
            _Tab.inc => _IncomeTab(
              hPad: hPad,
              fy: fy,
              income: data.income,
              pendingCount: pendingCount,
            ),
          },
        ],
      ),
    );
  }

  Widget _key(
    LedgerPalette c,
    String label,
    String value, {
    String? trailing,
    Color? color,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: LedgerText.eyebrow(color: c.textFaint)),
        const SizedBox(height: 7),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value,
                style: LedgerText.mono(size: 18, color: color ?? c.ink),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 7),
                Text(
                  trailing,
                  style: LedgerText.mono(
                    size: 11.5,
                    color: color ?? c.ink,
                    tabular: false,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _btn(LedgerPalette c, String label, {bool primary = false}) {
    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 13),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: primary ? c.ink : c.surfaceCard,
        border: Border.all(color: primary ? c.ink : c.borderButton),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        label,
        style: LedgerText.sans(
          size: 12.5,
          weight: primary ? FontWeight.w500 : FontWeight.w400,
          color: primary ? c.surfacePage : c.textStrong,
        ),
      ),
    );
  }

  Widget _tabBtn(LedgerPalette c, String label, String count, _Tab t) {
    final active = tab == t;
    return GestureDetector(
      onTap: () => onTabChanged(t),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          border: active
              ? Border(bottom: BorderSide(color: c.ink, width: 2))
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: LedgerText.sans(
                size: 13,
                color: active ? c.ink : c.textMuted,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              count,
              style: LedgerText.mono(
                size: 11,
                color: c.textFaint,
                tabular: false,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ParcelsTab extends StatelessWidget {
  const _ParcelsTab({required this.hPad, required this.parcels});
  final double hPad;
  final List<Parcel> parcels;

  static const _widths = [
    88.0,
    108.0,
    96.0,
    78.0,
    84.0,
    118.0,
    96.0,
    136.0,
    130.0,
  ];

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    final now = DateTime.now().toUtc();
    final totalOrig = parcels.fold<Decimal>(
      Decimal.zero,
      (s, p) => s + p.originalQuantity,
    );
    final totalRem = parcels.fold<Decimal>(
      Decimal.zero,
      (s, p) => s + p.remainingQuantity,
    );
    final totalCost = parcels.fold<Decimal>(
      Decimal.zero,
      (s, p) => s + p.costBase,
    );
    final avgCost = totalRem == Decimal.zero
        ? Decimal.zero
        : (totalCost / totalRem).toDecimal(scaleOnInfinitePrecision: 6);
    final eligibleUnits = parcels
        .where((p) => now.isAfter(p.twelveMonthDate))
        .fold<Decimal>(Decimal.zero, (s, p) => s + p.remainingQuantity);
    final pendingUnits = totalRem - eligibleUnits;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(hPad, 18, hPad, 0),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: c.surfaceInfoBox,
              border: Border.all(color: c.borderInfoBox),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 14,
                  height: 14,
                  margin: const EdgeInsets.only(top: 1),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: c.link, width: 1.5),
                  ),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Text(
                    'Parcels are derived from transactions and are read-only. To change a parcel, edit or reverse the transaction it came from — the parcel recalculates.',
                    style: LedgerText.sans(
                      size: 12,
                      height: 1.55,
                      color: c.textStrong,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),
        if (parcels.isEmpty)
          Padding(
            padding: EdgeInsets.symmetric(horizontal: hPad),
            child: Text(
              'No parcels yet for this holding.',
              style: LedgerText.sans(size: 13, color: c.textMuted),
            ),
          )
        else
          _horizontalTable(
            c: c,
            header: [
              'PARCEL',
              'ACQUIRED',
              'FROM TXN',
              'ORIG',
              'REMAIN',
              'COST BASE',
              'PER UNIT',
              '12-MONTH STATUS',
              'PARCEL STATE',
            ],
            rightAlign: const [
              false,
              false,
              false,
              true,
              true,
              true,
              true,
              false,
              false,
            ],
            rows: [
              for (final p in parcels)
                [
                  Text(
                    'P-${p.id.substring(0, 8)}',
                    style: LedgerText.mono(size: 12, color: c.textMid),
                  ),
                  Text(
                    _fmtDate(p.acquiredDate),
                    style: LedgerText.mono(size: 12.5, color: c.textStrong),
                  ),
                  Text(
                    'T-${p.openTransactionId.substring(0, 8)}',
                    style: LedgerText.mono(size: 12, color: c.link),
                  ),
                  Text(
                    quantity(p.originalQuantity),
                    style: LedgerText.mono(size: 12.5, color: c.textMuted),
                  ),
                  Text(
                    quantity(p.remainingQuantity),
                    style: LedgerText.mono(size: 12.5, color: c.textStrong),
                  ),
                  Text(
                    moneyD(p.costBase),
                    style: LedgerText.mono(size: 12.5, color: c.textStrong),
                  ),
                  Text(
                    p.remainingQuantity == Decimal.zero
                        ? '—'
                        : moneyD(p.perUnit),
                    style: LedgerText.mono(size: 12.5, color: c.textMid),
                  ),
                  HeldStatusPill(
                    eligible: now.isAfter(p.twelveMonthDate),
                    heldDate:
                        '${now.isAfter(p.twelveMonthDate) ? 'since' : 'from'} ${_fmtDate(p.twelveMonthDate)}',
                  ),
                  Text(
                    p.fullyDepleted
                        ? 'Fully depleted'
                        : p.partiallyDepleted
                        ? 'Partially depleted'
                        : 'Open',
                    style: LedgerText.sans(
                      size: 11.5,
                      height: 1.4,
                      color: c.textStrong,
                    ),
                  ),
                ],
            ],
            rowBg: [
              for (final p in parcels)
                p.partiallyDepleted ? c.surfaceParcelTint : c.surfaceCard,
            ],
            widths: _widths,
            hPad: hPad,
            footer: [
              'TOTAL',
              '',
              '',
              quantity(totalOrig),
              quantity(totalRem),
              moneyD(totalCost),
              moneyD(avgCost),
              '${quantity(eligibleUnits)} eligible',
              '${quantity(pendingUnits)} pending',
            ],
          ),
        Padding(
          padding: EdgeInsets.fromLTRB(hPad, 16, hPad, 26),
          child: Text(
            'Cost base is pro-rated on partial disposal, not re-averaged. CGT discount is not applied on this screen -- see CLAUDE.md: eligibility is computed at disposal, not stored on the open parcel.',
            style: LedgerText.mono(
              size: 11,
              color: c.textFaint,
              height: 1.6,
              tabular: false,
            ),
          ),
        ),
      ],
    );
  }
}

class _TxnsTab extends StatelessWidget {
  const _TxnsTab({required this.hPad, required this.txns});
  final double hPad;
  final List<Txn> txns;

  static const _widths = [88.0, 108.0, 118.0, 76.0, 92.0, 116.0, 300.0, 116.0];

  Color _kindColor(LedgerPalette c, TxnKind k) {
    switch (k) {
      case TxnKind.csv:
        return c.link;
      case TxnKind.email:
        return c.pendingText;
      case TxnKind.manual:
        return c.textMid;
    }
  }

  String _kindLabel(TxnKind k) => switch (k) {
    TxnKind.csv => 'CSV',
    TxnKind.email => 'EMAIL',
    TxnKind.manual => 'MANUAL',
  };

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    final csvCount = txns.where((t) => t.kind == TxnKind.csv).length;
    final emailCount = txns.where((t) => t.kind == TxnKind.email).length;
    final manualCount = txns.where((t) => t.kind == TxnKind.manual).length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(hPad, 16, hPad, 14),
          child: Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 14,
            runSpacing: 10,
            children: [
              Text(
                'Immutable records. A correction is entered as a reversing transaction — nothing is overwritten.',
                style: LedgerText.sans(size: 12, color: c.textMid),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SourceDotChip(
                    label: 'CSV $csvCount',
                    dotColor: c.link,
                    dense: true,
                  ),
                  const SizedBox(width: 6),
                  SourceDotChip(
                    label: 'Email $emailCount',
                    dotColor: c.pendingText,
                    dense: true,
                  ),
                  const SizedBox(width: 6),
                  SourceDotChip(
                    label: 'Manual $manualCount',
                    dotColor: c.textFaint,
                    dense: true,
                  ),
                ],
              ),
            ],
          ),
        ),
        if (txns.isEmpty)
          Padding(
            padding: EdgeInsets.symmetric(horizontal: hPad),
            child: Text(
              'No transactions yet for this holding.',
              style: LedgerText.sans(size: 13, color: c.textMuted),
            ),
          )
        else
          _horizontalTable(
            c: c,
            header: [
              'TXN',
              'DATE',
              'TYPE',
              'UNITS',
              'PRICE',
              'AMOUNT',
              'PROVENANCE',
              'PARCEL',
            ],
            rightAlign: const [
              false,
              false,
              false,
              true,
              true,
              true,
              false,
              false,
            ],
            rows: [
              for (final t in txns)
                [
                  Text(
                    'T-${t.id.substring(0, 8)}',
                    style: LedgerText.mono(size: 12, color: c.link),
                  ),
                  Text(
                    _fmtDate(t.tradeDate),
                    style: LedgerText.mono(size: 12.5, color: c.textStrong),
                  ),
                  Text(
                    t.type,
                    style: LedgerText.sans(size: 12, color: c.textStrong),
                  ),
                  Text(
                    t.quantity == null ? '—' : quantity(t.quantity!),
                    style: LedgerText.mono(size: 12.5, color: c.textStrong),
                  ),
                  Text(
                    t.unitPrice == null ? '—' : moneyD(t.unitPrice!),
                    style: LedgerText.mono(size: 12.5, color: c.textMid),
                  ),
                  Text(
                    t.amount == null ? '—' : moneyD(t.amount!),
                    style: LedgerText.mono(size: 12.5, color: c.textStrong),
                  ),
                  Row(
                    children: [
                      SourceDotChip(
                        label: _kindLabel(t.kind),
                        dotColor: _kindColor(c, t.kind),
                        textColor: _kindColor(c, t.kind),
                        dense: true,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          t.source,
                          overflow: TextOverflow.ellipsis,
                          style: LedgerText.mono(
                            size: 11.5,
                            color: c.textMuted,
                            tabular: false,
                          ),
                        ),
                      ),
                    ],
                  ),
                  Text(
                    t.parcelInfo,
                    style: LedgerText.mono(
                      size: 11.5,
                      color: c.textStrong,
                      tabular: false,
                    ),
                  ),
                ],
            ],
            rowBg: [for (final _ in txns) c.surfaceCard],
            widths: _widths,
            hPad: hPad,
          ),
        Padding(
          padding: EdgeInsets.fromLTRB(hPad, 16, hPad, 26),
          child: Text(
            'Every row retains its source artefact. Manual entries record who entered them and when.',
            style: LedgerText.mono(
              size: 11,
              color: c.textFaint,
              height: 1.6,
              tabular: false,
            ),
          ),
        ),
      ],
    );
  }
}

class _IncomeTab extends StatelessWidget {
  const _IncomeTab({
    required this.hPad,
    required this.fy,
    required this.income,
    required this.pendingCount,
  });
  final double hPad;
  final String fy;
  final List<IncomeRow> income;
  final int pendingCount;

  static const _widths = [
    118.0,
    130.0,
    80.0,
    108.0,
    108.0,
    116.0,
    112.0,
    200.0,
  ];

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    final tFranked = income.fold<Decimal>(
      Decimal.zero,
      (s, i) => s + i.franked,
    );
    final tUnfranked = income.fold<Decimal>(
      Decimal.zero,
      (s, i) => s + i.unfranked,
    );
    final tFrankingCredit = income.fold<Decimal>(
      Decimal.zero,
      (s, i) => s + i.frankingCredit,
    );
    final tCash = income.fold<Decimal>(Decimal.zero, (s, i) => s + i.cash);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.fromLTRB(hPad, 16, hPad, 14),
          child: Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 14,
            runSpacing: 10,
            children: [
              Text(
                'Distributions received. Component detail comes from the annual AMIT statement.',
                style: LedgerText.sans(size: 12, color: c.textMid),
              ),
              if (pendingCount > 0)
                Container(
                  padding: const EdgeInsets.fromLTRB(8, 4, 10, 4),
                  decoration: BoxDecoration(
                    color: c.surfaceWarnBox,
                    border: Border.all(color: c.borderWarnBox),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 5,
                        height: 5,
                        decoration: BoxDecoration(
                          color: c.pendingAmber,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 7),
                      Text(
                        '$pendingCount payment${pendingCount == 1 ? '' : 's'} awaiting component entry',
                        style: LedgerText.mono(
                          size: 11,
                          color: c.pendingText,
                          tabular: false,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        if (income.isEmpty)
          Padding(
            padding: EdgeInsets.symmetric(horizontal: hPad),
            child: Text(
              'No distributions recorded yet for this holding.',
              style: LedgerText.sans(size: 13, color: c.textMuted),
            ),
          )
        else
          _horizontalTable(
            c: c,
            header: [
              'PAY DATE',
              'TYPE',
              'UNITS',
              'FRANKED',
              'UNFRANKED',
              'FRANKING CR',
              'CASH',
              'STATEMENT',
            ],
            rightAlign: const [
              false,
              false,
              true,
              true,
              true,
              true,
              true,
              false,
            ],
            rows: [
              for (final i in income)
                [
                  Text(
                    _fmtDate(i.paymentDate),
                    style: LedgerText.mono(size: 12.5, color: c.textStrong),
                  ),
                  Text(
                    i.type,
                    style: LedgerText.sans(size: 12, color: c.textStrong),
                  ),
                  Text(
                    i.unitsDisplay,
                    style: LedgerText.mono(size: 12.5, color: c.textMid),
                  ),
                  Text(
                    moneyD(i.franked),
                    style: LedgerText.mono(size: 12.5, color: c.textStrong),
                  ),
                  Text(
                    moneyD(i.unfranked),
                    style: LedgerText.mono(size: 12.5, color: c.textStrong),
                  ),
                  Text(
                    moneyD(i.frankingCredit),
                    style: LedgerText.mono(size: 12.5, color: c.textStrong),
                  ),
                  Text(
                    moneyD(i.cash),
                    style: LedgerText.mono(size: 12.5, color: c.textStrong),
                  ),
                  Text(
                    i.pending
                        ? 'awaiting entry'
                        : (i.componentStatement ?? '—'),
                    style: LedgerText.mono(
                      size: 11.5,
                      color: i.pending ? c.pendingText : c.textMuted,
                      tabular: false,
                    ),
                  ),
                ],
            ],
            rowBg: [for (final _ in income) c.surfaceCard],
            widths: _widths,
            hPad: hPad,
            footer: [
              fy,
              '',
              '',
              moneyD(tFranked),
              moneyD(tUnfranked),
              moneyD(tFrankingCredit),
              moneyD(tCash),
              '',
            ],
            footerRightAlign: const [
              false,
              false,
              false,
              true,
              true,
              true,
              true,
              false,
            ],
          ),
        Padding(
          padding: EdgeInsets.fromLTRB(hPad, 16, hPad, 26),
          child: Text(
            'Franking credits are recorded as stated on each statement. Where a source does not state a value it is left blank rather than derived. Units held at record date is not currently tracked.',
            style: LedgerText.mono(
              size: 11,
              color: c.textFaint,
              height: 1.6,
              tabular: false,
            ),
          ),
        ),
      ],
    );
  }
}

String _fmtDate(DateTime d) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${d.day.toString().padLeft(2, '0')} ${months[d.month - 1]} ${d.year}';
}

/// Shared horizontal-scrolling grid used by all three detail tabs. Not a
/// generic table widget elsewhere in the design, but the column-header /
/// row / totals-footer shape repeats identically across tabs, so it's
/// factored out here rather than duplicated three times.
Widget _horizontalTable({
  required LedgerPalette c,
  required List<String> header,
  required List<bool> rightAlign,
  required List<List<Widget>> rows,
  required List<Color> rowBg,
  required List<double> widths,
  required double hPad,
  List<String>? footer,
  List<bool>? footerRightAlign,
}) {
  final total = widths.fold<double>(0, (s, w) => s + w);
  return Container(
    margin: const EdgeInsets.only(top: 18),
    decoration: BoxDecoration(
      border: Border(top: BorderSide(color: c.borderSidebar)),
    ),
    child: SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: EdgeInsets.symmetric(horizontal: hPad),
      child: SizedBox(
        width: total,
        child: Column(
          children: [
            Container(
              decoration: BoxDecoration(
                color: c.surfaceTable,
                border: Border(bottom: BorderSide(color: c.borderHeaderRule)),
              ),
              child: Row(
                children: [
                  for (var i = 0; i < header.length; i++)
                    SizedBox(
                      width: widths[i],
                      child: Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: i == 0 ? 14 : 12,
                          vertical: 9,
                        ),
                        child: Align(
                          alignment: rightAlign[i]
                              ? Alignment.centerRight
                              : Alignment.centerLeft,
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: rightAlign[i]
                                ? Alignment.centerRight
                                : Alignment.centerLeft,
                            child: Text(
                              header[i],
                              style: LedgerText.columnLabel(color: c.textMuted),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            for (var r = 0; r < rows.length; r++)
              Container(
                decoration: BoxDecoration(
                  color: rowBg[r],
                  border: Border(bottom: BorderSide(color: c.borderRow)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    for (var i = 0; i < rows[r].length; i++)
                      SizedBox(
                        width: widths[i],
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: i == 0 ? 14 : 12,
                            vertical: 10,
                          ),
                          child: Align(
                            alignment: rightAlign[i]
                                ? Alignment.centerRight
                                : Alignment.centerLeft,
                            child: rows[r][i],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            if (footer != null)
              Container(
                decoration: BoxDecoration(
                  color: c.surfaceTable,
                  border: Border(
                    top: BorderSide(color: c.borderTotalRule, width: 1.5),
                  ),
                ),
                child: Row(
                  children: [
                    for (var i = 0; i < footer.length; i++)
                      SizedBox(
                        width: widths[i],
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: i == 0 ? 14 : 12,
                            vertical: 12,
                          ),
                          child: Align(
                            alignment: (footerRightAlign ?? rightAlign)[i]
                                ? Alignment.centerRight
                                : Alignment.centerLeft,
                            child: Text(
                              footer[i],
                              style: i == 0
                                  ? LedgerText.mono(
                                      size: 11,
                                      weight: FontWeight.w500,
                                      color: c.textMid,
                                      letterSpacing: 0.9,
                                      tabular: false,
                                    )
                                  : LedgerText.mono(
                                      size: 13,
                                      weight: FontWeight.w500,
                                      color: c.textStrong,
                                    ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    ),
  );
}
