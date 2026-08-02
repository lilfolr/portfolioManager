import 'package:flutter/material.dart';
import '../data/sample_data.dart';
import '../format.dart';
import '../models/portfolio.dart';
import '../theme/ledger_theme.dart';
import '../widgets/composition_bar.dart';
import '../widgets/source_chip.dart';

enum _SortKey { sym, units, avg, price, value, gain, pct, src }

class _Row {
  _Row(this.holding, {this.groupHead, this.groupMeta});
  final Holding holding;
  final String? groupHead;
  final String? groupMeta;
}

class HoldingsScreen extends StatefulWidget {
  const HoldingsScreen({
    super.key,
    required this.fy,
    required this.wide,
    required this.narrow,
    required this.horizontalPadding,
    required this.onOpenDetail,
  });

  final String fy;
  final bool wide;
  final bool narrow;
  final double horizontalPadding;
  final VoidCallback onOpenDetail;

  @override
  State<HoldingsScreen> createState() => _HoldingsScreenState();
}

class _HoldingsScreenState extends State<HoldingsScreen> {
  _SortKey _sortKey = _SortKey.value;
  bool _desc = true;
  String _src = 'all';
  bool _group = false;
  bool _color = true;
  bool _byHolding = true;

  static const _colWidths = [
    82.0,
    100.0,
    92.0,
    124.0,
    128.0,
    84.0,
    168.0,
    30.0,
  ];
  static const _tableMinWidth = 1120.0;

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

  List<Holding> get _filtered => SampleData.holdings
      .where((h) => _src == 'all' || h.source.startsWith(_src))
      .toList();

  List<Holding> _sorted(List<Holding> list) {
    final sorted = [...list];
    int cmp(Holding a, Holding b) {
      switch (_sortKey) {
        case _SortKey.sym:
          return a.sym.compareTo(b.sym);
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
          return a.source.compareTo(b.source);
      }
    }

    sorted.sort((a, b) => _desc ? cmp(b, a) : cmp(a, b));
    return sorted;
  }

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    final filtered = _filtered;
    final sorted = _sorted(filtered);

    final rows = <_Row>[];
    if (_group) {
      final seen = <String>[];
      final byGroup = <String, List<Holding>>{};
      for (final h in sorted) {
        if (!byGroup.containsKey(h.source)) {
          byGroup[h.source] = [];
          seen.add(h.source);
        }
        byGroup[h.source]!.add(h);
      }
      for (final key in seen) {
        final g = byGroup[key]!;
        final gv = g.fold<double>(0, (s, h) => s + h.value);
        final gc = g.fold<double>(0, (s, h) => s + h.cost);
        for (var i = 0; i < g.length; i++) {
          rows.add(
            _Row(
              g[i],
              groupHead: i == 0 ? key.toUpperCase() : null,
              groupMeta: i == 0
                  ? '${g.length} positions · value ${money(gv)} · cost base ${money(gc)}'
                  : null,
            ),
          );
        }
      }
    } else {
      for (final h in sorted) {
        rows.add(_Row(h));
      }
    }

    final tValue = filtered.fold<double>(0, (s, h) => s + h.value);
    final tCost = filtered.fold<double>(0, (s, h) => s + h.cost);
    final tGain = tValue - tCost;
    final tGainColor = _color
        ? (tGain >= 0 ? c.positive : c.negative)
        : c.ink;

    // Composition segments.
    List<CompositionSegment> segments;
    if (_byHolding) {
      final total = filtered.fold<double>(0, (s, h) => s + h.value) == 0
          ? 1.0
          : filtered.fold<double>(0, (s, h) => s + h.value);
      final list = [...filtered]..sort((a, b) => b.value.compareTo(a.value));
      segments = [
        for (var i = 0; i < list.length; i++)
          CompositionSegment(
            label: list[i].sym,
            fullLabel: list[i].name,
            value: list[i].value,
            color: c.compRamp[i % c.compRamp.length],
            widthFraction: list[i].value / total,
            pctLabel: '${(list[i].value / total * 100).toStringAsFixed(1)}%',
          ),
      ];
    } else {
      final agg = <String, double>{};
      for (final h in filtered) {
        agg[h.source] = (agg[h.source] ?? 0) + h.value;
      }
      final total = agg.values.fold<double>(0, (s, v) => s + v) == 0
          ? 1.0
          : agg.values.fold<double>(0, (s, v) => s + v);
      final entries = agg.entries.toList()
        ..sort((a, b) => b.value.compareTo(a.value));
      segments = [
        for (final e in entries)
          CompositionSegment(
            label: e.key.replaceAll(' · SRN', ''),
            fullLabel: e.key,
            value: e.value,
            color: c.sourceDot(e.key),
            widthFraction: e.value / total,
            pctLabel: '${(e.value / total * 100).toStringAsFixed(1)}%',
          ),
      ];
    }
    final segTotal = segments.fold<double>(0, (s, e) => s + e.value);
    final top3 =
        segments.take(3).fold<double>(0, (s, e) => s + e.value) /
        (segTotal == 0 ? 1 : segTotal) *
        100;
    final defaultCaption =
        'largest 3 = ${top3.toStringAsFixed(1)}% of value · ${segments.length} segments';

    final hPad = widget.horizontalPadding;
    final kpiCols = widget.narrow ? 1 : (widget.wide ? 4 : 2);

    return SingleChildScrollView(
      child: Padding(
        padding: EdgeInsets.only(bottom: 26),
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
                        '9 positions · 5 source accounts · prices as at 01 Aug 2026, 16:10 AEST',
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
                      const _ActionButton(
                        label: 'Add transaction',
                        primary: true,
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
                tValue: money(tValue),
                tCost: money(tCost),
                tGain: signedMoney(tGain),
                tGainPct: signedPct(tGain / tCost * 100),
                tGainColor: tGainColor,
                fy: widget.fy,
              ),
            ),
            const SizedBox(height: 14),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: hPad),
              child: CompositionBar(
                segments: segments,
                byHolding: true,
                byHoldingSelected: _byHolding,
                byHoldingTap: () => setState(() => _byHolding = true),
                bySourceTap: () => setState(() => _byHolding = false),
                defaultCaption: defaultCaption,
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(hPad, 18, hPad, 12),
              child: Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: [
                  _SourceFilterRow(
                    current: _src,
                    onSelect: (k) => setState(() => _src = k),
                  ),
                  _ToggleButton(
                    label: _group ? 'Grouped by source' : 'Group by source',
                    active: _group,
                    onTap: () => setState(() => _group = !_group),
                  ),
                  _ToggleButton(
                    label: _color ? 'Gain colour on' : 'Gain colour off',
                    active: _color,
                    onTap: () => setState(() => _color = !_color),
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
                    final fixedSum = _colWidths.fold<double>(
                      0,
                      (s, w) => s + w,
                    );
                    final avail =
                        MediaQuery.of(context).size.width -
                        hPad * 2 -
                        (widget.wide ? 226 : 0);
                    final symWidth = (avail - fixedSum).clamp(
                      190.0,
                      double.infinity,
                    );
                    final totalWidth = symWidth + fixedSum;
                    return SizedBox(
                      key: const Key('holdingsTable'),
                      width: totalWidth < _tableMinWidth
                          ? _tableMinWidth
                          : totalWidth,
                      child: Column(
                        children: [
                          _HeaderRow(
                            symWidth: symWidth < 190 ? 190 : symWidth,
                            sortKey: _sortKey,
                            desc: _desc,
                            onSort: _sortBy,
                          ),
                          for (final r in rows)
                            _DataRow(
                              row: r,
                              symWidth: symWidth < 190 ? 190 : symWidth,
                              color: _color,
                              onTap: widget.onOpenDetail,
                            ),
                          _TotalsRow(
                            symWidth: symWidth < 190 ? 190 : symWidth,
                            rowCount: rows.where((r) => true).length,
                            positionCount: filtered.length,
                            tValue: money(tValue),
                            tGain: signedMoney(tGain),
                            tGainPct: signedPct(tGain / tCost * 100),
                            tGainColor: tGainColor,
                            tCost: money(tCost),
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
                  Text(
                    'Cost base includes brokerage and is derived from confirmed transactions only.',
                    style: LedgerText.mono(
                      size: 11,
                      color: c.textFaint,
                      height: 1.6,
                      tabular: false,
                    ),
                  ),
                  Text(
                    'VOO held in USD · converted at 0.6538 (01 Aug 2026); trade-date rates retained per parcel.',
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
  });

  final int columns;
  final String tValue;
  final String tCost;
  final String tGain;
  final String tGainPct;
  final Color tGainColor;
  final String fy;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    final cards = [
      _Kpi('TOTAL VALUE', tValue, '9 positions · 2,727 units', c.ink, null),
      _Kpi(
        'TOTAL COST BASE',
        tCost,
        'from 38 confirmed transactions',
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
        '6,412.88',
        '+ 1,586.28 franking credits',
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
  const _ActionButton({required this.label, this.primary = false});
  final String label;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
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
}

class _SourceFilterRow extends StatelessWidget {
  const _SourceFilterRow({required this.current, required this.onSelect});
  final String current;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: c.borderControl),
        borderRadius: BorderRadius.circular(5),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < SampleData.sourceFilters.length; i++)
            GestureDetector(
              onTap: () => onSelect(SampleData.sourceFilters[i].key),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: current == SampleData.sourceFilters[i].key
                      ? c.surfaceActive
                      : c.surfaceCard,
                  border: i != SampleData.sourceFilters.length - 1
                      ? Border(right: BorderSide(color: c.borderRow))
                      : null,
                ),
                child: Text(
                  SampleData.sourceFilters[i].value,
                  style: LedgerText.sans(
                    size: 12,
                    color: current == SampleData.sourceFilters[i].key
                        ? c.ink
                        : c.textMid,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ToggleButton extends StatelessWidget {
  const _ToggleButton({
    required this.label,
    required this.active,
    required this.onTap,
  });
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 29,
        padding: const EdgeInsets.symmetric(horizontal: 11),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? c.surfaceActive : c.surfaceCard,
          border: Border.all(color: c.borderControl),
          borderRadius: BorderRadius.circular(5),
        ),
        child: Text(
          label,
          style: LedgerText.sans(size: 12, color: c.textStrong),
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
                Text(
                  label,
                  style: LedgerText.columnLabel(color: c.textMuted),
                ),
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
          cell('SYMBOL / NAME', symWidth, _SortKey.sym),
          cell('UNITS', 82, _SortKey.units, alignRight: true),
          cell('AVG COST', 100, _SortKey.avg, alignRight: true),
          cell('PRICE', 92, _SortKey.price, alignRight: true),
          cell('MARKET VALUE', 124, _SortKey.value, alignRight: true),
          cell('UNREALISED', 128, _SortKey.gain, alignRight: true),
          cell('%', 84, _SortKey.pct, alignRight: true),
          cell('SOURCE ACCOUNT', 168, _SortKey.src),
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
    required this.color,
    required this.onTap,
  });
  final _Row row;
  final double symWidth;
  final bool color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    final h = row.holding;
    final gc = color ? (h.gain >= 0 ? c.positive : c.negative) : c.ink;

    return Column(
      children: [
        if (row.groupHead != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            decoration: BoxDecoration(
              color: c.surfaceGroupHead,
              border: Border(bottom: BorderSide(color: c.borderSubtle)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  row.groupHead!,
                  style: LedgerText.mono(
                    size: 10.5,
                    weight: FontWeight.w500,
                    color: c.textMid,
                    letterSpacing: 0.8,
                    tabular: false,
                  ),
                ),
                Text(
                  row.groupMeta!,
                  style: LedgerText.mono(
                    size: 11,
                    color: c.textMuted,
                    tabular: false,
                  ),
                ),
              ],
            ),
          ),
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
                          h.sym,
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
                              if (h.sub != null)
                                Padding(
                                  padding: const EdgeInsets.only(top: 2),
                                  child: Text(
                                    h.sub!,
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
                _num(c, h.units.toString(), 82),
                _num(c, money(h.avgCost), 100),
                _num(c, money(h.price), 92, color: c.textMid),
                _num(c, money(h.value), 124),
                _num(c, signedMoney(h.gain), 128, color: gc),
                _num(c, signedPct(h.gainPct), 84, color: gc, size: 12),
                SizedBox(
                  width: 168,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 9,
                    ),
                    child: SourceDotChip(
                      label: h.source,
                      dotColor: c.sourceDot(h.source),
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
          style: LedgerText.mono(
            size: size,
            color: color ?? c.textStrong,
          ),
        ),
      ),
    );
  }
}

class _TotalsRow extends StatelessWidget {
  const _TotalsRow({
    required this.symWidth,
    required this.rowCount,
    required this.positionCount,
    required this.tValue,
    required this.tGain,
    required this.tGainPct,
    required this.tGainColor,
    required this.tCost,
  });

  final double symWidth;
  final int rowCount;
  final int positionCount;
  final String tValue;
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
            width: 124,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              child: Text(
                tValue,
                textAlign: TextAlign.right,
                style: LedgerText.mono(
                  size: 13,
                  weight: FontWeight.w500,
                  color: c.textStrong,
                ),
              ),
            ),
          ),
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
