import type { Row } from '../../data/api';
import type { OpenParcel } from '../../data/repository';
import { D, Decimal, ZERO } from '../../domain/decimal';
import { FIELD_SPECS } from './fieldSpecs';
import { TXN_TYPES, type TxnTypeKey } from './meta';

/**
 * The pure parts of manual transaction entry: parsing typed values, matching
 * disposed units to parcels, and assembling the payload
 * `confirm_staged_row()` reads.
 *
 * Ledger-touching, so it lives apart from the form and is unit-tested
 * directly rather than only through the UI.
 */

export type FieldValues = Record<string, string>;
export type Allocation = Record<string, number>;
export type MatchMode = 'fifo' | 'specific';

/** A typed money/quantity field. Blank and unparseable both read as zero. */
export function parseDecimal(input: string | undefined): Decimal {
  const cleaned = (input ?? '').replace(/,/g, '').trim();
  if (cleaned === '') return ZERO;
  try {
    return D(cleaned);
  } catch {
    return ZERO;
  }
}

/** Units being disposed. Whole units only, matching the Flutter `int.tryParse`. */
export function parseUnits(input: string | undefined): number {
  const parsed = Number.parseInt((input ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * FIFO allocation: consume oldest parcels first until `want` is satisfied.
 * Port of `_fifoAlloc`. `parcels` is expected oldest-first, which is the order
 * `fetchOpenParcels` returns.
 */
export function fifoAlloc(parcels: OpenParcel[], want: number): Allocation {
  const result: Allocation = {};
  let left = want;
  for (const parcel of parcels) {
    if (left <= 0) break;
    const available = Math.floor(
      Number(parcel.available.toFixed(0, Decimal.ROUND_DOWN)),
    );
    const use = Math.min(left, available);
    if (use > 0) result[parcel.id] = use;
    left -= use;
  }
  return result;
}

/**
 * The allocation actually in force: computed for FIFO, as typed for specific
 * identification. Port of `_effectiveAlloc`.
 *
 * Which method applies is the user's assertion, never inferred -- CLAUDE.md:
 * "parcel selection method: all user-asserted".
 */
export function effectiveAlloc(
  parcels: OpenParcel[],
  mode: MatchMode,
  want: number,
  typed: Record<string, string>,
): Allocation {
  if (mode === 'fifo') return fifoAlloc(parcels, want);
  const result: Allocation = {};
  for (const parcel of parcels) {
    const value = Number.parseInt(typed[parcel.id] ?? '', 10);
    if (Number.isFinite(value) && value > 0) result[parcel.id] = value;
  }
  return result;
}

export interface AllocationSummary {
  allocatedUnits: number;
  costBaseUsed: Decimal;
  gain: Decimal;
  /** The portion of the gain from parcels held over 12 months. Reported
   * separately; the CGT discount itself is applied by the FY report, not here. */
  gainFromLongHeld: Decimal;
  /** Units still to allocate; negative when over-allocated. */
  shortfall: number;
  over: boolean;
  complete: boolean;
}

export function summariseAllocation(
  parcels: OpenParcel[],
  allocation: Allocation,
  unitPrice: Decimal,
  want: number,
): AllocationSummary {
  let allocatedUnits = 0;
  let costBaseUsed = ZERO;
  let gain = ZERO;
  let gainFromLongHeld = ZERO;

  for (const parcel of parcels) {
    const use = allocation[parcel.id] ?? 0;
    if (use === 0) continue;
    const used = D(use);
    const parcelCost = parcel.costPerUnit.times(used);
    const parcelGain = unitPrice.times(used).minus(parcelCost);
    allocatedUnits += use;
    costBaseUsed = costBaseUsed.plus(parcelCost);
    gain = gain.plus(parcelGain);
    if (parcel.discountEligible) {
      gainFromLongHeld = gainFromLongHeld.plus(parcelGain);
    }
  }

  const shortfall = want - allocatedUnits;
  return {
    allocatedUnits,
    costBaseUsed,
    gain,
    gainFromLongHeld,
    shortfall,
    over: allocatedUnits > want,
    complete: shortfall === 0 && want > 0,
  };
}

/**
 * Whether the entry can be saved. Port of `_canSave` plus the SELL branch that
 * the Flutter build evaluated inside its FutureBuilder.
 *
 * Two rules, both from the type metadata's `saveNote`: a SELL needs every unit
 * matched, and a DIVIDEND needs a franking credit transcribed from the
 * statement. Neither is derived if absent.
 */
export function canSave(
  type: TxnTypeKey,
  values: FieldValues,
  allocation?: AllocationSummary,
): boolean {
  if (type === 'sell') return allocation?.complete === true;
  if (type === 'div') return (values.franking_credit ?? '').trim() !== '';
  return true;
}

/**
 * Builds `parsed_payload` for `confirm_staged_row()`. Port of `_buildPayload`.
 *
 * KNOWN DEFECT, ported as-is rather than fixed: `account_id` carries whatever
 * the user typed into the free-text "Source account" field -- a display name
 * like "CommSec 0421" -- and `trade_date` carries a DD/MM/YYYY string. The RPC
 * does `(v_parsed->>'account_id')::uuid` and casts the date, so both fail. No
 * `instrument_id` is sent either. See the accompanying `test.failing` and the
 * PR description; fixing it means an account picker that yields the real UUID
 * and an ISO date, which is a behaviour change rather than a port.
 *
 * Several fields below are likewise built and then silently ignored by the RPC:
 * parcel_allocation, franked, unfranked, franking_credit, residual, ratio,
 * amount_per_unit, original_acquisition_date, original_cost_base.
 */
export function buildPayload(
  type: TxnTypeKey,
  values: FieldValues,
  parcelAllocation?: Allocation,
): Row {
  const keys = new Set(FIELD_SPECS[type].map((spec) => spec.key));
  const value = (key: string) => (values[key] ?? '').trim();

  const payload: Row = {
    type: TXN_TYPES[type].dbType,
    trade_date: value('trade_date'),
    account_id: value('account'),
  };

  if (keys.has('symbol')) payload.symbol = value('symbol').toUpperCase();
  if (keys.has('units')) payload.quantity = value('units');
  if (keys.has('unit_price')) payload.unit_price = value('unit_price');
  if (keys.has('brokerage')) payload.brokerage = value('brokerage');
  if (keys.has('ref')) payload.external_ref = value('ref');
  if (keys.has('orig_date')) {
    payload.original_acquisition_date = value('orig_date');
  }
  if (keys.has('orig_cost')) payload.original_cost_base = value('orig_cost');
  if (parcelAllocation) payload.parcel_allocation = parcelAllocation;

  return payload;
}

/** The BUY / SELL consideration breakdown under the fields panel. */
export function consideration(type: TxnTypeKey, values: FieldValues) {
  const units = parseDecimal(values.units);
  const price = parseDecimal(values.unit_price);
  const brokerage = parseDecimal(values.brokerage);
  const gross = units.times(price);

  if (type === 'buy') {
    return [
      { label: 'Consideration', value: gross, bold: false },
      { label: 'Plus brokerage', value: brokerage, bold: false, prefix: '+' },
      {
        label: 'Cost base of new parcel',
        value: gross.plus(brokerage),
        bold: true,
      },
    ];
  }
  if (type === 'sell') {
    return [
      { label: 'Gross proceeds', value: gross, bold: false },
      { label: 'Less brokerage', value: brokerage, bold: false, prefix: '-' },
      { label: 'Net proceeds', value: gross.minus(brokerage), bold: true },
    ];
  }
  return [];
}

/** ROC's read-only Total field: amount per unit x units. */
export function rocTotal(values: FieldValues): string {
  const total = parseDecimal(values.amount_per_unit).times(
    parseDecimal(values.units),
  );
  return total.isZero() ? '' : total.toFixed(2);
}
