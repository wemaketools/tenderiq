/**
 * Live line totals for the pricing editor, from decimal strings only (DD-32). The server recomputes the official
 * totals on save.
 */
import { isDecimal, mul, round, sub } from '@contracts/decimal';

export interface LineTotalInput {
  readonly priceStatus: string;
  readonly unitPrice: string;
  readonly quantity: string;
  readonly discountAmount: string;
}

/** quantity × unit price − discount, rounded to 2 places; null unless the line is priced with valid decimals. */
export function liveLineTotal(line: LineTotalInput): string | null {
  if (line.priceStatus !== 'priced' || !isDecimal(line.unitPrice) || !isDecimal(line.quantity)) {
    return null;
  }
  const gross = mul(line.quantity, line.unitPrice);
  const discount = isDecimal(line.discountAmount) ? line.discountAmount : '0';
  return round(sub(gross, discount), 2);
}
