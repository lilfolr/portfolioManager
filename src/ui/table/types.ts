import type { ReactNode } from 'react';

/**
 * One column of a ledger table.
 *
 * `width` is a fixed pixel value straight from the Flutter `_colWidths` /
 * `_widths` arrays -- the design depends on those exact widths, so they are
 * transcribed rather than re-derived. Exactly one column may instead be
 * `flexible`, matching the symbol column that absorbs the remaining space.
 */
export interface Column<T> {
  key: string;
  /** Column header, e.g. "PROFIT/LOSS $". Empty for the chevron column. */
  label: string;
  width: number;
  /** True for the one column that absorbs leftover width. */
  flexible?: boolean;
  align?: 'left' | 'right';
  /** Renders the cell body. */
  render: (row: T) => ReactNode;
  /** Renders the totals-row cell, if the table has one. */
  renderTotal?: () => ReactNode;
  /** Horizontal cell padding; the first column uses 14, the rest 12. */
  paddingHorizontal?: number;
}

export interface SortState<K extends string> {
  key: K;
  desc: boolean;
}
