// Known transaction sequences in, asserted parcels and disposals out.
// CLAUDE.md: "Write the test suite for this before the UI. ... the most
// valuable asset in the codebase." No database, no Deno/Supabase imports
// beyond the std assertion helpers -- this runs anywhere Deno runs.

import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  computeParcelsAndDisposals,
  financialYear,
  isDiscountEligible,
} from "./engine.ts";
import type { Transaction } from "./types.ts";

const ACCOUNT = "acc-1";
const OTHER_ACCOUNT = "acc-2";
const INSTRUMENT = "vas";

function buy(
  id: string,
  tradeDate: string,
  quantity: string,
  unitPrice: string,
  opts: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    accountId: ACCOUNT,
    instrumentId: INSTRUMENT,
    type: "BUY",
    tradeDate,
    quantity,
    unitPrice,
    brokerage: "0",
    fees: "0",
    currency: "AUD",
    fxRateToAud: "1",
    supersededBy: null,
    ...opts,
  };
}

Deno.test("BUY then SELL depletes FIFO across two parcels", () => {
  const txns: Transaction[] = [
    buy("t1", "2020-01-01", "100", "10"), // cost base 1000
    buy("t2", "2021-01-01", "100", "20"), // cost base 2000
    {
      id: "t3",
      accountId: ACCOUNT,
      instrumentId: INSTRUMENT,
      type: "SELL",
      tradeDate: "2022-06-01",
      quantity: "150",
      unitPrice: "30",
      brokerage: "0",
      fees: "0",
      currency: "AUD",
      fxRateToAud: "1",
      supersededBy: null,
    },
  ];

  const { parcels, disposals } = computeParcelsAndDisposals(txns);

  const p1 = parcels.find((p) => p.id === "t1")!;
  const p2 = parcels.find((p) => p.id === "t2")!;
  assertEquals(p1.remainingQuantity, "0");
  assertEquals(p2.remainingQuantity, "50");
  assertEquals(p2.costBase, "1000"); // half of 2000 remains

  assertEquals(disposals.length, 2);
  const d1 = disposals.find((d) => d.parcelId === "t1")!;
  const d2 = disposals.find((d) => d.parcelId === "t2")!;
  assertEquals(d1.quantity, "100");
  assertEquals(d1.costBaseUsed, "1000");
  assertEquals(d2.quantity, "50");
  assertEquals(d2.costBaseUsed, "1000");
  // Both parcels held well over 12 months by the 2022-06-01 sale.
  assert(d1.discountEligible);
  assert(d2.discountEligible);
});

Deno.test("SPLIT rewrites quantity on all open parcels, SELL uses post-split units", () => {
  const txns: Transaction[] = [
    buy("t1", "2019-01-01", "100", "10"), // cost base 1000
    {
      id: "t2",
      accountId: ACCOUNT,
      instrumentId: INSTRUMENT,
      type: "SPLIT",
      tradeDate: "2020-01-01",
      quantity: null,
      unitPrice: "2", // 2-for-1
      brokerage: "0",
      fees: "0",
      currency: "AUD",
      fxRateToAud: "1",
      supersededBy: null,
    },
    {
      id: "t3",
      accountId: ACCOUNT,
      instrumentId: INSTRUMENT,
      type: "SELL",
      tradeDate: "2021-06-01",
      quantity: "150",
      unitPrice: "8",
      brokerage: "0",
      fees: "0",
      currency: "AUD",
      fxRateToAud: "1",
      supersededBy: null,
    },
  ];

  const { parcels, disposals } = computeParcelsAndDisposals(txns);
  const p1 = parcels.find((p) => p.id === "t1")!;
  // 100 units split 2-for-1 -> 200, sell 150 -> 50 remain.
  assertEquals(p1.remainingQuantity, "50");
  // Total cost base unchanged by the split.
  assertEquals(p1.costBase, "250"); // 1000 * (50/200)
  assertEquals(disposals[0].quantity, "150");
  assertEquals(disposals[0].costBaseUsed, "750"); // 1000 * (150/200)
});

Deno.test("tax-deferred distribution component reduces cost base for parcels held at record date", () => {
  const txns: Transaction[] = [
    buy("t1", "2019-01-01", "100", "10"), // cost base 1000, reduced cost base 1000
    buy("t2", "2023-01-01", "100", "10"), // acquired after the record date below
    {
      id: "t3",
      accountId: ACCOUNT,
      instrumentId: INSTRUMENT,
      type: "DISTRIBUTION",
      tradeDate: "2022-01-19",
      quantity: null,
      unitPrice: null,
      brokerage: "0",
      fees: "0",
      currency: "AUD",
      fxRateToAud: "1",
      supersededBy: null,
      recordDate: "2022-01-15",
      incomeComponents: [
        { componentType: "tax_deferred", amount: "100" },
      ],
    },
  ];

  const { parcels } = computeParcelsAndDisposals(txns);
  const p1 = parcels.find((p) => p.id === "t1")!;
  const p2 = parcels.find((p) => p.id === "t2")!;
  // Only t1 was held at the 2022-01-15 record date, so it absorbs the whole
  // $100 tax-deferred reduction on both cost base fields.
  assertEquals(p1.costBase, "900");
  assertEquals(p1.reducedCostBase, "900");
  assertEquals(p2.costBase, "1000");
});

Deno.test("a superseded transaction is excluded from the replay", () => {
  const txns: Transaction[] = [
    buy("t1", "2020-01-01", "100", "10"),
    { ...buy("t1-corrected", "2020-01-01", "80", "10"), id: "t1-corrected" },
  ];
  // Mark the original as superseded by the correction.
  txns[0] = { ...txns[0], supersededBy: "t1-corrected" };

  const { parcels } = computeParcelsAndDisposals(txns);
  assertEquals(parcels.length, 1);
  assertEquals(parcels[0].id, "t1-corrected");
  assertEquals(parcels[0].originalQuantity, "80");
});

Deno.test("DRP opens a parcel with fractional quantity", () => {
  const txns: Transaction[] = [
    buy("t1", "2026-03-16", "48.36219178", "103.89", { type: "DRP" }),
  ];
  const { parcels } = computeParcelsAndDisposals(txns);
  assertEquals(parcels[0].originalQuantity, "48.36219178");
});

Deno.test("discount eligibility: exactly 12 months is not enough, 12 months + 1 day is", () => {
  assert(!isDiscountEligible("2021-08-04", "2022-08-04"));
  assert(isDiscountEligible("2021-08-04", "2022-08-05"));
});

Deno.test("financial year: 30 June falls in the prior FY, 1 July starts the next", () => {
  assertEquals(financialYear("2026-06-30"), 2026);
  assertEquals(financialYear("2026-07-01"), 2027);
});

Deno.test("a SELL for more than is held across open parcels throws rather than going negative", () => {
  const txns: Transaction[] = [
    buy("t1", "2020-01-01", "10", "10"),
    {
      id: "t2",
      accountId: ACCOUNT,
      instrumentId: INSTRUMENT,
      type: "SELL",
      tradeDate: "2021-01-01",
      quantity: "20",
      unitPrice: "10",
      brokerage: "0",
      fees: "0",
      currency: "AUD",
      fxRateToAud: "1",
      supersededBy: null,
    },
  ];
  assertThrows(() => computeParcelsAndDisposals(txns));
});

Deno.test("a SELL only depletes parcels held in the same account", () => {
  const txns: Transaction[] = [
    buy("t1", "2020-01-01", "10", "10", { accountId: OTHER_ACCOUNT }),
    {
      id: "t2",
      accountId: ACCOUNT,
      instrumentId: INSTRUMENT,
      type: "SELL",
      tradeDate: "2021-01-01",
      quantity: "5",
      unitPrice: "10",
      brokerage: "0",
      fees: "0",
      currency: "AUD",
      fxRateToAud: "1",
      supersededBy: null,
    },
  ];
  // Nothing open in ACCOUNT, so this must fail rather than silently pull
  // from the other account's holding.
  assertThrows(() => computeParcelsAndDisposals(txns));
});

Deno.test("DEMERGER is refused rather than guessing a cost base split", () => {
  const txns: Transaction[] = [
    buy("t1", "2020-01-01", "10", "10"),
    {
      id: "t2",
      accountId: ACCOUNT,
      instrumentId: INSTRUMENT,
      type: "DEMERGER",
      tradeDate: "2021-01-01",
      quantity: null,
      unitPrice: null,
      brokerage: "0",
      fees: "0",
      currency: "AUD",
      fxRateToAud: "1",
      supersededBy: null,
    },
  ];
  assertThrows(() => computeParcelsAndDisposals(txns));
});
