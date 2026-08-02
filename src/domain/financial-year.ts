/**
 * Parses the top bar's `'FY 2025–26'` label into the integer financial year
 * convention CLAUDE.md defines (`2026` == FY2025-26, 1 Jul 2025 - 30 Jun 2026):
 * the label's first year + 1.
 *
 * Ported from `financialYearFromLabel` in `portfolio_repository.dart`. It lives
 * in the domain layer rather than the data layer because it touches no IO --
 * keeping it here means a test that mocks the repository does not accidentally
 * mock this away too.
 */
export function financialYearFromLabel(label: string): number {
  const match = /(\d{4})/.exec(label);
  if (!match?.[1]) return new Date().getFullYear();
  return parseInt(match[1], 10) + 1;
}
