import 'package:flutter/material.dart';
import 'screens/holding_detail_screen.dart';
import 'screens/holdings_screen.dart';
import 'screens/not_in_pass_screen.dart';
import 'theme/ledger_theme.dart';
import 'theme/theme_controller.dart';
import 'widgets/sidebar_nav.dart';
import 'widgets/top_bar.dart';

enum LedgerScreen { holdings, detail, other }

/// Top-level shell: sidebar/chip-row navigation, top bar, and the current
/// screen body. Mirrors the single flat `state` object of the DC component's
/// `Component` class — `screen` and `fy` are shared across screens, so they
/// live here; each screen owns its own screen-local state (sort, filters,
/// tabs) internally.
class LedgerAppShell extends StatefulWidget {
  const LedgerAppShell({super.key, required this.themeController});

  final ThemeController themeController;

  @override
  State<LedgerAppShell> createState() => _LedgerAppShellState();
}

class _LedgerAppShellState extends State<LedgerAppShell> {
  LedgerScreen _screen = LedgerScreen.holdings;
  String _fy = 'FY 2025–26';

  void _go(LedgerScreen s) => setState(() => _screen = s);

  String get _crumb {
    switch (_screen) {
      case LedgerScreen.holdings:
        return 'Portfolio / Holdings';
      case LedgerScreen.detail:
        return 'Portfolio / Holdings / VAS';
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
                    onOpenDetail: () => _go(LedgerScreen.detail),
                  ),
                  LedgerScreen.detail => HoldingDetailScreen(
                    fy: _fy,
                    wide: wide,
                    horizontalPadding: hPad,
                    onBack: () => _go(LedgerScreen.holdings),
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
                  onOther: () => _go(LedgerScreen.other),
                  isHoldings: _screen == LedgerScreen.holdings,
                  isDetail: _screen == LedgerScreen.detail,
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
