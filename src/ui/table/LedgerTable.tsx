import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { useBreakpoint, SIDEBAR_WIDTH } from '../../layout/breakpoint';
import { ColumnLabel, Mono, Sans } from '../text';
import type { Column } from './types';

/**
 * The dense ledger table. Port of the fixed-width, horizontally-scrolling
 * layout the Flutter screens built inline (`_colWidths` / `_tableMinWidth` in
 * `holdings_screen.dart`, `_horizontalTable()` in `holding_detail_screen.dart`).
 *
 * React Native has no DataTable, so this is a horizontal ScrollView wrapping a
 * fixed-width column stack. Column widths are inline `style` rather than
 * classes -- Tailwind can only emit classes it can see in the source, and these
 * widths come from a runtime array. That is the one sanctioned use of `style`
 * for layout in the codebase; colours still come from tokens.
 *
 * Rows are a plain stack, not a FlatList: the whole screen is one vertical
 * scroll (header, KPI cards, table, footnotes) exactly as the Flutter build
 * had it, and nesting a virtualised list inside that scroll view breaks
 * measurement. Revisit if a holding ever accumulates enough parcels to matter.
 */

export function tableWidth<T>(
  columns: Column<T>[],
  availableWidth: number,
  minWidth: number,
): { total: number; flexibleWidth: number } {
  const fixedSum = columns
    .filter((column) => !column.flexible)
    .reduce((sum, column) => sum + column.width, 0);
  const flexible = columns.find((column) => column.flexible);
  if (!flexible) {
    return { total: Math.max(fixedSum, minWidth), flexibleWidth: 0 };
  }
  // `width` on the flexible column is its minimum, matching the Flutter
  // `.clamp(190.0, double.infinity)`.
  const flexibleWidth = Math.max(flexible.width, availableWidth - fixedSum);
  return {
    total: Math.max(flexibleWidth + fixedSum, minWidth),
    flexibleWidth,
  };
}

function Cell({
  width,
  align,
  paddingHorizontal,
  children,
}: {
  width: number;
  align?: 'left' | 'right';
  paddingHorizontal: number;
  children: ReactNode;
}) {
  return (
    <View
      style={{ width, paddingHorizontal, paddingVertical: 9 }}
      className={align === 'right' ? 'items-end' : 'items-start'}
    >
      {children}
    </View>
  );
}

export interface LedgerTableProps<T, K extends string> {
  columns: Column<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  /** The design's minimum table width -- 996 on Holdings. */
  minWidth: number;
  horizontalPadding: number;
  onRowPress?: (row: T) => void;
  /** Sort state and handler; omit for tables whose headers aren't sortable. */
  sort?: { key: K; desc: boolean; onSort: (key: K) => void };
  /** Maps a column key to its sort key, when they differ. */
  sortKeyFor?: (column: Column<T>) => K | undefined;
  /** Shown in place of rows when there are none. */
  emptyMessage?: string;
  /** Renders a totals row beneath the data, using each column's renderTotal. */
  showTotals?: boolean;
  testID?: string;
}

export function LedgerTable<T, K extends string>({
  columns,
  rows,
  keyExtractor,
  minWidth,
  horizontalPadding,
  onRowPress,
  sort,
  sortKeyFor,
  emptyMessage,
  showTotals = false,
  testID,
}: LedgerTableProps<T, K>) {
  const { width, wide } = useBreakpoint();
  const available = width - horizontalPadding * 2 - (wide ? SIDEBAR_WIDTH : 0);
  const { total, flexibleWidth } = tableWidth(columns, available, minWidth);

  const widthOf = (column: Column<T>) =>
    column.flexible ? flexibleWidth : column.width;
  const padOf = (column: Column<T>, index: number) =>
    column.paddingHorizontal ?? (index === 0 ? 14 : 12);

  return (
    <View className="border-t border-edge-sidebar">
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View testID={testID} style={{ width: total }}>
          {/* Header */}
          <View className="flex-row border-b border-edge-header-rule bg-surface-table">
            {columns.map((column, index) => {
              const sortKey = sortKeyFor?.(column);
              const active = sort && sortKey && sort.key === sortKey;
              const label = (
                <View className="flex-row items-center">
                  <ColumnLabel>{column.label}</ColumnLabel>
                  {active ? (
                    <Mono className="font-mono-med text-[9.5px] text-link">
                      {sort.desc ? ' ↓' : ' ↑'}
                    </Mono>
                  ) : null}
                </View>
              );
              return (
                <Cell
                  key={column.key}
                  width={widthOf(column)}
                  align={column.align}
                  paddingHorizontal={padOf(column, index)}
                >
                  {sort && sortKey ? (
                    <Pressable
                      accessibilityRole="button"
                      testID={`sort-${sortKey}`}
                      onPress={() => sort.onSort(sortKey)}
                    >
                      {label}
                    </Pressable>
                  ) : (
                    label
                  )}
                </Cell>
              );
            })}
          </View>

          {/* Rows */}
          {rows.length === 0 && emptyMessage ? (
            <View className="border-b border-edge-row px-3.5 py-6">
              <Sans className="text-[13px] text-muted">{emptyMessage}</Sans>
            </View>
          ) : (
            rows.map((row) => {
              const body = (
                <View className="flex-row items-center border-b border-edge-row">
                  {columns.map((column, index) => (
                    <Cell
                      key={column.key}
                      width={widthOf(column)}
                      align={column.align}
                      paddingHorizontal={padOf(column, index)}
                    >
                      {column.render(row)}
                    </Cell>
                  ))}
                </View>
              );
              return onRowPress ? (
                <Pressable
                  key={keyExtractor(row)}
                  accessibilityRole="button"
                  onPress={() => onRowPress(row)}
                  className="hover:bg-surface-hover active:bg-surface-hover"
                >
                  {body}
                </Pressable>
              ) : (
                <View key={keyExtractor(row)}>{body}</View>
              );
            })
          )}

          {/* Totals */}
          {showTotals ? (
            <View className="flex-row border-t-[1.5px] border-edge-total-rule bg-surface-table">
              {columns.map((column, index) => (
                <View
                  key={column.key}
                  style={{
                    width: widthOf(column),
                    paddingHorizontal: padOf(column, index),
                    paddingVertical: 12,
                  }}
                  className={
                    column.align === 'right' ? 'items-end' : 'items-start'
                  }
                >
                  {column.renderTotal?.() ?? null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
