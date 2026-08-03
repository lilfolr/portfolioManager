-- CSV import: raw file retention, per-row diagnostics, and the bulk paths that
-- make a few thousand rows a handful of round trips rather than a few thousand.
--
-- The write path onto the ledger is unchanged: confirm_staged_row() is still
-- the only function that inserts a transaction, and everything added here
-- either feeds it or calls it. Import is a way to *stage* rows in bulk; it is
-- not a second door onto the ledger (CLAUDE.md rule 3).

-- ---------------------------------------------------------------------------
-- Raw file retention.
--
-- CLAUDE.md rule 6: "Raw source is retained so a bad parse can be reprocessed
-- without asking the user for the original again." import_sources.raw_blob_ref
-- has existed since the first migration with nothing to point at; this is the
-- bucket it points into.
--
-- Path convention is `{user_id}/{import_source_id}/{filename}`, and the
-- policies below key off the first path segment. That makes the object's owner
-- a property of its location rather than of a metadata column, which is what
-- lets a plain storage RLS policy enforce tenancy.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imports',
  'imports',
  false,
  5242880, -- 5 MiB; the edge function refuses anything larger before parsing
  array[
    'text/csv',
    'text/plain',
    'application/csv',
    'application/vnd.ms-excel',
    'application/octet-stream'
  ]
)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by the Storage extension; these are
-- the per-command policies for this bucket. Same shape as every other
-- user-owned table in 0002_rls.sql, including `(select auth.uid())` so the
-- planner hoists it into an InitPlan.

create policy imports_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy imports_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy imports_objects_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Delete is granted so an abandoned upload can be cleaned up by the client
-- that made it. Deleting the blob does not delete the import -- once a job is
-- committed the staged rows and any transactions stand on their own, and
-- raw_blob_ref simply stops resolving.
create policy imports_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.import_sources
  add column row_count     integer,
  add column error_message text,
  add column content_hash  text;

comment on column public.import_sources.content_hash is
  'SHA-256 of the uploaded file. Lets the start screen point out that this '
  'exact file has been imported before -- a warning, never an automatic skip.';

-- Cheap "have I seen this file" lookup for the start screen.
create index import_sources_content_hash_idx
  on public.import_sources (user_id, content_hash);

alter table public.staged_rows
  add column issues     jsonb not null default '[]'::jsonb,
  add column dedupe_key text;

comment on column public.staged_rows.issues is
  'Array of {code, field, message, blocking}. One extensible column rather '
  'than a column per failure mode: unmapped values, unresolved instruments '
  'and duplicate suspicion all land here. A row with any blocking entry '
  'cannot be confirmed.';

comment on column public.staged_rows.dedupe_key is
  'Stable digest of the identifying fields, so the same trade arriving via '
  'both a CSV and a registry email is detectable. Advisory only.';

create index staged_rows_dedupe_key_idx
  on public.staged_rows (user_id, dedupe_key);

-- Makes committing an import idempotent: a retried or double-clicked commit
-- re-inserts the same (source_id, row_number) pairs and they are discarded
-- rather than duplicated. row_number is null for manual entry, and null is
-- distinct from null in a unique constraint, so manual rows are unaffected.
alter table public.staged_rows
  add constraint staged_rows_source_row_unique unique (source_id, row_number);

-- v_active_transactions now joins import_sources, and "show me what this job
-- created" is the core of the import detail view.
create index transactions_source_id_idx on public.transactions (source_id);

-- ---------------------------------------------------------------------------
-- Blocking-issue predicate.
--
-- Used by every confirm path, so it lives in one place. Defensive about the
-- shape of `issues` because a bad writer would otherwise turn a malformed
-- payload into an error at confirm time rather than a row that simply has no
-- blocking issues.
-- ---------------------------------------------------------------------------

create function public.staged_row_blocked(p_issues jsonb)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_issues) <> 'array' then false
    else exists (
      select 1
      from jsonb_array_elements(p_issues) as i
      where coalesce((i ->> 'blocking')::boolean, false)
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- Voided imports drop out here, which is the whole mechanism: the parcels
-- edge function, the holdings screen, the holding detail tabs and the
-- provenance join all read this view, so one status flip removes a bad import
-- from every derived figure at once without touching a transaction row.
--
-- The numeric::text casts are unchanged and load-bearing -- PostgREST
-- serialises `numeric` as an unquoted JSON number, which would silently round
-- a numeric(20,8) quantity at the client boundary.
create or replace view public.v_active_transactions
  with (security_invoker = true) as
select
  t.id, t.user_id, t.account_id, t.instrument_id, t.type, t.trade_date,
  t.settlement_date,
  t.quantity::text as quantity,
  t.unit_price::text as unit_price,
  t.brokerage::text as brokerage,
  t.fees::text as fees,
  t.currency,
  t.fx_rate_to_aud::text as fx_rate_to_aud,
  t.financial_year, t.source_id, t.external_ref, t.created_at, t.superseded_by
from public.transactions t
left join public.import_sources s on s.id = t.source_id
where t.superseded_by is null
  and (s.id is null or s.status <> 'voided');

-- One row per import job with its staged-row tally, so the status screen reads
-- a single table instead of counting client-side over a paginated fetch.
create view public.v_import_jobs
  with (security_invoker = true) as
select
  s.id,
  s.user_id,
  s.kind,
  s.filename_or_message_id,
  s.imported_at,
  s.status,
  s.parser_version,
  s.raw_blob_ref,
  s.content_hash,
  s.row_count,
  s.error_message,
  count(r.id) as staged_total,
  count(r.id) filter (where r.status = 'pending') as staged_pending,
  count(r.id) filter (where r.status = 'confirmed') as staged_confirmed,
  count(r.id) filter (where r.status = 'rejected') as staged_rejected,
  count(r.id) filter (where public.staged_row_blocked(r.issues)) as staged_blocked,
  count(r.id) filter (
    where jsonb_typeof(r.issues) = 'array' and jsonb_array_length(r.issues) > 0
  ) as staged_with_issues
from public.import_sources s
left join public.staged_rows r on r.source_id = s.id
group by s.id;

grant select on public.v_import_jobs to authenticated;

-- ---------------------------------------------------------------------------
-- active_dedupe_keys: the keys already in force for one account.
--
-- Returns a single jsonb object rather than a row set, deliberately. PostgREST
-- caps every response at max_rows (1000, see config.toml), so reading this as
-- a table would silently truncate for anyone with a real trading history and
-- quietly stop detecting duplicates past the first thousand. One scalar
-- response has no such cap.
--
-- SECURITY INVOKER (the default), so RLS on staged_rows scopes it to the
-- caller without an explicit ownership check. Joining through
-- v_active_transactions rather than reading staged_rows alone is what excludes
-- superseded transactions and voided imports -- re-importing a file after
-- voiding the first attempt is a correction, and flagging every row of it as a
-- duplicate would be noise.
-- ---------------------------------------------------------------------------

create function public.active_dedupe_keys(p_account_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(r.dedupe_key, 'T-' || left(t.id::text, 8)),
    '{}'::jsonb
  )
  from public.staged_rows r
  join public.v_active_transactions t on t.id = r.transaction_id
  where r.status = 'confirmed'
    and r.dedupe_key is not null
    and t.account_id = p_account_id;
$$;

-- ---------------------------------------------------------------------------
-- confirm_staged_row: unchanged except for the blocking-issue guard.
--
-- The guard belongs here rather than in the bulk wrappers because this is the
-- single write path onto transactions -- putting it anywhere else would leave
-- a way to confirm a row the parser could not fully understand.
-- ---------------------------------------------------------------------------

create or replace function public.confirm_staged_row(p_staged_row_id uuid)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.staged_rows%rowtype;
  v_txn public.transactions%rowtype;
  v_parsed jsonb;
begin
  select * into v_row from public.staged_rows where id = p_staged_row_id;

  if not found then
    raise exception 'staged row % not found', p_staged_row_id;
  end if;

  if v_row.user_id <> auth.uid() then
    raise exception 'not authorized';
  end if;

  if v_row.status <> 'pending' then
    raise exception 'staged row % is not pending (status=%)', p_staged_row_id, v_row.status;
  end if;

  v_parsed := v_row.parsed_payload;
  if v_parsed is null then
    raise exception 'staged row % has no parsed payload', p_staged_row_id;
  end if;

  if public.staged_row_blocked(v_row.issues) then
    raise exception 'staged row % has unresolved blocking issues', p_staged_row_id;
  end if;

  insert into public.transactions (
    user_id, account_id, instrument_id, type, trade_date, settlement_date,
    quantity, unit_price, brokerage, fees, currency, fx_rate_to_aud,
    source_id, external_ref
  ) values (
    v_row.user_id,
    (v_parsed ->> 'account_id')::uuid,
    nullif(v_parsed ->> 'instrument_id', '')::uuid,
    (v_parsed ->> 'type')::public.transaction_type,
    (v_parsed ->> 'trade_date')::date,
    nullif(v_parsed ->> 'settlement_date', '')::date,
    nullif(v_parsed ->> 'quantity', '')::numeric,
    nullif(v_parsed ->> 'unit_price', '')::numeric,
    coalesce(nullif(v_parsed ->> 'brokerage', '')::numeric, 0),
    coalesce(nullif(v_parsed ->> 'fees', '')::numeric, 0),
    coalesce(nullif(v_parsed ->> 'currency', ''), 'AUD'),
    coalesce(nullif(v_parsed ->> 'fx_rate_to_aud', '')::numeric, 1),
    v_row.source_id,
    nullif(v_parsed ->> 'external_ref', '')
  )
  returning * into v_txn;

  update public.staged_rows
    set status = 'confirmed', transaction_id = v_txn.id
    where id = p_staged_row_id;

  return v_txn;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_import_source_status.
--
-- import_sources has no client UPDATE grant and gains none here: leaving the
-- table closed and routing every transition through one function keeps the
-- set of legal state changes readable in a single place. The edge function
-- calls this to mark a job processed or errored once its rows have landed.
-- ---------------------------------------------------------------------------

create function public.set_import_source_status(
  p_source_id     uuid,
  p_status        public.import_source_status,
  p_row_count     integer default null,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_current public.import_source_status;
begin
  select user_id, status into v_owner, v_current
  from public.import_sources where id = p_source_id;

  if not found then
    raise exception 'import source % not found', p_source_id;
  end if;

  if v_owner <> auth.uid() then
    raise exception 'not authorized';
  end if;

  -- Only an in-flight job may be resolved, and voiding has its own entry
  -- point. Without this, a stale retry could flip a voided job back to
  -- processed and quietly resurrect its transactions.
  if v_current <> 'pending' then
    raise exception 'import source % is already resolved (status=%)', p_source_id, v_current;
  end if;

  if p_status not in ('processed', 'error') then
    raise exception 'set_import_source_status only resolves to processed or error, got %', p_status;
  end if;

  update public.import_sources
     set status        = p_status,
         row_count     = coalesce(p_row_count, row_count),
         error_message = p_error_message
   where id = p_source_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- bulk_insert_staged_rows.
--
-- The loop runs inside Postgres on purpose. Staging a 20,000-row file as
-- individual PostgREST inserts would be tens of sequential round trips from
-- the edge runtime, stacking network latency on top of parse time and risking
-- the function being killed part-way through with a half-staged job behind it.
-- One call per few thousand rows keeps the whole commit to a handful of trips.
--
-- `on conflict do nothing` against staged_rows_source_row_unique is what makes
-- a retry safe: re-sending a chunk that already landed is a no-op rather than
-- a duplicate.
-- ---------------------------------------------------------------------------

create function public.bulk_insert_staged_rows(p_source_id uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_status public.import_source_status;
  v_inserted integer;
begin
  select user_id, status into v_owner, v_status
  from public.import_sources where id = p_source_id;

  if not found then
    raise exception 'import source % not found', p_source_id;
  end if;

  if v_owner <> auth.uid() then
    raise exception 'not authorized';
  end if;

  if v_status <> 'pending' then
    raise exception 'import source % is not accepting rows (status=%)', p_source_id, v_status;
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a json array, got %', jsonb_typeof(p_rows);
  end if;

  insert into public.staged_rows (
    user_id, source_id, row_number, raw_payload, parsed_payload, issues,
    dedupe_key, status
  )
  select
    v_owner,
    p_source_id,
    (r ->> 'row_number')::integer,
    coalesce(r -> 'raw_payload', '{}'::jsonb),
    -- `r -> 'parsed_payload'` yields jsonb 'null' (not SQL NULL) when the key
    -- is present and null, which is what a row the parser could not resolve
    -- looks like. confirm_staged_row tests for SQL NULL, so normalise here.
    nullif(r -> 'parsed_payload', 'null'::jsonb),
    coalesce(r -> 'issues', '[]'::jsonb),
    nullif(r ->> 'dedupe_key', ''),
    'pending'
  from jsonb_array_elements(p_rows) as r
  on conflict (source_id, row_number) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_staged_rows: an explicit, hand-picked selection.
--
-- All-or-nothing by design. These are rows a person ticked one at a time, so
-- a partial success that leaves them guessing which half landed is worse than
-- a clean failure they can retry.
-- ---------------------------------------------------------------------------

create function public.confirm_staged_rows(p_ids uuid[])
returns setof public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  foreach v_id in array coalesce(p_ids, '{}'::uuid[]) loop
    -- confirm_staged_row does its own ownership, status and blocking checks.
    return next public.confirm_staged_row(v_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_import_source: everything still pending in one job.
--
-- Takes a source id rather than a list of row ids so confirming a 10,000-row
-- import does not put 10,000 UUIDs on the wire, and so a selection spanning
-- several pages of the review screen never has to be materialised on the
-- client.
--
-- Batched, and reports what is left: one call confirms at most p_limit rows
-- and returns the remaining count, so the caller loops and the screen shows
-- real progress. It also keeps each call comfortably inside the authenticated
-- role's statement_timeout, which a single 10,000-row transaction would not
-- be.
--
-- Rows with blocking issues are skipped rather than raising -- they are the
-- expected residue of a partly-understood file, and the user resolves or
-- rejects them separately. Skipping them is why `remaining` counts only
-- confirmable rows: otherwise the caller's loop would never terminate.
-- ---------------------------------------------------------------------------

create function public.confirm_import_source(
  p_source_id uuid,
  p_limit     integer default 500
)
returns table (confirmed integer, remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_id uuid;
  v_confirmed integer := 0;
  v_remaining integer;
begin
  select user_id into v_owner from public.import_sources where id = p_source_id;

  if not found then
    raise exception 'import source % not found', p_source_id;
  end if;

  if v_owner <> auth.uid() then
    raise exception 'not authorized';
  end if;

  if p_limit is null or p_limit < 1 then
    raise exception 'p_limit must be positive, got %', p_limit;
  end if;

  for v_id in
    select id
    from public.staged_rows
    where source_id = p_source_id
      and user_id = v_owner
      and status = 'pending'
      and parsed_payload is not null
      and not public.staged_row_blocked(issues)
    order by row_number
    limit p_limit
  loop
    perform public.confirm_staged_row(v_id);
    v_confirmed := v_confirmed + 1;
  end loop;

  select count(*) into v_remaining
  from public.staged_rows
  where source_id = p_source_id
    and user_id = v_owner
    and status = 'pending'
    and parsed_payload is not null
    and not public.staged_row_blocked(issues);

  return query select v_confirmed, v_remaining;
end;
$$;

-- ---------------------------------------------------------------------------
-- void_import_source: discard a whole import.
--
-- Nothing is deleted. The job is marked voided, which takes its transactions
-- out of v_active_transactions and therefore out of the parcel engine's input
-- set, and its still-pending staged rows are rejected so they stop appearing
-- in the review queue. The transaction rows themselves are untouched -- they
-- remain in `transactions` as the record of what was imported and undone,
-- which is the point of an append-only ledger.
--
-- Reversible by construction, since nothing was destroyed. There is no
-- unvoid entry point yet; add one when a user needs it rather than guessing
-- at the semantics now.
-- ---------------------------------------------------------------------------

create function public.void_import_source(p_source_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_status public.import_source_status;
begin
  select user_id, status into v_owner, v_status
  from public.import_sources where id = p_source_id;

  if not found then
    raise exception 'import source % not found', p_source_id;
  end if;

  if v_owner <> auth.uid() then
    raise exception 'not authorized';
  end if;

  if v_status = 'voided' then
    return;
  end if;

  update public.import_sources set status = 'voided' where id = p_source_id;

  update public.staged_rows
     set status = 'rejected'
   where source_id = p_source_id
     and user_id = v_owner
     and status = 'pending';
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Same shape as the two existing RPCs: revoke from public, then grant
-- execute to authenticated only.
-- ---------------------------------------------------------------------------

revoke all on function public.staged_row_blocked(jsonb) from public;
grant execute on function public.staged_row_blocked(jsonb) to authenticated;

revoke all on function public.active_dedupe_keys(uuid) from public;
grant execute on function public.active_dedupe_keys(uuid) to authenticated;

revoke all on function public.set_import_source_status(uuid, public.import_source_status, integer, text) from public;
grant execute on function public.set_import_source_status(uuid, public.import_source_status, integer, text) to authenticated;

revoke all on function public.bulk_insert_staged_rows(uuid, jsonb) from public;
grant execute on function public.bulk_insert_staged_rows(uuid, jsonb) to authenticated;

revoke all on function public.confirm_staged_rows(uuid[]) from public;
grant execute on function public.confirm_staged_rows(uuid[]) to authenticated;

revoke all on function public.confirm_import_source(uuid, integer) from public;
grant execute on function public.confirm_import_source(uuid, integer) to authenticated;

revoke all on function public.void_import_source(uuid) from public;
grant execute on function public.void_import_source(uuid) to authenticated;
