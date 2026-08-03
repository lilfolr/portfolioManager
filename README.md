# portfolio_app

A ledger for Australian investors holding shares across multiple brokers and
registries. Transactions are the source of truth; parcels (tax lots) are
derived, never edited directly. See `CLAUDE.md` for the full domain rules.

## Backend

Postgres + row-level security via Supabase, run locally with the Supabase
CLI. No separate API server — the client talks to PostgREST directly, with
RLS as the tenant boundary and Supabase Edge Functions for the parcel engine
(the one thing that can't live in SQL).

```
supabase/
  migrations/           schema, RLS policies, append-only rules, views
  seed.sql              two local dev users for RLS testing
  functions/
    _shared/engine/      pure parcel engine (transactions[] -> parcels/disposals)
    _shared/csv/         pure CSV import mapper (file text -> staged rows)
    parcels/             edge function wrapping the engine
    import-csv/          edge function wrapping the mapper
  tests/
    rls_negative.sql     tenant-isolation, append-only and import assertions
```

### Setup

Requires Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```
make db-up        # start Postgres, auth, PostgREST, Studio
make db-reset      # replay migrations + seed.sql from scratch
make fn-serve      # serve edge functions locally, hot-reloads on save
```

`make db-status` prints the local API URL, anon/service keys, and Studio
URL. Local ports are shifted to 543[67]x in `supabase/config.toml` to avoid
clashing with other Supabase projects running on the same machine — override
via `DB_URL` in the Makefile if needed.

### Key rules enforced in the database

- **Transactions are append-only.** Corrections set `superseded_by`; nothing
  else about an existing transaction row can change (enforced by a trigger
  plus a column-level grant).
- **Nothing reaches the ledger unconfirmed.** The only way to create a
  transaction is `confirm_staged_row()`, a `SECURITY DEFINER` RPC. Direct
  `INSERT` on `transactions` is revoked for clients. The bulk import paths
  (`confirm_staged_rows`, `confirm_import_source`) call it rather than
  bypassing it, and it refuses any row whose parser left a blocking issue.
- **An import can be undone without breaking append-only.**
  `void_import_source()` marks the job `voided`, and `v_active_transactions`
  excludes transactions belonging to a voided source. The transaction rows are
  never updated or deleted — they simply stop counting, so parcels recompute
  as if the import had not happened. `superseded_by` stays what it is: a
  pointer to the transaction that *replaced* a specific row.
- **Parcels and disposals are derived, never written directly.** No
  insert/update grant exists on either table for client roles.
- **Every user-scoped table carries `user_id`** (denormalized, enforced via
  composite foreign keys) so RLS policies don't need `EXISTS` joins.

### Testing

```
make fn-test       # parcel engine unit tests (Dockerized Deno, no host install needed)
make fn-check      # type-check the edge functions under Deno
make db-test-rls   # RLS negative tests: cross-tenant isolation, anon lockout,
                    # append-only enforcement, confirm_staged_row ownership,
                    # the import RPCs, and voided-source exclusion
```

All are pure/local — no live Supabase project required beyond `make db-up`.

The CSV import mapper (`functions/_shared/csv`) is Deno source but its unit
tests run under jest, so they are part of the default `make test` rather than
sitting behind Docker like the engine's. `jest.config.js` maps the one `npm:`
specifier it reaches; the Deno-style `./x.ts` import paths resolve as-is.
`make fn-check` covers the thing jest cannot — that it still compiles under
Deno, which is what the edge function actually runs.

## Client

Expo (React Native) with Expo Router, rendering to web via react-native-web as
well as iOS and Android. Web is the primary surface: the ledger is a dense,
spreadsheet-like set of tables that assumes a wide viewport, and the app is
intended to be installable as a PWA.

The Holdings, Holding Detail and Transaction Entry screens read live data —
accounts, instruments, prices, transactions, income and computed parcels —
from the backend above. There is no fixture/sample-data mode; a backend must be
running (`make db-up && make db-reset && make fn-serve`) for the app to show
anything, and an empty ledger renders as an empty state rather than an error.

### Setup

```
cp .env.example .env.local   # once
make db-status                # copy the anon key into .env.local
make install                  # npm install
```

The anon key is public by design — RLS is the tenant boundary, not client-side
secrecy — which is why it is an `EXPO_PUBLIC_` variable inlined into the bundle.

### Run

```
make web          # expo start --web
make ios          # expo start --ios
make android      # expo start --android
```

Sign in with one of the local dev users from `supabase/seed.sql`
(`alice@example.com` / `password123`).

### Layout

```
app/                       expo-router routes only, no logic
  (auth)/login             email + password
  (app)/holdings           the ledger table
  (app)/holdings/[instrumentId]?accountId=…
  (app)/transactions/new   manual entry
  (app)/import-sources     import jobs, status and void
  (app)/import-sources/new upload → validate → stage
  (app)/import-review?sourceId=…   the staged-row review queue
src/
  domain/                  Decimal config, formatters, models, wire types
  data/                    supabase client, api reads, repository, query hooks
  theme/                   palette.js + the NativeWind token wiring
  ui/                      LedgerTable, text components, chips, buttons
  features/                one folder per screen
```

`src/domain/` holds pure logic with no React and no IO: `format.ts`,
`models.ts`, `financial-year.ts`, and the `Decimal` configuration that must
stay in step with the engine's own. `src/data/repository.ts` composes the raw
reads in `api.ts` into the view models each screen needs, and each of those
sits behind one react-query hook in `queries.ts`.

`src/domain/wire.ts` re-exports the engine's `types.ts` by its Deno-style
specifier rather than keeping a second copy of the shapes the `parcels`
function returns. The import is type-only, so Babel erases it and Metro never
resolves the path — but `tsc` does, which means a change to the engine's
contract breaks the client's typecheck instead of surfacing at runtime.

### Colours

`src/theme/palette.js` is the single source of truth for every colour. It is
plain CommonJS so `tailwind.config.js` can `require()` it under Node to
generate both the CSS custom properties and the utility class names, while app
code imports the same object for the cases a class can't express (the
composition ramp, the source-dot map keyed by account name).

Tokens resolve through CSS variables swapped at the root, so components write
`className="bg-surface-card"` with no `dark:` prefixes anywhere. The Tailwind
config **replaces** `theme.colors` rather than extending it, so Tailwind's
default palette does not exist — `bg-white` and `text-black` produce no style
at all — and an eslint rule rejects colour literals outside `palette.js`.

### Testing

```
make test          # jest
make typecheck     # tsc --noEmit
make lint          # eslint
```

Tests use fixtures, not a live backend. Route-level tests mount the real
`app/` tree with only the repository and the auth client mocked, so routing,
layouts, redirects and the responsive switch are exercised for real. Note that
`renderRouter` can only be called once per module registry, so those tests are
one scenario per file — see `__tests__/helpers/router.tsx`.
