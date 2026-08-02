-- Manual transaction entry: the two-step path that satisfies CLAUDE.md rule 3
-- ("nothing enters the ledger without user confirmation").
--
-- 1. insert_manual_staged_row()  creates an import_source (kind='manual') and
--    a staged_row in one atomic call, returns the staged_row.id.
-- 2. confirm_staged_row()        already in 0003_ledger_rules.sql; promotes
--    the pending staged_row to a committed transaction row.
--
-- Clients call both RPCs; the only write path onto transactions remains
-- confirm_staged_row, so the append-only and provenance rules are preserved.

create function public.insert_manual_staged_row(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_row_id    uuid;
begin
  -- Every manual entry gets its own import_source row so provenance is
  -- retained per-transaction (CLAUDE.md: "every ledger row has provenance").
  insert into public.import_sources (user_id, kind, filename_or_message_id, status)
  values (
    auth.uid(),
    'manual',
    'manual entry ' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'processed'
  )
  returning id into v_source_id;

  -- raw_payload == parsed_payload for manual entry: there is no parser
  -- artefact separate from what the user typed.
  insert into public.staged_rows (user_id, source_id, raw_payload, parsed_payload, status)
  values (
    auth.uid(),
    v_source_id,
    p_payload,
    p_payload,
    'pending'
  )
  returning id into v_row_id;

  return v_row_id;
end;
$$;

revoke all on function public.insert_manual_staged_row(jsonb) from public;
grant execute on function public.insert_manual_staged_row(jsonb) to authenticated;
