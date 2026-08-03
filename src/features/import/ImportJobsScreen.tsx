import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { useImportJobs, useVoidImportSource } from '../../data/queries';
import { formatDate } from '../../domain/dates';
import {
  importJobConfirmable,
  type ImportJob,
} from '../../domain/models';
import { useBreakpoint } from '../../layout/breakpoint';
import { useLedgerColors } from '../../theme/use-ledger-colors';
import { ActionButton } from '../../ui/ActionButton';
import { LedgerTable } from '../../ui/table/LedgerTable';
import type { Column } from '../../ui/table/types';
import { Mono, Sans } from '../../ui/text';
import { ImportStatusChip } from './parts';

/**
 * Every import job and where it got to -- the "status and completion" view.
 *
 * Also the only place an import can be voided. Voiding is per-job rather than
 * per-transaction because that is the unit a mistake arrives in: one wrong
 * file, several hundred wrong rows.
 */

const WIDTHS = [230, 92, 118, 78, 78, 78, 78, 108];

function jobColumns(args: {
  onVoid: (job: ImportJob) => void;
  voidingId: string | null;
}): Column<ImportJob>[] {
  const [file, kind, imported, rows, pending, confirmed, rejected, actions] =
    WIDTHS as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];

  const count = (value: number, muted = false) => (
    <Mono className={`text-[12.5px] ${muted ? 'text-faint' : 'text-strong'}`}>
      {value === 0 ? '—' : value}
    </Mono>
  );

  return [
    {
      key: 'file',
      label: 'FILE',
      width: file,
      flexible: true,
      paddingHorizontal: 14,
      render: (job) => (
        <View>
          <Sans numberOfLines={1} className="text-[12.5px] text-strong">
            {job.label}
          </Sans>
          <Mono className="mt-[3px] text-[10.5px] text-faint">
            {job.errorMessage ?? job.parserVersion ?? 'manual entry'}
          </Mono>
        </View>
      ),
    },
    {
      key: 'kind',
      label: 'VIA',
      width: kind,
      render: (job) => (
        <Mono className="text-[11px] uppercase text-mid">{job.kind}</Mono>
      ),
    },
    {
      key: 'imported',
      label: 'IMPORTED',
      width: imported,
      render: (job) => (
        <Mono className="text-[12px] text-mid">{formatDate(job.importedAt)}</Mono>
      ),
    },
    {
      key: 'rows',
      label: 'ROWS',
      width: rows,
      align: 'right',
      render: (job) => count(job.total),
    },
    {
      key: 'pending',
      label: 'PENDING',
      width: pending,
      align: 'right',
      render: (job) => (
        <Mono
          className={`text-[12.5px] ${
            job.pending > 0 ? 'text-pending-text' : 'text-faint'
          }`}
        >
          {job.pending === 0 ? '—' : job.pending}
        </Mono>
      ),
    },
    {
      key: 'confirmed',
      label: 'CONFIRMED',
      width: confirmed,
      align: 'right',
      render: (job) => count(job.confirmed),
    },
    {
      key: 'rejected',
      label: 'REJECTED',
      width: rejected,
      align: 'right',
      render: (job) => count(job.rejected, true),
    },
    {
      key: 'actions',
      label: 'STATUS',
      width: actions,
      render: (job) => (
        <View className="gap-1.5">
          <ImportStatusChip status={job.status} />
          {job.status === 'voided' ? null : (
            <Pressable
              testID={`voidImport-${job.id}`}
              accessibilityRole="button"
              disabled={args.voidingId !== null}
              onPress={() => args.onVoid(job)}
            >
              <Mono className="text-[10.5px] text-link">
                {args.voidingId === job.id ? 'voiding…' : 'void import'}
              </Mono>
            </Pressable>
          )}
        </View>
      ),
    },
  ];
}

export function ImportJobsScreen() {
  const router = useRouter();
  const colors = useLedgerColors();
  const { horizontalPadding } = useBreakpoint();
  const query = useImportJobs();
  const voidImport = useVoidImportSource();

  // Voiding takes a whole import out of every derived figure, so it asks
  // first. The confirmation is inline rather than a modal because the row it
  // refers to stays visible.
  const [confirming, setConfirming] = useState<ImportJob | null>(null);

  if (query.isPending) {
    return (
      <View className="flex-1 items-center justify-center p-12">
        <ActivityIndicator size="small" color={colors.link} />
      </View>
    );
  }

  if (query.isError || !query.data) {
    return (
      <View className="flex-1 items-center justify-center p-12">
        <Sans testID="importJobsError" className="text-center text-mid">
          {`Could not load imports: ${String(query.error)}`}
        </Sans>
      </View>
    );
  }

  const jobs = query.data;
  const pendingRows = jobs.reduce(
    (sum, job) => sum + importJobConfirmable(job),
    0,
  );

  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-[26px]">
      <View
        className="flex-row flex-wrap items-end justify-between gap-x-[18px] gap-y-3 pb-[18px] pt-[22px]"
        style={{ paddingHorizontal: horizontalPadding }}
      >
        <View>
          <Sans className="font-sans-semi text-[22px] tracking-[-0.33px] text-ink">
            Import sources
          </Sans>
          <Mono testID="importJobsSummary" className="mt-1.5 text-[12px] text-muted">
            {`${jobs.length} ${jobs.length === 1 ? 'import' : 'imports'} · ${pendingRows} ${
              pendingRows === 1 ? 'row' : 'rows'
            } awaiting review`}
          </Mono>
        </View>
        <View className="flex-row gap-2">
          <ActionButton
            label="Review queue"
            testID="openReview"
            onPress={() => router.push('/import-review')}
          />
          <ActionButton
            label="New import"
            primary
            testID="newImport"
            onPress={() => router.push('/import-sources/new')}
          />
        </View>
      </View>

      {confirming ? (
        <View style={{ paddingHorizontal: horizontalPadding }} className="pb-3">
          <View
            testID="voidConfirm"
            className="rounded-md border border-edge-warn-box bg-surface-warn-box p-[13px]"
          >
            <Sans className="font-sans-med text-[12.5px] text-pending-text">
              {`Void ${confirming.label}?`}
            </Sans>
            {/* Facts about what the action does, not a recommendation about
                whether to take it. */}
            <Sans className="mt-1.5 text-[11.5px] leading-[1.6] text-mid">
              {`${confirming.confirmed} confirmed ${
                confirming.confirmed === 1 ? 'transaction' : 'transactions'
              } from this import will stop counting towards holdings, parcels and income, and its ${
                confirming.pending
              } remaining pending ${
                confirming.pending === 1 ? 'row' : 'rows'
              } will be rejected. Nothing is deleted: the transactions stay on the ledger as a record, and the file stays in storage.`}
            </Sans>
            <View className="mt-3 flex-row gap-2">
              <ActionButton
                label="Void this import"
                testID="voidConfirmYes"
                onPress={() => {
                  const id = confirming.id;
                  setConfirming(null);
                  voidImport.mutate(id);
                }}
              />
              <ActionButton
                label="Keep it"
                testID="voidConfirmNo"
                onPress={() => setConfirming(null)}
              />
            </View>
          </View>
        </View>
      ) : null}

      {voidImport.isError ? (
        <View style={{ paddingHorizontal: horizontalPadding }} className="pb-3">
          <Sans testID="voidError" className="text-[12px] text-negative">
            {`Could not void that import: ${String(voidImport.error)}`}
          </Sans>
        </View>
      ) : null}

      <LedgerTable
        testID="importJobsTable"
        columns={jobColumns({
          onVoid: setConfirming,
          voidingId: voidImport.isPending ? voidImport.variables : null,
        })}
        rows={jobs}
        keyExtractor={(job) => job.id}
        minWidth={WIDTHS.reduce((sum, width) => sum + width, 0)}
        horizontalPadding={horizontalPadding}
        rowPaddingVertical={10}
        onRowPress={(job) =>
          router.push({
            pathname: '/import-review',
            params: { sourceId: job.id },
          })
        }
        rowClassName={(job) =>
          job.status === 'voided' ? 'bg-surface-active' : 'bg-surface-card'
        }
        emptyMessage="No imports yet. Upload a broker CSV to get started."
      />
    </ScrollView>
  );
}
