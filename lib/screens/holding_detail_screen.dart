import 'package:flutter/material.dart';
import '../data/sample_data.dart';
import '../format.dart';
import '../models/portfolio.dart';
import '../theme/ledger_theme.dart';
import '../widgets/source_chip.dart';

enum _Tab { parcels, txns, inc }

/// The VAS holding-detail screen: header, key figures, and three tabs
/// (Parcels / Transactions / Income). All figures for this screen are the
/// fixture literals from the design (a single-holding drill-down), not
/// derived from [SampleData.holdings].
class HoldingDetailScreen extends StatefulWidget {
  const HoldingDetailScreen({
    super.key,
    required this.fy,
    required this.wide,
    required this.horizontalPadding,
    required this.onBack,
  });

  final String fy;
  final bool wide;
  final double horizontalPadding;
  final VoidCallback onBack;

  @override
  State<HoldingDetailScreen> createState() => _HoldingDetailScreenState();
}

class _HoldingDetailScreenState extends State<HoldingDetailScreen> {
  _Tab _tab = _Tab.parcels;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    final hPad = widget.horizontalPadding;
    final posColor = c.positive;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(hPad, 20, hPad, 0),
            child: GestureDetector(
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
                          'VAS',
                          style: LedgerText.mono(
                            size: 24,
                            weight: FontWeight.w500,
                            letterSpacing: -0.24,
                            color: c.textStrong,
                          ),
                        ),
                        Text(
                          'Vanguard Australian Shares Index ETF',
                          style: LedgerText.sans(size: 15, color: c.textStrong),
                        ),
                      ],
                    ),
                    const SizedBox(height: 9),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        const PlainTag(label: 'ASX'),
                        const PlainTag(label: 'Unit trust · AMIT'),
                        SourceDotChip(label: 'CommSec 0421', dotColor: c.link),
                        SourceDotChip(
                          label: 'Computershare DRP',
                          dotColor: c.pendingText,
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
                    _btn(c, 'Add transaction', primary: true),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(hPad, 0, hPad, 18),
            child: Wrap(
              spacing: widget.wide ? 38 : 18,
              runSpacing: 14,
              children: [
                _key(c, 'UNITS', '460'),
                _key(c, 'COST BASE', '39,920.04'),
                _key(c, 'AVG COST', '86.78'),
                _key(c, 'MARKET VALUE', '46,989.00'),
                _key(
                  c,
                  'UNREALISED',
                  '7,068.96',
                  trailing: '17.71%',
                  color: posColor,
                ),
                _key(c, 'INCOME · ${widget.fy}', '2,584.54'),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: hPad),
            child: Row(
              children: [
                _tabBtn(c, 'Parcels', '6', _Tab.parcels),
                _tabBtn(c, 'Transactions', '9', _Tab.txns),
                _tabBtn(c, 'Income', '6', _Tab.inc),
              ],
            ),
          ),
          Container(height: 1, color: c.borderSidebar),
          switch (_tab) {
            _Tab.parcels => _ParcelsTab(hPad: hPad),
            _Tab.txns => _TxnsTab(hPad: hPad),
            _Tab.inc => _IncomeTab(hPad: hPad, fy: widget.fy),
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

  Widget _tabBtn(LedgerPalette c, String label, String count, _Tab tab) {
    final active = _tab == tab;
    return GestureDetector(
      onTap: () => setState(() => _tab = tab),
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
              style: LedgerText.mono(size: 11, color: c.textFaint, tabular: false),
            ),
          ],
        ),
      ),
    );
  }
}

class _ParcelsTab extends StatelessWidget {
  const _ParcelsTab({required this.hPad});
  final double hPad;

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
                  child: Text.rich(
                    TextSpan(
                      style: LedgerText.sans(
                        size: 12,
                        height: 1.55,
                        color: c.textStrong,
                      ),
                      children: [
                        const TextSpan(
                          text:
                              'Parcels are derived from transactions and are read-only. To change a parcel, edit or reverse the transaction it came from — the parcel recalculates. ',
                        ),
                        TextSpan(
                          text: 'See transaction history',
                          style: LedgerText.sans(size: 12, color: c.link),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),
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
            for (final p in SampleData.parcels)
              [
                Text(p.id, style: LedgerText.mono(size: 12, color: c.textMid)),
                Text(
                  p.date,
                  style: LedgerText.mono(size: 12.5, color: c.textStrong),
                ),
                Text(p.txn, style: LedgerText.mono(size: 12, color: c.link)),
                Text(
                  p.orig.toString(),
                  style: LedgerText.mono(size: 12.5, color: c.textMuted),
                ),
                Text(
                  p.rem.toString(),
                  style: LedgerText.mono(size: 12.5, color: c.textStrong),
                ),
                Text(
                  money(p.cost),
                  style: LedgerText.mono(size: 12.5, color: c.textStrong),
                ),
                Text(
                  money(p.perUnit),
                  style: LedgerText.mono(size: 12.5, color: c.textMid),
                ),
                HeldStatusPill(
                  eligible: p.longTermEligible,
                  heldDate: p.heldDate,
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      p.status,
                      style: LedgerText.sans(
                        size: 11.5,
                        height: 1.4,
                        color: c.textStrong,
                      ),
                    ),
                    if (p.note != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          p.note!,
                          style: LedgerText.mono(
                            size: 10,
                            color: c.textFaint,
                            tabular: false,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
          ],
          rowBg: [
            for (final p in SampleData.parcels)
              p.partiallyDepleted ? c.surfaceParcelTint : c.surfaceCard,
          ],
          widths: _widths,
          hPad: hPad,
          footer: [
            'TOTAL',
            '',
            '',
            '498',
            '460',
            '39,920.04',
            '86.78',
            '412 eligible',
            '48 pending',
          ],
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(hPad, 16, hPad, 26),
          child: Text(
            'P-0002 was partially disposed on 02 May 2024 (38 of 80 units, FIFO). Remaining cost base is pro-rated, not re-averaged. CGT discount is not applied on this screen.',
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
  const _TxnsTab({required this.hPad});
  final double hPad;

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
                  SourceDotChip(label: 'CSV 4', dotColor: c.link, dense: true),
                  const SizedBox(width: 6),
                  SourceDotChip(
                    label: 'Email 3',
                    dotColor: c.pendingText,
                    dense: true,
                  ),
                  const SizedBox(width: 6),
                  SourceDotChip(
                    label: 'Manual 2',
                    dotColor: c.textFaint,
                    dense: true,
                  ),
                ],
              ),
            ],
          ),
        ),
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
            for (final t in SampleData.txns)
              [
                Text(t.id, style: LedgerText.mono(size: 12, color: c.link)),
                Text(
                  t.date,
                  style: LedgerText.mono(size: 12.5, color: c.textStrong),
                ),
                Text(t.type, style: LedgerText.sans(size: 12, color: c.textStrong)),
                Text(
                  t.units,
                  style: LedgerText.mono(size: 12.5, color: c.textStrong),
                ),
                Text(
                  t.price,
                  style: LedgerText.mono(size: 12.5, color: c.textMid),
                ),
                Text(
                  t.amount,
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
                  t.parcel,
                  style: LedgerText.mono(
                    size: 11.5,
                    color: c.textStrong,
                    tabular: false,
                  ),
                ),
              ],
          ],
          rowBg: [for (final _ in SampleData.txns) c.surfaceCard],
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
  const _IncomeTab({required this.hPad, required this.fy});
  final double hPad;
  final String fy;

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
                      '1 payment awaiting component entry',
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
          rightAlign: const [false, false, true, true, true, true, true, false],
          rows: [
            for (final i in SampleData.income)
              [
                Text(
                  i.date,
                  style: LedgerText.mono(size: 12.5, color: c.textStrong),
                ),
                Text(i.type, style: LedgerText.sans(size: 12, color: c.textStrong)),
                Text(
                  i.units,
                  style: LedgerText.mono(size: 12.5, color: c.textMid),
                ),
                Text(
                  i.franked,
                  style: LedgerText.mono(size: 12.5, color: c.textStrong),
                ),
                Text(
                  i.unfranked,
                  style: LedgerText.mono(size: 12.5, color: c.textStrong),
                ),
                Text(
                  i.frankingCredit,
                  style: LedgerText.mono(size: 12.5, color: c.textStrong),
                ),
                Text(
                  i.cash,
                  style: LedgerText.mono(size: 12.5, color: c.textStrong),
                ),
                Text(
                  i.componentStatement,
                  style: LedgerText.mono(
                    size: 11.5,
                    color: i.pending ? c.pendingText : c.textMuted,
                    tabular: false,
                  ),
                ),
              ],
          ],
          rowBg: [for (final _ in SampleData.income) c.surfaceCard],
          widths: _widths,
          hPad: hPad,
          footer: [fy, '', '1,004.30', '536.88', '430.41', '1,541.18', '', ''],
          footerRightAlign: const [
            false,
            false,
            true,
            true,
            true,
            true,
            false,
            false,
          ],
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(hPad, 16, hPad, 26),
          child: Text(
            'Franking credits are recorded as stated on each statement. Where a source does not state a value it is left blank rather than derived.',
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
    margin: EdgeInsets.only(top: 18),
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
