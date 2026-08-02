import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:portfolio_app/format.dart';
import 'package:portfolio_app/data/sample_data.dart';
import 'package:portfolio_app/app_shell.dart';
import 'package:portfolio_app/theme/ledger_theme.dart';
import 'package:portfolio_app/theme/theme_controller.dart';

/// Pumps the app shell directly, bypassing [MyApp]'s Supabase-backed
/// [AuthGate] — these widget tests exercise the ledger UI against
/// [SampleData], not the auth flow, and Supabase isn't initialized in the
/// test environment.
Widget _testApp({ThemeMode mode = ThemeMode.light}) {
  return MaterialApp(
    title: 'Ledger',
    debugShowCheckedModeBanner: false,
    theme: LedgerTheme.light(),
    darkTheme: LedgerTheme.dark(),
    themeMode: mode,
    home: LedgerAppShell(themeController: ThemeController()),
  );
}

void main() {
  testWidgets('app builds and shows the Holdings screen with all 9 rows', (
    WidgetTester tester,
  ) async {
    tester.view.physicalSize = const Size(1600, 1000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(_testApp());
    await tester.pumpAndSettle();

    expect(find.text('Holdings'), findsWidgets);
    final table = find.byKey(const Key('holdingsTable'));
    expect(table, findsOneWidget);
    for (final h in SampleData.holdings) {
      expect(
        find.descendant(of: table, matching: find.text(h.sym)),
        findsOneWidget,
      );
    }
  });

  testWidgets(
    'Stake source filter matches both Stake AU and Stake US via prefix match',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1600, 1000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(_testApp());
      await tester.pumpAndSettle();

      await tester.tap(find.text('Stake'));
      await tester.pumpAndSettle();

      final table = find.byKey(const Key('holdingsTable'));
      // Stake AU: A200, GOLD. Stake US: VOO. All three symbols should remain.
      expect(
        find.descendant(of: table, matching: find.text('A200')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: table, matching: find.text('GOLD')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: table, matching: find.text('VOO')),
        findsOneWidget,
      );
      // A holding under a different source should be filtered out of the table
      // (it still appears in the sidebar nav label, which is unaffected by the filter).
      expect(
        find.descendant(of: table, matching: find.text('VAS')),
        findsNothing,
      );
    },
  );

  testWidgets(
    'tapping a new column header sorts desc, tapping again flips to asc',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1600, 1000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(_testApp());
      await tester.pumpAndSettle();

      // Default sort is MARKET VALUE desc, so switch to a different column:
      // selecting a new key always starts descending, and repeat-tapping the
      // same (now active) key flips to ascending.
      await tester.tap(find.text('UNITS'));
      await tester.pumpAndSettle();
      expect(find.textContaining('↓'), findsWidgets);

      await tester.tap(find.text('UNITS'));
      await tester.pumpAndSettle();
      expect(find.textContaining('↑'), findsWidgets);
    },
  );

  testWidgets(
    'holding detail screen and all three tabs render without layout errors',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1600, 1000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(_testApp());
      await tester.pumpAndSettle();

      await tester.tap(find.text('VAS').first);
      await tester.pumpAndSettle();

      expect(find.text('Vanguard Australian Shares Index ETF'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('Transactions'));
      await tester.pumpAndSettle();
      expect(find.text('T-0042'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('Income'));
      await tester.pumpAndSettle();
      expect(find.text('AMIT-2025-Q4'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('Parcels'));
      await tester.pumpAndSettle();
      expect(find.text('P-0002'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('‹ Holdings'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('holdingsTable')), findsOneWidget);
    },
  );

  testWidgets(
    'mobile-width layout (chip row, no sidebar) renders without layout errors',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(900, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(_testApp());
      await tester.pumpAndSettle();

      expect(find.text('VAS detail'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('VAS detail'));
      await tester.pumpAndSettle();
      expect(find.text('Vanguard Australian Shares Index ETF'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'app renders under the dark theme without layout errors or a missing '
    'LedgerPalette extension',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1600, 1000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(_testApp(mode: ThemeMode.dark));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('holdingsTable')), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('VAS').first);
      await tester.pumpAndSettle();
      expect(find.text('Vanguard Australian Shares Index ETF'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  test('money formats en-AU grouped 2dp, sign handling matches DC m()', () {
    expect(money(-1234.5), '-1,234.50');
    expect(money(1234.5), '1,234.50');
    expect(money(0), '0.00');
    expect(signedMoney(1234.5), '+1,234.50');
    expect(signedMoney(-1234.5), '-1,234.50');
    expect(signedPct(17.706), '+17.71%');
    expect(signedPct(-4.2), '-4.20%');
  });
}
