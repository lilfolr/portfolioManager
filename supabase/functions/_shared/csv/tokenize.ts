// RFC 4180 CSV tokenizer. Splits text into records and cells; interprets
// nothing.
//
// Hand-rolled rather than pulling in a parser because this needs one thing an
// off-the-shelf tokenizer makes awkward: the *physical* line number each
// record starts on. That number becomes staged_rows.row_number and is shown as
// provenance ("commsec-2024-fy.csv · row 118"), so it has to be the line a
// person sees when they open the file in a spreadsheet -- blank lines counted,
// not silently skipped, and a quoted field spanning three lines advancing the
// count by three.
//
// Pure: no IO, no clock, no dependencies.

export interface CsvRecord {
  /** 1-based physical line the record starts on. */
  line: number;
  cells: string[];
}

export interface TokenizeResult {
  delimiter: string;
  /** The first non-empty record. Empty array if the file has no content. */
  headers: string[];
  /** Every record after the header, blank lines excluded. */
  records: CsvRecord[];
  /** Total physical lines, for error messages. */
  lineCount: number;
}

const CANDIDATE_DELIMITERS = [",", ";", "\t", "|"];

/**
 * Picks the delimiter by counting candidates outside quotes on the header
 * line. Ties resolve in CANDIDATE_DELIMITERS order, which puts comma first --
 * the right default when a file has neither.
 */
export function detectDelimiter(text: string): string {
  let best = ",";
  let bestCount = 0;
  for (const candidate of CANDIDATE_DELIMITERS) {
    const count = countInFirstRecord(text, candidate);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function countInFirstRecord(text: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') i++;
        else inQuotes = false;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delimiter) count++;
    else if (ch === "\n" || ch === "\r") break;
  }
  return count;
}

/** Strips a UTF-8 BOM. Excel writes one on every CSV it exports, and left in
 * place it corrupts the first header ("﻿type" matches nothing). */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function tokenize(
  input: string,
  options: { delimiter?: string } = {},
): TokenizeResult {
  const text = stripBom(input);
  const delimiter = options.delimiter ?? detectDelimiter(text);

  const all: CsvRecord[] = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  const endField = () => {
    cells.push(field);
    field = "";
  };

  const endRecord = () => {
    endField();
    // A single empty (or whitespace-only) cell is a blank line, not a row of
    // data. Everything else is kept, including a row that is entirely empty
    // cells -- `,,,` is a real, if useless, record and dropping it would put
    // every subsequent row_number out by one.
    const blank = cells.length === 1 && (cells[0] ?? "").trim() === "";
    if (!blank) all.push({ line: recordLine, cells });
    cells = [];
    recordLine = line;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      endField();
      continue;
    }

    if (ch === "\r") {
      // \r\n and a bare \r both end the record; consume the \n if present.
      if (text[i + 1] === "\n") i++;
      line++;
      endRecord();
      continue;
    }

    if (ch === "\n") {
      line++;
      endRecord();
      continue;
    }

    field += ch;
  }

  // Trailing record with no terminating newline.
  if (field !== "" || cells.length > 0 || inQuotes) endRecord();

  const [header, ...rest] = all;
  return {
    delimiter,
    headers: header ? header.cells.map((c) => c.trim()) : [],
    records: rest,
    lineCount: line,
  };
}
