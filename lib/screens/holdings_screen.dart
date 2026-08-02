import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:fquery/fquery.dart';
import 'package:fquery_core/fquery_core.dart';

import '../data/portfolio_repository.dart';
import '../format.dart';
import '../models/portfolio.dart';
import '../theme/ledger_theme.dart';
import '../widgets/source_chip.dart';

enum _SortKey { sym, units, avg, price, value, gain, pct, src }

class _Row {
  _Row(this.holding);
  final Holding holding;
}

class HoldingsScreen extends StatefulWidget {
  const HoldingsScreen({
    super.key,
    required this.fy,
    required this.wide,
    required this.narrow,
    required this.horizontalPadding,
    required this.onOpenDetail,
    required this.onAddTransaction,
    this.fetchData = fetchHoldingsScreenData,
  });

  final String fy;
  final bool wide;
  final bool narrow;
  final double horizontalPadding;
  final ValueChanged<Holding> onOpenDetail;
  final VoidCallback onAddTransaction;

  /// Overridable for tests, which can't reach a live Supabase instance --
  /// defaults to the real repository read.
  final Future<HoldingsScreenData> Function(int financialYear) fetchData;

  @override
  State<HoldingsScreen> createState() => _HoldingsScreenState();
}

class _HoldingsScreenState extends State<HoldingsScreen> {
  _SortKey _sortKey = _SortKey.value;
  bool _desc = true;
  String _src = 'all';

  static const _colWidths = [82.0, 100.0, 92.0, 128.0, 84.0, 168.0, 30.0];
  static const _tableMinWidth = 996.0;

  void _sortBy(_SortKey key) {
    setState(() {
      if (_sortKey == key) {
        _desc = !_desc;
      } else {
        _sortKey = key;
        _desc = true;
      }
    });
  }

  List<Holding> _filtered(List<Holding> all) =>
      all
          .where((h) =>
              _src == 'all' ||
              h.accountDisplayName.startsWith(_src))
          .toList();

  List<Holding> _sorted(List<Holding> list) {
    final sorted = [...list];
    int cmp(Holding a, Holding b) {
      switch (_sortKey) {
        case _SortKey.sym:
          return a.symbol.compareTo(b.symbol);
        case _SortKey.units:
          return a.units.compareTo(b.units);
        case _SortKey.avg:
          return a.avgCost.compareTo(b.avgCost);
        case _SortKey.price:
          return a.price.compareTo(b.price);
        case _SortKey.value:
          return a.value.compareTo(b.value);
        case _SortKey.gain:
          return a.gain.compareTo(b.gain);
        case _SortKey.pct:
          return a.gainPct.compareTo(b.gainPct);
        case _SortKey.src:
          return a.accountDisplayName.compareTo(b.accountDisplayName);
      }
    }

    sorted.sort((a, b) => _desc ? cmp(b, a) : cmp(a, b));
    return sorted;
  }

  @override
  Widget build(BuildContext context) {
    final financialYear = financialYearFromLabel(widget.fy);
    return QueryBuilder<HoldingsScreenData, Exception>(
      options: QueryOptions(
        queryKey: QueryKey(['holdingsScreen', financialYear]),
        queryFn: () => widget.fetchData(financialYear),
      ),
      builder: (context, query) {
        if (query.isLoading) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.all(48),
              child: CircularProgressIndicator(),
            ),
          );
        }
        if (query.isError) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(48),
              child: Text('Could not load holdings: ${query.error}'),
            ),
          );
        }
        return _HoldingsBody(
          data: query.data!,
          fy: widget.fy,
          wide: widget.wide,
          narrow: widget.narrow,
          horizontalPadding: widget.horizontalPadding,
          onOpenDetail: widget.onOpenDetail,
          onAddTransaction: widget.onAddTransaction,
          sortKey: _sortKey,
          desc: _desc,
          src: _src,
          onSort: _sortBy,
          onSrcChanged: (v) => setState(() => _src = v),
          filtered: _filtered,
          sorted: _sorted,
          colWidths: _colWidths,
          tableMinWidth: _tableMinWidth,
        );
      },
    );
  }
}

class _HoldingsBody extends StatelessWidget {
  const _HoldingsBody({
    required this.data,
    required this.fy,
    required this.wide,
    required this.narrow,
    required this.horizontalPadding,
    required this.onOpenDetail,
    required this.onAddTransaction,
    required this.sortKey,
    required this.desc,
    required this.src,
    required this.onSort,
    required this.onSrcChanged,
    required this.filtered,
    required this.sorted,
    required this.colWidths,
    required this.tableMinWidth,
  });

  final HoldingsScreenData data;
  final String fy;
  final bool wide;
  final bool narrow;
  final double horizontalPadding;
  final ValueChanged<Holding> onOpenDetail;
  final VoidCallback onAddTransaction;
  final _SortKey sortKey;
  final bool desc;
  final String src;
  final ValueChanged<_SortKey> onSort;
  final ValueChanged<String> onSrcChanged;
  final List<Holding> Function(List<Holding>) filtered;
  final List<Holding> Function(List<Holding>) sorted;
  final List<double> colWidths;
  final double tableMinWidth;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    final all = filtered(data.holdings);
    final list = sorted(all);

    final rows = [for (final h in list) _Row(h)];

    final tValue = all.fold<Decimal>(Decimal.zero, (s, h) => s + h.value);
    final tCost = all.fold<Decimal>(Decimal.zero, (s, h) => s + h.costBase);
    final tGain = tValue - tCost;
    final tGainPct = tCost == Decimal.zero
        ? Decimal.zero
        : (tGain / tCost).toDecimal(scaleOnInfinitePrecision: 6) *
              Decimal.fromInt(100);
    final tGainColor = tGain >= Decimal.zero ? c.positive : c.negative;

    final totalUnits = all.fold<Decimal>(Decimal.zero, (s, h) => s + h.units);
    final distinctAccounts = all.map((h) => h.accountId).toSet().length;
    final priceDateLabel = data.latestPriceDate == null
        ? 'no priced instruments yet'
        : 'prices as at ${_shortDate(data.latestPriceDate!)}';
    final foreignHoldings = all
        .where((h) => h.fxSubLine != null)
        .toList(growable: false);

    final hPad = horizontalPadding;
    final kpiCols = narrow ? 1 : (wide ? 4 : 2);

    return SingleChildScrollView(
      child: Padding(
        padding: const EdgeInsets.only(bottom: 26),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(hPad, 22, hPad, 18),
              child: Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.end,
                spacing: 18,
                runSpacing: 12,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Holdings',
                        style: LedgerText.sans(
                          size: 22,
                          weight: FontWeight.w600,
                          letterSpacing: -0.33,
                          color: c.ink,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${all.length} positions · $distinctAccounts source accounts · $priceDateLabel',
                        style: LedgerText.mono(
                          size: 12,
                          color: c.textMuted,
                          tabular: false,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const _ActionButton(label: 'Export CSV'),
                      const SizedBox(width: 8),
                      _ActionButton(
                        label: 'Add transaction',
                        primary: true,
                        onTap: onAddTransaction,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: hPad),
              child: KpiStripCards(
                columns: kpiCols,
                tValue: moneyD(tValue),
                tCost: moneyD(tCost),
                tGain: signedMoneyD(tGain),
                tGainPct: signedPctD(tGainPct),
                tGainColor: tGainColor,
                fy: fy,
                positions: all.length,
                totalUnits: quantity(totalUnits),
                transactionCount: data.transactionCount,
                income: moneyD(data.incomeTotal),
                frankingCredits: moneyD(data.frankingCreditTotal),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(hPad, 18, hPad, 12),
              child: Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: [
                  _SrcFilterBar(
                    accounts: data.accounts,
                    selected: src,
                    onChanged: onSrcChanged,
                  ),
                ],
              ),
            ),
            Container(
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: c.borderSidebar)),
              ),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final fixedSum = colWidths.fold<double>(0, (s, w) => s + w);
                    final avail =
                        MediaQuery.of(context).size.width -
                        hPad * 2 -
                        (wide ? 226 : 0);
                    final symWidth = (avail - fixedSum).clamp(
                      190.0,
                      double.infinity,
                    );
                    final totalWidth = symWidth + fixedSum;
                    return SizedBox(
                      key: const Key('holdingsTable'),
                      width: totalWidth < tableMinWidth
                          ? tableMinWidth
                          : totalWidth,
                      child: Column(
                        children: [
                          _HeaderRow(
                            symWidth: symWidth < 190 ? 190 : symWidth,
                            sortKey: sortKey,
                            desc: desc,
                            onSort: onSort,
                          ),
                          if (rows.isEmpty)
                            _EmptyRow(symWidth: symWidth < 190 ? 190 : symWidth)
                          else
                            for (final r in rows)
                              _DataRow(
                                row: r,
                                symWidth: symWidth < 190 ? 190 : symWidth,
                                onTap: () => onOpenDetail(r.holding),
                              ),
                          _TotalsRow(
                            symWidth: symWidth < 190 ? 190 : symWidth,
                            positionCount: all.length,
                            tGain: signedMoneyD(tGain),
                            tGainPct: signedPctD(tGainPct),
                            tGainColor: tGainColor,
                            tCost: moneyD(tCost),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(hPad, 16, hPad, 26),
              child: Wrap(
                spacing: 22,
                runSpacing: 6,
                children: [
                  for (final h in foreignHoldings)
                    Text(
                      '${h.symbol}: ${h.fxSubLine}',
                      style: LedgerText.mono(
                        size: 11,
                        color: c.textFaint,
                        height: 1.6,
                        tabular: false,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _shortDate(DateTime d) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${d.day.toString().padLeft(2, '0')} ${months[d.month - 1]} ${d.year}';
}

/// Source-account filter chip bar. Uses display-name prefix matching so a
/// single "Stake" chip covers both "Stake AU" and "Stake US" accounts.
/// `selected` is 'all' or a display-name prefix; `onChanged` receives the
/// same.
class _SrcFilterBar extends StatelessWidget {
  const _SrcFilterBar({
    required this.accounts,
    required this.selected,
    required this.onChanged,
  });

  final List<AccountRef> accounts;
  final String selected;
  final ValueChanged<String> onChanged;

  /// Unique display-name prefixes in insertion order, deduped.
  List<String> _prefixes() {
    final seen = <String>{};
    final result = <String>[];
    for (final a in accounts) {
      // Take up to the first space or '·' as the prefix label, so
      // "Stake AU" and "Stake US" both map to "Stake".
      final prefix = a.displayName.split(RegExp(r'[\s·]')).first;
      if (seen.add(prefix)) result.add(prefix);
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    final prefixes = _prefixes();
    final chips = <({String value, String label})>[
      (value: 'all', label: 'All sources'),
      for (final p in prefixes) (value: p, label: p),
    ];

    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: c.borderControl),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < chips.length; i++)
            _SrcChip(
              label: chips[i].label,
              value: chips[i].value,
              selected: selected == chips[i].value,
              isLast: i == chips.length - 1,
              onTap: () => onChanged(chips[i].value),
              c: c,
            ),
        ],
      ),
    );
  }
}

class _SrcChip extends StatefulWidget {
  const _SrcChip({
    required this.label,
    required this.value,
    required this.selected,
    required this.isLast,
    required this.onTap,
    required this.c,
  });

  final String label;
  final String value;
  final bool selected;
  final bool isLast;
  final VoidCallback onTap;
  final LedgerPalette c;

  @override
  State<_SrcChip> createState() => _SrcChipState();
}

class _SrcChipState extends State<_SrcChip> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final c = widget.c;
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
          decoration: BoxDecoration(
            color: widget.selected
                ? c.surfaceActive
                : _hover
                    ? c.surfaceHover
                    : c.surfaceCard,
            border: !widget.isLast
                ? Border(right: BorderSide(color: c.borderSubtle))
                : null,
          ),
          child: Text(
            widget.label,
            style: LedgerText.sans(
              size: 12,
              color: widget.selected ? c.ink : c.textMid,
              weight: widget.selected ? FontWeight.w500 : FontWeight.w400,
            ),
          ),
        ),
      ),
    );
  }
}


class _EmptyRow extends StatelessWidget {
  const _EmptyRow({required this.symWidth});
  final double symWidth;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 14),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderRow)),
      ),
      child: Text(
        'No holdings yet. Confirm a transaction to see it here.',
        style: LedgerText.sans(size: 13, color: c.textMuted),
      ),
    );
  }
}

class KpiStripCards extends StatelessWidget {
  const KpiStripCards({
    super.key,
    required this.columns,
    required this.tValue,
    required this.tCost,
    required this.tGain,
    required this.tGainPct,
    required this.tGainColor,
    required this.fy,
    required this.positions,
    required this.totalUnits,
    required this.transactionCount,
    required this.income,
    required this.frankingCredits,
  });

  final int columns;
  final String tValue;
  final String tCost;
  final String tGain;
  final String tGainPct;
  final Color tGainColor;
  final String fy;
  final int positions;
  final String totalUnits;
  final int transactionCount;
  final String income;
  final String frankingCredits;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    final cards = [
      _Kpi(
        'TOTAL VALUE',
        tValue,
        '$positions positions · $totalUnits units',
        c.ink,
        null,
      ),
      _Kpi(
        'TOTAL COST BASE',
        tCost,
        'from $transactionCount confirmed transactions',
        c.ink,
        null,
      ),
      _Kpi(
        'UNREALISED GAIN',
        tGain,
        'not adjusted for CGT discount',
        tGainColor,
        tGainPct,
      ),
      _Kpi(
        'INCOME · $fy',
        income,
        '+ $frankingCredits franking credits',
        c.ink,
        null,
      ),
    ];

    final rows = <List<_Kpi>>[];
    for (var i = 0; i < cards.length; i += columns) {
      rows.add(cards.sublist(i, (i + columns).clamp(0, cards.length)));
    }

    return Container(
      decoration: BoxDecoration(
        color: c.surfaceSidebar,
        border: Border.all(color: c.borderSubtle),
        borderRadius: BorderRadius.circular(6),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (final row in rows)
            Row(
              children: [
                for (var i = 0; i < row.length; i++)
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                      decoration: BoxDecoration(
                        border: i != row.length - 1
                            ? Border(right: BorderSide(color: c.borderRow))
                            : null,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            row[i].label,
                            style: LedgerText.eyebrow(color: c.textFaint),
                          ),
                          const SizedBox(height: 9),
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.baseline,
                              textBaseline: TextBaseline.alphabetic,
                              children: [
                                Text(
                                  row[i].value,
                                  style: LedgerText.mono(
                                    size: 23,
                                    color: row[i].color,
                                    letterSpacing: -0.46,
                                  ),
                                ),
                                if (row[i].trailing != null) ...[
                                  const SizedBox(width: 8),
                                  Text(
                                    row[i].trailing!,
                                    style: LedgerText.mono(
                                      size: 12.5,
                                      color: row[i].color,
                                      tabular: false,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            row[i].caption,
                            style: LedgerText.sans(
                              size: 11,
                              color: c.textMuted,
                              height: 1.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class _Kpi {
  _Kpi(this.label, this.value, this.caption, this.color, this.trailing);
  final String label;
  final String value;
  final String caption;
  final Color color;
  final String? trailing;
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({required this.label, this.primary = false, this.onTap});
  final String label;
  final bool primary;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
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
      ),
    );
  }
}

class _HeaderRow extends StatelessWidget {
  const _HeaderRow({
    required this.symWidth,
    required this.sortKey,
    required this.desc,
    required this.onSort,
  });
  final double symWidth;
  final _SortKey sortKey;
  final bool desc;
  final ValueChanged<_SortKey> onSort;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);

    Widget cell(
      String label,
      double width,
      _SortKey key, {
      bool alignRight = false,
    }) {
      final active = sortKey == key;
      return GestureDetector(
        onTap: () => onSort(key),
        child: Container(
          width: width,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          alignment: alignRight ? Alignment.centerRight : Alignment.centerLeft,
          child: FittedBox(
            fit: BoxFit.scaleDown,
            alignment: alignRight
                ? Alignment.centerRight
                : Alignment.centerLeft,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label, style: LedgerText.columnLabel(color: c.textMuted)),
                if (active)
                  Text(
                    desc ? ' ↓' : ' ↑',
                    style: LedgerText.mono(
                      size: 9.5,
                      weight: FontWeight.w500,
                      color: c.link,
                      tabular: false,
                    ),
                  ),
              ],
            ),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: c.surfaceTable,
        border: Border(bottom: BorderSide(color: c.borderHeaderRule)),
      ),
      child: Row(
        children: [
          cell('SYMBOL / CODE', symWidth, _SortKey.sym),
          cell('UNITS', 82, _SortKey.units, alignRight: true),
          cell('PURCHASE \$', 100, _SortKey.avg, alignRight: true),
          cell('LAST \$', 92, _SortKey.price, alignRight: true),
          cell('PROFIT/LOSS \$', 128, _SortKey.gain, alignRight: true),
          cell('PROFIT/LOSS %', 84, _SortKey.pct, alignRight: true),
          cell('SOURCE', 168, _SortKey.src),
          const SizedBox(width: 30),
        ],
      ),
    );
  }
}

class _DataRow extends StatelessWidget {
  const _DataRow({
    required this.row,
    required this.symWidth,
    required this.onTap,
  });
  final _Row row;
  final double symWidth;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    final h = row.holding;
    final gc = h.gain >= Decimal.zero ? c.positive : c.negative;

    return Column(
      children: [
        GestureDetector(
          onTap: onTap,
          child: Container(
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: c.borderRow)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                SizedBox(
                  width: symWidth,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 9,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          h.symbol,
                          style: LedgerText.mono(
                            size: 12.5,
                            letterSpacing: 0.12,
                            color: c.textStrong,
                          ),
                        ),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                h.name,
                                overflow: TextOverflow.ellipsis,
                                style: LedgerText.sans(
                                  size: 12.5,
                                  height: 1.35,
                                  color: c.textStrong,
                                ),
                              ),
                              if (h.fxSubLine != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 2),
                                  child: Text(
                                    h.fxSubLine!,
                                    overflow: TextOverflow.ellipsis,
                                    style: LedgerText.mono(
                                      size: 10.5,
                                      color: c.textFaint,
                                      tabular: false,
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
                _num(c, quantity(h.units), 82),
                _num(c, moneyD(h.avgCost), 100),
                _num(c, moneyD(h.price), 92, color: c.textMid),
                _num(c, signedMoneyD(h.gain), 128, color: gc),
                _num(c, signedPctD(h.gainPct), 84, color: gc, size: 12),
                SizedBox(
                  width: 168,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 9,
                    ),
                    child: SourceDotChip(
                      label: h.accountDisplayName,
                      dotColor: c.sourceDot(h.accountDisplayName),
                    ),
                  ),
                ),
                SizedBox(
                  width: 30,
                  child: Text(
                    '›',
                    textAlign: TextAlign.center,
                    style: LedgerText.mono(size: 13, color: c.iconMuted),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _num(
    LedgerPalette c,
    String text,
    double width, {
    Color? color,
    double size = 12.5,
  }) {
    return SizedBox(
      width: width,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        child: Text(
          text,
          textAlign: TextAlign.right,
          style: LedgerText.mono(size: size, color: color ?? c.textStrong),
        ),
      ),
    );
  }
}

class _TotalsRow extends StatelessWidget {
  const _TotalsRow({
    required this.symWidth,
    required this.positionCount,
    required this.tGain,
    required this.tGainPct,
    required this.tGainColor,
    required this.tCost,
  });

  final double symWidth;
  final int positionCount;
  final String tGain;
  final String tGainPct;
  final Color tGainColor;
  final String tCost;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: c.surfaceTable,
        border: Border(top: BorderSide(color: c.borderTotalRule, width: 1.5)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: symWidth,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Text(
                'TOTAL · $positionCount POSITIONS',
                style: LedgerText.mono(
                  size: 11,
                  weight: FontWeight.w500,
                  color: c.textMid,
                  letterSpacing: 0.9,
                  tabular: false,
                ),
              ),
            ),
          ),
          const SizedBox(width: 82),
          const SizedBox(width: 100),
          const SizedBox(width: 92),
          SizedBox(
            width: 128,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              child: Text(
                tGain,
                textAlign: TextAlign.right,
                style: LedgerText.mono(
                  size: 13,
                  weight: FontWeight.w500,
                  color: tGainColor,
                ),
              ),
            ),
          ),
          SizedBox(
            width: 84,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              child: Text(
                tGainPct,
                textAlign: TextAlign.right,
                style: LedgerText.mono(
                  size: 12.5,
                  weight: FontWeight.w500,
                  color: tGainColor,
                ),
              ),
            ),
          ),
          SizedBox(
            width: 168,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              child: Text(
                'cost base $tCost',
                style: LedgerText.mono(
                  size: 11,
                  color: c.textFaint,
                  tabular: false,
                ),
              ),
            ),
          ),
          const SizedBox(width: 30),
        ],
      ),
    );
  }
}
