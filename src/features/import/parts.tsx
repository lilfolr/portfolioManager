import { View } from 'react-native';

import type { ImportStatus, RowIssue } from '../../domain/models';
import { Eyebrow, Mono, Sans } from '../../ui/text';

/**
 * The small pieces the three import screens share.
 *
 * Copy rule throughout: state facts, never advise (CLAUDE.md rule 5). "12 rows
 * match a transaction already in the ledger" is a fact; "skip these" is not.
 * The user decides what to confirm.
 */

// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<ImportStatus, string> = {
  pending: 'IN PROGRESS',
  processed: 'IMPORTED',
  error: 'FAILED',
  voided: 'VOIDED',
};

const STATUS_TONE: Record<ImportStatus, string> = {
  pending: 'border-edge-warn-box bg-surface-warn-box text-pending-text',
  processed: 'border-edge-sidebar bg-surface-table text-mid',
  error: 'border-negative bg-surface-warn-box text-negative',
  voided: 'border-edge-sidebar bg-surface-table text-faint',
};

export function ImportStatusChip({ status }: { status: ImportStatus }) {
  return (
    <View
      testID={`importStatus-${status}`}
      className={`self-start rounded border px-2 py-0.5 ${STATUS_TONE[status]}`}
    >
      <Mono className="text-[10.5px]">{STATUS_LABEL[status]}</Mono>
    </View>
  );
}

// ---------------------------------------------------------------------------

/**
 * A row's issues, worst first.
 *
 * Blocking and non-blocking are visually distinct because they mean genuinely
 * different things: a blocking issue means the row cannot be confirmed at all,
 * while a duplicate suspicion is information the user acts on or ignores.
 */
export function IssueChips({ issues }: { issues: RowIssue[] }) {
  if (issues.length === 0) {
    return <Mono className="text-[11px] text-faint">—</Mono>;
  }

  const ordered = [...issues].sort(
    (a, b) => Number(b.blocking) - Number(a.blocking),
  );

  return (
    <View className="gap-1">
      {ordered.map((issue, index) => (
        <View
          key={`${issue.code}-${index}`}
          className={`self-start rounded border px-1.5 py-0.5 ${
            issue.blocking
              ? 'border-negative bg-surface-warn-box'
              : 'border-edge-warn-box bg-surface-warn-box'
          }`}
        >
          <Mono
            className={`text-[10.5px] ${
              issue.blocking ? 'text-negative' : 'text-pending-text'
            }`}
          >
            {issue.message}
          </Mono>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------

export type SummaryTone = 'ok' | 'warning' | 'blocked';

const TONE_STYLE: Record<
  SummaryTone,
  { box: string; dot: string; title: string; label: string }
> = {
  ok: {
    box: 'border-held-eligible-border bg-held-eligible-bg',
    dot: 'bg-positive',
    title: 'text-positive',
    label: 'text-held-eligible-fg',
  },
  warning: {
    box: 'border-edge-warn-box bg-surface-warn-box',
    dot: 'bg-pending-amber',
    title: 'text-pending-text',
    label: 'text-pending-text',
  },
  blocked: {
    box: 'border-negative bg-surface-warn-box',
    dot: 'bg-negative',
    title: 'text-negative',
    label: 'text-negative',
  },
};

/**
 * The tri-state summary card. Same visual language as `AllocationStatus` on
 * the transaction entry screen, so "here is the state of the thing you are
 * about to commit" looks the same in both places.
 */
export function ImportSummaryCard({
  tone,
  eyebrow,
  title,
  body,
  children,
  testID,
}: {
  tone: SummaryTone;
  eyebrow: string;
  title: string;
  body: string;
  children?: React.ReactNode;
  testID?: string;
}) {
  const style = TONE_STYLE[tone];
  return (
    <View
      testID={testID}
      className={`min-w-[250px] flex-1 rounded-md border p-[15px] ${style.box}`}
    >
      <Eyebrow className={style.label}>{eyebrow}</Eyebrow>
      <View className="mt-[11px] flex-row items-center">
        <View className={`h-2 w-2 rounded-full ${style.dot}`} />
        <Sans
          className={`ml-[9px] flex-1 font-sans-med text-[13px] ${style.title}`}
        >
          {title}
        </Sans>
      </View>
      <Sans className="mt-[7px] text-[11.5px] leading-[1.6] text-mid">
        {body}
      </Sans>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------

/** The blue "what happens next" callout, matching the holding detail screen. */
export function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-md border border-edge-info-box bg-surface-info-box p-[13px]">
      {children}
    </View>
  );
}

/** A labelled figure, for the counts strip above a table. */
export function CountPill({
  label,
  value,
  valueClassName = 'text-strong',
}: {
  label: string;
  value: number | string;
  valueClassName?: string;
}) {
  return (
    <View>
      <Eyebrow className="text-faint">{label}</Eyebrow>
      <Mono className={`mt-1 text-[15px] ${valueClassName}`}>{value}</Mono>
    </View>
  );
}
