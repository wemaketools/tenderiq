/**
 * BigInt-based decimal arithmetic on strings (DD-32, ADR 0005).
 *
 * Money (`numeric(18,2)`), quantities (`numeric(18,4)`), scores, rates and weights (`numeric(12,6)`) and
 * exchange rates (`numeric(18,8)`) travel end to end as decimal strings and never pass through a JS float.
 * This module is the one arithmetic implementation: the SPA computes live totals with it (SUP-13), the mock
 * API uses it for fixtures, and `src/server/lib/decimal.ts` re-exports it for the authoritative server-side
 * recomputation.
 *
 * Rules:
 * - Input is a plain decimal string: optional `-`, digits, optional `.` and digits (`^-?\d+(\.\d+)?$`).
 *   Exponents, `+`, spaces, grouping separators and empty fractions are rejected with `DecimalError`.
 * - `add`, `sub` and `mul` are exact. `add`/`sub` keep the larger scale of their operands; `mul` keeps the sum
 *   of the scales. `div` always takes an explicit scale and rounds.
 * - Rounding is HALF_UP in the financial sense: a tie rounds AWAY from zero (`2.5 → 3`, `-2.5 → -3`).
 * - `-0` never appears in a result; zero is always unsigned.
 *
 * Pure module: no imports at all (architecture-plan §3.10).
 */

/** A decimal number written as a string, for example `"1500000.00"` or `"-0.125"`. */
export type DecimalInput = string;

/** Error raised for malformed input or an impossible operation. `code` is stable for callers and tests. */
export class DecimalError extends Error {
  readonly code: 'INVALID_DECIMAL' | 'DIVISION_BY_ZERO' | 'INVALID_SCALE';

  constructor(code: DecimalError['code'], message: string) {
    super(message);
    this.name = 'DecimalError';
    this.code = code;
  }
}

/** The accepted decimal string syntax. */
export const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

/** The largest scale any operation accepts. Covers every numeric column (max 8) with a wide margin. */
export const MAX_SCALE = 20;

interface Parsed {
  /** The unscaled integer: value = units / 10^scale. */
  readonly units: bigint;
  readonly scale: number;
}

const TEN = 10n;

function pow10(exponent: number): bigint {
  return TEN ** BigInt(exponent);
}

function assertScale(scale: number): void {
  if (!Number.isInteger(scale) || scale < 0 || scale > MAX_SCALE) {
    throw new DecimalError('INVALID_SCALE', `Scale must be an integer from 0 to ${MAX_SCALE}, got ${scale}.`);
  }
}

function parse(value: DecimalInput): Parsed {
  if (typeof value !== 'string' || !DECIMAL_PATTERN.test(value)) {
    throw new DecimalError('INVALID_DECIMAL', `Not a decimal string: ${JSON.stringify(value)}.`);
  }
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const dot = unsigned.indexOf('.');
  const whole = dot === -1 ? unsigned : unsigned.slice(0, dot);
  const fraction = dot === -1 ? '' : unsigned.slice(dot + 1);
  if (fraction.length > MAX_SCALE) {
    throw new DecimalError('INVALID_DECIMAL', `More than ${MAX_SCALE} decimal places: ${value}.`);
  }
  const magnitude = BigInt(whole + fraction);
  return { units: negative ? -magnitude : magnitude, scale: fraction.length };
}

function render(units: bigint, scale: number): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const whole = scale === 0 ? digits : digits.slice(0, digits.length - scale);
  const fraction = scale === 0 ? '' : `.${digits.slice(digits.length - scale)}`;
  return `${negative && units !== 0n ? '-' : ''}${whole}${fraction}`;
}

/** Re-expresses `p` with a larger scale (never loses digits). */
function widen(p: Parsed, scale: number): bigint {
  return p.units * pow10(scale - p.scale);
}

/** Integer division of `numerator` by a positive or negative `denominator`, rounding HALF_UP (away from zero on ties). */
function divideHalfUp(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  let quotient = n / d;
  const remainder = n % d;
  if (remainder * 2n >= d) {
    quotient += 1n;
  }
  return negative ? -quotient : quotient;
}

/** True when `value` is a well-formed decimal string. */
export function isDecimal(value: unknown): value is string {
  return typeof value === 'string' && DECIMAL_PATTERN.test(value);
}

/** A decimal string from a safe integer or a bigint. Floats are refused: build decimals from strings. */
export function fromInteger(value: number | bigint): string {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new DecimalError('INVALID_DECIMAL', `Only safe integers convert to decimals, got ${value}.`);
  }
  return BigInt(value).toString();
}

/** Exact sum. The result keeps the larger scale of the operands (`"1.5" + "2.25" = "3.75"`, `"1.50" + "2" = "3.50"`). */
export function add(a: DecimalInput, b: DecimalInput): string {
  const x = parse(a);
  const y = parse(b);
  const scale = Math.max(x.scale, y.scale);
  return render(widen(x, scale) + widen(y, scale), scale);
}

/** Exact difference `a - b`, keeping the larger scale of the operands. */
export function sub(a: DecimalInput, b: DecimalInput): string {
  const x = parse(a);
  const y = parse(b);
  const scale = Math.max(x.scale, y.scale);
  return render(widen(x, scale) - widen(y, scale), scale);
}

/**
 * Exact product. The result scale is the sum of the operand scales (`"1.5" × "2.25" = "3.375"`); a product whose
 * scale would exceed `MAX_SCALE` is rounded HALF_UP to `MAX_SCALE` places.
 */
export function mul(a: DecimalInput, b: DecimalInput): string {
  const x = parse(a);
  const y = parse(b);
  const scale = x.scale + y.scale;
  if (scale > MAX_SCALE) {
    return render(divideHalfUp(x.units * y.units, pow10(scale - MAX_SCALE)), MAX_SCALE);
  }
  return render(x.units * y.units, scale);
}

/** `a / b` rounded HALF_UP to exactly `scale` decimal places. Division by zero throws `DIVISION_BY_ZERO`. */
export function div(a: DecimalInput, b: DecimalInput, scale: number): string {
  assertScale(scale);
  const x = parse(a);
  const y = parse(b);
  if (y.units === 0n) {
    throw new DecimalError('DIVISION_BY_ZERO', `Division by zero: ${a} / ${b}.`);
  }
  // a / b = (x.units / 10^xs) / (y.units / 10^ys); scaled result = x.units * 10^(scale + ys - xs) / y.units.
  const shift = scale + y.scale - x.scale;
  const numerator = shift >= 0 ? x.units * pow10(shift) : x.units;
  const denominator = shift >= 0 ? y.units : y.units * pow10(-shift);
  return render(divideHalfUp(numerator, denominator), scale);
}

/** Rounds HALF_UP (ties away from zero) and returns exactly `places` decimal places (`round("86", 2) = "86.00"`). */
export function round(value: DecimalInput, places: number): string {
  assertScale(places);
  const p = parse(value);
  if (p.scale <= places) {
    return render(widen(p, places), places);
  }
  return render(divideHalfUp(p.units, pow10(p.scale - places)), places);
}

/** Alias of `round`: the value at a fixed number of decimal places, for storage and display. */
export const toScale = round;

/** `-1`, `0` or `1` as `a` is less than, equal to or greater than `b` (scale-insensitive: `"1.0" = "1"`). */
export function compare(a: DecimalInput, b: DecimalInput): -1 | 0 | 1 {
  const x = parse(a);
  const y = parse(b);
  const scale = Math.max(x.scale, y.scale);
  const left = widen(x, scale);
  const right = widen(y, scale);
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

export function eq(a: DecimalInput, b: DecimalInput): boolean {
  return compare(a, b) === 0;
}

export function lt(a: DecimalInput, b: DecimalInput): boolean {
  return compare(a, b) < 0;
}

export function lte(a: DecimalInput, b: DecimalInput): boolean {
  return compare(a, b) <= 0;
}

export function gt(a: DecimalInput, b: DecimalInput): boolean {
  return compare(a, b) > 0;
}

export function gte(a: DecimalInput, b: DecimalInput): boolean {
  return compare(a, b) >= 0;
}

export function isZero(value: DecimalInput): boolean {
  return parse(value).units === 0n;
}

export function isNegative(value: DecimalInput): boolean {
  return parse(value).units < 0n;
}

/** Absolute value, keeping the scale. */
export function abs(value: DecimalInput): string {
  const p = parse(value);
  return render(p.units < 0n ? -p.units : p.units, p.scale);
}

/** Negation, keeping the scale. Zero stays unsigned. */
export function neg(value: DecimalInput): string {
  const p = parse(value);
  return render(-p.units, p.scale);
}

/** The smaller of two values, returned as written. */
export function min(a: DecimalInput, b: DecimalInput): string {
  return compare(a, b) <= 0 ? a : b;
}

/** The larger of two values, returned as written. */
export function max(a: DecimalInput, b: DecimalInput): string {
  return compare(a, b) >= 0 ? a : b;
}

/** Exact sum of a list, keeping the largest scale. The sum of an empty list is `"0"`. */
export function sum(values: readonly DecimalInput[]): string {
  return values.reduce<string>((total, value) => add(total, value), '0');
}

/** Removes trailing fractional zeros (`"86.500" → "86.5"`, `"12.00" → "12"`). */
export function normalize(value: DecimalInput): string {
  const p = parse(value);
  let { units, scale } = p;
  while (scale > 0 && units % TEN === 0n) {
    units /= TEN;
    scale -= 1;
  }
  return render(units, scale);
}

/** Number of decimal places written in the value (`"1.250"` → 3). */
export function scaleOf(value: DecimalInput): number {
  return parse(value).scale;
}

export interface FormatOptions {
  /** Round HALF_UP to this many places first. Omitted: the value keeps its own scale. */
  readonly places?: number;
  /** Thousands separator. Default `,`. Use `''` for none. */
  readonly groupSeparator?: string;
  /** Decimal separator. Default `.`. */
  readonly decimalSeparator?: string;
}

/** Formats a decimal for display without floats: `format("1500000", { places: 2 })` → `"1,500,000.00"`. */
export function format(value: DecimalInput, options: FormatOptions = {}): string {
  const parsed = parse(value);
  const text = options.places === undefined ? render(parsed.units, parsed.scale) : round(value, options.places);
  const group = options.groupSeparator ?? ',';
  const point = options.decimalSeparator ?? '.';
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole = '0', fraction] = unsigned.split('.');
  const grouped = group === '' ? whole : whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${negative ? '-' : ''}${grouped}${fraction === undefined ? '' : `${point}${fraction}`}`;
}

/** Currency code check shared with `common.ts` (`char(3)`, `^[A-Z]{3}$`). */
export const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/**
 * Formats an amount with its currency code: `formatMoney("1500000", "BWP")` → `"BWP 1,500,000.00"`.
 * Money always carries its currency (architecture-plan §1). Default 2 places (`numeric(18,2)`).
 */
export function formatMoney(amount: DecimalInput, currency: string, options: FormatOptions = {}): string {
  if (!CURRENCY_PATTERN.test(currency)) {
    throw new DecimalError('INVALID_DECIMAL', `Not a currency code: ${JSON.stringify(currency)}.`);
  }
  return `${currency} ${format(amount, { ...options, places: options.places ?? 2 })}`;
}

const COMPACT_UNITS: ReadonlyArray<readonly [string, number]> = [
  ['B', 9],
  ['M', 6],
  ['K', 3],
];

/**
 * Compact money for KPI cards: `formatMoneyCompact("5300000", "BWP")` → `"BWP 5.3M"` (docs/technical/09-frontend.md).
 * Uses one decimal place, HALF_UP, and drops a trailing `.0`. Amounts under 1,000 are shown in full.
 */
export function formatMoneyCompact(amount: DecimalInput, currency: string): string {
  if (!CURRENCY_PATTERN.test(currency)) {
    throw new DecimalError('INVALID_DECIMAL', `Not a currency code: ${JSON.stringify(currency)}.`);
  }
  const magnitude = abs(amount);
  for (let index = 0; index < COMPACT_UNITS.length; index += 1) {
    const [suffix, exponent] = COMPACT_UNITS[index] ?? ['', 0];
    const unit = pow10(exponent).toString();
    if (gte(magnitude, unit)) {
      const scaled = div(amount, unit, 1);
      const larger = COMPACT_UNITS[index - 1];
      // 999,950 rounds to 1000.0K: show it in the next unit up (1M) instead.
      if (larger !== undefined && gte(abs(scaled), '1000')) {
        const [largerSuffix, largerExponent] = larger;
        return `${currency} ${normalize(div(amount, pow10(largerExponent).toString(), 1))}${largerSuffix}`;
      }
      return `${currency} ${normalize(scaled)}${suffix}`;
    }
  }
  return `${currency} ${format(amount, { places: 0 })}`;
}
