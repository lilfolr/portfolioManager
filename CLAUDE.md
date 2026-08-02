# CLAUDE.md

## What this is

A web app for Australian investors who hold shares across multiple brokers and
share registries. It consolidates positions into one ledger with correct,
auditable cost base records, and later produces a tax pack for their accountant.

Phase 1 is the ledger. Phase 2 is the tax layer. Phase 1 must be built so that
Phase 2 is mostly formatting.

## Non-negotiable domain rules

These are the rules that make the product correct. Violating them produces
numbers that are wrong in ways that are hard to detect.

1. **Transactions are the source of truth. Parcels are derived.**
   A parcel is never written directly and never edited. Parcel state is a pure
   function of the active transaction set. If parcel data looks wrong, the fix
   is to correct a transaction and replay.

2. **Transactions are append-only.**
   Corrections create a new transaction and set `superseded_by` on the old one.
   Never UPDATE or DELETE a transaction row.

3. **Nothing enters the ledger without user confirmation.**
   Parsed rows land in `staged_rows` and require explicit confirmation. This
   applies to CSV imports, email parsing, and anything LLM-derived.

4. **The app never infers a classification that changes a tax outcome.**
   Repair vs improvement, capital vs revenue, parcel selection method: all
   user-asserted. The app computes; the user decides.

5. **No advice. Ever.**
   Facts and totals only. No recommendations, no evaluative language, no
   imperatives, no "you should", no highlighting one option as better than
   another. See the Compliance section.

6. **Every ledger row has provenance.**
   Which file, which email, or manual. Raw source is retained so a bad parse
   can be reprocessed without asking the user for the original again.

## Money and numbers

- Money: integer minor units or Postgres `numeric`. **Never float. Never
  JavaScript `number` for currency.**
- Quantity: `numeric(20,8)`. DRP and US fractional shares produce long decimals.
- FX: store the rate used on the transaction itself. Never look it up later.
  Rates get revised.
- Financial year: integer, where `2027` means FY2026-27 (1 Jul 2026 to
  30 Jun 2027). Computed on write, stored on the row. Never derived in a query.
- Dates: trade date and settlement date are different and both matter. CGT uses
  contract/trade date.

## Data model

Core tables and the reasoning behind them:

- `accounts` - a broker, registry, property, or cash source
- `instruments` - symbol, exchange, ISIN, AMIT flag
- `transactions` - immutable event log, discriminated by `type`
- `parcels` - derived, one per acquisition event, depleted by disposals
- `disposals` - links one sell transaction to one or more parcels
- `income_events` + `income_components` - a distribution decomposes into many
  components; do not flatten these into columns on the income row
- `properties`, `property_transactions`, `depreciation_assets`
- `import_sources`, `staged_rows` - provenance and the review queue

Transaction types: `BUY`, `SELL`, `DRP`, `DIVIDEND`, `DISTRIBUTION`, `SPLIT`,
`CONSOLIDATION`, `RETURN_OF_CAPITAL`, `DEMERGER`, `TRANSFER_IN`,
`TRANSFER_OUT`, `INTEREST`, `EXPENSE`.

`TRANSFER_IN` is how holdings arrive with a pre-existing cost base. It is the
onboarding path for users with history the app will never parse.

Parcels carry both `cost_base` and `reduced_cost_base`. These diverge once
tax-deferred distribution components adjust them. Both are needed from day one.

## The parcel engine

This is the heart of the app. It must be a pure function:

```
(transactions[]) => { parcels[], disposals[] }
```

No IO, no database access, no clock reads. Deterministic and fully testable.

Rules it implements:
- A `BUY` or `DRP` opens a parcel
- A `SELL` depletes parcels per the selected method (FIFO or specific
  identification), producing a disposal row per parcel touched
- `discount_eligible` is computed at disposal from the holding period, not
  stored on the parcel
- A `SPLIT` or `CONSOLIDATION` rewrites quantity and unit cost on all open
  parcels for that instrument
- Tax-deferred distribution components reduce cost base on parcels held at the
  record date
- Superseded transactions are excluded from the input set

**Write the test suite for this before the UI.** Known transaction sequences
in, asserted parcels and disposals out. This suite is the most valuable asset
in the codebase.

## Ingestion

There are no consumer APIs for Australian brokers or registries.

- **CSV import**: one parser per source (CommSec, Stake, Selfwealth, Pearler).
  Parsers are versioned via `parser_version` so imports can be reprocessed
  after a fix.
- **Registry email parsing**: each user gets a unique forwarding address.
  Holding statements, dividend statements and contract notes from Computershare,
  MUFG, Automic and Boardroom are parsed on arrival into `staged_rows`.
- **Manual entry**: always available, never removed as an option.

**Never scrape with user credentials.** It violates provider terms and creates
breach liability. If it needs a password to a third party, it is out of scope.

Duplicate detection matters: the same trade will arrive via both CSV and email.

## Compliance

Two separate Australian regimes apply.

**Tax Agent Services Act (TPB).** Providing a tax agent service for a fee
without registration carries civil penalties. Computation on user-asserted
facts is safe. Applying tax law to a user's circumstances is not.

**Corporations Act (ASIC).** Personal advice considers someone's objectives,
situation or needs. Asset allocation commentary, benchmark comparison and
anything about super contributions falls in this space.

Practical rules for code and copy:
- Present facts. "You have $11,200 of unused concessional cap" is a fact.
  "Contribute $11,200" is advice.
- If computing FIFO and specific identification side by side, do not sort by
  outcome or highlight the better one. The comparison is arithmetic; the
  selection is the user's.
- The output is a pack for a registered tax agent. Never a lodgement, never
  framed as final.
- Label estimates as estimates and always show the working.
- Disclaimers are not a defence. What the software does is what matters.

Get a lawyer who works in TASA and AFSL to review the feature list before
launch. Verify current requirements rather than relying on these notes.

## Scope

**In scope for Phase 1:**
Listed shares and ETFs. Broker CSV. Registry email parsing. Parcel ledger.
Income and distribution components. Property income, expenses and depreciation.
End-of-day pricing. Manual entry for everything.

**Deferred:**
Superannuation. Automated bank feeds and CDR. Crypto. Live intraday pricing.
Mobile receipt capture. Net worth charts. Asset allocation views. Performance
attribution. Benchmarking.

**Out of scope entirely:**
Lodgement. Budgeting and expense categorisation of everyday spending. Trusts.
Sole trader income. Multiple properties (Phase 1). Advice of any kind.

When asked to add a feature, apply the filter: **does the tax pack need this
field?** If no, it is deferred. The tracker half is the enjoyable half and will
expand to fill all available time if unchecked.

## Milestone

Ledger complete by **January 2027**. The tax layer needs to be testable against
real data before the April to June window. Missing that window costs a full
year.

## Stack

TypeScript throughout. PostgreSQL. AWS. Web-first, installable as a PWA. Keep
the codebase Capacitor-compatible in case an App Store presence is wanted later.

Market data: end-of-day only. **Check redistribution rights in the licence
before choosing a vendor.** Consuming data and displaying it to your own users
are different permissions and differ by orders of magnitude in cost.

## Conventions

- Correctness over cleverness in anything touching the ledger
- Tables over charts in the UI; dense and scannable, spreadsheet-like
- Full data export always available; tracker users fear lock-in
- All amounts display in AUD, with original currency and FX rate shown for
  foreign holdings
- Prefer explicit over inferred everywhere a tax outcome is involved
- Every screen and component must support light and dark theme. Resolve
  colours from the active theme (`LedgerColors.of(context)` /
  `LedgerPalette`) — never hardcode a `Colors.*` value or literal hex,
  and never give a colour parameter a light-only default
