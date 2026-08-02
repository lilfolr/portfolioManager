// The parcel engine. Pure function: (transactions[]) => { parcels, disposals }.
// No IO, no database access, no clock reads -- see CLAUDE.md "The parcel
// engine". Every rule here is implemented once, in one place; the SQL layer
// never recomputes cost base.
//
// Rule: transactions are the source of truth, parcels are derived. This
// module is the only place derivation happens.

import { D, Decimal } from "./decimal.ts";
import type {
  Disposal,
  EngineResult,
  Parcel,
  Transaction,
} from "./types.ts";

class EngineError extends Error {}

interface MutableParcel extends Omit<Parcel, "costBase" | "reducedCostBase" | "costBaseNative" | "originalQuantity" | "remainingQuantity"> {
  originalQuantity: Decimal;
  remainingQuantity: Decimal;
  costBase: Decimal;
  reducedCostBase: Decimal;
  costBaseNative: Decimal | null;
}

function toParcel(p: MutableParcel): Parcel {
  return {
    id: p.id,
    instrumentId: p.instrumentId,
    accountId: p.accountId,
    openTransactionId: p.openTransactionId,
    acquiredDate: p.acquiredDate,
    originalQuantity: p.originalQuantity.toString(),
    remainingQuantity: p.remainingQuantity.toString(),
    costBase: p.costBase.toString(),
    reducedCostBase: p.reducedCostBase.toString(),
    costBaseNative: p.costBaseNative?.toString() ?? null,
    currency: p.currency,
  };
}

/** More than 12 months between acquisition and disposal, per the CGT
 * discount rule -- neither the acquisition day nor exactly 12 months later
 * is enough; it must be at least a day past the anniversary. Calendar-date
 * arithmetic only, no currency involved, so plain Date is fine here. */
function isDiscountEligible(acquiredDate: string, sellDate: string): boolean {
  const acquired = new Date(acquiredDate + "T00:00:00Z");
  const sell = new Date(sellDate + "T00:00:00Z");
  const anniversary = new Date(acquired);
  anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 1);
  return sell.getTime() > anniversary.getTime();
}

function financialYear(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1; // 1-12
  return month >= 7 ? year + 1 : year;
}

export function computeParcelsAndDisposals(
  transactions: Transaction[],
): EngineResult {
  const active = transactions
    .filter((t) => t.supersededBy === null)
    .slice()
    .sort((a, b) => {
      const dateCmp = a.tradeDate.localeCompare(b.tradeDate);
      if (dateCmp !== 0) return dateCmp;
      // Stable tie-break so replays are deterministic when multiple
      // transactions land on the same trade date.
      return a.id.localeCompare(b.id);
    });

  // Open parcels, keyed by instrumentId (splits/consolidations apply to
  // every open parcel for the instrument regardless of account) and also
  // tracked per-account for disposal depletion (a sell can only deplete
  // parcels held in the same account as the sale).
  const parcelsByInstrument = new Map<string, MutableParcel[]>();
  const disposals: Disposal[] = [];

  function openParcelsFor(instrumentId: string): MutableParcel[] {
    let list = parcelsByInstrument.get(instrumentId);
    if (!list) {
      list = [];
      parcelsByInstrument.set(instrumentId, list);
    }
    return list;
  }

  for (const txn of active) {
    switch (txn.type) {
      case "BUY":
      case "DRP":
      case "TRANSFER_IN": {
        if (!txn.instrumentId) {
          throw new EngineError(`${txn.type} ${txn.id} has no instrument_id`);
        }
        if (txn.quantity === null || txn.unitPrice === null) {
          throw new EngineError(
            `${txn.type} ${txn.id} requires quantity and unit_price`,
          );
        }
        const quantity = D(txn.quantity);
        const unitPrice = D(txn.unitPrice);
        const fxRate = D(txn.fxRateToAud);
        const grossNative = quantity.times(unitPrice);
        const costsNative = D(txn.brokerage).plus(D(txn.fees));
        const totalNative = grossNative.plus(costsNative);
        const costBaseAud = totalNative.times(fxRate);
        const isForeign = txn.currency !== "AUD";

        const parcel: MutableParcel = {
          id: txn.id,
          instrumentId: txn.instrumentId,
          accountId: txn.accountId,
          openTransactionId: txn.id,
          acquiredDate: txn.tradeDate,
          originalQuantity: quantity,
          remainingQuantity: quantity,
          costBase: costBaseAud,
          reducedCostBase: costBaseAud,
          costBaseNative: isForeign ? totalNative : null,
          currency: txn.currency,
        };
        openParcelsFor(txn.instrumentId).push(parcel);
        break;
      }

      case "SELL": {
        if (!txn.instrumentId) {
          throw new EngineError(`SELL ${txn.id} has no instrument_id`);
        }
        if (txn.quantity === null || txn.unitPrice === null) {
          throw new EngineError(
            `SELL ${txn.id} requires quantity and unit_price`,
          );
        }
        const sellQuantity = D(txn.quantity);
        const fxRate = D(txn.fxRateToAud);
        const proceedsNative = sellQuantity.times(D(txn.unitPrice)).minus(
          D(txn.brokerage),
        ).minus(D(txn.fees));
        const proceedsTotalAud = proceedsNative.times(fxRate);

        const candidates = openParcelsFor(txn.instrumentId).filter(
          (p) => p.accountId === txn.accountId && p.remainingQuantity.gt(0),
        );

        const ordered = orderForDisposal(candidates, txn);

        let remainingToSell = sellQuantity;
        for (const parcel of ordered) {
          if (remainingToSell.lte(0)) break;
          const qtyFromParcel = Decimal.min(
            remainingToSell,
            parcel.remainingQuantity,
          );
          if (qtyFromParcel.lte(0)) continue;

          const shareOfParcel = qtyFromParcel.div(parcel.remainingQuantity);
          const costBaseUsed = parcel.costBase.times(shareOfParcel);
          const reducedCostBaseUsed = parcel.reducedCostBase.times(
            shareOfParcel,
          );
          const proceedsShare = qtyFromParcel.div(sellQuantity).times(
            proceedsTotalAud,
          );
          const gainLoss = proceedsShare.minus(costBaseUsed);

          disposals.push({
            id: `${txn.id}:${parcel.id}`,
            sellTransactionId: txn.id,
            parcelId: parcel.id,
            sellDate: txn.tradeDate,
            quantity: qtyFromParcel.toString(),
            proceeds: proceedsShare.toString(),
            costBaseUsed: costBaseUsed.toString(),
            gainLoss: gainLoss.toString(),
            discountEligible: isDiscountEligible(
              parcel.acquiredDate,
              txn.tradeDate,
            ),
          });

          parcel.remainingQuantity = parcel.remainingQuantity.minus(
            qtyFromParcel,
          );
          parcel.costBase = parcel.costBase.minus(costBaseUsed);
          parcel.reducedCostBase = parcel.reducedCostBase.minus(
            reducedCostBaseUsed,
          );
          remainingToSell = remainingToSell.minus(qtyFromParcel);
        }

        if (remainingToSell.gt(0)) {
          throw new EngineError(
            `SELL ${txn.id} disposes ${sellQuantity.toString()} units but only ` +
              `${sellQuantity.minus(remainingToSell).toString()} were available across open parcels`,
          );
        }
        break;
      }

      case "TRANSFER_OUT": {
        // Movement between accounts/providers, not itself a disposal
        // decision -- CGT treatment of a transfer out depends on facts
        // (own-name transfer vs. off-market sale) that the app must not
        // infer (CLAUDE.md rule 4). This depletes parcel quantity so
        // holdings stay correct; it deliberately does not emit a disposal.
        if (!txn.instrumentId || txn.quantity === null) {
          throw new EngineError(
            `TRANSFER_OUT ${txn.id} requires instrument_id and quantity`,
          );
        }
        let remaining = D(txn.quantity);
        const candidates = openParcelsFor(txn.instrumentId).filter(
          (p) => p.accountId === txn.accountId && p.remainingQuantity.gt(0),
        ).sort((a, b) => a.acquiredDate.localeCompare(b.acquiredDate));
        for (const parcel of candidates) {
          if (remaining.lte(0)) break;
          const qty = Decimal.min(remaining, parcel.remainingQuantity);
          const share = qty.div(parcel.remainingQuantity);
          parcel.costBase = parcel.costBase.times(D(1).minus(share));
          parcel.reducedCostBase = parcel.reducedCostBase.times(
            D(1).minus(share),
          );
          parcel.remainingQuantity = parcel.remainingQuantity.minus(qty);
          remaining = remaining.minus(qty);
        }
        break;
      }

      case "SPLIT":
      case "CONSOLIDATION": {
        // txn.unitPrice carries the ratio (new units per old unit) --
        // e.g. "2" for a 2-for-1 split, "0.5" for a 1-for-2 consolidation.
        // Total cost base is unchanged; only quantity and unit cost move.
        if (!txn.instrumentId || txn.unitPrice === null) {
          throw new EngineError(
            `${txn.type} ${txn.id} requires instrument_id and a ratio in unit_price`,
          );
        }
        const ratio = D(txn.unitPrice);
        for (const parcel of openParcelsFor(txn.instrumentId)) {
          if (parcel.remainingQuantity.lte(0)) continue;
          parcel.originalQuantity = parcel.originalQuantity.times(ratio);
          parcel.remainingQuantity = parcel.remainingQuantity.times(ratio);
        }
        break;
      }

      case "RETURN_OF_CAPITAL": {
        if (!txn.instrumentId || txn.quantity === null) {
          // quantity here is repurposed as "amount per unit"; see comment
          // below. Fees/brokerage don't apply to a distribution event.
          throw new EngineError(
            `RETURN_OF_CAPITAL ${txn.id} requires instrument_id and an amount`,
          );
        }
        applyCostBaseAdjustment(
          openParcelsFor(txn.instrumentId),
          txn,
          (share, totalAmount) => totalAmount.times(share).neg(),
        );
        break;
      }

      case "DISTRIBUTION":
      case "DIVIDEND": {
        if (!txn.incomeComponents?.length || !txn.instrumentId) break;
        const taxDeferred = txn.incomeComponents
          .filter((c) =>
            c.componentType === "tax_deferred" ||
            c.componentType === "amit_cost_base_increase"
          )
          .reduce((sum, c) => {
            const sign = c.componentType === "tax_deferred" ? -1 : 1;
            return sum.plus(D(c.amount).times(sign));
          }, D(0));
        if (taxDeferred.eq(0)) break;
        applyCostBaseAdjustmentByRecordDate(
          openParcelsFor(txn.instrumentId),
          txn.recordDate ?? txn.tradeDate,
          taxDeferred,
        );
        break;
      }

      case "DEMERGER": {
        // Apportioning cost base between the original and the demerged
        // security is a user-asserted allocation under ATO class rulings,
        // not something this engine may infer (CLAUDE.md rule 4). Refuse
        // rather than silently produce a wrong cost base.
        throw new EngineError(
          `DEMERGER ${txn.id}: cost base apportionment is not automated -- ` +
            `requires a user-supplied allocation, not yet wired into the engine`,
        );
      }

      case "INTEREST":
      case "EXPENSE":
        // No parcel effect.
        break;

      default: {
        const _exhaustive: never = txn.type;
        throw new EngineError(`unhandled transaction type: ${_exhaustive}`);
      }
    }
  }

  const parcels: Parcel[] = [];
  for (const list of parcelsByInstrument.values()) {
    for (const p of list) parcels.push(toParcel(p));
  }

  return { parcels, disposals };
}

function orderForDisposal(
  candidates: MutableParcel[],
  txn: Transaction,
): MutableParcel[] {
  if (txn.disposalMethod === "specific_identification") {
    if (!txn.specificParcelIds?.length) {
      throw new EngineError(
        `SELL ${txn.id} specifies specific_identification with no parcel ids`,
      );
    }
    const byId = new Map(candidates.map((p) => [p.id, p]));
    return txn.specificParcelIds
      .map((id) => byId.get(id))
      .filter((p): p is MutableParcel => p !== undefined);
  }
  // FIFO: oldest acquisition first.
  return candidates.slice().sort((a, b) =>
    a.acquiredDate.localeCompare(b.acquiredDate)
  );
}

/** Shared by RETURN_OF_CAPITAL-style adjustments: apply `amountFn` per open
 * parcel, weighted by that parcel's share of total remaining quantity at
 * the time of the event. Floors cost base at zero. */
function applyCostBaseAdjustment(
  parcels: MutableParcel[],
  txn: Transaction,
  amountFn: (share: Decimal, totalAmount: Decimal) => Decimal,
) {
  const open = parcels.filter((p) => p.remainingQuantity.gt(0));
  const totalUnits = open.reduce(
    (sum, p) => sum.plus(p.remainingQuantity),
    D(0),
  );
  if (totalUnits.lte(0)) return;
  const totalAmount = D(txn.quantity!).times(totalUnits); // amount-per-unit * units
  for (const parcel of open) {
    const share = parcel.remainingQuantity.div(totalUnits);
    const delta = amountFn(share, totalAmount);
    parcel.costBase = Decimal.max(0, parcel.costBase.plus(delta));
    parcel.reducedCostBase = Decimal.max(
      0,
      parcel.reducedCostBase.plus(delta),
    );
  }
}

function applyCostBaseAdjustmentByRecordDate(
  parcels: MutableParcel[],
  recordDate: string,
  totalDeltaAud: Decimal,
) {
  const held = parcels.filter(
    (p) => p.remainingQuantity.gt(0) && p.acquiredDate <= recordDate,
  );
  const totalUnits = held.reduce(
    (sum, p) => sum.plus(p.remainingQuantity),
    D(0),
  );
  if (totalUnits.lte(0)) return;
  for (const parcel of held) {
    const share = parcel.remainingQuantity.div(totalUnits);
    const delta = totalDeltaAud.times(share);
    parcel.costBase = Decimal.max(0, parcel.costBase.plus(delta));
    parcel.reducedCostBase = Decimal.max(
      0,
      parcel.reducedCostBase.plus(delta),
    );
  }
}

export { financialYear, isDiscountEligible };
