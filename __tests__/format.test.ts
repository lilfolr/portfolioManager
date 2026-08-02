import { D } from '@/src/domain/decimal';
import { money, quantity, signedMoney, signedPct } from '@/src/domain/format';

// Ports of the two pure `test()` cases in `test/widget_test.dart`. Assertions
// are unchanged -- if this file goes green, the formatters are byte-identical
// to the Flutter build's.
describe('format', () => {
  it('formats money en-AU grouped 2dp, sign handling matches DC m()', () => {
    expect(money(-1234.5)).toBe('-1,234.50');
    expect(money(1234.5)).toBe('1,234.50');
    expect(money(0)).toBe('0.00');
    expect(signedMoney(1234.5)).toBe('+1,234.50');
    expect(signedMoney(-1234.5)).toBe('-1,234.50');
    expect(signedPct(17.706)).toBe('+17.71%');
    expect(signedPct(-4.2)).toBe('-4.20%');
  });

  it('formats Decimal input identically to the number overload', () => {
    expect(money(D('-1234.5'))).toBe('-1,234.50');
    expect(money(D('1234.5'))).toBe('1,234.50');
    expect(signedMoney(D('1234.5'))).toBe('+1,234.50');
    expect(signedMoney(D('-1234.5'))).toBe('-1,234.50');
    expect(signedPct(D('17.706'))).toBe('+17.71%');
    expect(quantity(D('460'))).toBe('460');
    expect(quantity(D('48.00000000'))).toBe('48');
    expect(quantity(D('22.5'))).toBe('22.5');
  });

  it('groups thousands at every magnitude', () => {
    expect(money(D('999'))).toBe('999.00');
    expect(money(D('1000'))).toBe('1,000.00');
    expect(money(D('1234567.891'))).toBe('1,234,567.89');
    expect(quantity(D('1234567'))).toBe('1,234,567');
  });

  it('keeps full precision on numeric(20,8) quantities', () => {
    // The DRP fixture from engine_test.ts. A float would lose the tail.
    expect(quantity(D('48.36219178'))).toBe('48.36219178');
    // Small fractions must not switch to exponential notation -- decimal.js
    // does that by default below 1e-7, and quantity() splits on '.'.
    expect(quantity(D('0.00000012'))).toBe('0.00000012');
  });

  it('treats negative zero as zero, not as a negative', () => {
    expect(money(D('-0.001'))).toBe('-0.00');
    expect(money(D('0'))).toBe('0.00');
    expect(signedMoney(D('0'))).toBe('+0.00');
  });
});
