// Decimal arithmetic for the engine. CLAUDE.md is explicit: never float,
// never JS `number`, for money or quantity. decimal.js gives us arbitrary
// precision without hand-rolling string arithmetic. Deno resolves npm
// specifiers natively, no build step, no node_modules to check in.
import { Decimal } from "npm:decimal.js@10.4.3";

Decimal.set({ precision: 40 });

export { Decimal };

export function D(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}
