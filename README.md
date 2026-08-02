# portfolio_app

A ledger for Australian investors holding shares across multiple brokers and
registries. Transactions are the source of truth; parcels (tax lots) are
derived, never edited directly. See `CLAUDE.md` for the full domain rules.

## Backend

Postgres + row-level security via Supabase, run locally with the Supabase
CLI. No separate API server — the Flutter client talks to PostgREST
directly, with RLS as the tenant boundary and Supabase Edge Functions for
the parcel engine (the one thing that can't live in SQL).

```
supabase/
  migrations/           schema, RLS policies, append-only rules, views
  seed.sql              two local dev users for RLS testing
  functions/
    _shared/engine/      pure parcel engine (transactions[] -> parcels/disposals)
    parcels/             edge function wrapping the engine
  tests/
    rls_negative.sql     tenant-isolation and append-only assertions
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
  `INSERT` on `transactions` is revoked for clients.
- **Parcels and disposals are derived, never written directly.** No
  insert/update grant exists on either table for client roles.
- **Every user-scoped table carries `user_id`** (denormalized, enforced via
  composite foreign keys) so RLS policies don't need `EXISTS` joins.

### Testing

```
make fn-test       # parcel engine unit tests (Dockerized Deno, no host install needed)
make db-test-rls   # RLS negative tests: cross-tenant isolation, anon lockout,
                    # append-only enforcement, confirm_staged_row ownership
```

Both are pure/local — no live Supabase project required beyond `make db-up`.

## Flutter app

The Holdings and Holding Detail screens read live data — accounts,
instruments, prices, transactions, income and computed parcels — from the
backend above. There is no fixture/sample-data mode; a backend must be
running (`make db-up && make db-reset && make fn-serve`) for the app to show
anything, and an empty ledger renders as an empty state rather than an error.

### Setup

```
cp env/local.example.json env/local.json   # once
make db-status                              # copy the anon key into env/local.json
make get                                    # flutter pub get
```

### Run

```
make run-web       # flutter run -d chrome, reads Supabase config from env/local.json
make run           # flutter run (device picker)
```

Sign in with one of the local dev users from `supabase/seed.sql`
(`alice@example.com` / `password123`).

### Data layer

```
lib/data/
  api.dart                 thin wrappers over Supabase.instance.client
  portfolio_repository.dart composes api.dart reads into the screens' view models
lib/models/portfolio.dart  Decimal-typed domain models (never double, per CLAUDE.md)
```

`HoldingsScreen` fetches via `fquery`'s `QueryBuilder` (mounts once, at the
app root). `HoldingDetailScreen` fetches via a plain `FutureBuilder` — its
data can't use `QueryBuilder` because it first mounts as a side effect of a
row tap in a different widget's rebuild, and fquery's observer calls
`setState` synchronously from `didChangeDependencies` in that situation,
which Flutter rejects. Both screens take an optional `fetchData` override
(see `test/widget_test.dart`) so widget tests run against fixtures instead
of a live Supabase project.

### Testing

```
make test          # flutter test — widget tests use fixtures, not a live backend
make analyze        # flutter analyze
```
