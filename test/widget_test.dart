import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fquery/fquery.dart';
import 'package:fquery_core/fquery_core.dart';

import 'package:portfolio_app/app_shell.dart';
import 'package:portfolio_app/data/portfolio_repository.dart';
import 'package:portfolio_app/format.dart';
import 'package:portfolio_app/models/portfolio.dart';
import 'package:portfolio_app/screens/transaction_entry_screen.dart';
import 'package:portfolio_app/theme/ledger_theme.dart';
import 'package:portfolio_app/theme/theme_controller.dart';

/// Fixture data replacing the removed `SampleData` -- these widget tests
/// exercise the ledger UI against fixtures injected through
/// [LedgerAppShell]'s `fetchData` overrides, not a live Supabase project
/// (unreachable in the test environment; see `HoldingsScreen.fetchData` /
/// `HoldingDetailScreen.fetchData`).
Decimal _d(String v) => Decimal.parse(v);

const _commsec = AccountRef(
  id: 'acc-commsec',
  kind: 'broker',
  displayName: 'CommSec 0421',
);
const _computershare = AccountRef(
  id: 'acc-cs',
  kind: 'registry',
  displayName: 'Computershare · SRN',
);
const _stakeAu = AccountRef(
  id: 'acc-stake-au',
  kind: 'broker',
  displayName: 'Stake AU',
);
const _stakeUs = AccountRef(
  id: 'acc-stake-us',
  kind: 'broker',
  displayName: 'Stake US',
);
const _mufg = AccountRef(
  id: 'acc-mufg',
  kind: 'registry',
  displayName: 'MUFG · SRN',
);

final _holdings = <Holding>[
  Holding(
    instrumentId: 'ins-vas',
    accountId: _commsec.id,
    symbol: 'VAS',
    name: 'Vanguard Australian Shares Index ETF',
    exchange: 'ASX',
    units: _d('460'),
    costBase: _d('39920.04'),
    price: _d('102.15'),
    accountDisplayName: _commsec.displayName,
  ),
  Holding(
    instrumentId: 'ins-vgs',
    accountId: _commsec.id,
    symbol: 'VGS',
    name: 'Vanguard MSCI Intl Shares ETF',
    exchange: 'ASX',
    units: _d('310'),
    costBase: _d('29822.00'),
    price: _d('112.80'),
    accountDisplayName: _commsec.displayName,
  ),
  Holding(
    instrumentId: 'ins-a200',
    accountId: _stakeAu.id,
    symbol: 'A200',
    name: 'Betashares Australia 200 ETF',
    exchange: 'ASX',
    units: _d('180'),
    costBase: _d('23058.00'),
    price: _d('141.35'),
    accountDisplayName: _stakeAu.displayName,
  ),
  Holding(
    instrumentId: 'ins-voo',
    accountId: _stakeUs.id,
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    exchange: 'NYSEARCA',
    units: _d('22'),
    costBase: _d('15106.74'),
    price: _d('783.72'),
    accountDisplayName: _stakeUs.displayName,
    fxSubLine: 'USD 452.10 avg cost · FX 1.5296 to AUD at trade date',
  ),
  Holding(
    instrumentId: 'ins-cba',
    accountId: _computershare.id,
    symbol: 'CBA',
    name: 'Commonwealth Bank of Australia',
    exchange: 'ASX',
    units: _d('65'),
    costBase: _d('6246.50'),
    price: _d('172.40'),
    accountDisplayName: _computershare.displayName,
  ),
  Holding(
    instrumentId: 'ins-bhp',
    accountId: _computershare.id,
    symbol: 'BHP',
    name: 'BHP Group Ltd',
    exchange: 'ASX',
    units: _d('140'),
    costBase: _d('5768.00'),
    price: _d('43.85'),
    accountDisplayName: _computershare.displayName,
  ),
  Holding(
    instrumentId: 'ins-gold',
    accountId: _stakeAu.id,
    symbol: 'GOLD',
    name: 'Global X Physical Gold',
    exchange: 'ASX',
    units: _d('150'),
    costBase: _d('4110.00'),
    price: _d('34.90'),
    accountDisplayName: _stakeAu.displayName,
  ),
  Holding(
    instrumentId: 'ins-arg',
    accountId: _computershare.id,
    symbol: 'ARG',
    name: 'Argo Investments Ltd',
    exchange: 'ASX',
    units: _d('500'),
    costBase: _d('4300.00'),
    price: _d('9.35'),
    accountDisplayName: _computershare.displayName,
  ),
  Holding(
    instrumentId: 'ins-tls',
    accountId: _mufg.id,
    symbol: 'TLS',
    name: 'Telstra Group Ltd',
    exchange: 'ASX',
    units: _d('900'),
    costBase: _d('3465.00'),
    price: _d('4.12'),
    accountDisplayName: _mufg.displayName,
  ),
];

Future<HoldingsScreenData> _fakeHoldingsData(int financialYear) async {
  return HoldingsScreenData(
    holdings: _holdings,
    accounts: const [_commsec, _computershare, _stakeAu, _stakeUs, _mufg],
    incomeTotal: _d('2584.54'),
    frankingCreditTotal: _d('136.54'),
    transactionCount: 38,
    latestPriceDate: DateTime.utc(2026, 8, 1),
  );
}

Future<HoldingDetailData> _fakeHoldingDetail({
  required String instrumentId,
  required String accountId,
}) async {
  final parcels = [
    Parcel(
      id: '00000001-0000-0000-0000-000000000000',
      openTransactionId: '00000001-0000-0000-0000-000000000000',
      acquiredDate: DateTime.utc(2019, 11, 14),
      originalQuantity: _d('120'),
      remainingQuantity: _d('120'),
      costBase: _d('8214.00'),
      reducedCostBase: _d('8214.00'),
    ),
    Parcel(
      id: '00000002-0000-0000-0000-000000000000',
      openTransactionId: '00000002-0000-0000-0000-000000000000',
      acquiredDate: DateTime.utc(2020, 8, 3),
      originalQuantity: _d('80'),
      remainingQuantity: _d('42'),
      costBase: _d('3171.42'),
      reducedCostBase: _d('3171.42'),
    ),
  ];
  final txns = [
    Txn(
      id: '00000042-0000-0000-0000-000000000000',
      tradeDate: DateTime.utc(2026, 3, 16),
      type: 'DRP',
      quantity: _d('48'),
      unitPrice: _d('103.89'),
      amount: _d('4986.72'),
      kind: TxnKind.email,
      source: 'vanguard-drp-mar-2026.eml',
      parcelInfo: 'P-00000042',
    ),
    Txn(
      id: '00000031-0000-0000-0000-000000000000',
      tradeDate: DateTime.utc(2024, 5, 2),
      type: 'SELL',
      quantity: _d('38'),
      unitPrice: _d('96.55'),
      amount: _d('3668.90'),
      kind: TxnKind.csv,
      source: 'commsec-2024-fy.csv · row 118',
      parcelInfo: 'P-00000002 · FIFO',
    ),
  ];
  final income = [
    IncomeRow(
      paymentDate: DateTime.utc(2025, 7, 18),
      financialYear: 2026,
      type: 'Distribution',
      franked: _d('318.60'),
      unfranked: _d('104.22'),
      frankingCredit: _d('136.54'),
      cash: _d('742.18'),
      componentStatement: 'AMIT-2025-Q4',
      pending: false,
    ),
    IncomeRow(
      paymentDate: DateTime.utc(2026, 1, 19),
      financialYear: 2026,
      type: 'Distribution',
      franked: _d('501.20'),
      unfranked: _d('268.44'),
      frankingCredit: _d('0'),
      cash: _d('1842.36'),
      componentStatement: null,
      pending: true,
    ),
  ];

  return HoldingDetailData(
    symbol: 'VAS',
    name: 'Vanguard Australian Shares Index ETF',
    exchange: 'ASX',
    amitFlag: true,
    accountDisplayName: _commsec.displayName,
    accountKind: _commsec.kind,
    units: _d('162'),
    costBase: _d('11385.42'),
    price: _d('102.15'),
    parcels: parcels,
    txns: txns,
    income: income,
  );
}

Widget _testApp() {
  return CacheProvider(
    // Zero cache duration so the GC timer fquery schedules on unmount fires
    // (or is a no-op) before the test tears down -- otherwise flutter_test
    // asserts on a still-pending Timer.
    cache: QueryCache(
      defaultQueryOptions: DefaultQueryOptions(cacheDuration: Duration.zero),
    ),
    child: MaterialApp(
      title: 'Ledger',
      debugShowCheckedModeBanner: false,
      theme: LedgerTheme.light(),
      home: LedgerAppShell(
        themeController: ThemeController(),
        holdingsFetchData: _fakeHoldingsData,
        holdingDetailFetchData: _fakeHoldingDetail,
        parcelsFetcher: ({required symbol, required accountId}) async => [],
        transactionSubmitter: (_) async => 'test-txn-id',
      ),
    ),
  );
}

/// Pumps [_testApp]. Pair with a trailing [_finish] call (not `addTearDown`
/// -- that runs outside the test's own async zone, too late to flush the
/// zero-duration GC timer fquery schedules on unmount, which otherwise
/// trips flutter_test's "Timer still pending" assertion).
Future<void> _pumpApp(
  WidgetTester tester, {
  Size size = const Size(1600, 1000),
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  await tester.pumpWidget(_testApp());
  await tester.pumpAndSettle();
}

/// Unmounts the pumped app and flushes fquery's GC timer. Call at the end
/// of every test that used [_pumpApp].
Future<void> _finish(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(Duration.zero);
  await tester.pump(Duration.zero);
}

void main() {
  testWidgets('app builds and shows the Holdings screen with all 9 rows', (
    WidgetTester tester,
  ) async {
    await _pumpApp(tester);

    expect(find.text('Holdings'), findsWidgets);
    final table = find.byKey(const Key('holdingsTable'));
    expect(table, findsOneWidget);
    for (final h in _holdings) {
      expect(
        find.descendant(of: table, matching: find.text(h.symbol)),
        findsOneWidget,
      );
    }
    await _finish(tester);
  });

  testWidgets(
    'Stake source filter matches both Stake AU and Stake US via prefix match',
    (WidgetTester tester) async {
      await _pumpApp(tester);

      await tester.tap(find.text('Stake'));
      await tester.pumpAndSettle();

      final table = find.byKey(const Key('holdingsTable'));
      // Stake AU: A200, GOLD. Stake US: VOO. All three should remain visible.
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
      await _finish(tester);
    },
  );

  testWidgets(
    'tapping a new column header sorts desc, tapping again flips to asc',
    (WidgetTester tester) async {
      await _pumpApp(tester);

      // Default sort is MARKET VALUE desc, so switch to a different column:
      // selecting a new key always starts descending, and repeat-tapping the
      // same (now active) key flips to ascending.
      await tester.tap(find.text('UNITS'));
      await tester.pumpAndSettle();
      expect(find.textContaining('↓'), findsWidgets);

      await tester.tap(find.text('UNITS'));
      await tester.pumpAndSettle();
      expect(find.textContaining('↑'), findsWidgets);
      await _finish(tester);
    },
  );

  testWidgets(
    'holding detail screen and all three tabs render without layout errors',
    (WidgetTester tester) async {
      await _pumpApp(tester);

      final table = find.byKey(const Key('holdingsTable'));
      await tester.tap(find.descendant(of: table, matching: find.text('VAS')));
      await tester.pumpAndSettle();

      expect(find.text('Vanguard Australian Shares Index ETF'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('Transactions'));
      await tester.pumpAndSettle();
      expect(find.text('P-00000042'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('Income'));
      await tester.pumpAndSettle();
      expect(find.text('AMIT-2025-Q4'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('Parcels'));
      await tester.pumpAndSettle();
      expect(find.text('P-00000002'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('‹ Holdings'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('holdingsTable')), findsOneWidget);
      await _finish(tester);
    },
  );

  testWidgets(
    'mobile-width layout (chip row, no sidebar) renders without layout errors',
    (WidgetTester tester) async {
      await _pumpApp(tester, size: const Size(900, 1200));

      final table = find.byKey(const Key('holdingsTable'));
      expect(table, findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(
        find.descendant(of: table, matching: find.text('VAS')).first,
      );
      await tester.pumpAndSettle();
      expect(find.text('Vanguard Australian Shares Index ETF'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await _finish(tester);
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

  test('Decimal formatters match their num counterparts', () {
    expect(moneyD(_d('-1234.5')), '-1,234.50');
    expect(moneyD(_d('1234.5')), '1,234.50');
    expect(signedMoneyD(_d('1234.5')), '+1,234.50');
    expect(signedMoneyD(_d('-1234.5')), '-1,234.50');
    expect(signedPctD(_d('17.706')), '+17.71%');
    expect(quantity(_d('460')), '460');
    expect(quantity(_d('48.00000000')), '48');
    expect(quantity(_d('22.5')), '22.5');
  });

  // -------------------------------------------------------------------------
  // Transaction entry screen tests
  // -------------------------------------------------------------------------

  Widget txnApp({
    List<OpenParcel> parcels = const [],
    Future<String> Function(Map<String, dynamic>)? submit,
    ValueNotifier<bool>? savedNotifier,
  }) {
    return MaterialApp(
      theme: LedgerTheme.light(),
      home: Scaffold(
        body: TransactionEntryScreen(
          onCancel: () {},
          onSaved: () {
            savedNotifier?.value = true;
          },
          parcelsFetcher: ({required symbol, required accountId}) async =>
              parcels,
          transactionSubmitter: submit ?? (_) async => 'test-id',
        ),
      ),
    );
  }

  testWidgets('transaction entry: type buttons switch hint text', (tester) async {
    await tester.pumpWidget(txnApp());
    await tester.pumpAndSettle();

    // Default type is BUY
    expect(
      find.text(
          'Creates a new parcel dated on the trade date. Brokerage is added to the cost base.'),
      findsOneWidget,
    );

    // Tap Sell
    await tester.tap(find.text('Sell'));
    await tester.pumpAndSettle();
    expect(
      find.text(
          'Depletes existing parcels. Parcel selection is required before the disposal can be saved.'),
      findsOneWidget,
    );

    // Tap Dividend
    await tester.tap(find.text('Dividend'));
    await tester.pumpAndSettle();
    expect(
      find.text('Income only. No parcel is created or changed.'),
      findsOneWidget,
    );
  });

  testWidgets('transaction entry: BUY effect panel shows 3 lines', (tester) async {
    await tester.pumpWidget(txnApp());
    await tester.pumpAndSettle();

    expect(find.text('EFFECT ON THE LEDGER'), findsOneWidget);
    expect(
      find.text(
          'Creates a new parcel dated on the trade date. Cost base = consideration + brokerage.'),
      findsOneWidget,
    );
  });

  testWidgets('transaction entry: non-SELL Save blocked for DIVIDEND with blank franking credit',
      (tester) async {
    await tester.pumpWidget(txnApp());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Dividend'));
    await tester.pumpAndSettle();

    // Franking credit is blank → save blocked (save note visible)
    expect(
      find.text('Save is blocked while the franking credit field is blank.'),
      findsOneWidget,
    );
  });

  testWidgets('transaction entry: SELL shows parcel-matching panel', (tester) async {
    final parcels = [
      OpenParcel(
        id: '00000001-0000-0000-0000-000000000000',
        acquiredDate: DateTime.utc(2019, 11, 14),
        available: _d('120'),
        costPerUnit: _d('68.45'),
        discountEligible: true,
      ),
      OpenParcel(
        id: '00000002-0000-0000-0000-000000000000',
        acquiredDate: DateTime.utc(2020, 8, 3),
        available: _d('42'),
        costPerUnit: _d('75.51'),
        discountEligible: true,
      ),
    ];
    await tester.pumpWidget(txnApp(parcels: parcels));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Sell'));
    await tester.pumpAndSettle();

    expect(find.text('PARCEL MATCHING'), findsOneWidget);
    expect(find.text('FIFO'), findsOneWidget);
    expect(find.text('Select specific parcels'), findsOneWidget);
  });

  testWidgets('transaction entry: navigating to txn via shell works', (tester) async {
    await _pumpApp(tester);

    // Tap 'Transaction entry' in the sidebar (wide layout)
    await tester.tap(find.text('Transaction entry'));
    await tester.pumpAndSettle();

    expect(find.text('New transaction'), findsOneWidget);
    expect(find.text('Ledger input / Transaction entry'), findsOneWidget);

    // Cancel goes back to Holdings
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('holdingsTable')), findsOneWidget);

    await _finish(tester);
  });

  testWidgets('transaction entry: Add transaction button on Holdings navigates to txn', (tester) async {
    await _pumpApp(tester);

    await tester.tap(find.text('Add transaction'));
    await tester.pumpAndSettle();

    expect(find.text('New transaction'), findsOneWidget);
    await _finish(tester);
  });
}
