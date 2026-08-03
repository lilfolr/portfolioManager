import {
  canonicalDecimal,
  coerceCurrency,
  coerceDate,
  coerceDecimal,
  coerceTransactionType,
  dateInZone,
  normaliseHeader,
} from '../supabase/functions/_shared/csv/coerce.ts';

/**
 * Coercion is where a broker's text becomes a ledger value, so these tests are
 * mostly about the two ways that can go quietly wrong: losing precision on a
 * decimal, and landing a date on the wrong side of midnight.
 */

const expectOk = (
  result: ReturnType<typeof coerceDecimal>,
): string | null => {
  if (!result.ok) throw new Error(`expected ok, got ${result.message}`);
  return result.value;
};

const expectBad = (result: ReturnType<typeof coerceDecimal>) => {
  if (result.ok) throw new Error(`expected a failure, got ${result.value}`);
  return result;
};

describe('normaliseHeader', () => {
  it('collapses case, spaces and punctuation so aliases need not be exhaustive', () => {
    expect(normaliseHeader('Trade Date')).toBe('tradedate');
    expect(normaliseHeader('trade_date')).toBe('tradedate');
    expect(normaliseHeader('TRADE-DATE')).toBe('tradedate');
  });
});

describe('coerceDecimal', () => {
  it('preserves the scale the source wrote', () => {
    // "10.00" must not come back as "10": numeric(20,8) keeps the scale and a
    // round trip through a float is exactly what CLAUDE.md forbids.
    expect(expectOk(coerceDecimal('10.00'))).toBe('10.00');
    expect(expectOk(coerceDecimal('0.00000001'))).toBe('0.00000001');
  });

  it('keeps precision a double would lose', () => {
    const value = '12345678901234.12345678';
    expect(expectOk(coerceDecimal(value))).toBe(value);
    expect(String(Number(value))).not.toBe(value);
  });

  it('strips thousands separators, currency symbols and whitespace', () => {
    expect(expectOk(coerceDecimal(' $1,234.56 '))).toBe('1234.56');
  });

  it('reads accounting-style parentheses as negative', () => {
    expect(expectOk(coerceDecimal('(1,234.56)'))).toBe('-1234.56');
  });

  it('accepts an explicit sign', () => {
    expect(expectOk(coerceDecimal('-42'))).toBe('-42');
    expect(expectOk(coerceDecimal('+42'))).toBe('42');
  });

  it('treats a blank cell as absent, not as zero', () => {
    // Zero and "not supplied" are different: a missing required value has to
    // surface as an issue rather than a silent 0.
    expect(expectOk(coerceDecimal(''))).toBeNull();
    expect(expectOk(coerceDecimal('   '))).toBeNull();
  });

  it('rejects scientific notation rather than expanding it', () => {
    // Seeing it means the value has already been through a float upstream.
    expect(expectBad(coerceDecimal('1.2e3')).code).toBe('unparseable_decimal');
  });

  it('rejects text', () => {
    expect(expectBad(coerceDecimal('n/a')).code).toBe('unparseable_decimal');
    expect(expectBad(coerceDecimal('1.2.3')).code).toBe('unparseable_decimal');
  });
});

describe('canonicalDecimal', () => {
  it('collapses equal values written differently, for dedupe keys', () => {
    expect(canonicalDecimal('10')).toBe('10');
    expect(canonicalDecimal('10.00')).toBe('10');
    expect(canonicalDecimal('+10')).toBe('10');
  });

  it('maps absent values to an empty string', () => {
    expect(canonicalDecimal(null)).toBe('');
    expect(canonicalDecimal('')).toBe('');
  });
});

describe('coerceDate', () => {
  it('takes an ISO date as written', () => {
    expect(expectOk(coerceDate('2026-08-03', 'ISO', 'Australia/Sydney'))).toBe(
      '2026-08-03',
    );
  });

  it('rejects an impossible calendar date', () => {
    expect(
      expectBad(coerceDate('2026-02-30', 'ISO', 'Australia/Sydney')).code,
    ).toBe('unparseable_date');
  });

  it('reads DMY and MDY according to the profile', () => {
    expect(expectOk(coerceDate('03/08/2026', 'DMY', 'Australia/Sydney'))).toBe(
      '2026-08-03',
    );
    expect(expectOk(coerceDate('03/08/2026', 'MDY', 'America/New_York'))).toBe(
      '2026-03-08',
    );
  });

  it('accepts dash and dot separators', () => {
    expect(expectOk(coerceDate('3-8-2026', 'DMY', 'Australia/Sydney'))).toBe(
      '2026-08-03',
    );
    expect(expectOk(coerceDate('3.8.2026', 'DMY', 'Australia/Sydney'))).toBe(
      '2026-08-03',
    );
  });

  it('expands two-digit years on the POSIX convention', () => {
    expect(expectOk(coerceDate('01/07/26', 'DMY', 'Australia/Sydney'))).toBe(
      '2026-07-01',
    );
    expect(expectOk(coerceDate('01/07/85', 'DMY', 'Australia/Sydney'))).toBe(
      '1985-07-01',
    );
  });

  it('refuses a slashed date when the profile says ISO', () => {
    // Guessing here is how 03/08 silently becomes March instead of August.
    expect(
      expectBad(coerceDate('03/08/2026', 'ISO', 'Australia/Sydney')).code,
    ).toBe('unparseable_date');
  });

  it('discards the time from a timestamp with no offset', () => {
    // No offset means the clock is already the source's own.
    expect(
      expectOk(coerceDate('2026-08-03T09:30:00', 'ISO', 'Australia/Sydney')),
    ).toBe('2026-08-03');
    expect(
      expectOk(coerceDate('2026-08-03 09:30', 'ISO', 'Australia/Sydney')),
    ).toBe('2026-08-03');
  });

  it('rejects a cell that is not a date at all', () => {
    expect(
      expectBad(coerceDate('sometime tuesday', 'ISO', 'Australia/Sydney')).code,
    ).toBe('unparseable_date');
  });
});

/**
 * The financial-year boundary. These are the cases that make normalising to
 * UTC the wrong answer.
 *
 * `financial_year` is a generated column over `trade_date`, and FY2027 runs
 * 1 Jul 2026 to 30 Jun 2027. A trade made on the morning of 1 July in Sydney
 * is 30 June in UTC -- so a UTC normalisation would move it into the previous
 * financial year and change a tax outcome. The target is always the source's
 * own calendar date.
 */
describe('coerceDate across the financial-year boundary', () => {
  it('keeps a Sydney morning trade on 1 July in the new financial year', () => {
    expect(
      expectOk(
        coerceDate('2026-07-01T09:30:00+10:00', 'ISO', 'Australia/Sydney'),
      ),
    ).toBe('2026-07-01');
  });

  it('keeps a Sydney evening trade on 30 June in the old financial year', () => {
    // 30 Jun 2026 23:30 AEST is 1 Jul 2026 in UTC. Storing the UTC date would
    // push a trade forward a whole financial year.
    expect(
      expectOk(
        coerceDate('2026-06-30T23:30:00+10:00', 'ISO', 'Australia/Sydney'),
      ),
    ).toBe('2026-06-30');
  });

  it('resolves a UTC-stamped instant into the source market calendar date', () => {
    // 30 Jun 2026 23:30 UTC is already 1 Jul in Sydney.
    expect(
      expectOk(coerceDate('2026-06-30T23:30:00Z', 'ISO', 'Australia/Sydney')),
    ).toBe('2026-07-01');
  });

  it('keeps a New York trade on its own calendar date', () => {
    // 31 Dec 2026 18:00 EST is 1 Jan 2027 in UTC.
    expect(
      expectOk(
        coerceDate('2026-12-31T18:00:00-05:00', 'ISO', 'America/New_York'),
      ),
    ).toBe('2026-12-31');
  });

  it('applies the offset in force on the date, not a fixed one', () => {
    // Sydney is UTC+11 in January (daylight saving) and UTC+10 in July.
    // Adding a constant number of hours would get one of these wrong.
    expect(dateInZone(new Date('2027-01-31T13:30:00Z'), 'Australia/Sydney')).toBe(
      '2027-02-01',
    );
    expect(dateInZone(new Date('2026-07-31T13:30:00Z'), 'Australia/Sydney')).toBe(
      '2026-07-31',
    );
  });
});

describe('coerceTransactionType', () => {
  it('accepts the canonical spelling', () => {
    expect(expectOk(coerceTransactionType('BUY'))).toBe('BUY');
    expect(expectOk(coerceTransactionType('RETURN_OF_CAPITAL'))).toBe(
      'RETURN_OF_CAPITAL',
    );
  });

  it('is insensitive to case and separators', () => {
    expect(expectOk(coerceTransactionType('buy'))).toBe('BUY');
    expect(expectOk(coerceTransactionType('return of capital'))).toBe(
      'RETURN_OF_CAPITAL',
    );
  });

  it('rejects a type the ledger does not have', () => {
    // Nothing is guessed: mapping a broker's own vocabulary onto a ledger type
    // is a profile's job, where the assumption is visible and versioned.
    expect(expectBad(coerceTransactionType('PURCHASE')).code).toBe(
      'unknown_transaction_type',
    );
  });

  it('treats a blank cell as absent', () => {
    expect(expectOk(coerceTransactionType(''))).toBeNull();
  });
});

describe('coerceCurrency', () => {
  it('upper-cases a three-letter code', () => {
    expect(expectOk(coerceCurrency('aud'))).toBe('AUD');
  });

  it('rejects anything else', () => {
    expect(expectBad(coerceCurrency('AUSD')).code).toBe('invalid_currency');
    expect(expectBad(coerceCurrency('$')).code).toBe('invalid_currency');
  });
});
