import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { useOpenParcels, useSubmitTransaction } from '../../data/queries';
import { useSession } from '../../auth/session';
import { formatDate } from '../../domain/dates';
import { money } from '../../domain/format';
import { useBreakpoint } from '../../layout/breakpoint';
import { useLedgerColors } from '../../theme/use-ledger-colors';
import { ActionButton } from '../../ui/ActionButton';
import { Eyebrow, Mono, Sans } from '../../ui/text';
import { EffectPanel } from './EffectPanel';
import { FIELD_SPECS, NOT_STATED_WARNING, type FieldSpec } from './fieldSpecs';
import { ParcelMatchPanel } from './ParcelMatchPanel';
import { TXN_TYPES, TXN_TYPE_ORDER, type TxnTypeKey } from './meta';
import {
  buildPayload,
  canSave,
  consideration,
  effectiveAlloc,
  parseDecimal,
  parseUnits,
  rocTotal,
  summariseAllocation,
  type FieldValues,
  type MatchMode,
} from './payload';

/**
 * Manual transaction entry. Port of
 * `lib/screens/transaction_entry_screen.dart`.
 *
 * The heavy lifting lives elsewhere on purpose: the type metadata and field
 * specs are data (meta.ts, fieldSpecs.ts), and the payload, allocation and
 * save-gating rules are pure functions with their own tests (payload.ts). What
 * is left here is form state and layout.
 */
export function TransactionEntryScreen() {
  const router = useRouter();
  const colors = useLedgerColors();
  const { session } = useSession();
  const { narrow } = useBreakpoint();

  const [type, setType] = useState<TxnTypeKey>('buy');
  const [values, setValues] = useState<FieldValues>({});
  const [mode, setMode] = useState<MatchMode>('fifo');
  const [typedAlloc, setTypedAlloc] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const meta = TXN_TYPES[type];
  const specs = FIELD_SPECS[type];

  const symbol = (values.symbol ?? '').trim().toUpperCase();
  const account = (values.account ?? '').trim();
  const want = parseUnits(values.units);
  const unitPrice = parseDecimal(values.unit_price);
  const brokerage = parseDecimal(values.brokerage);

  // The Flutter build debounced symbol+account by 400ms before firing the
  // fetch. react-query's `enabled` gate covers the empty case, and its cache
  // dedupes repeats, so the debounce is no longer load-bearing.
  const parcelsQuery = useOpenParcels(
    type === 'sell' ? symbol : '',
    type === 'sell' ? account : '',
  );
  const parcels = useMemo(() => parcelsQuery.data ?? [], [parcelsQuery.data]);

  const allocation = useMemo(
    () => effectiveAlloc(parcels, mode, want, typedAlloc),
    [parcels, mode, want, typedAlloc],
  );
  const summary = useMemo(
    () => summariseAllocation(parcels, allocation, unitPrice, want),
    [parcels, allocation, unitPrice, want],
  );

  const submit = useSubmitTransaction();
  const saveable = canSave(type, values, type === 'sell' ? summary : undefined);

  const setField = useCallback((key: string, value: string) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      // ROC's Total is derived, never typed -- keep it in step as the operands
      // change, exactly as the Dart listener did.
      if (key === 'amount_per_unit' || key === 'units') {
        next.total = rocTotal(next);
      }
      return next;
    });
  }, []);

  const changeType = useCallback((next: TxnTypeKey) => {
    setType(next);
    setValues({});
    setMode('fifo');
    setTypedAlloc({});
    setSaveError(null);
  }, []);

  const save = async ({
    andAnother = false,
  }: { andAnother?: boolean } = {}) => {
    setSaveError(null);
    try {
      await submit.mutateAsync(
        buildPayload(type, values, type === 'sell' ? allocation : undefined),
      );
      if (andAnother) {
        setValues({});
        setTypedAlloc({});
      } else {
        router.push('/holdings');
      }
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const saveButtons = (
    <View className="flex-row flex-wrap gap-2">
      <ActionButton
        label="Save transaction"
        primary
        testID="saveTransaction"
        onPress={saveable && !submit.isPending ? () => void save() : undefined}
      />
      <ActionButton
        label="Save and add another"
        testID="saveAndAnother"
        onPress={
          saveable && !submit.isPending
            ? () => void save({ andAnother: true })
            : undefined
        }
      />
    </View>
  );

  const fieldsPanel = (
    <View>
      <Eyebrow className="text-faint">
        {`${meta.label.toUpperCase()} DETAILS`}
      </Eyebrow>
      <View className="mt-4">
        {specs.map((spec) => (
          <Field
            key={spec.key}
            spec={spec}
            value={values[spec.key] ?? ''}
            placeholderColor={colors.faint}
            onChange={(text) => setField(spec.key, text)}
          />
        ))}
      </View>

      <Consideration type={type} values={values} />

      <View className="mt-[18px]">{type === 'sell' ? null : saveButtons}</View>

      {saveError ? (
        <Mono
          testID="saveError"
          className="mt-2 text-[10.5px] leading-[1.55] text-negative"
        >
          {saveError}
        </Mono>
      ) : null}

      <Mono
        testID="saveNote"
        className="mt-2.5 text-[10.5px] leading-[1.55] text-faint"
      >
        {meta.saveNote}
      </Mono>
    </View>
  );

  const rightPanel =
    type === 'sell' ? (
      <ParcelMatchPanel
        symbol={symbol}
        account={account}
        unitsText={values.units ?? ''}
        unitPrice={unitPrice}
        brokerage={brokerage}
        want={want}
        mode={mode}
        onModeChange={(next) => {
          setMode(next);
          setTypedAlloc({});
        }}
        parcels={parcels}
        isPending={parcelsQuery.isFetching}
        error={parcelsQuery.error}
        allocation={allocation}
        summary={summary}
        onAllocate={(parcelId, units) =>
          setTypedAlloc((current) => ({ ...current, [parcelId]: units }))
        }
        saveActions={
          summary.complete ? (
            <View className="mt-3.5 border-t border-edge-subtle pt-3">
              {saveButtons}
            </View>
          ) : null
        }
      />
    ) : (
      <EffectPanel lines={meta.effectLines} />
    );

  return (
    <ScrollView className="flex-1">
      <View className="flex-row items-start px-[26px] pb-4 pt-[22px]">
        <View className="flex-1">
          <Sans className="font-sans-semi text-[22px] tracking-[-0.33px] text-ink">
            New transaction
          </Sans>
          <Mono
            testID="provenanceNote"
            className="mt-1.5 text-[12px] text-muted"
          >
            {`Manual entry · provenance recorded as manual, ${
              session?.user.email ?? 'manual'
            }, ${formatDate(new Date())}`}
          </Mono>
        </View>
        <ActionButton
          label="Cancel"
          testID="cancelEntry"
          onPress={() => router.push('/holdings')}
        />
      </View>

      <View className="px-[26px] pb-[18px]">
        <Eyebrow className="text-faint">TRANSACTION TYPE</Eyebrow>
        <View className="mt-2.5 flex-row flex-wrap gap-1.5">
          {TXN_TYPE_ORDER.map((key) => {
            const selected = key === type;
            return (
              <Pressable
                key={key}
                testID={`txnType-${key}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => changeType(key)}
                className={`rounded-[5px] border px-3 py-1.5 ${
                  selected
                    ? 'border-ink bg-ink'
                    : 'border-edge-control bg-surface-card hover:border-edge-control-hover hover:bg-surface-hover active:bg-surface-hover'
                }`}
              >
                <Sans
                  className={`text-[12.5px] ${
                    selected ? 'text-surface-page' : 'text-strong'
                  }`}
                >
                  {TXN_TYPES[key].label}
                </Sans>
              </Pressable>
            );
          })}
        </View>
        <Sans
          testID="typeHint"
          className="mt-2.5 text-[12px] leading-[1.5] text-mid"
        >
          {meta.hint}
        </Sans>
      </View>

      <View className="h-px bg-edge-subtle" />

      {narrow ? (
        <View>
          <View className="bg-surface-top-bar p-5">{fieldsPanel}</View>
          {rightPanel}
        </View>
      ) : (
        <View className="flex-row items-stretch">
          <View className="min-w-[340px] max-w-[420px] flex-1 border-r border-edge-subtle bg-surface-top-bar p-6">
            {fieldsPanel}
          </View>
          <View className="flex-[2]">{rightPanel}</View>
        </View>
      )}
    </ScrollView>
  );
}

function Field({
  spec,
  value,
  placeholderColor,
  onChange,
}: {
  spec: FieldSpec;
  value: string;
  placeholderColor: string;
  onChange: (text: string) => void;
}) {
  const blank = value.trim() === '';
  const warn = spec.warningIfBlank === true && blank;

  return (
    <View className="mb-[13px]">
      <View className="flex-row items-center justify-between">
        <Sans className="text-[11.5px] text-mid">{spec.label}</Sans>
        {spec.hint ? (
          <Mono className="text-[10.5px] text-faint">{spec.hint}</Mono>
        ) : null}
      </View>
      <TextInput
        testID={`field-${spec.key}`}
        value={value}
        editable={spec.readOnly !== true}
        onChangeText={onChange}
        placeholder={spec.placeholder}
        placeholderTextColor={placeholderColor}
        className={`mt-[5px] h-8 rounded-[5px] border px-2.5 font-mono text-[13px] text-ink focus:border-link ${
          spec.rightAlign ? 'text-right' : 'text-left'
        } ${spec.readOnly ? 'bg-surface-active' : 'bg-surface-card'} ${
          warn ? 'border-edge-warn-box' : 'border-edge-control'
        }`}
      />
      {warn ? (
        <Mono
          testID={`warn-${spec.key}`}
          className="mt-1 text-[10.5px] leading-[1.45] text-held-not-yet-fg"
        >
          {NOT_STATED_WARNING}
        </Mono>
      ) : null}
    </View>
  );
}

function Consideration({
  type,
  values,
}: {
  type: TxnTypeKey;
  values: FieldValues;
}) {
  const rows = consideration(type, values);
  if (rows.length === 0) return null;

  return (
    <View testID="consideration" className="mt-[5px]">
      {rows.map((row) => (
        <View
          key={row.label}
          className="flex-row items-center justify-between py-[3.5px]"
        >
          <Sans
            className={`text-[11.5px] ${
              row.bold ? 'font-sans-med text-ink' : 'text-mid'
            }`}
          >
            {row.label}
          </Sans>
          <Mono
            className={
              row.bold
                ? 'font-mono-med text-[14px] text-ink'
                : 'text-[12.5px] text-mid'
            }
          >
            {`${row.prefix ?? ''}${money(row.value)}`}
          </Mono>
        </View>
      ))}
    </View>
  );
}
