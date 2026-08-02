/**
 * The single point of contact with the backend engine's type contract.
 *
 * `supabase/functions/_shared/engine/types.ts` is dependency-free -- it has no
 * imports at all and declares only types -- so the client re-exports it rather
 * than keeping a second, drifting copy of the shapes the `parcels` edge
 * function returns. The import is type-only, so Babel erases it and Metro never
 * resolves the Deno-style `.ts` specifier; only `tsc` follows it.
 *
 * Values in these shapes are decimal strings, never numbers. Converting them to
 * `Decimal` is the repository's job.
 *
 * The engine module itself is deliberately NOT imported. It runs in exactly one
 * place -- the `parcels` edge function -- per CLAUDE.md's rule that parcels are
 * derived in a single implementation.
 */
export type {
  ComponentType,
  Disposal as WireDisposal,
  EngineResult,
  IncomeComponentInput,
  Parcel as WireParcel,
  Transaction as WireTransaction,
  TransactionType,
} from '../../supabase/functions/_shared/engine/types.ts';
