// CSV import: download an uploaded file, map it, and either report what it
// would do (preview) or stage it for review (commit).
//
// Shaped like ../parcels: it forwards the caller's JWT and never touches the
// service role, so RLS -- not this function -- decides what it can see and
// write. All the interpretation lives in the pure ../_shared/csv module; this
// file is IO, size limits, and the order of the writes.
//
// Nothing here reaches the transactions table. Committing produces
// `staged_rows` with status 'pending'; they become transactions only when a
// person confirms them through confirm_staged_row (CLAUDE.md rule 3).

import { createClient } from "npm:@supabase/supabase-js@2";

import { normaliseHeader } from "../_shared/csv/coerce.ts";
import { mapRows } from "../_shared/csv/map.ts";
import {
  detectProfile,
  parserVersion,
  profileById,
} from "../_shared/csv/profiles/index.ts";
import { tokenize } from "../_shared/csv/tokenize.ts";
import type {
  ImportProfile,
  InstrumentRef,
  MappedRow,
} from "../_shared/csv/types.ts";

/** The bucket enforces this too; checking here gives a usable message instead
 * of a storage error, and stops us reading a huge blob into memory. */
const MAX_BYTES = 5 * 1024 * 1024;
/** Above this the edge runtime's memory and time budget stop being safe. A
 * user with more history than this can split the export. */
const MAX_ROWS = 20_000;
/** Rows per bulk_insert_staged_rows call. Sized so a 20k-row import is ~7
 * round trips rather than 40, while each jsonb payload stays a few MB. */
const INSERT_CHUNK = 3_000;

interface RequestBody {
  /** Client-generated UUID, used as both the storage folder and the
   * import_sources id. See the note on idempotency below. */
  importId?: string;
  storagePath?: string;
  filename?: string;
  accountId?: string;
  profileId?: string;
  commit?: boolean;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fail(message: string, status: number): Response {
  return json({ error: message }, status);
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("use POST", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return fail("missing Authorization header", 401);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return fail("body must be JSON", 400);
  }

  const { importId, storagePath, filename, accountId, profileId } = body;
  const commit = body.commit === true;

  if (!importId) return fail("importId is required", 400);
  if (!storagePath) return fail("storagePath is required", 400);
  if (!accountId) return fail("accountId is required", 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  // -------------------------------------------------------------------------
  // Read the uploaded file. The storage policies scope the `imports` bucket to
  // a folder named after the caller's uid, so another user's path simply is
  // not readable with this JWT -- no ownership check is needed here.
  // -------------------------------------------------------------------------

  const download = await supabase.storage.from("imports").download(storagePath);
  if (download.error || !download.data) {
    return fail(
      `could not read ${storagePath}: ${download.error?.message ?? "not found"}`,
      404,
    );
  }

  const bytes = await download.data.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    return fail(
      `file is ${Math.round(bytes.byteLength / 1024)}KB; the limit is ${
        MAX_BYTES / 1024 / 1024
      }MB`,
      413,
    );
  }

  const contentHash = await sha256Hex(bytes);
  const text = new TextDecoder("utf-8").decode(bytes);

  // -------------------------------------------------------------------------
  // Parse and map. Pure from here to the end of mapRows.
  // -------------------------------------------------------------------------

  const { headers, records, delimiter } = tokenize(text);
  if (headers.length === 0) return fail("the file has no header row", 422);
  if (records.length === 0) return fail("the file has no data rows", 422);
  if (records.length > MAX_ROWS) {
    return fail(
      `file has ${records.length} rows; the limit is ${MAX_ROWS}. Split it and import the parts.`,
      413,
    );
  }

  const profile = profileId ? profileById(profileId) : detectProfile(headers);
  if (!profile) {
    return fail(
      profileId
        ? `unknown import profile "${profileId}"`
        : "no import profile recognises these columns",
      422,
    );
  }

  // The account must be the caller's own. RLS makes this a filter rather than
  // a check -- another user's account id simply returns nothing.
  const account = await supabase
    .from("accounts")
    .select("id, display_name")
    .eq("id", accountId)
    .maybeSingle();
  if (account.error) return fail(account.error.message, 500);
  if (!account.data) return fail("unknown account", 422);

  // Only the symbols this file actually mentions, not the whole instrument
  // universe. PostgREST caps responses at max_rows (1000) and the ASX alone
  // has more listings than that, so an unfiltered read would silently truncate
  // and turn known symbols into "unknown instrument" blocking issues.
  const instruments = await loadInstruments(
    supabase,
    symbolsIn(headers, records, profile),
  );
  if (typeof instruments === "string") return fail(instruments, 500);

  // Dedupe keys already in force for this account, as one scalar response --
  // same row-cap reasoning; see active_dedupe_keys in the migration.
  const dedupeKeys = await supabase.rpc("active_dedupe_keys", {
    p_account_id: accountId,
  });
  if (dedupeKeys.error) return fail(dedupeKeys.error.message, 500);
  const existingDedupeKeys = new Map<string, string>(
    Object.entries((dedupeKeys.data ?? {}) as Record<string, string>),
  );

  const mapped = mapRows({
    headers,
    records,
    profile,
    context: { accountId, instruments, existingDedupeKeys },
  });

  // -------------------------------------------------------------------------
  // Preview: report and write nothing.
  // -------------------------------------------------------------------------

  if (!commit) {
    const priorImport = await findPriorImport(supabase, contentHash);
    return json({
      mode: "preview",
      importId,
      profileId: profile.id,
      profileLabel: profile.label,
      parserVersion: parserVersion(profile),
      delimiter,
      contentHash,
      priorImportOfSameFile: priorImport,
      headerMapping: mapped.headerMapping,
      unmappedHeaders: mapped.unmappedHeaders,
      missingColumns: mapped.missingColumns,
      totals: mapped.totals,
      issueSummary: summariseIssues(mapped.rows),
      // Enough to show the shape of the file without shipping all of it back.
      rows: mapped.rows.slice(0, 50),
    });
  }

  // -------------------------------------------------------------------------
  // Commit.
  //
  // importId is generated by the client and used as the import_sources primary
  // key, which is what makes a double-clicked commit safe: the second
  // invocation's insert conflicts, it finds the existing job, and returns that
  // instead of creating a twin. The staging insert is idempotent too, on
  // (source_id, row_number).
  //
  // The job stays 'pending' until every chunk has landed, so an interrupted
  // commit is distinguishable from a finished one -- and, being an ordinary
  // job, is voidable.
  // -------------------------------------------------------------------------

  const existing = await supabase
    .from("import_sources")
    .select("id, status, row_count")
    .eq("id", importId)
    .maybeSingle();
  if (existing.error) return fail(existing.error.message, 500);
  if (existing.data && existing.data.status !== "pending") {
    return json(
      {
        error: "this import has already been committed",
        sourceId: importId,
        status: existing.data.status,
      },
      409,
    );
  }

  if (!existing.data) {
    const created = await supabase.from("import_sources").insert({
      id: importId,
      kind: "csv",
      filename_or_message_id: filename ?? storagePath.split("/").pop() ?? null,
      raw_blob_ref: storagePath,
      parser_version: mapped.parserVersion,
      content_hash: contentHash,
      status: "pending",
    });
    if (created.error) return fail(created.error.message, 500);
  }

  try {
    let staged = 0;
    for (let i = 0; i < mapped.rows.length; i += INSERT_CHUNK) {
      const chunk = mapped.rows.slice(i, i + INSERT_CHUNK);
      const { data, error } = await supabase.rpc("bulk_insert_staged_rows", {
        p_source_id: importId,
        p_rows: chunk,
      });
      if (error) throw new Error(error.message);
      staged += Number(data ?? 0);
    }

    const resolved = await supabase.rpc("set_import_source_status", {
      p_source_id: importId,
      p_status: "processed",
      p_row_count: mapped.rows.length,
      p_error_message: null,
    });
    if (resolved.error) throw new Error(resolved.error.message);

    return json({
      mode: "commit",
      sourceId: importId,
      profileId: profile.id,
      parserVersion: mapped.parserVersion,
      rows: mapped.rows.length,
      staged,
      totals: mapped.totals,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Best effort: if this fails too the job is left 'pending', which reads as
    // "interrupted" rather than as a success.
    await supabase.rpc("set_import_source_status", {
      p_source_id: importId,
      p_status: "error",
      p_row_count: null,
      p_error_message: message.slice(0, 500),
    });
    return fail(`staging failed: ${message}`, 500);
  }
});

// ---------------------------------------------------------------------------

type Client = ReturnType<typeof createClient>;

/** The distinct symbols the file mentions, so the instrument lookup is bounded
 * by the import rather than by the size of the market. */
function symbolsIn(
  headers: string[],
  records: { cells: string[] }[],
  profile: ImportProfile,
): string[] {
  const mapping = profile.columns.find((column) => column.field === "symbol");
  if (!mapping) return [];

  const keys = new Set(
    [mapping.field, ...mapping.aliases].map(normaliseHeader),
  );
  const index = headers.findIndex((header) => keys.has(normaliseHeader(header)));
  if (index === -1) return [];

  const symbols = new Set<string>();
  for (const record of records) {
    const cell = (record.cells[index] ?? "").trim().toUpperCase();
    if (cell !== "") symbols.add(cell);
  }
  return Array.from(symbols);
}

/**
 * Instrument reference data for the given symbols. Returns the rows, or an
 * error message.
 *
 * Chunked because a very wide import could still name more symbols than
 * PostgREST will return in one response, and because a long `in` list makes an
 * unwieldy URL.
 */
async function loadInstruments(
  supabase: Client,
  symbols: string[],
): Promise<InstrumentRef[] | string> {
  if (symbols.length === 0) return [];

  const CHUNK = 200;
  const found: InstrumentRef[] = [];
  for (let i = 0; i < symbols.length; i += CHUNK) {
    const { data, error } = await supabase
      .from("instruments")
      .select("id, symbol, exchange")
      .in("symbol", symbols.slice(i, i + CHUNK));
    if (error) return error.message;
    found.push(...((data ?? []) as InstrumentRef[]));
  }
  return found;
}

/** The most recent non-voided import of a byte-identical file, if any. */
async function findPriorImport(
  supabase: Client,
  contentHash: string,
): Promise<{ id: string; filename: string | null; importedAt: string } | null> {
  const { data, error } = await supabase
    .from("import_sources")
    .select("id, filename_or_message_id, imported_at")
    .eq("content_hash", contentHash)
    .neq("status", "voided")
    .order("imported_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    id: row.id as string,
    filename: (row.filename_or_message_id as string | null) ?? null,
    importedAt: row.imported_at as string,
  };
}

function summariseIssues(rows: MappedRow[]) {
  const counts = new Map<string, { count: number; blocking: boolean }>();
  for (const row of rows) {
    for (const issue of row.issues) {
      const entry = counts.get(issue.code);
      if (entry) entry.count += 1;
      else counts.set(issue.code, { count: 1, blocking: issue.blocking });
    }
  }
  return Array.from(counts.entries())
    .map(([code, entry]) => ({ code, ...entry }))
    .sort((a, b) => b.count - a.count);
}
