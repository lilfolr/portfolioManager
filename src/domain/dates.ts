const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * `01 Aug 2026`. Port of the `_shortDate` / `_fmtDate` helpers that appeared
 * identically in both Flutter screens.
 *
 * Formatted in UTC, because trade and payment dates are calendar dates from
 * the ledger, not instants -- reading them in the device's local zone would
 * shift a date across midnight for anyone west of UTC.
 */
export function formatDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${day} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
