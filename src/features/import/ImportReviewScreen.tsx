import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import {
  useConfirmReviewRows,
  useConfirmWholeImport,
  useImportJobs,
  useImportReview,
  useRejectImportSource,
  useRejectReviewRows,
} from '../../data/queries';
import { money, quantity as formatQuantity } from '../../domain/format';
import {
  reviewRowBlocked,
  reviewRowConfirmable,
  type ReviewRow,
} from '../../domain/models';
import { useBreakpoint } from '../../layout/breakpoint';
import { useLedgerColors } from '../../theme/use-ledger-colors';
import { ActionButton } from '../../ui/ActionButton';
import { ColumnLabel, Mono, Sans } from '../../ui/text';
import { CountPill, ImportSummaryCard, InfoBox, IssueChips } from './parts';

/**
 * The review queue: staged rows waiting for a decision.
 *
 * This is where CLAUDE.md rule 3 is actually enforced for imports -- nothing
 * from a file becomes a transaction until someone confirms it here.
 *
 * Hand-rolled grid rather than LedgerTable, for the same reason
 * ParcelMatchPanel is: rows need a per-row control (a checkbox) and a bespoke
 * header, which the shared table's column contract has no room for.
 */

const COL = {
  check: 40,
  row: 58,
  type: 92,
  date: 96,
  quantity: 96,
  price: 100,
  value: 108,
  issues: 260,
};

const TABLE_WIDTH = Object.values(COL).reduce((sum, width) => sum + width, 0);

export function ImportReviewScreen() {
  const router = useRouter();
  const colors = useLedgerColors();
  const { horizontalPadding } = useBreakpoint();

  const params = useLocalSearchParams<{ sourceId?: string }>();
  const sourceId = typeof params.sourceId === 'string' ? params.sourceId : undefined;

  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{
    confirmed: number;
    total: number;
  } | null>(null);

  const review = useImportReview(sourceId, page);
  const jobs = useImportJobs();

  const confirmRows = useConfirmReviewRows();
  const confirmAll = useConfirmWholeImport();
  const rejectRows = useRejectReviewRows();
  const rejectAll = useRejectImportSource();

  const job = jobs.data?.find((candidate) => candidate.id === sourceId) ?? null;
  const rows = useMemo(() => review.data?.rows ?? [], [review.data]);

  const confirmable = useMemo(() => rows.filter(reviewRowConfirmable), [rows]);
  const selectedConfirmable = useMemo(
    () => confirmable.filter((row) => selected.has(row.id)),
    [confirmable, selected],
  );

  const busy =
    confirmRows.isPending ||
    confirmAll.isPending ||
    rejectRows.isPending ||
    rejectAll.isPending;

  const toggle = (row: ReviewRow) => {
    if (!reviewRowConfirmable(row)) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((current) =>
      current.size === confirmable.length
        ? new Set()
        : new Set(confirmable.map((row) => row.id)),
    );
  };

  const clearSelection = () => setSelected(new Set());

  if (review.isPending || jobs.isPending) {
    return (
      <View className="flex-1 items-center justify-center p-12">
        <ActivityIndicator size="small" color={colors.link} />
      </View>
    );
  }

  if (review.isError || !review.data) {
    return (
      <View className="flex-1 items-center justify-center p-12">
        <Sans testID="importReviewError" className="text-center text-mid">
          {`Could not load the review queue: ${String(review.error)}`}
        </Sans>
      </View>
    );
  }

  const blockedCount = rows.filter(reviewRowBlocked).length;
  const withNotes = rows.filter(
    (row) => row.issues.length > 0 && !reviewRowBlocked(row),
  ).length;

  const error =
    confirmRows.error ?? confirmAll.error ?? rejectRows.error ?? rejectAll.error;

  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-[26px]">
      <View
        className="flex-row flex-wrap items-end justify-between gap-x-[18px] gap-y-3 pb-[18px] pt-[22px]"
        style={{ paddingHorizontal: horizontalPadding }}
      >
        <View>
          <Sans className="font-sans-semi text-[22px] tracking-[-0.33px] text-ink">
            Import review
          </Sans>
          <Mono testID="reviewSummary" className="mt-1.5 text-[12px] text-muted">
            {job
              ? `${job.label} · ${rows.length} pending on this page`
              : `${rows.length} pending ${rows.length === 1 ? 'row' : 'rows'} across all imports`}
          </Mono>
        </View>
        <ActionButton
          label="All imports"
          testID="backToJobs"
          onPress={() => router.push('/import-sources')}
        />
      </View>

      <View
        style={{ paddingHorizontal: horizontalPadding }}
        className="gap-4 pb-4"
      >
        <ImportSummaryCard
          testID="reviewSummaryCard"
          tone={blockedCount > 0 ? 'warning' : 'ok'}
          eyebrow="REVIEW QUEUE"
          title={
            rows.length === 0
              ? 'Nothing waiting'
              : `${confirmable.length} of ${rows.length} ${
                  rows.length === 1 ? 'row' : 'rows'
                } can be confirmed`
          }
          body={
            rows.length === 0
              ? 'Every staged row from this import has been confirmed or rejected.'
              : blockedCount > 0
                ? 'Blocked rows cannot be confirmed — the parser could not turn them into a transaction. Reject them, or fix the file and import it again.'
                : 'Confirming a row appends it to the ledger. Confirmed transactions cannot be edited; a correction supersedes them.'
          }
        >
          <View className="mt-3 flex-row flex-wrap gap-x-6 gap-y-2">
            <CountPill label="PENDING" value={rows.length} />
            <CountPill
              label="SELECTED"
              value={selectedConfirmable.length}
              valueClassName={
                selectedConfirmable.length > 0 ? 'text-link' : 'text-faint'
              }
            />
            <CountPill
              label="WITH NOTES"
              value={withNotes}
              valueClassName={withNotes > 0 ? 'text-pending-text' : 'text-faint'}
            />
            <CountPill
              label="BLOCKED"
              value={blockedCount}
              valueClassName={blockedCount > 0 ? 'text-negative' : 'text-faint'}
            />
          </View>
        </ImportSummaryCard>

        {progress ? (
          <InfoBox>
            <Sans testID="confirmProgress" className="text-[11.5px] text-mid">
              {`Confirmed ${progress.confirmed} of ${progress.total}…`}
            </Sans>
          </InfoBox>
        ) : null}

        {error ? (
          <Sans testID="reviewActionError" className="text-[12px] text-negative">
            {String(error)}
          </Sans>
        ) : null}

        <View className="flex-row flex-wrap gap-2">
          <ActionButton
            label={
              selectedConfirmable.length === 0
                ? 'Confirm selected'
                : `Confirm ${selectedConfirmable.length} selected`
            }
            primary
            testID="confirmSelected"
            onPress={
              busy || selectedConfirmable.length === 0
                ? undefined
                : () =>
                    confirmRows.mutate(
                      selectedConfirmable.map((row) => row.id),
                      { onSuccess: clearSelection },
                    )
            }
          />
          {/* Sends one source id, not a list of row ids: a whole-import
              confirm must not put thousands of UUIDs on the wire, and a
              selection spanning pages should never have to exist on the
              client. */}
          {sourceId ? (
            <ActionButton
              label={
                job && job.pending > rows.length
                  ? `Confirm all ${job.pending - job.blocked} in this import`
                  : 'Confirm all in this import'
              }
              testID="confirmAll"
              onPress={
                busy || confirmable.length === 0
                  ? undefined
                  : () =>
                      confirmAll.mutate(
                        { sourceId, onProgress: setProgress },
                        {
                          onSuccess: () => {
                            clearSelection();
                            setProgress(null);
                            setPage(0);
                          },
                        },
                      )
              }
            />
          ) : null}
          <ActionButton
            label="Reject selected"
            testID="rejectSelected"
            onPress={
              busy || selected.size === 0
                ? undefined
                : () =>
                    rejectRows.mutate(Array.from(selected), {
                      onSuccess: clearSelection,
                    })
            }
          />
          {sourceId ? (
            <ActionButton
              label="Reject all pending"
              testID="rejectAll"
              onPress={
                busy || rows.length === 0
                  ? undefined
                  : () =>
                      rejectAll.mutate(sourceId, { onSuccess: clearSelection })
              }
            />
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: horizontalPadding }}
      >
        <View style={{ width: TABLE_WIDTH }}>
          <Header
            allSelected={
              confirmable.length > 0 && selected.size === confirmable.length
            }
            onToggleAll={confirmable.length === 0 ? undefined : toggleAll}
          />
          {rows.length === 0 ? (
            <View className="border-b border-edge-row px-3.5 py-6">
              <Sans className="text-[13px] text-muted">
                No rows waiting for review.
              </Sans>
            </View>
          ) : (
            rows.map((row) => (
              <RowLine
                key={row.id}
                row={row}
                selected={selected.has(row.id)}
                onToggle={() => toggle(row)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {review.data.hasMore || page > 0 ? (
        <View
          className="flex-row items-center gap-2 pt-3"
          style={{ paddingHorizontal: horizontalPadding }}
        >
          <ActionButton
            label="Previous"
            testID="prevPage"
            onPress={
              page === 0
                ? undefined
                : () => {
                    clearSelection();
                    setPage((current) => current - 1);
                  }
            }
          />
          <Mono className="text-[11.5px] text-faint">{`page ${page + 1}`}</Mono>
          <ActionButton
            label="Next"
            testID="nextPage"
            onPress={
              review.data.hasMore
                ? () => {
                    clearSelection();
                    setPage((current) => current + 1);
                  }
                : undefined
            }
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------

function Header({
  allSelected,
  onToggleAll,
}: {
  allSelected: boolean;
  onToggleAll?: () => void;
}) {
  return (
    <View className="flex-row border-b border-edge-header-rule bg-surface-table">
      <HeadCell width={COL.check} paddingHorizontal={12}>
        <Checkbox
          checked={allSelected}
          onPress={onToggleAll}
          testID="selectAll"
          label="Select every confirmable row on this page"
        />
      </HeadCell>
      <HeadCell width={COL.row} align="right">
        ROW
      </HeadCell>
      <HeadCell width={COL.type}>TYPE</HeadCell>
      <HeadCell width={COL.date}>TRADE DATE</HeadCell>
      <HeadCell width={COL.quantity} align="right">
        QUANTITY
      </HeadCell>
      <HeadCell width={COL.price} align="right">
        UNIT PRICE
      </HeadCell>
      <HeadCell width={COL.value} align="right">
        CONSIDERATION
      </HeadCell>
      <HeadCell width={COL.issues}>NOTES</HeadCell>
    </View>
  );
}

function HeadCell({
  width,
  align = 'left',
  paddingHorizontal = 12,
  children,
}: {
  width: number;
  align?: 'left' | 'right';
  paddingHorizontal?: number;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{ width, paddingHorizontal, paddingVertical: 8 }}
      className={align === 'right' ? 'items-end' : 'items-start'}
    >
      {typeof children === 'string' ? (
        <ColumnLabel>{children}</ColumnLabel>
      ) : (
        children
      )}
    </View>
  );
}

function RowLine({
  row,
  selected,
  onToggle,
}: {
  row: ReviewRow;
  selected: boolean;
  onToggle: () => void;
}) {
  const blocked = reviewRowBlocked(row);
  const confirmable = reviewRowConfirmable(row);
  const parsed = row.parsed;

  // Consideration is quantity x price, shown so a row can be sanity-checked
  // against a contract note at a glance. Decimal throughout -- never a float.
  const consideration =
    parsed?.quantity && parsed.unitPrice
      ? money(parsed.quantity.times(parsed.unitPrice))
      : '—';

  return (
    <View
      testID={`reviewRow-${row.id}`}
      className={`flex-row items-center border-b border-edge-row ${
        blocked ? 'bg-surface-warn-box' : selected ? 'bg-surface-active' : 'bg-surface-card'
      }`}
    >
      <Body width={COL.check}>
        <Checkbox
          checked={selected}
          onPress={confirmable ? onToggle : undefined}
          testID={`select-${row.id}`}
          label={
            confirmable
              ? `Select row ${row.rowNumber ?? ''}`
              : 'This row cannot be confirmed'
          }
        />
      </Body>
      <Body width={COL.row} align="right">
        <Mono className="text-[12px] text-faint">{row.rowNumber ?? '—'}</Mono>
      </Body>
      <Body width={COL.type}>
        <Mono className="text-[12px] text-strong">
          {parsed?.type ?? String(row.raw.type ?? '—')}
        </Mono>
      </Body>
      <Body width={COL.date}>
        <Mono className="text-[12px] text-mid">
          {parsed?.tradeDate ?? String(row.raw.trade_date ?? '—')}
        </Mono>
      </Body>
      <Body width={COL.quantity} align="right">
        <Mono className="text-[12px] text-strong">
          {parsed?.quantity ? formatQuantity(parsed.quantity) : '—'}
        </Mono>
      </Body>
      <Body width={COL.price} align="right">
        <Mono className="text-[12px] text-strong">
          {parsed?.unitPrice ? money(parsed.unitPrice) : '—'}
        </Mono>
      </Body>
      <Body width={COL.value} align="right">
        <Mono className="text-[12px] text-mid">{consideration}</Mono>
      </Body>
      <Body width={COL.issues}>
        <IssueChips issues={row.issues} />
      </Body>
    </View>
  );
}

function Body({
  width,
  align = 'left',
  children,
}: {
  width: number;
  align?: 'left' | 'right';
  children: React.ReactNode;
}) {
  return (
    <View
      style={{ width, paddingHorizontal: 12, paddingVertical: 10 }}
      className={align === 'right' ? 'items-end' : 'items-start'}
    >
      {children}
    </View>
  );
}

/** No checkbox primitive exists in React Native, and this is the only screen
 * that needs one. Disabled (no `onPress`) is how a blocked row says so. */
function Checkbox({
  checked,
  onPress,
  testID,
  label,
}: {
  checked: boolean;
  onPress?: () => void;
  testID?: string;
  label: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      className={`h-[15px] w-[15px] items-center justify-center rounded-[3px] border ${
        !onPress
          ? 'border-edge-subtle bg-surface-active'
          : checked
            ? 'border-link bg-link'
            : 'border-edge-control bg-surface-card hover:border-edge-control-hover'
      }`}
    >
      {checked && onPress ? (
        <Mono className="text-[10px] leading-[10px] text-surface-page">✓</Mono>
      ) : null}
    </Pressable>
  );
}
