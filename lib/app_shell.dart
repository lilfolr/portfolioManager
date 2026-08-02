import 'package:flutter/material.dart';
import 'data/portfolio_repository.dart';
import 'screens/holding_detail_screen.dart';
import 'screens/holdings_screen.dart';
import 'screens/not_in_pass_screen.dart';
import 'screens/transaction_entry_screen.dart';
import 'theme/ledger_theme.dart';
import 'theme/theme_controller.dart';
import 'widgets/sidebar_nav.dart';
import 'widgets/top_bar.dart';

enum LedgerScreen { holdings, detail, txn, other }

/// Top-level shell: sidebar/chip-row navigation, top bar, and the current
/// screen body. Mirrors the single flat `state` object of the DC component's
/// `Component` class — `screen` and `fy` are shared across screens, so they
/// live here; each screen owns its own screen-local state internally.
class LedgerAppShell extends StatefulWidget {
  const LedgerAppShell({
    super.key,
    required this.themeController,
    this.holdingsFetchData = fetchHoldingsScreenData,
    this.holdingDetailFetchData = fetchHoldingDetail,
    this.parcelsFetcher = fetchOpenParcels,
    this.transactionSubmitter = submitManualTransaction,
  });

  final ThemeController themeController;

  /// Overridable for tests, which can't reach a live Supabase instance.
  final Future<HoldingsScreenData> Function(int financialYear)
      holdingsFetchData;
  final Future<HoldingDetailData> Function({
    required String instrumentId,
    required String accountId,
  }) holdingDetailFetchData;

  /// Overridable for tests — defaults to the real parcel-engine fetch.
  final Future<List<OpenParcel>> Function({
    required String symbol,
    required String accountId,
  }) parcelsFetcher;

  /// Overridable for tests — defaults to the real two-step RPC.
  final Future<String> Function(Map<String, dynamic> payload) transactionSubmitter;

  @override
  State<LedgerAppShell> createState() => _LedgerAppShellState();
}

class _LedgerAppShellState extends State<LedgerAppShell> {
  LedgerScreen _screen = LedgerScreen.holdings;
  String _fy = 'FY 2025–26';
  ({String instrumentId, String accountId, String symbol})? _selected;

  void _go(LedgerScreen s) => setState(() => _screen = s);

  void _openDetail({
    required String instrumentId,
    required String accountId,
    required String symbol,
  }) {
    setState(() {
      _selected = (
        instrumentId: instrumentId,
        accountId: accountId,
        symbol: symbol,
      );
      _screen = LedgerScreen.detail;
    });
  }

  String get _crumb {
    switch (_screen) {
      case LedgerScreen.holdings:
        return 'Portfolio / Holdings';
      case LedgerScreen.detail:
        final symbol = _selected?.symbol;
        return symbol == null
            ? 'Portfolio / Holdings'
            : 'Portfolio / Holdings / $symbol';
      case LedgerScreen.txn:
        return 'Ledger input / Transaction entry';
      case LedgerScreen.other:
        return 'Portfolio';
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    return Scaffold(
      backgroundColor: c.surfacePage,
      body: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          final wide = width >= 1000;
          final narrow = width < 600;
          final hPad = wide ? 26.0 : 16.0;

          final body = Column(
            children: [
              if (!wide)
                MobileNavChips(
                  onHoldings: () => _go(LedgerScreen.holdings),
                  onDetail: () => _go(LedgerScreen.detail),
                  onTxn: () => _go(LedgerScreen.txn),
                  onOther: () => _go(LedgerScreen.other),
                ),
              TopBar(
                crumb: _crumb,
                fy: _fy,
                onFyChanged: (v) => setState(() => _fy = v),
                showSearch: wide,
                horizontalPadding: hPad,
              ),
              Expanded(
                child: switch (_screen) {
                  LedgerScreen.holdings => HoldingsScreen(
                      fy: _fy,
                      wide: wide,
                      narrow: narrow,
                      horizontalPadding: hPad,
                      fetchData: widget.holdingsFetchData,
                      onOpenDetail: (h) => _openDetail(
                        instrumentId: h.instrumentId,
                        accountId: h.accountId,
                        symbol: h.symbol,
                      ),
                      onAddTransaction: () => _go(LedgerScreen.txn),
                    ),
                  LedgerScreen.detail => HoldingDetailScreen(
                      fy: _fy,
                      wide: wide,
                      horizontalPadding: hPad,
                      instrumentId: _selected?.instrumentId,
                      accountId: _selected?.accountId,
                      symbol: _selected?.symbol,
                      fetchData: widget.holdingDetailFetchData,
                      onBack: () => _go(LedgerScreen.holdings),
                      onAddTransaction: () => _go(LedgerScreen.txn),
                    ),
                  LedgerScreen.txn => TransactionEntryScreen(
                      onCancel: () => _go(LedgerScreen.holdings),
                      onSaved: () => _go(LedgerScreen.holdings),
                      parcelsFetcher: widget.parcelsFetcher,
                      transactionSubmitter: widget.transactionSubmitter,
                    ),
                  LedgerScreen.other => NotInPassScreen(
                      onBack: () => _go(LedgerScreen.holdings),
                    ),
                },
              ),
            ],
          );

          return Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (wide)
                Sidebar(
                  onHoldings: () => _go(LedgerScreen.holdings),
                  onDetail: () => _go(LedgerScreen.detail),
                  onTxn: () => _go(LedgerScreen.txn),
                  onOther: () => _go(LedgerScreen.other),
                  isHoldings: _screen == LedgerScreen.holdings,
                  isDetail: _screen == LedgerScreen.detail,
                  isTxn: _screen == LedgerScreen.txn,
                  themeController: widget.themeController,
                ),
              Expanded(
                child: DecoratedBox(
                  decoration: BoxDecoration(color: c.surfaceCard),
                  child: body,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
