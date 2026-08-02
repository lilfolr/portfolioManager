/// Ports of the small formatting helpers from the DC component's `m(n)`.
///
/// `double`/`num` is used only here, at the point figures become display
/// text -- everywhere upstream of this file (models, the repository) stays
/// `Decimal` per CLAUDE.md's money rules. The `Decimal` overloads below
/// convert internally rather than making callers do it, so a call site
/// can't accidentally lose precision converting to `double` itself.
library;

import 'package:decimal/decimal.dart';

String _group(String wholeDigits) {
  final buffer = StringBuffer();
  final len = wholeDigits.length;
  for (var i = 0; i < len; i++) {
    if (i > 0 && (len - i) % 3 == 0) buffer.write(',');
    buffer.write(wholeDigits[i]);
  }
  return buffer.toString();
}

/// Formats [n] as `en-AU` grouped, 2-decimal-place magnitude with a leading
/// `-` for negatives (never a `+` for positives) — e.g. `m(-1234.5)` ==
/// `'-1,234.50'`, `m(1234.5)` == `'1,234.50'`.
String money(num n) {
  final sign = n < 0 ? '-' : '';
  final fixed = n.abs().toStringAsFixed(2);
  final parts = fixed.split('.');
  return '$sign${_group(parts[0])}.${parts[1]}';
}

/// [money], but taking a [Decimal] so a monetary figure that accumulated as
/// `Decimal` never round-trips through `double` to get formatted.
String moneyD(Decimal n) {
  final sign = n < Decimal.zero ? '-' : '';
  final fixed = n.abs().toStringAsFixed(2);
  final parts = fixed.split('.');
  return '$sign${_group(parts[0])}.${parts[1]}';
}

/// Formats a signed gain/percentage figure: `+` prefix when `n >= 0`, `-`
/// (via [money]) otherwise. Mirrors `(gain >= 0 ? '+' : '') + m(gain)`.
String signedMoney(num n) => (n >= 0 ? '+' : '') + money(n);

/// [signedMoney] for a [Decimal].
String signedMoneyD(Decimal n) => (n >= Decimal.zero ? '+' : '') + moneyD(n);

/// Formats a percentage with the same signed convention as [signedMoney],
/// e.g. `signedPct(17.706)` == `'+17.71%'`.
String signedPct(num n) => '${n >= 0 ? '+' : ''}${n.toStringAsFixed(2)}%';

/// [signedPct] for a [Decimal].
String signedPctD(Decimal n) =>
    '${n >= Decimal.zero ? '+' : ''}${n.toStringAsFixed(2)}%';

/// A unit quantity: grouped whole part, decimals only when non-zero (units
/// are `numeric(20,8)` -- DRP and US fractional shares produce long
/// decimals that a fixed 2dp would either truncate or clutter whole-share
/// holdings with).
String quantity(Decimal n) {
  final trimmed = n.toString();
  final parts = trimmed.split('.');
  if (parts.length == 1) return _group(parts[0]);
  final decimals = parts[1].replaceFirst(RegExp(r'0+$'), '');
  return decimals.isEmpty ? _group(parts[0]) : '${_group(parts[0])}.$decimals';
}
