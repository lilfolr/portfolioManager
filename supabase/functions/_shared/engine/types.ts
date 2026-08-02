// Types for the parcel engine. Deliberately dependency-free: no Deno std,
// no Supabase client, no Date.now(). See CLAUDE.md "The parcel engine" --
// this module must stay a pure function of (transactions[]) => derived
// state so it stays testable with known sequences in, asserted parcels and
// disposals out.

export type TransactionType =
  | "BUY"
  | "SELL"
  | "DRP"
  | "DIVIDEND"
  | "DISTRIBUTION"
  | "SPLIT"
  | "CONSOLIDATION"
  | "RETURN_OF_CAPITAL"
  | "DEMERGER"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "INTEREST"
  | "EXPENSE";

export type ComponentType =
  | "franked"
  | "unfranked"
  | "franking_credit"
  | "foreign_income"
  | "foreign_tax_offset"
  | "discounted_capital_gain"
  | "non_discount_capital_gain"
  | "tax_deferred"
  | "cgt_concession"
  | "amit_cost_base_increase";

/** Quantities and money are decimal strings on the wire and in the engine's
 * public API -- never `number` -- to match CLAUDE.md's money rules and avoid
 * float error compounding across a long transaction history. Internally the
 * engine uses a Decimal implementation (see decimal.ts); string in, string
 * out at the boundary. */
export interface Transaction {
  id: string;
  accountId: string;
  instrumentId: string | null;
  type: TransactionType;
  tradeDate: string; // YYYY-MM-DD
  quantity: string | null;
  unitPrice: string | null;
  brokerage: string;
  fees: string;
  currency: string;
  fxRateToAud: string;
  supersededBy: string | null;
  /** Present only on DISTRIBUTION/DIVIDEND transactions that carry
   * tax-deferred components affecting cost base at record date. */
  incomeComponents?: IncomeComponentInput[];
  recordDate?: string | null;
  /** Parcel selection for SELL transactions using specific identification.
   * Omitted (or method 'fifo') means FIFO across open parcels for the
   * instrument+account. */
  disposalMethod?: "fifo" | "specific_identification";
  specificParcelIds?: string[];
}

export interface IncomeComponentInput {
  componentType: ComponentType;
  amount: string;
}

export interface Parcel {
  id: string; // == the opening transaction's id (see migration 0001 note)
  instrumentId: string;
  accountId: string;
  openTransactionId: string;
  acquiredDate: string;
  originalQuantity: string;
  remainingQuantity: string;
  costBase: string;
  reducedCostBase: string;
  costBaseNative: string | null;
  currency: string;
}

export interface Disposal {
  id: string;
  sellTransactionId: string;
  parcelId: string;
  sellDate: string;
  quantity: string;
  proceeds: string;
  costBaseUsed: string;
  gainLoss: string;
  discountEligible: boolean;
}

export interface EngineResult {
  parcels: Parcel[];
  disposals: Disposal[];
}
