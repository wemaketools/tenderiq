import { describe, expect, it } from 'vitest';

import {
  DecimalError,
  MAX_SCALE,
  abs,
  add,
  compare,
  div,
  eq,
  format,
  formatMoney,
  formatMoneyCompact,
  fromInteger,
  gt,
  gte,
  isDecimal,
  isNegative,
  isZero,
  lt,
  lte,
  max,
  min,
  mul,
  neg,
  normalize,
  round,
  scaleOf,
  sub,
  sum,
  toScale,
} from './decimal.js';

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof DecimalError ? error.code : 'NOT_A_DECIMAL_ERROR';
  }
  return undefined;
}

describe('decimal parsing', () => {
  it.each(['0', '1', '-1', '0.5', '-0.5', '1500000.00', '000123', '12.000000'])(
    'accepts the well-formed decimal %s',
    (value) => {
      expect(isDecimal(value)).toBe(true);
      expect(() => add(value, '0')).not.toThrow();
    },
  );

  it.each(['', '.5', '5.', '+1', '1e3', '1,000', ' 1', '1 ', '--1', 'NaN', '0x10', '1.2.3', '١٢'])(
    'rejects the malformed input %j with INVALID_DECIMAL',
    (value) => {
      expect(isDecimal(value)).toBe(false);
      expect(errorCode(() => add(value, '0'))).toBe('INVALID_DECIMAL');
    },
  );

  it('rejects a non-string input with INVALID_DECIMAL', () => {
    expect(isDecimal(12)).toBe(false);
    expect(errorCode(() => add(12 as unknown as string, '0'))).toBe('INVALID_DECIMAL');
  });

  it('rejects more decimal places than MAX_SCALE', () => {
    const tooLong = `0.${'1'.repeat(MAX_SCALE + 1)}`;
    expect(errorCode(() => normalize(tooLong))).toBe('INVALID_DECIMAL');
  });
});

describe('fromInteger', () => {
  it('converts safe integers and bigints to decimal strings', () => {
    expect(fromInteger(0)).toBe('0');
    expect(fromInteger(-42)).toBe('-42');
    expect(fromInteger(123456789012345678901234567890n)).toBe('123456789012345678901234567890');
  });

  it('refuses floats and unsafe integers', () => {
    expect(errorCode(() => fromInteger(0.1))).toBe('INVALID_DECIMAL');
    expect(errorCode(() => fromInteger(Number.MAX_SAFE_INTEGER + 1))).toBe('INVALID_DECIMAL');
  });
});

describe('add and sub', () => {
  it.each([
    ['1', '2', '3'],
    ['1.5', '2.25', '3.75'],
    ['1.50', '2', '3.50'],
    ['0.1', '0.2', '0.3'],
    ['-1.25', '1.25', '0.00'],
    ['-5', '-5.5', '-10.5'],
    ['999999999999999999.99', '0.01', '1000000000000000000.00'],
  ])('add(%s, %s) = %s exactly', (a, b, expected) => {
    expect(add(a, b)).toBe(expected);
  });

  it.each([
    ['3', '2', '1'],
    ['0.3', '0.1', '0.2'],
    ['1', '1.001', '-0.001'],
    ['-1', '-1', '0'],
    ['100000', '120000', '-20000'],
  ])('sub(%s, %s) = %s exactly', (a, b, expected) => {
    expect(sub(a, b)).toBe(expected);
  });

  it('never returns negative zero', () => {
    expect(sub('0.00', '0.00')).toBe('0.00');
    expect(add('-0.5', '0.5')).toBe('0.0');
    expect(neg('0')).toBe('0');
  });
});

describe('mul', () => {
  it.each([
    ['2', '3', '6'],
    ['1.5', '2.25', '3.375'],
    ['-1.5', '2', '-3.0'],
    ['0.1', '0.1', '0.01'],
    ['12.50', '4.0000', '50.000000'],
    ['123456789.12', '1000', '123456789120.00'],
  ])('mul(%s, %s) = %s exactly', (a, b, expected) => {
    expect(mul(a, b)).toBe(expected);
  });

  it('rounds a product whose scale would exceed MAX_SCALE', () => {
    const a = '0.0000000001'; // 1e-10, scale 10
    const b = '0.00000000015'; // 1.5e-10, scale 11
    const product = mul(a, b); // exact 1.5e-20 at scale 21 → HALF_UP to 2e-20 at scale 20
    expect(scaleOf(product)).toBe(MAX_SCALE);
    expect(product).toBe(`0.${'0'.repeat(MAX_SCALE - 1)}2`);
  });
});

describe('div', () => {
  it.each([
    ['1', '3', 6, '0.333333'],
    ['2', '3', 6, '0.666667'],
    ['10', '4', 2, '2.50'],
    ['10', '4', 0, '3'],
    ['-10', '4', 0, '-3'],
    ['1', '8', 2, '0.13'],
    ['-1', '8', 2, '-0.13'],
    ['1', '-8', 3, '-0.125'],
    ['0.5', '0.25', 0, '2'],
    ['100000', '120000', 6, '0.833333'],
    ['7', '7', 4, '1.0000'],
  ])('div(%s, %s, %i) = %s', (a, b, scale, expected) => {
    expect(div(a, b, scale)).toBe(expected);
  });

  it('throws DIVISION_BY_ZERO for a zero divisor at any scale', () => {
    expect(errorCode(() => div('1', '0', 2))).toBe('DIVISION_BY_ZERO');
    expect(errorCode(() => div('1', '0.000', 2))).toBe('DIVISION_BY_ZERO');
  });

  it('throws INVALID_SCALE for a negative, fractional or too large scale', () => {
    expect(errorCode(() => div('1', '3', -1))).toBe('INVALID_SCALE');
    expect(errorCode(() => div('1', '3', 1.5))).toBe('INVALID_SCALE');
    expect(errorCode(() => div('1', '3', MAX_SCALE + 1))).toBe('INVALID_SCALE');
  });
});

describe('round (HALF_UP, ties away from zero)', () => {
  it.each([
    ['2.5', 0, '3'],
    ['-2.5', 0, '-3'],
    ['2.4999', 0, '2'],
    ['1.005', 2, '1.01'],
    ['-1.005', 2, '-1.01'],
    ['1.004', 2, '1.00'],
    ['86', 2, '86.00'],
    ['0.0049', 2, '0.00'],
    ['-0.0049', 2, '0.00'],
    ['123.456789', 4, '123.4568'],
    ['9.999', 2, '10.00'],
  ])('round(%s, %i) = %s', (value, places, expected) => {
    expect(round(value, places)).toBe(expected);
  });

  it('pads to exactly the requested places', () => {
    expect(round('1', 3)).toBe('1.000');
    expect(toScale('12.5', 2)).toBe('12.50');
  });

  it('rejects an invalid number of places', () => {
    expect(errorCode(() => round('1', -2))).toBe('INVALID_SCALE');
  });
});

describe('compare and predicates', () => {
  it('compares values regardless of scale', () => {
    expect(compare('1.0', '1')).toBe(0);
    expect(compare('1.01', '1.1')).toBe(-1);
    expect(compare('-1', '-2')).toBe(1);
    expect(eq('86.00', '86')).toBe(true);
    expect(lt('86.00', '88.00')).toBe(true);
    expect(lte('88', '88.000')).toBe(true);
    expect(gt('120000', '100000')).toBe(true);
    expect(gte('0', '-0.01')).toBe(true);
  });

  it('reports zero and sign', () => {
    expect(isZero('0.000')).toBe(true);
    expect(isZero('0.001')).toBe(false);
    expect(isNegative('-0.01')).toBe(true);
    expect(isNegative('0')).toBe(false);
    expect(abs('-12.30')).toBe('12.30');
    expect(neg('12.30')).toBe('-12.30');
  });

  it('min and max return the operand as written', () => {
    expect(min('1.50', '2')).toBe('1.50');
    expect(max('1.50', '2')).toBe('2');
    expect(max('2.0', '2')).toBe('2.0');
  });
});

describe('sum, normalize, scaleOf', () => {
  it('sums a list exactly and returns "0" for an empty list', () => {
    expect(sum([])).toBe('0');
    expect(sum(['0.1', '0.2', '0.3'])).toBe('0.6');
    expect(sum(['100000.00', '20000', '0.5'])).toBe('120000.50');
  });

  it('normalizes trailing zeros away', () => {
    expect(normalize('86.500')).toBe('86.5');
    expect(normalize('12.00')).toBe('12');
    expect(normalize('-0.0')).toBe('0');
    expect(normalize('100')).toBe('100');
  });

  it('reports the written scale', () => {
    expect(scaleOf('1.250')).toBe(3);
    expect(scaleOf('7')).toBe(0);
  });
});

describe('formatting', () => {
  it('groups thousands and keeps the written scale', () => {
    expect(format('1500000')).toBe('1,500,000');
    expect(format('1500000.5')).toBe('1,500,000.5');
    expect(format('-1234.567', { places: 2 })).toBe('-1,234.57');
    expect(format('999', { places: 2 })).toBe('999.00');
    expect(format('1234567.891', { places: 1, groupSeparator: ' ', decimalSeparator: ',' })).toBe('1 234 567,9');
    expect(format('1234567', { groupSeparator: '' })).toBe('1234567');
  });

  it('formats money with its currency code and two places by default', () => {
    expect(formatMoney('1500000', 'BWP')).toBe('BWP 1,500,000.00');
    expect(formatMoney('120000', 'BWP', { places: 0 })).toBe('BWP 120,000');
    expect(formatMoney('-0.005', 'USD')).toBe('USD -0.01');
  });

  it('rejects an invalid currency code', () => {
    expect(errorCode(() => formatMoney('1', 'bwp'))).toBe('INVALID_DECIMAL');
    expect(errorCode(() => formatMoneyCompact('1', 'BW'))).toBe('INVALID_DECIMAL');
  });

  it('abbreviates amounts for KPI cards', () => {
    expect(formatMoneyCompact('5300000', 'BWP')).toBe('BWP 5.3M');
    expect(formatMoneyCompact('2000000', 'BWP')).toBe('BWP 2M');
    expect(formatMoneyCompact('10000000', 'BWP')).toBe('BWP 10M');
    expect(formatMoneyCompact('1250', 'BWP')).toBe('BWP 1.3K');
    expect(formatMoneyCompact('999950', 'BWP')).toBe('BWP 1M');
    expect(formatMoneyCompact('1500000000', 'BWP')).toBe('BWP 1.5B');
    expect(formatMoneyCompact('-5300000', 'BWP')).toBe('BWP -5.3M');
    expect(formatMoneyCompact('999', 'BWP')).toBe('BWP 999');
  });
});

describe('PRD §9.2 illustrative weighted model (AC-19)', () => {
  const places = 6;
  /** Weighted points = rating / 5 × max points (PRD §9.2). */
  const weighted = (rating: string, maxPoints: string): string => div(mul(rating, maxPoints), '5', places);
  /** Price score = lowest evaluated cost / this offer's evaluated cost × 30. */
  const priceScore = (lowest: string, offer: string): string => div(mul(lowest, '30'), offer, places);

  it('turns a quality rating of 4 out of 5 on a 35-point criterion into 28 points', () => {
    expect(round(weighted('4', '35'), 2)).toBe('28.00');
  });

  it('gives price scores of 30 and 25 for evaluated costs of 100,000 and 120,000', () => {
    expect(round(priceScore('100000', '100000'), 2)).toBe('30.00');
    expect(round(priceScore('100000', '120000'), 2)).toBe('25.00');
  });

  it('totals Supplier A at 86.00 and Supplier B at 88.00, so B ranks first despite the higher cost', () => {
    const supplierA = sum(['28.00', '16.00', '12.00', priceScore('100000', '100000')]);
    const supplierB = sum(['31.50', '18.00', '13.50', priceScore('100000', '120000')]);
    expect(round(supplierA, 2)).toBe('86.00');
    expect(round(supplierB, 2)).toBe('88.00');
    expect(gt(supplierB, supplierA)).toBe(true);
    expect(gt('120000', '100000')).toBe(true);
  });

  it('keeps the maximum points at exactly 100', () => {
    expect(sum(['35', '20', '15', '30'])).toBe('100');
  });

  it('derives each criterion result from its 0–5 rating', () => {
    expect(round(weighted('4.5', '35'), 2)).toBe('31.50');
    expect(round(weighted('4', '20'), 2)).toBe('16.00');
    expect(round(weighted('4.5', '20'), 2)).toBe('18.00');
    expect(round(weighted('4', '15'), 2)).toBe('12.00');
    expect(round(weighted('4.5', '15'), 2)).toBe('13.50');
  });
});
