import {
  detectDelimiter,
  stripBom,
  tokenize,
} from '../supabase/functions/_shared/csv/tokenize.ts';

/**
 * The tokenizer's job is to be boring and exact. These cases are the ones that
 * actually show up in broker exports: Excel's BOM, Windows line endings, a
 * company name with a comma in it, and a trailing blank line.
 *
 * The line numbers matter as much as the cells. `record.line` becomes
 * staged_rows.row_number and is displayed as provenance ("file.csv · row 118"),
 * so it has to be the physical line a person sees in a spreadsheet -- which
 * means blank lines are counted, and a quoted field containing newlines
 * advances the count by more than one.
 */

describe('stripBom', () => {
  it('removes the BOM Excel writes on every exported CSV', () => {
    expect(stripBom('﻿type,date')).toBe('type,date');
  });

  it('leaves a file without one alone', () => {
    expect(stripBom('type,date')).toBe('type,date');
  });
});

describe('detectDelimiter', () => {
  it('defaults to comma', () => {
    expect(detectDelimiter('type,trade_date,symbol')).toBe(',');
  });

  it('finds a semicolon', () => {
    expect(detectDelimiter('type;trade_date;symbol')).toBe(';');
  });

  it('finds a tab', () => {
    expect(detectDelimiter('type\ttrade_date\tsymbol')).toBe('\t');
  });

  it('ignores delimiters inside quotes', () => {
    // One real semicolon, two inside a quoted cell. Counting naively would
    // pick the semicolon and shred the file.
    expect(detectDelimiter('a,"x;y;z",c')).toBe(',');
  });

  it('falls back to comma for a single-column file', () => {
    expect(detectDelimiter('type')).toBe(',');
  });
});

describe('tokenize', () => {
  it('splits a plain file into headers and records', () => {
    const result = tokenize('type,symbol\nBUY,CBA\nSELL,BHP\n');
    expect(result.headers).toEqual(['type', 'symbol']);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toEqual({ line: 2, cells: ['BUY', 'CBA'] });
    expect(result.records[1]).toEqual({ line: 3, cells: ['SELL', 'BHP'] });
  });

  it('handles CRLF line endings', () => {
    const result = tokenize('type,symbol\r\nBUY,CBA\r\n');
    expect(result.headers).toEqual(['type', 'symbol']);
    expect(result.records[0]?.cells).toEqual(['BUY', 'CBA']);
  });

  it('handles a file with no trailing newline', () => {
    const result = tokenize('type,symbol\nBUY,CBA');
    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.cells).toEqual(['BUY', 'CBA']);
  });

  it('keeps commas inside quoted fields', () => {
    const result = tokenize('name,symbol\n"Commonwealth Bank, Ltd",CBA\n');
    expect(result.records[0]?.cells).toEqual([
      'Commonwealth Bank, Ltd',
      'CBA',
    ]);
  });

  it('unescapes doubled quotes', () => {
    const result = tokenize('note\n"she said ""hello"""\n');
    expect(result.records[0]?.cells).toEqual(['she said "hello"']);
  });

  it('keeps newlines inside quoted fields and still counts the lines', () => {
    const result = tokenize('note,symbol\n"line one\nline two",CBA\nBUY,BHP\n');
    expect(result.records[0]?.cells).toEqual(['line one\nline two', 'CBA']);
    // The quoted field spans lines 2 and 3, so the next record is on line 4.
    expect(result.records[1]).toEqual({ line: 4, cells: ['BUY', 'BHP'] });
  });

  it('skips blank lines but still counts them in the line number', () => {
    const result = tokenize('type\nBUY\n\n\nSELL\n');
    expect(result.records).toEqual([
      { line: 2, cells: ['BUY'] },
      { line: 5, cells: ['SELL'] },
    ]);
  });

  it('treats a whitespace-only line as blank', () => {
    const result = tokenize('type\nBUY\n   \nSELL\n');
    expect(result.records.map((r) => r.cells[0])).toEqual(['BUY', 'SELL']);
  });

  it('keeps a row of empty cells, which is not a blank line', () => {
    // Dropping `,,` would put every later row_number out by one.
    const result = tokenize('a,b,c\n,,\nBUY,CBA,1\n');
    expect(result.records[0]).toEqual({ line: 2, cells: ['', '', ''] });
    expect(result.records[1]?.line).toBe(3);
  });

  it('reports ragged rows as-is rather than padding them', () => {
    const result = tokenize('a,b,c\n1,2\n1,2,3,4\n');
    expect(result.records[0]?.cells).toEqual(['1', '2']);
    expect(result.records[1]?.cells).toEqual(['1', '2', '3', '4']);
  });

  it('trims header whitespace but not cell whitespace', () => {
    // Header trimming is what makes " Trade Date " match; cell values are left
    // exactly as written so raw_payload stays a faithful copy.
    const result = tokenize(' type , symbol \nBUY , CBA \n');
    expect(result.headers).toEqual(['type', 'symbol']);
    expect(result.records[0]?.cells).toEqual(['BUY ', ' CBA ']);
  });

  it('returns no headers for an empty file', () => {
    expect(tokenize('').headers).toEqual([]);
    expect(tokenize('').records).toEqual([]);
  });

  it('parses a BOM-prefixed CRLF file, which is what Excel produces', () => {
    const result = tokenize('﻿type,symbol\r\nBUY,CBA\r\n');
    expect(result.headers).toEqual(['type', 'symbol']);
    expect(result.records[0]?.cells).toEqual(['BUY', 'CBA']);
  });
});
