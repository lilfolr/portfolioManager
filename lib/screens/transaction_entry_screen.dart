import 'dart:async';

import 'package:decimal/decimal.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/portfolio_repository.dart';
import '../format.dart';
import '../theme/ledger_theme.dart';

// ---------------------------------------------------------------------------
// Transaction type enum + static metadata (ported from TYPES/FIELDS/EFFECTS
// in the DC component's Component class).
// ---------------------------------------------------------------------------

enum _TxnType { buy, sell, drp, div, dist, split, roc, tin }

extension _TxnTypeMeta on _TxnType {
  String get label => const {
        _TxnType.buy: 'Buy',
        _TxnType.sell: 'Sell',
        _TxnType.drp: 'DRP',
        _TxnType.div: 'Dividend',
        _TxnType.dist: 'Distribution',
        _TxnType.split: 'Split / consolidation',
        _TxnType.roc: 'Return of capital',
        _TxnType.tin: 'Transfer in',
      }[this]!;

  String get hint => const {
        _TxnType.buy:
            'Creates a new parcel dated on the trade date. Brokerage is added to the cost base.',
        _TxnType.sell:
            'Depletes existing parcels. Parcel selection is required before the disposal can be saved.',
        _TxnType.drp:
            'Creates a new parcel at the allocation price. The 12-month clock starts on the issue date, not the original holding.',
        _TxnType.div: 'Income only. No parcel is created or changed.',
        _TxnType.dist:
            'Income only. Components are transcribed separately from the annual tax statement.',
        _TxnType.split:
            'Restates units across all open parcels. Total cost base and acquisition dates are unchanged.',
        _TxnType.roc:
            'Reduces the cost base of parcels held at the record date. No income is recorded.',
        _TxnType.tin:
            'Carries the original acquisition date and cost base, so 12-month status is inherited.',
      }[this]!;

  String get dbType => const {
        _TxnType.buy: 'BUY',
        _TxnType.sell: 'SELL',
        _TxnType.drp: 'DRP',
        _TxnType.div: 'DIVIDEND',
        _TxnType.dist: 'DISTRIBUTION',
        _TxnType.split: 'SPLIT',
        _TxnType.roc: 'RETURN_OF_CAPITAL',
        _TxnType.tin: 'TRANSFER_IN',
      }[this]!;

  List<String> get effectLines {
    const map = <_TxnType, List<String>>{
      _TxnType.buy: [
        'Creates a new parcel dated on the trade date. Cost base = consideration + brokerage.',
        'Average cost across the holding updates across all open parcels.',
        'Recorded with manual provenance and the entering user.',
      ],
      _TxnType.drp: [
        'Creates a new parcel dated on the payment date at the allocation price.',
        'The 12-month date for the new parcel runs from the issue date, not the original holding.',
        'Residual cash is held against the holding and is not treated as income.',
      ],
      _TxnType.div: [
        'No parcel change. Recorded against the current financial year income.',
        'Franking credit is stored exactly as stated on the statement.',
        'Appears in the income summary and the FY franking credit total.',
      ],
      _TxnType.dist: [
        'Cash received recorded against the current financial year income.',
        'Marked components pending until the annual tax statement is transcribed.',
        'Tax-deferred and CGT concession components will adjust parcel cost bases on entry.',
      ],
      _TxnType.split: [
        'Units restated across all open parcels at the entered ratio.',
        'Total cost base unchanged; per-unit cost base recalculated per parcel.',
        'Acquisition dates unchanged, so 12-month status is preserved.',
      ],
      _TxnType.roc: [
        'Reduces the cost base of parcels held at record date by the amount per unit.',
        'No income is recorded for this payment.',
        'If a parcel cost base reaches zero, the excess is recorded as a capital gain, itemised per parcel.',
      ],
      _TxnType.tin: [
        'Creates a parcel carrying the original acquisition date and cost base.',
        '12-month status is inherited from the original acquisition, not the transfer date.',
        'Evidence must be attached before the transfer can be confirmed.',
      ],
      _TxnType.sell: [],
    };
    return map[this]!;
  }

  String get saveNote => switch (this) {
        _TxnType.sell =>
          'Save is blocked until every disposed unit is matched to a parcel.',
        _TxnType.div =>
          'Save is blocked while the franking credit field is blank.',
        _ =>
          'Saved records are immutable. Corrections are entered as reversing transactions.',
      };
}

// ---------------------------------------------------------------------------
// Field spec — describes one row in the left-column fields panel.
// ---------------------------------------------------------------------------

class _FieldSpec {
  const _FieldSpec({
    required this.label,
    required this.key,
    this.placeholder = '',
    this.hint = '',
    this.rightAlign = false,
    this.warningIfBlank = false,
    this.readOnly = false,
  });

  final String label;
  final String key;
  final String placeholder;
  final String hint;
  final bool rightAlign;
  final bool warningIfBlank;
  final bool readOnly;
}

const _fieldSpecs = <_TxnType, List<_FieldSpec>>{
  _TxnType.buy: [
    _FieldSpec(label: 'Trade date', key: 'trade_date', placeholder: 'DD/MM/YYYY', hint: 'settlement T+2'),
    _FieldSpec(label: 'Symbol', key: 'symbol', placeholder: 'e.g. VAS', hint: 'ASX'),
    _FieldSpec(label: 'Units', key: 'units', placeholder: '0', rightAlign: true),
    _FieldSpec(label: 'Unit price', key: 'unit_price', placeholder: '0.00', hint: 'AUD', rightAlign: true),
    _FieldSpec(label: 'Brokerage', key: 'brokerage', placeholder: '0.00', hint: 'added to cost base', rightAlign: true),
    _FieldSpec(label: 'Source account', key: 'account', placeholder: 'e.g. CommSec 0421'),
    _FieldSpec(label: 'Reference', key: 'ref', placeholder: 'not stated', hint: 'optional'),
  ],
  _TxnType.sell: [
    _FieldSpec(label: 'Trade date', key: 'trade_date', placeholder: 'DD/MM/YYYY', hint: 'settlement T+2'),
    _FieldSpec(label: 'Symbol', key: 'symbol', placeholder: 'e.g. VAS', hint: 'ASX'),
    _FieldSpec(label: 'Units', key: 'units', placeholder: '0', rightAlign: true),
    _FieldSpec(label: 'Unit price', key: 'unit_price', placeholder: '0.00', hint: 'AUD', rightAlign: true),
    _FieldSpec(label: 'Brokerage', key: 'brokerage', placeholder: '0.00', hint: 'reduces proceeds', rightAlign: true),
    _FieldSpec(label: 'Source account', key: 'account', placeholder: 'e.g. CommSec 0421'),
    _FieldSpec(label: 'Reference', key: 'ref', placeholder: 'not stated', hint: 'optional'),
  ],
  _TxnType.drp: [
    _FieldSpec(label: 'Payment date', key: 'trade_date', placeholder: 'DD/MM/YYYY'),
    _FieldSpec(label: 'Symbol', key: 'symbol', placeholder: 'e.g. VAS', hint: 'ASX'),
    _FieldSpec(label: 'Units issued', key: 'units', placeholder: '0', rightAlign: true),
    _FieldSpec(label: 'Allocation price', key: 'unit_price', placeholder: '0.00', hint: 'AUD', rightAlign: true),
    _FieldSpec(label: 'Residual carried forward', key: 'residual', placeholder: '0.00', hint: 'to next DRP', rightAlign: true),
    _FieldSpec(label: 'Source account', key: 'account', placeholder: 'e.g. Computershare · SRN'),
  ],
  _TxnType.div: [
    _FieldSpec(label: 'Payment date', key: 'trade_date', placeholder: 'DD/MM/YYYY'),
    _FieldSpec(label: 'Symbol', key: 'symbol', placeholder: 'e.g. TLS', hint: 'ASX'),
    _FieldSpec(label: 'Franked amount', key: 'franked', placeholder: '0.00', rightAlign: true),
    _FieldSpec(label: 'Unfranked amount', key: 'unfranked', placeholder: '0.00', rightAlign: true),
    _FieldSpec(
      label: 'Franking credit',
      key: 'franking_credit',
      placeholder: 'not stated',
      hint: 'from statement',
      rightAlign: true,
      warningIfBlank: true,
    ),
    _FieldSpec(label: 'Source account', key: 'account', placeholder: 'e.g. MUFG · SRN'),
  ],
  _TxnType.dist: [
    _FieldSpec(label: 'Payment date', key: 'trade_date', placeholder: 'DD/MM/YYYY'),
    _FieldSpec(label: 'Symbol', key: 'symbol', placeholder: 'e.g. VAS', hint: 'ASX'),
    _FieldSpec(label: 'Cash received', key: 'cash', placeholder: '0.00', rightAlign: true),
    _FieldSpec(label: 'Units at record date', key: 'units', placeholder: '0', rightAlign: true),
    _FieldSpec(label: 'Source account', key: 'account', placeholder: 'e.g. CommSec 0421'),
  ],
  _TxnType.split: [
    _FieldSpec(label: 'Effective date', key: 'trade_date', placeholder: 'DD/MM/YYYY'),
    _FieldSpec(label: 'Symbol', key: 'symbol', placeholder: 'e.g. TLS', hint: 'ASX'),
    _FieldSpec(label: 'Ratio new : old', key: 'ratio', placeholder: 'e.g. 2 : 1', rightAlign: true),
    _FieldSpec(label: 'Applies to', key: 'applies_to', placeholder: 'all open parcels', readOnly: true),
  ],
  _TxnType.roc: [
    _FieldSpec(label: 'Payment date', key: 'trade_date', placeholder: 'DD/MM/YYYY'),
    _FieldSpec(label: 'Symbol', key: 'symbol', placeholder: 'e.g. ARG', hint: 'ASX'),
    _FieldSpec(label: 'Amount per unit', key: 'amount_per_unit', placeholder: '0.0000', rightAlign: true),
    _FieldSpec(label: 'Units at record date', key: 'units', placeholder: '0', rightAlign: true),
    _FieldSpec(label: 'Total', key: 'total', placeholder: '0.00', hint: 'reduces cost base', rightAlign: true, readOnly: true),
    _FieldSpec(label: 'Source account', key: 'account', placeholder: 'e.g. Computershare · SRN'),
  ],
  _TxnType.tin: [
    _FieldSpec(label: 'Transfer date', key: 'trade_date', placeholder: 'DD/MM/YYYY'),
    _FieldSpec(label: 'Symbol', key: 'symbol', placeholder: 'e.g. BHP', hint: 'ASX'),
    _FieldSpec(label: 'Units', key: 'units', placeholder: '0', rightAlign: true),
    _FieldSpec(label: 'Original acquisition date', key: 'orig_date', placeholder: 'DD/MM/YYYY', hint: 'carries over'),
    _FieldSpec(label: 'Original cost base', key: 'orig_cost', placeholder: '0.00', hint: 'carries over', rightAlign: true),
    _FieldSpec(label: 'From', key: 'from_broker', placeholder: 'e.g. external broker'),
    _FieldSpec(label: 'To account', key: 'account', placeholder: 'e.g. Computershare · SRN'),
  ],
};

// ---------------------------------------------------------------------------
// Parcel-match mode
// ---------------------------------------------------------------------------

enum _MatchMode { fifo, specific }

// ---------------------------------------------------------------------------
// Screen widget
// ---------------------------------------------------------------------------

/// The manual transaction entry screen. All state lives here in one class,
/// matching the DC component's flat `state` object pattern.
class TransactionEntryScreen extends StatefulWidget {
  const TransactionEntryScreen({
    super.key,
    required this.onCancel,
    required this.onSaved,
    this.parcelsFetcher = fetchOpenParcels,
    this.transactionSubmitter = submitManualTransaction,
  });

  final VoidCallback onCancel;
  final VoidCallback onSaved;

  final Future<List<OpenParcel>> Function({
    required String symbol,
    required String accountId,
  }) parcelsFetcher;

  final Future<String> Function(Map<String, dynamic> payload) transactionSubmitter;

  @override
  State<TransactionEntryScreen> createState() =>
      _TransactionEntryScreenState();
}

class _TransactionEntryScreenState extends State<TransactionEntryScreen> {
  // -- type + match mode
  _TxnType _type = _TxnType.buy;
  _MatchMode _match = _MatchMode.fifo;

  // -- field controllers keyed by _FieldSpec.key for the active type
  final Map<String, TextEditingController> _ctrl = {};

  // -- SELL: open parcels (loaded on symbol+account change, debounced)
  Future<List<OpenParcel>>? _parcelsFuture;
  Timer? _debounce;
  String _lastParcelKey = ''; // symbol|accountId to avoid spurious reloads

  // -- SELL specific-mode: parcelId -> units string typed by the user
  final Map<String, String> _alloc = {};

  // -- save state
  bool _saving = false;
  String? _saveError;

  // -- hover for type buttons
  _TxnType? _hoverType;

  @override
  void initState() {
    super.initState();
    _initControllers(_type);
  }

  @override
  void dispose() {
    _disposeControllers();
    _debounce?.cancel();
    super.dispose();
  }

  void _initControllers(_TxnType type) {
    _disposeControllers();
    for (final spec in _fieldSpecs[type]!) {
      _ctrl[spec.key] = TextEditingController()
        ..addListener(_onFieldChanged);
    }
    // ROC: auto-compute Total from amount_per_unit * units
    if (type == _TxnType.roc) {
      _ctrl['amount_per_unit']!.addListener(_updateRocTotal);
      _ctrl['units']!.addListener(_updateRocTotal);
    }
  }

  void _disposeControllers() {
    for (final c in _ctrl.values) {
      c.dispose();
    }
    _ctrl.clear();
  }

  void _onFieldChanged() {
    setState(() {});
    if (_type == _TxnType.sell) _scheduleParcelReload();
  }

  void _updateRocTotal() {
    final amt = _parseDecimal(_ctrl['amount_per_unit']?.text ?? '');
    final units = _parseDecimal(_ctrl['units']?.text ?? '');
    final total = (amt * units);
    final formatted = total == Decimal.zero ? '' : total.toStringAsFixed(2);
    final totalCtrl = _ctrl['total'];
    if (totalCtrl != null && totalCtrl.text != formatted) {
      totalCtrl.removeListener(_onFieldChanged);
      totalCtrl.text = formatted;
      totalCtrl.addListener(_onFieldChanged);
    }
  }

  void _scheduleParcelReload() {
    final symbol = (_ctrl['symbol']?.text ?? '').trim().toUpperCase();
    final account = (_ctrl['account']?.text ?? '').trim();
    final key = '$symbol|$account';
    if (key == _lastParcelKey) return;
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      if (!mounted) return;
      if (symbol.isEmpty || account.isEmpty) {
        setState(() {
          _parcelsFuture = null;
          _lastParcelKey = key;
          _alloc.clear();
        });
        return;
      }
      setState(() {
        _lastParcelKey = key;
        _alloc.clear();
        _parcelsFuture = widget.parcelsFetcher(
          symbol: symbol,
          accountId: account,
        );
      });
    });
  }

  void _setType(_TxnType t) {
    setState(() {
      _type = t;
      _match = _MatchMode.fifo;
      _alloc.clear();
      _parcelsFuture = null;
      _lastParcelKey = '';
      _saveError = null;
      _initControllers(t);
    });
  }

  // -- FIFO allocation: pure function, oldest parcels first
  Map<String, int> _fifoAlloc(List<OpenParcel> parcels, int want) {
    final result = <String, int>{};
    int left = want;
    for (final p in parcels) {
      if (left <= 0) break;
      final avail = p.available.toBigInt().toInt();
      final use = left < avail ? left : avail;
      if (use > 0) result[p.id] = use;
      left -= use;
    }
    return result;
  }

  Map<String, int> _effectiveAlloc(List<OpenParcel> parcels) {
    if (_match == _MatchMode.fifo) {
      return _fifoAlloc(parcels, _wantUnits);
    }
    final result = <String, int>{};
    for (final p in parcels) {
      final v = int.tryParse(_alloc[p.id] ?? '') ?? 0;
      if (v > 0) result[p.id] = v;
    }
    return result;
  }

  int get _wantUnits => int.tryParse(_ctrl['units']?.text.trim() ?? '') ?? 0;

  Decimal _parseDecimal(String s) {
    final cleaned = s.replaceAll(',', '').trim();
    return cleaned.isEmpty ? Decimal.zero : (Decimal.tryParse(cleaned) ?? Decimal.zero);
  }

  bool get _canSave {
    if (_saving) return false;
    if (_type == _TxnType.sell) return false; // evaluated in FutureBuilder
    if (_type == _TxnType.div) {
      final fc = _ctrl['franking_credit']?.text.trim() ?? '';
      return fc.isNotEmpty;
    }
    return true;
  }

  // Build the payload for confirm_staged_row's parsed_payload.
  Map<String, dynamic> _buildPayload({Map<String, int>? parcelAlloc}) {
    final payload = <String, dynamic>{
      'type': _type.dbType,
      'trade_date': _ctrl['trade_date']?.text.trim() ?? '',
      'account_id': _ctrl['account']?.text.trim() ?? '',
    };
    if (_ctrl.containsKey('symbol')) {
      payload['symbol'] = _ctrl['symbol']!.text.trim().toUpperCase();
    }
    if (_ctrl.containsKey('units')) {
      payload['quantity'] = _ctrl['units']!.text.trim();
    }
    if (_ctrl.containsKey('unit_price')) {
      payload['unit_price'] = _ctrl['unit_price']!.text.trim();
    }
    if (_ctrl.containsKey('brokerage')) {
      payload['brokerage'] = _ctrl['brokerage']!.text.trim();
    }
    if (_ctrl.containsKey('ref')) {
      payload['external_ref'] = _ctrl['ref']!.text.trim();
    }
    if (_ctrl.containsKey('orig_date')) {
      payload['original_acquisition_date'] = _ctrl['orig_date']!.text.trim();
    }
    if (_ctrl.containsKey('orig_cost')) {
      payload['original_cost_base'] = _ctrl['orig_cost']!.text.trim();
    }
    if (parcelAlloc != null) {
      payload['parcel_allocation'] = parcelAlloc;
    }
    return payload;
  }

  Future<void> _save({bool andAnother = false, Map<String, int>? parcelAlloc}) async {
    setState(() {
      _saving = true;
      _saveError = null;
    });
    try {
      await widget.transactionSubmitter(_buildPayload(parcelAlloc: parcelAlloc));
      if (!mounted) return;
      if (andAnother) {
        setState(() {
          _saving = false;
          _initControllers(_type);
          _alloc.clear();
          _parcelsFuture = null;
          _lastParcelKey = '';
        });
      } else {
        widget.onSaved();
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _saveError = e.toString();
      });
    }
  }

  String _sessionEmail() {
    try {
      return Supabase.instance.client.auth.currentUser?.email ?? 'manual';
    } catch (_) {
      return 'manual';
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    return LayoutBuilder(
      builder: (context, constraints) {
        final narrow = constraints.maxWidth < 600;
        return SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(c),
              _buildTypePicker(c),
              Container(height: 1, color: c.borderSubtle),
              narrow ? _buildNarrowLayout(c) : _buildWideLayout(c),
            ],
          ),
        );
      },
    );
  }

  // -- header: title + cancel button
  Widget _buildHeader(LedgerPalette c) {
    final today = _formatToday();
    final email = _sessionEmail();
    return Padding(
      padding: const EdgeInsets.fromLTRB(26, 22, 26, 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'New transaction',
                  style: LedgerText.sans(
                    size: 22,
                    weight: FontWeight.w600,
                    letterSpacing: -0.33,
                    color: c.ink,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Manual entry · provenance recorded as manual, $email, $today',
                  style: LedgerText.mono(
                    size: 12,
                    color: c.textMuted,
                    tabular: false,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          _OutlineButton(label: 'Cancel', onTap: widget.onCancel),
        ],
      ),
    );
  }

  // -- type picker row + hint
  Widget _buildTypePicker(LedgerPalette c) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(26, 0, 26, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('TRANSACTION TYPE', style: LedgerText.eyebrow(color: c.textFaint)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: _TxnType.values.map((t) {
              final selected = _type == t;
              final hover = _hoverType == t;
              return MouseRegion(
                cursor: SystemMouseCursors.click,
                onEnter: (_) => setState(() => _hoverType = t),
                onExit: (_) => setState(() => _hoverType = null),
                child: GestureDetector(
                  onTap: () => _setType(t),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 120),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: selected
                          ? c.ink
                          : hover
                              ? c.surfaceHover
                              : c.surfaceCard,
                      border: Border.all(
                        color: selected
                            ? c.ink
                            : hover
                                ? c.borderControlHover
                                : c.borderControl,
                      ),
                      borderRadius: BorderRadius.circular(5),
                    ),
                    child: Text(
                      t.label,
                      style: LedgerText.sans(
                        size: 12.5,
                        color: selected ? c.surfacePage : c.textStrong,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 10),
          Text(
            _type.hint,
            style: LedgerText.sans(size: 12, height: 1.5, color: c.textMid),
          ),
        ],
      ),
    );
  }

  Widget _buildWideLayout(LedgerPalette c) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 340, maxWidth: 420),
            child: Container(
              decoration: BoxDecoration(
                color: c.surfaceTopBar,
                border: Border(right: BorderSide(color: c.borderSubtle)),
              ),
              padding: const EdgeInsets.all(24),
              child: _buildFieldsPanel(c),
            ),
          ),
          Expanded(child: _buildRightPanel(c)),
        ],
      ),
    );
  }

  Widget _buildNarrowLayout(LedgerPalette c) {
    return Column(
      children: [
        Container(
          color: c.surfaceTopBar,
          padding: const EdgeInsets.all(20),
          child: _buildFieldsPanel(c),
        ),
        _buildRightPanel(c),
      ],
    );
  }

  // -- left column: field list + consideration + save buttons
  Widget _buildFieldsPanel(LedgerPalette c) {
    final specs = _fieldSpecs[_type]!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${_type.label.toUpperCase()} DETAILS',
          style: LedgerText.eyebrow(color: c.textFaint),
        ),
        const SizedBox(height: 16),
        for (final spec in specs) ...[
          _buildField(c, spec),
          const SizedBox(height: 13),
        ],
        const SizedBox(height: 5),
        ..._buildConsideration(c),
        const SizedBox(height: 18),
        _buildSaveButtons(c),
        const SizedBox(height: 9),
        if (_saveError != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(
              _saveError!,
              style: LedgerText.mono(
                size: 10.5,
                color: c.negative,
                height: 1.55,
                tabular: false,
              ),
            ),
          ),
        Text(
          _type.saveNote,
          style: LedgerText.mono(
            size: 10.5,
            color: c.textFaint,
            height: 1.55,
            tabular: false,
          ),
        ),
      ],
    );
  }

  Widget _buildField(LedgerPalette c, _FieldSpec spec) {
    final ctrl = _ctrl[spec.key]!;
    final blank = ctrl.text.trim().isEmpty;
    final warn = spec.warningIfBlank && blank;
    final borderColor = warn ? c.borderWarnBox : c.borderControl;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(spec.label,
                style: LedgerText.sans(size: 11.5, color: c.textMid)),
            if (spec.hint.isNotEmpty)
              Text(spec.hint,
                  style: LedgerText.mono(
                      size: 10.5, color: c.textFaint, tabular: false)),
          ],
        ),
        const SizedBox(height: 5),
        Focus(
          child: Builder(
            builder: (ctx) {
              final focused = Focus.of(ctx).hasFocus;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                height: 32,
                decoration: BoxDecoration(
                  color: spec.readOnly ? c.surfaceActive : c.surfaceCard,
                  border: Border.all(
                    color: focused ? c.link : borderColor,
                  ),
                  borderRadius: BorderRadius.circular(5),
                  boxShadow: focused
                      ? [
                          BoxShadow(
                            color: c.link.withValues(alpha: 0.10),
                            blurRadius: 0,
                            spreadRadius: 3,
                          )
                        ]
                      : null,
                ),
                child: TextField(
                  controller: ctrl,
                  readOnly: spec.readOnly,
                  textAlign:
                      spec.rightAlign ? TextAlign.right : TextAlign.left,
                  style: LedgerText.mono(size: 13, color: c.ink),
                  decoration: InputDecoration(
                    hintText: spec.placeholder,
                    hintStyle: LedgerText.mono(
                        size: 13, color: c.textFaint, tabular: false),
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                    border: InputBorder.none,
                    isDense: true,
                  ),
                ),
              );
            },
          ),
        ),
        if (spec.warningIfBlank && blank)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Not stated in the source. Enter from the statement — this value is never derived.',
              style: LedgerText.mono(
                  size: 10.5,
                  color: c.heldNotYetFg,
                  height: 1.45,
                  tabular: false),
            ),
          ),
      ],
    );
  }

  List<Widget> _buildConsideration(LedgerPalette c) {
    if (_type == _TxnType.buy) {
      final units = _parseDecimal(_ctrl['units']?.text ?? '');
      final price = _parseDecimal(_ctrl['unit_price']?.text ?? '');
      final brok = _parseDecimal(_ctrl['brokerage']?.text ?? '');
      final consideration = units * price;
      final costBase = consideration + brok;
      return [
        _considerationRow(c, 'Consideration', moneyD(consideration), bold: false),
        _considerationRow(c, 'Plus brokerage', '+${moneyD(brok)}', bold: false),
        _considerationRow(c, 'Cost base of new parcel', moneyD(costBase), bold: true),
      ];
    }
    if (_type == _TxnType.sell) {
      final units = _parseDecimal(_ctrl['units']?.text ?? '');
      final price = _parseDecimal(_ctrl['unit_price']?.text ?? '');
      final brok = _parseDecimal(_ctrl['brokerage']?.text ?? '');
      final gross = units * price;
      final net = gross - brok;
      return [
        _considerationRow(c, 'Gross proceeds', moneyD(gross), bold: false),
        _considerationRow(c, 'Less brokerage', '-${moneyD(brok)}', bold: false),
        _considerationRow(c, 'Net proceeds', moneyD(net), bold: true),
      ];
    }
    return [];
  }

  Widget _considerationRow(LedgerPalette c, String label, String value,
      {required bool bold}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: LedgerText.sans(
                size: 11.5,
                color: bold ? c.ink : c.textMid,
                weight: bold ? FontWeight.w500 : FontWeight.w400),
          ),
          Text(
            value,
            style: LedgerText.mono(
                size: bold ? 14 : 12.5,
                weight: bold ? FontWeight.w500 : FontWeight.w400,
                color: bold ? c.ink : c.textMid),
          ),
        ],
      ),
    );
  }

  Widget _buildSaveButtons(LedgerPalette c) {
    // canSave for non-SELL types is already computable here.
    // For SELL it's handled separately inside the FutureBuilder.
    final canSave = _type == _TxnType.sell ? false : _canSave;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _SaveButton(
          label: 'Save transaction',
          enabled: canSave,
          loading: _saving,
          onTap: canSave ? () => _save() : null,
          c: c,
        ),
        _OutlineButton(
          label: 'Save and add another',
          onTap: canSave ? () => _save(andAnother: true) : null,
          muted: !canSave,
        ),
      ],
    );
  }

  // -- right panel
  Widget _buildRightPanel(LedgerPalette c) {
    if (_type == _TxnType.sell) {
      return _buildSellPanel(c);
    }
    return _buildEffectPanel(c);
  }

  // -- non-SELL: "Effect on the ledger"
  Widget _buildEffectPanel(LedgerPalette c) {
    final lines = _type.effectLines;
    return Padding(
      padding: const EdgeInsets.fromLTRB(26, 20, 26, 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('EFFECT ON THE LEDGER', style: LedgerText.eyebrow(color: c.textFaint)),
          const SizedBox(height: 14),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: c.borderSubtle),
              borderRadius: BorderRadius.circular(6),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (var i = 0; i < lines.length; i++)
                  Container(
                    decoration: BoxDecoration(
                      color: c.surfaceCard,
                      border: i < lines.length - 1
                          ? Border(bottom: BorderSide(color: c.borderRow))
                          : null,
                    ),
                    padding: const EdgeInsets.fromLTRB(15, 13, 15, 13),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (i + 1).toString().padLeft(2, '0'),
                          style: LedgerText.mono(
                              size: 11, color: c.iconMuted, tabular: false),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            lines[i],
                            style: LedgerText.sans(
                                size: 12.5, height: 1.6, color: c.textStrong),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.fromLTRB(15, 12, 15, 12),
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
                    'No classification is inferred. Where a statement does not state a value, the field stays blank and the transaction saves as incomplete rather than being estimated.',
                    style: LedgerText.sans(
                        size: 12, height: 1.6, color: c.textStrong),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // -- SELL right panel: parcel matching, disposal result, allocation status
  Widget _buildSellPanel(LedgerPalette c) {
    final symbol = (_ctrl['symbol']?.text ?? '').trim().toUpperCase();
    final account = (_ctrl['account']?.text ?? '').trim();
    final hasInput = symbol.isNotEmpty && account.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header: title + FIFO / Specific toggle
        Padding(
          padding: const EdgeInsets.fromLTRB(26, 18, 26, 0),
          child: Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.start,
            spacing: 16,
            runSpacing: 10,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('PARCEL MATCHING',
                      style: LedgerText.eyebrow(color: c.textFaint)),
                  const SizedBox(height: 7),
                  RichText(
                    text: TextSpan(
                      style: LedgerText.sans(size: 13, height: 1.4, color: c.textStrong),
                      children: [
                        const TextSpan(text: 'Disposing '),
                        TextSpan(
                          text: _ctrl['units']?.text.isNotEmpty == true
                              ? _ctrl['units']!.text
                              : '–',
                          style: LedgerText.mono(
                              size: 13, color: c.textStrong, tabular: false),
                        ),
                        const TextSpan(text: ' units of '),
                        TextSpan(
                          text: symbol.isNotEmpty ? symbol : '–',
                          style: LedgerText.mono(
                              size: 13, color: c.textStrong, tabular: false),
                        ),
                        const TextSpan(text: ' — every unit must be matched.'),
                      ],
                    ),
                  ),
                ],
              ),
              // FIFO / Specific toggle
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: c.borderControl),
                  borderRadius: BorderRadius.circular(5),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _MatchToggleChip(
                      label: 'FIFO',
                      selected: _match == _MatchMode.fifo,
                      onTap: () => setState(() {
                        _match = _MatchMode.fifo;
                        _alloc.clear();
                      }),
                      leftRounded: true,
                      c: c,
                    ),
                    Container(width: 1, color: c.borderSubtle),
                    _MatchToggleChip(
                      label: 'Select specific parcels',
                      selected: _match == _MatchMode.specific,
                      onTap: () => setState(() {
                        _match = _MatchMode.specific;
                        _alloc.clear();
                      }),
                      leftRounded: false,
                      c: c,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        // Method note
        Padding(
          padding: const EdgeInsets.fromLTRB(26, 10, 26, 14),
          child: Text(
            _match == _MatchMode.fifo
                ? 'Oldest parcels are consumed first. Units used are calculated, not editable — switch to specific selection to choose parcels yourself.'
                : 'Enter units against any parcel. Each parcel shows the gain that allocation produces as you type.',
            style: LedgerText.mono(
                size: 11.5, height: 1.55, color: c.textMuted, tabular: false),
          ),
        ),
        // Parcel table + cards
        if (!hasInput)
          Padding(
            padding: const EdgeInsets.fromLTRB(26, 0, 26, 22),
            child: Text(
              'Enter symbol and source account to load open parcels.',
              style: LedgerText.sans(size: 13, color: c.textMuted),
            ),
          )
        else
          FutureBuilder<List<OpenParcel>>(
            future: _parcelsFuture,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 26, vertical: 8),
                  child: LinearProgressIndicator(),
                );
              }
              if (snap.hasError) {
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 26),
                  child: Text(
                    'Could not load parcels: ${snap.error}',
                    style: LedgerText.sans(size: 13, color: c.negative),
                  ),
                );
              }
              final parcels = snap.data ?? [];
              if (parcels.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 26),
                  child: Text(
                    'No open parcels found for $symbol / $account.',
                    style: LedgerText.sans(size: 13, color: c.textMuted),
                  ),
                );
              }
              return _buildSellTable(c, parcels);
            },
          ),
      ],
    );
  }

  Widget _buildSellTable(LedgerPalette c, List<OpenParcel> parcels) {
    final alloc = _effectiveAlloc(parcels);
    final want = _wantUnits;
    final price = _parseDecimal(_ctrl['unit_price']?.text ?? '');
    final brok = _parseDecimal(_ctrl['brokerage']?.text ?? '');

    int allocUnits = 0;
    Decimal totalCostUsed = Decimal.zero;
    Decimal totalGain = Decimal.zero;
    Decimal totalGainLong = Decimal.zero;

    for (final p in parcels) {
      final use = alloc[p.id] ?? 0;
      final costUsed = p.costPerUnit * Decimal.fromInt(use);
      final gain = price * Decimal.fromInt(use) - costUsed;
      allocUnits += use;
      totalCostUsed += costUsed;
      totalGain += gain;
      if (p.discountEligible) totalGainLong += gain;
    }

    final short = want - allocUnits;
    final over = allocUnits > want;
    final complete = short == 0 && want > 0;
    final proceeds = price * Decimal.fromInt(want) - brok;
    final canSaveNow = complete;

    // Allocation bar segments
    final barSegments = <({double pct, Color color})>[];
    int run = 0;
    final total = want > 0 ? want : 1;
    for (final p in parcels) {
      final use = alloc[p.id] ?? 0;
      if (use == 0) continue;
      final within = (use < want - run) ? use : (want - run < 0 ? 0 : want - run);
      final excess = use - within;
      if (within > 0) {
        barSegments.add((pct: within / total, color: c.link));
        run += within;
      }
      if (excess > 0) {
        barSegments.add((pct: excess / total, color: c.negative));
      }
    }
    if (short > 0) {
      barSegments.add((pct: short / total, color: c.borderControl));
    }

    const colWidths = [88.0, 108.0, 82.0, 96.0, 108.0, 116.0, 124.0, 118.0];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Parcel table
        Container(
          decoration: BoxDecoration(
            border: Border(top: BorderSide(color: c.borderSidebar)),
          ),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: SizedBox(
              width: colWidths.fold<double>(0, (s, w) => s + w),
              child: Column(
                children: [
                  // Header
                  Container(
                    decoration: BoxDecoration(
                      color: c.surfaceTable,
                      border: Border(bottom: BorderSide(color: c.borderHeaderRule)),
                    ),
                    child: Row(
                      children: [
                        _sellHeader(colWidths[0], 'PARCEL', false, c),
                        _sellHeader(colWidths[1], 'ACQUIRED', false, c),
                        _sellHeader(colWidths[2], 'AVAIL', true, c),
                        _sellHeader(colWidths[3], 'COST / UNIT', true, c),
                        _sellHeader(colWidths[4], 'UNITS USED', true, c),
                        _sellHeader(colWidths[5], 'COST BASE USED', true, c),
                        _sellHeader(colWidths[6], 'GAIN ON PARCEL', true, c),
                        _sellHeader(colWidths[7], '12-MONTH', false, c),
                      ],
                    ),
                  ),
                  // Rows
                  for (final p in parcels) _buildParcelRow(c, p, alloc, price, colWidths),
                  // Totals row
                  Container(
                    decoration: BoxDecoration(
                      color: c.surfaceTable,
                      border: Border(top: BorderSide(color: c.borderTotalRule, width: 1.5)),
                    ),
                    child: Row(
                      children: [
                        SizedBox(
                          width: colWidths[0],
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                            child: Text('ALLOCATED',
                                style: LedgerText.mono(
                                    size: 11,
                                    weight: FontWeight.w500,
                                    color: c.textMid,
                                    letterSpacing: 0.9,
                                    tabular: false)),
                          ),
                        ),
                        SizedBox(width: colWidths[1]),
                        SizedBox(width: colWidths[2]),
                        SizedBox(width: colWidths[3]),
                        SizedBox(
                          width: colWidths[4],
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                            child: Align(
                              alignment: Alignment.centerRight,
                              child: Text(
                                '$allocUnits',
                                style: LedgerText.mono(
                                    size: 13,
                                    weight: FontWeight.w500,
                                    color: complete
                                        ? c.positive
                                        : over
                                            ? c.negative
                                            : c.ink),
                              ),
                            ),
                          ),
                        ),
                        SizedBox(
                          width: colWidths[5],
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                            child: Align(
                              alignment: Alignment.centerRight,
                              child: Text(moneyD(totalCostUsed),
                                  style: LedgerText.mono(
                                      size: 13,
                                      weight: FontWeight.w500,
                                      color: c.textStrong)),
                            ),
                          ),
                        ),
                        SizedBox(
                          width: colWidths[6],
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                            child: Align(
                              alignment: Alignment.centerRight,
                              child: Text(
                                '${totalGain >= Decimal.zero ? '+' : ''}${moneyD(totalGain)}',
                                style: LedgerText.mono(
                                    size: 13,
                                    weight: FontWeight.w500,
                                    color: totalGain >= Decimal.zero
                                        ? c.positive
                                        : c.negative),
                              ),
                            ),
                          ),
                        ),
                        SizedBox(width: colWidths[7]),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        // Bottom cards: disposal result + allocation status
        Padding(
          padding: const EdgeInsets.fromLTRB(26, 16, 26, 22),
          child: Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              // Disposal result card
              ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 250),
                child: Container(
                  padding: const EdgeInsets.all(15),
                  decoration: BoxDecoration(
                    border: Border.all(color: c.borderSubtle),
                    borderRadius: BorderRadius.circular(6),
                    color: c.surfaceTopBar,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('DISPOSAL RESULT', style: LedgerText.eyebrow(color: c.textFaint)),
                      const SizedBox(height: 11),
                      _resultLine(c, 'Units disposed', '$want', bold: false),
                      _resultLine(c, 'Net proceeds', moneyD(proceeds), bold: false),
                      _resultLine(c, 'Cost base used', moneyD(totalCostUsed), bold: false),
                      Container(height: 1, color: c.borderSubtle, margin: const EdgeInsets.symmetric(vertical: 8)),
                      _resultLine(c, 'Gross capital gain',
                          '${totalGain >= Decimal.zero ? '+' : ''}${moneyD(totalGain)}',
                          bold: true,
                          valueColor: totalGain >= Decimal.zero ? c.positive : c.negative),
                      _resultLine(c, 'From parcels held over 12 months',
                          '${totalGainLong >= Decimal.zero ? '+' : ''}${moneyD(totalGainLong)}',
                          bold: false,
                          valueColor: c.textMid,
                          labelColor: c.textMuted),
                      const SizedBox(height: 11),
                      Text(
                        'CGT discount is not applied here. The FY capital gains report states discountable and non-discountable amounts separately.',
                        style: LedgerText.mono(
                            size: 10.5, height: 1.55, color: c.textFaint, tabular: false),
                      ),
                    ],
                  ),
                ),
              ),
              // Allocation status card
              ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 250),
                child: _buildStatusCard(c, complete, over, short, allocUnits, want, barSegments, canSaveNow, parcels, alloc),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildParcelRow(
    LedgerPalette c,
    OpenParcel p,
    Map<String, int> alloc,
    Decimal price,
    List<double> colWidths,
  ) {
    final use = alloc[p.id] ?? 0;
    final costUsed = p.costPerUnit * Decimal.fromInt(use);
    final gain = price * Decimal.fromInt(use) - costUsed;
    final isFifo = _match == _MatchMode.fifo;

    return Container(
      decoration: BoxDecoration(
        color: use > 0 ? c.surfaceParcelTint : c.surfaceCard,
        border: Border(bottom: BorderSide(color: c.borderRow)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: colWidths[0],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Text('P-${p.id.substring(0, 8)}',
                  style: LedgerText.mono(size: 12, color: c.textMid)),
            ),
          ),
          SizedBox(
            width: colWidths[1],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Text(_fmtDate(p.acquiredDate),
                  style: LedgerText.mono(size: 12.5, color: c.textStrong)),
            ),
          ),
          SizedBox(
            width: colWidths[2],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Align(
                alignment: Alignment.centerRight,
                child: Text(p.available.toString(),
                    style: LedgerText.mono(size: 12.5, color: c.textMid)),
              ),
            ),
          ),
          SizedBox(
            width: colWidths[3],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Align(
                alignment: Alignment.centerRight,
                child: Text(moneyD(p.costPerUnit),
                    style: LedgerText.mono(size: 12.5, color: c.textMid)),
              ),
            ),
          ),
          // Units used input (FIFO: read-only; Specific: editable)
          SizedBox(
            width: colWidths[4],
            child: Padding(
              padding: const EdgeInsets.fromLTRB(5, 5, 10, 5),
              child: Container(
                height: 28,
                decoration: BoxDecoration(
                  color: isFifo ? c.surfaceActive : c.surfaceCard,
                  border: Border.all(
                    color: isFifo ? c.borderSubtle : (use > 0 ? c.borderControlHover : c.borderControl),
                  ),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: TextField(
                  controller: TextEditingController(text: use > 0 ? '$use' : ''),
                  readOnly: isFifo,
                  textAlign: TextAlign.right,
                  style: LedgerText.mono(
                      size: 12.5,
                      color: isFifo ? c.textMid : c.ink),
                  decoration: InputDecoration(
                    hintText: '0',
                    hintStyle: LedgerText.mono(
                        size: 12.5, color: c.textFaint, tabular: false),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 0),
                    border: InputBorder.none,
                    isDense: true,
                  ),
                  onChanged: isFifo
                      ? null
                      : (v) {
                          setState(() {
                            _alloc[p.id] = v.replaceAll(RegExp(r'[^0-9]'), '');
                          });
                        },
                ),
              ),
            ),
          ),
          SizedBox(
            width: colWidths[5],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Align(
                alignment: Alignment.centerRight,
                child: Text(
                  use > 0 ? moneyD(costUsed) : '—',
                  style: LedgerText.mono(
                      size: 12.5,
                      color: use > 0 ? c.textStrong : c.iconMuted),
                ),
              ),
            ),
          ),
          SizedBox(
            width: colWidths[6],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Align(
                alignment: Alignment.centerRight,
                child: Text(
                  use > 0
                      ? '${gain >= Decimal.zero ? '+' : ''}${moneyD(gain)}'
                      : '—',
                  style: LedgerText.mono(
                      size: 12.5,
                      color: use > 0
                          ? (gain >= Decimal.zero ? c.positive : c.negative)
                          : c.iconMuted),
                ),
              ),
            ),
          ),
          SizedBox(
            width: colWidths[7],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: use > 0
                  ? _HeldPill(eligible: p.discountEligible, c: c)
                  : Text(
                      p.discountEligible ? 'eligible' : 'not yet',
                      style: LedgerText.mono(
                          size: 10.5,
                          color: c.iconMuted,
                          tabular: false),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusCard(
    LedgerPalette c,
    bool complete,
    bool over,
    int short,
    int allocUnits,
    int want,
    List<({double pct, Color color})> barSegments,
    bool canSaveNow,
    List<OpenParcel> parcels,
    Map<String, int> alloc,
  ) {
    final borderColor =
        complete ? c.heldEligibleBorder : over ? c.negative.withValues(alpha: 0.4) : c.borderWarnBox;
    final bgColor =
        complete ? c.heldEligibleBg : over ? c.negative.withValues(alpha: 0.06) : c.surfaceWarnBox;
    final dotColor =
        complete ? c.positive : over ? c.negative : c.pendingAmber;
    final titleColor =
        complete ? c.positive : over ? c.negative : c.pendingText;
    final labelColor =
        complete ? c.heldEligibleFg : over ? c.negative.withValues(alpha: 0.7) : c.pendingText.withValues(alpha: 0.7);
    final title = complete
        ? 'Allocation complete'
        : over
            ? 'Over-allocated by ${-short} units'
            : '$short units unallocated';
    final body = complete
        ? () {
            final n = alloc.values.where((v) => v > 0).length;
            return 'All $want units are matched across $n ${n == 1 ? 'parcel' : 'parcels'}.';
          }()
        : over
            ? 'Reduce a parcel allocation before saving. Allocated units cannot exceed the units being disposed.'
            : 'Allocate the remaining units to parcels. The disposal cannot be saved while any unit is unmatched.';

    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: bgColor,
        border: Border.all(color: borderColor),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('ALLOCATION STATUS', style: LedgerText.eyebrow(color: labelColor)),
          const SizedBox(height: 11),
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Text(title,
                    style: LedgerText.sans(
                        size: 13, weight: FontWeight.w500, color: titleColor)),
              ),
            ],
          ),
          const SizedBox(height: 7),
          Text(body, style: LedgerText.sans(size: 11.5, height: 1.6, color: c.textMid)),
          const Spacer(),
          const SizedBox(height: 12),
          // Allocation bar
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: SizedBox(
              height: 6,
              child: Row(
                children: [
                  for (final seg in barSegments)
                    Flexible(
                      flex: (seg.pct * 1000).round(),
                      child: Container(color: seg.color, height: 6),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            over
                ? '$want units to dispose · ${-short} units in excess'
                : '$allocUnits of $want units allocated',
            style: LedgerText.mono(size: 10.5, color: labelColor, tabular: false),
          ),
          // Save buttons for SELL (inside the status card so canSave is accessible)
          if (canSaveNow) ...[
            const SizedBox(height: 14),
            Container(height: 1, color: borderColor.withValues(alpha: 0.5)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _SaveButton(
                  label: 'Save transaction',
                  enabled: canSaveNow,
                  loading: _saving,
                  onTap: () => _save(parcelAlloc: _effectiveAlloc(parcels)),
                  c: c,
                ),
                _OutlineButton(
                  label: 'Save and add another',
                  onTap: () => _save(andAnother: true, parcelAlloc: _effectiveAlloc(parcels)),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _sellHeader(double w, String label, bool right, LedgerPalette c) {
    return SizedBox(
      width: w,
      child: Padding(
        padding: EdgeInsets.fromLTRB(w == 88 ? 14 : 12, 9, w == 118 ? 14 : 12, 9),
        child: Align(
          alignment: right ? Alignment.centerRight : Alignment.centerLeft,
          child: Text(label, style: LedgerText.columnLabel(color: c.textMuted)),
        ),
      ),
    );
  }

  Widget _resultLine(
    LedgerPalette c,
    String label,
    String value, {
    required bool bold,
    Color? valueColor,
    Color? labelColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label,
              style: LedgerText.sans(
                  size: bold ? 11.5 : 11.5,
                  color: labelColor ?? (bold ? c.ink : c.textMid)),
            ),
          ),
          Text(
            value,
            style: LedgerText.mono(
                size: bold ? 14 : 12.5,
                weight: bold ? FontWeight.w500 : FontWeight.w400,
                color: valueColor ?? (bold ? c.ink : c.textMid)),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Small reusable widgets
// ---------------------------------------------------------------------------

class _OutlineButton extends StatefulWidget {
  const _OutlineButton({
    required this.label,
    this.onTap,
    this.muted = false,
  });

  final String label;
  final VoidCallback? onTap;
  final bool muted;

  @override
  State<_OutlineButton> createState() => _OutlineButtonState();
}

class _OutlineButtonState extends State<_OutlineButton> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final c = LedgerColors.of(context);
    return MouseRegion(
      cursor: widget.onTap != null
          ? SystemMouseCursors.click
          : SystemMouseCursors.basic,
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          height: 33,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _hover && widget.onTap != null ? c.surfaceHover : c.surfaceCard,
            border: Border.all(color: c.borderButton),
            borderRadius: BorderRadius.circular(5),
          ),
          child: Text(
            widget.label,
            style: LedgerText.sans(
              size: 12.5,
              color: widget.muted ? c.textFaint : c.textStrong,
            ),
          ),
        ),
      ),
    );
  }
}

class _SaveButton extends StatefulWidget {
  const _SaveButton({
    required this.label,
    required this.enabled,
    required this.loading,
    required this.c,
    this.onTap,
  });

  final String label;
  final bool enabled;
  final bool loading;
  final VoidCallback? onTap;
  final LedgerPalette c;

  @override
  State<_SaveButton> createState() => _SaveButtonState();
}

class _SaveButtonState extends State<_SaveButton> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final c = widget.c;
    final enabled = widget.enabled && !widget.loading;
    return MouseRegion(
      cursor: enabled ? SystemMouseCursors.click : SystemMouseCursors.basic,
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: GestureDetector(
        onTap: enabled ? widget.onTap : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          height: 33,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: enabled
                ? (_hover ? const Color(0xFF333029) : c.ink)
                : c.surfaceActive,
            border: Border.all(
              color: enabled ? c.ink : c.borderControl,
            ),
            borderRadius: BorderRadius.circular(5),
          ),
          child: widget.loading
              ? SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.5,
                    color: c.surfacePage,
                  ),
                )
              : Text(
                  widget.label,
                  style: LedgerText.sans(
                    size: 12.5,
                    weight: FontWeight.w500,
                    color: enabled ? c.surfacePage : c.textFaint,
                  ),
                ),
        ),
      ),
    );
  }
}

class _MatchToggleChip extends StatefulWidget {
  const _MatchToggleChip({
    required this.label,
    required this.selected,
    required this.onTap,
    required this.leftRounded,
    required this.c,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool leftRounded;
  final LedgerPalette c;

  @override
  State<_MatchToggleChip> createState() => _MatchToggleChipState();
}

class _MatchToggleChipState extends State<_MatchToggleChip> {
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
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: widget.selected
                ? c.surfaceActive
                : _hover
                    ? c.surfaceHover
                    : c.surfaceCard,
            borderRadius: widget.leftRounded
                ? const BorderRadius.only(
                    topLeft: Radius.circular(4),
                    bottomLeft: Radius.circular(4),
                  )
                : const BorderRadius.only(
                    topRight: Radius.circular(4),
                    bottomRight: Radius.circular(4),
                  ),
          ),
          child: Text(
            widget.label,
            style: LedgerText.sans(
              size: 12,
              color: widget.selected ? c.ink : c.textMid,
            ),
          ),
        ),
      ),
    );
  }
}

class _HeldPill extends StatelessWidget {
  const _HeldPill({required this.eligible, required this.c});

  final bool eligible;
  final LedgerPalette c;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(6, 2, 8, 2),
      decoration: BoxDecoration(
        color: eligible ? c.heldEligibleBg : c.heldNotYetBg,
        border: Border.all(
          color: eligible ? c.heldEligibleBorder : c.heldNotYetBorder,
        ),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(
              color: eligible ? c.heldEligibleFg : c.heldNotYetFg,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            eligible ? 'eligible' : 'not yet',
            style: LedgerText.mono(
                size: 10.5,
                color: eligible ? c.heldEligibleFg : c.heldNotYetFg,
                tabular: false),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

String _formatToday() {
  final d = DateTime.now();
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${d.day.toString().padLeft(2, '0')} ${months[d.month - 1]} ${d.year}';
}

String _fmtDate(DateTime d) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return '${d.day.toString().padLeft(2, '0')} ${months[d.month - 1]} ${d.year}';
}
