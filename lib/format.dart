/// Ports of the small formatting helpers from the DC component's `m(n)`.
library;

/// Formats [n] as `en-AU` grouped, 2-decimal-place magnitude with a leading
/// `-` for negatives (never a `+` for positives) — e.g. `m(-1234.5)` ==
/// `'-1,234.50'`, `m(1234.5)` == `'1,234.50'`.
String money(num n) {
  final sign = n < 0 ? '-' : '';
  final fixed = n.abs().toStringAsFixed(2);
  final parts = fixed.split('.');
  final wholeDigits = parts[0];
  final decimals = parts[1];

  final buffer = StringBuffer();
  final len = wholeDigits.length;
  for (var i = 0; i < len; i++) {
    if (i > 0 && (len - i) % 3 == 0) buffer.write(',');
    buffer.write(wholeDigits[i]);
  }
  return '$sign$buffer.$decimals';
}

/// Formats a signed gain/percentage figure: `+` prefix when `n >= 0`, `-`
/// (via [money]) otherwise. Mirrors `(gain >= 0 ? '+' : '') + m(gain)`.
String signedMoney(num n) => (n >= 0 ? '+' : '') + money(n);

/// Formats a percentage with the same signed convention as [signedMoney],
/// e.g. `signedPct(17.706)` == `'+17.71%'`.
String signedPct(num n) => '${n >= 0 ? '+' : ''}${n.toStringAsFixed(2)}%';
