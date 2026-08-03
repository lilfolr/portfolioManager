import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { useSession } from '../../auth/session';
import {
  useFinishImport,
  useHoldingsScreenData,
  useStartImport,
} from '../../data/queries';
import { financialYearFromLabel } from '../../domain/financial-year';
import { useBreakpoint } from '../../layout/breakpoint';
import { useFinancialYear } from '../../layout/financial-year';
import { useLedgerColors } from '../../theme/use-ledger-colors';
import { ActionButton } from '../../ui/ActionButton';
import { FilePicker, type PickedFile } from '../../ui/FilePicker';
import { Select } from '../../ui/Select';
import { LedgerTable } from '../../ui/table/LedgerTable';
import type { Column } from '../../ui/table/types';
import { ColumnLabel, Eyebrow, Mono, Sans } from '../../ui/text';
import {
  CountPill,
  ImportSummaryCard,
  InfoBox,
  IssueChips,
  type SummaryTone,
} from './parts';
import {
  previewFromRow,
  type ImportPreview,
  type PreviewRow,
} from './preview';

/**
 * Upload a CSV, see exactly what importing it would do, then commit.
 *
 * The validate step exists because an import is the one place a user can put
 * hundreds of wrong rows on the ledger in a single action. Nothing is written
 * until they have seen the column mapping, the row count, and every problem
 * the parser found.
 *
 * Three steps in local state rather than three routes: it is one task, and a
 * half-finished import is not something to be able to navigate back into.
 */

/** Matches MAX_BYTES in the import-csv edge function and the bucket limit. */
const MAX_BYTES = 5 * 1024 * 1024;

type Step = 'choose' | 'validate';

export function ImportStartScreen() {
  const router = useRouter();
  const colors = useLedgerColors();
  const { horizontalPadding, narrow } = useBreakpoint();
  const { session } = useSession();
  const { fy } = useFinancialYear();

  // The account list is already loaded for the holdings screen; reusing that
  // query means no new read just to fill a picker.
  const accountsQuery = useHoldingsScreenData(financialYearFromLabel(fy));

  const [step, setStep] = useState<Step>('choose');
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [staged, setStaged] = useState<{
    importId: string;
    storagePath: string;
  } | null>(null);

  const start = useStartImport();
  const finish = useFinishImport();

  // Memoised on the query result rather than on `accounts`, because the `??`
  // fallback would be a fresh array on every render.
  const accounts = accountsQuery.data?.accounts;
  const accountLabels = useMemo(
    () => (accounts ?? []).map((account) => account.displayName),
    [accounts],
  );
  const selectedAccount = accounts?.find((a) => a.id === accountId) ?? null;

  const userId = session?.user?.id ?? null;
  const canValidate =
    picked !== null && accountId !== null && userId !== null && !start.isPending;

  const validate = () => {
    if (!picked || !accountId || !userId) return;
    start.mutate(
      {
        userId,
        file: picked.file,
        filename: picked.filename,
        accountId,
      },
      {
        onSuccess: (result) => {
          setStaged({
            importId: result.importId,
            storagePath: result.storagePath,
          });
          setPreview(previewFromRow(result.preview));
          setStep('validate');
        },
      },
    );
  };

  const commit = () => {
    if (!staged || !picked || !accountId) return;
    finish.mutate(
      {
        importId: staged.importId,
        storagePath: staged.storagePath,
        filename: picked.filename,
        accountId,
      },
      {
        onSuccess: (sourceId) =>
          router.replace({
            pathname: '/import-review',
            params: { sourceId },
          }),
      },
    );
  };

  const startOver = () => {
    setStep('choose');
    setPreview(null);
    setStaged(null);
  };

  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-[26px]">
      <View
        className="pb-[18px] pt-[22px]"
        style={{ paddingHorizontal: horizontalPadding }}
      >
        <Sans className="font-sans-semi text-[22px] tracking-[-0.33px] text-ink">
          New import
        </Sans>
        <Mono className="mt-1.5 text-[12px] text-muted">
          {step === 'choose'
            ? 'Step 1 of 2 · choose a file and the account it belongs to'
            : 'Step 2 of 2 · check what this import would do'}
        </Mono>
      </View>

      {step === 'choose' ? (
        <ChooseStep
          picked={picked}
          onPick={setPicked}
          accounts={accountLabels}
          accountLabel={selectedAccount?.displayName ?? null}
          onAccount={(label) =>
            setAccountId(
              accounts?.find((a) => a.displayName === label)?.id ?? null,
            )
          }
          onValidate={validate}
          canValidate={canValidate}
          busy={start.isPending}
          error={start.isError ? String(start.error) : null}
          loadingAccounts={accountsQuery.isPending}
          horizontalPadding={horizontalPadding}
          spinnerColor={colors.link}
        />
      ) : preview ? (
        <ValidateStep
          preview={preview}
          filename={picked?.filename ?? ''}
          accountLabel={selectedAccount?.displayName ?? ''}
          onCommit={commit}
          onBack={startOver}
          busy={finish.isPending}
          error={finish.isError ? String(finish.error) : null}
          horizontalPadding={horizontalPadding}
          narrow={narrow}
        />
      ) : null}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------

function ChooseStep(props: {
  picked: PickedFile | null;
  onPick: (file: PickedFile) => void;
  accounts: string[];
  accountLabel: string | null;
  onAccount: (label: string) => void;
  onValidate: () => void;
  canValidate: boolean;
  busy: boolean;
  error: string | null;
  loadingAccounts: boolean;
  horizontalPadding: number;
  spinnerColor: string;
}) {
  return (
    <View style={{ paddingHorizontal: props.horizontalPadding }} className="gap-4">
      <View>
        <ColumnLabel className="text-faint">CSV FILE</ColumnLabel>
        <View className="mt-2">
          <FilePicker
            picked={props.picked}
            onPick={props.onPick}
            disabled={props.busy}
            maxBytes={MAX_BYTES}
          />
        </View>
      </View>

      <View>
        <ColumnLabel className="text-faint">DESTINATION ACCOUNT</ColumnLabel>
        <View className="mt-2 flex-row">
          {props.loadingAccounts ? (
            <ActivityIndicator size="small" color={props.spinnerColor} />
          ) : props.accounts.length === 0 ? (
            <Sans testID="noAccounts" className="text-[12px] text-mid">
              No accounts yet. Add one before importing, so every row has
              somewhere to go.
            </Sans>
          ) : (
            <Select
              testID="accountSelect"
              value={props.accountLabel ?? 'Choose an account'}
              options={props.accounts}
              onChange={props.onAccount}
            />
          )}
        </View>
        {/* Explaining the constraint up front is cheaper than a screen of
            per-row errors. One account per import also means account_id is a
            real UUID on every row rather than something guessed from a
            column. */}
        <Sans className="mt-2 text-[11.5px] leading-[1.6] text-faint">
          Every row in this file will be attached to this account. Import one
          file per account.
        </Sans>
      </View>

      {props.error ? (
        <Sans testID="startImportError" className="text-[12px] text-negative">
          {props.error}
        </Sans>
      ) : null}

      <View className="flex-row gap-2">
        <ActionButton
          label={props.busy ? 'Reading the file…' : 'Check this import'}
          primary
          testID="validateImport"
          onPress={props.canValidate ? props.onValidate : undefined}
        />
      </View>

      <InfoBox>
        <Sans className="text-[11.5px] leading-[1.6] text-mid">
          Checking reads the file and reports what it found. Nothing reaches the
          ledger until you confirm the rows on the next screen.
        </Sans>
      </InfoBox>
    </View>
  );
}

// ---------------------------------------------------------------------------

const PREVIEW_WIDTHS = [58, 90, 96, 84, 92, 96, 240];

function previewColumns(): Column<PreviewRow>[] {
  const [row, type, date, symbol, qty, price, issues] = PREVIEW_WIDTHS as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];

  const mono = (value: string | null) => (
    <Mono className="text-[12px] text-strong">{value ?? '—'}</Mono>
  );

  return [
    {
      key: 'row',
      label: 'ROW',
      width: row,
      align: 'right',
      paddingHorizontal: 14,
      render: (r) => <Mono className="text-[12px] text-faint">{r.rowNumber}</Mono>,
    },
    { key: 'type', label: 'TYPE', width: type, render: (r) => mono(r.type) },
    { key: 'date', label: 'TRADE DATE', width: date, render: (r) => mono(r.tradeDate) },
    { key: 'symbol', label: 'SYMBOL', width: symbol, render: (r) => mono(r.symbol) },
    {
      key: 'quantity',
      label: 'QUANTITY',
      width: qty,
      align: 'right',
      render: (r) => mono(r.quantity),
    },
    {
      key: 'price',
      label: 'UNIT PRICE',
      width: price,
      align: 'right',
      render: (r) => mono(r.unitPrice),
    },
    {
      key: 'issues',
      label: 'ISSUES',
      width: issues,
      flexible: true,
      render: (r) => <IssueChips issues={r.issues} />,
    },
  ];
}

function ValidateStep(props: {
  preview: ImportPreview;
  filename: string;
  accountLabel: string;
  onCommit: () => void;
  onBack: () => void;
  busy: boolean;
  error: string | null;
  horizontalPadding: number;
  narrow: boolean;
}) {
  const { preview } = props;
  const { totals } = preview;

  const tone: SummaryTone =
    totals.blocking > 0 ? 'blocked' : totals.warning > 0 ? 'warning' : 'ok';

  const title =
    totals.blocking > 0
      ? `${totals.blocking} ${totals.blocking === 1 ? 'row cannot' : 'rows cannot'} be imported`
      : totals.warning > 0
        ? `${totals.rows} ${totals.rows === 1 ? 'row' : 'rows'} ready, ${totals.warning} with a note`
        : `${totals.rows} ${totals.rows === 1 ? 'row' : 'rows'} ready`;

  // Facts about the file, not instructions about what to do with it.
  const body =
    totals.blocking > 0
      ? 'Rows with a blocking issue are staged but cannot be confirmed. You can import the rest now and deal with those separately, or fix the file and start again.'
      : totals.warning > 0
        ? 'Rows with a note can be confirmed like any other. The notes are there so you can decide.'
        : 'Every row parsed cleanly.';

  return (
    <View style={{ paddingHorizontal: props.horizontalPadding }} className="gap-4">
      <View className="flex-row flex-wrap gap-3">
        <ImportSummaryCard
          testID="importSummary"
          tone={tone}
          eyebrow="IMPORT CHECK"
          title={title}
          body={body}
        >
          <View className="mt-3 flex-row flex-wrap gap-x-6 gap-y-2">
            <CountPill label="ROWS" value={totals.rows} />
            <CountPill
              label="CLEAN"
              value={totals.ok}
              valueClassName="text-positive"
            />
            <CountPill
              label="WITH NOTES"
              value={totals.warning}
              valueClassName={
                totals.warning > 0 ? 'text-pending-text' : 'text-faint'
              }
            />
            <CountPill
              label="BLOCKED"
              value={totals.blocking}
              valueClassName={
                totals.blocking > 0 ? 'text-negative' : 'text-faint'
              }
            />
          </View>
        </ImportSummaryCard>

        <View className="min-w-[250px] flex-1 rounded-md border border-edge-card bg-surface-card p-[15px]">
          <Eyebrow className="text-faint">FILE</Eyebrow>
          <Mono className="mt-[11px] text-[12.5px] text-strong">
            {props.filename}
          </Mono>
          <View className="mt-3 gap-1.5">
            <Detail label="Parsed as" value={preview.profileLabel} />
            <Detail label="Parser" value={preview.parserVersion} />
            <Detail label="Into account" value={props.accountLabel} />
            {preview.priorImport ? (
              <Detail
                label="Same file"
                value={`imported before as ${preview.priorImport}`}
                tone="warn"
              />
            ) : null}
          </View>
        </View>
      </View>

      <MappingPanel preview={preview} />

      <View>
        <ColumnLabel className="text-faint">
          {preview.rows.length < totals.rows
            ? `FIRST ${preview.rows.length} OF ${totals.rows} ROWS`
            : 'ALL ROWS'}
        </ColumnLabel>
        <View className="mt-2">
          <LedgerTable
            testID="previewTable"
            columns={previewColumns()}
            rows={preview.rows}
            keyExtractor={(r) => String(r.rowNumber)}
            minWidth={PREVIEW_WIDTHS.reduce((sum, width) => sum + width, 0)}
            horizontalPadding={0}
            rowPaddingVertical={9}
            rowClassName={(r) =>
              r.issues.some((issue) => issue.blocking)
                ? 'bg-surface-warn-box'
                : 'bg-surface-card'
            }
            emptyMessage="No rows found in this file."
          />
        </View>
      </View>

      {props.error ? (
        <Sans testID="commitImportError" className="text-[12px] text-negative">
          {props.error}
        </Sans>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        <ActionButton
          label={
            props.busy
              ? 'Staging…'
              : totals.blocking > 0
                ? `Stage the ${totals.rows - totals.blocking} importable rows`
                : `Stage ${totals.rows} ${totals.rows === 1 ? 'row' : 'rows'} for review`
          }
          primary
          testID="commitImport"
          onPress={props.busy || totals.rows === 0 ? undefined : props.onCommit}
        />
        <ActionButton
          label="Choose a different file"
          testID="restartImport"
          onPress={props.busy ? undefined : props.onBack}
        />
      </View>

      <InfoBox>
        <Sans className="text-[11.5px] leading-[1.6] text-mid">
          Staging puts these rows in the review queue. They become transactions
          only when you confirm them there.
        </Sans>
      </InfoBox>
    </View>
  );
}

function Detail({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warn';
}) {
  return (
    <View className="flex-row justify-between gap-3">
      <Sans className="text-[11.5px] text-faint">{label}</Sans>
      <Mono
        className={`shrink text-right text-[11.5px] ${
          tone === 'warn' ? 'text-pending-text' : 'text-mid'
        }`}
      >
        {value}
      </Mono>
    </View>
  );
}

function MappingPanel({ preview }: { preview: ImportPreview }) {
  return (
    <View className="rounded-md border border-edge-card bg-surface-card p-[15px]">
      <Eyebrow className="text-faint">COLUMN MAPPING</Eyebrow>
      <View className="mt-[11px] flex-row flex-wrap gap-x-5 gap-y-2">
        {preview.headerMapping.map((mapping) => (
          <View key={mapping.header} className="flex-row items-center gap-1.5">
            <Mono className="text-[11.5px] text-strong">{mapping.header}</Mono>
            <Mono className="text-[11.5px] text-faint">→</Mono>
            <Mono
              className={`text-[11.5px] ${
                mapping.field ? 'text-link' : 'text-faint'
              }`}
            >
              {mapping.field ?? 'not used'}
            </Mono>
          </View>
        ))}
      </View>
      {preview.missingColumns.length > 0 ? (
        <Sans className="mt-3 text-[11.5px] leading-[1.6] text-faint">
          {`Not in this file: ${preview.missingColumns.join(', ')}. Optional columns fall back to their defaults.`}
        </Sans>
      ) : null}
    </View>
  );
}
