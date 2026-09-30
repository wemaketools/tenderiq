/**
 * Currency resolution of selection money fields (DD-32): currencies come from API data only (the tender's offer
 * values, then the organization default); when none is known the user enters the ISO 4217 code.
 */
import type { Money } from '@contracts/common';

import type { MoneyInputValue } from '../../../components/ui';

const CURRENCY_CODE = /^[A-Z]{3}$/;

/** The currencies a money field on this tender may use, from offer values and the organization default. */
export function tenderCurrencies(
  values: readonly (Money | null)[],
  organizationDefault: string | null,
): string[] {
  const codes = values
    .map((value) => value?.currency)
    .filter((code): code is string => code !== undefined);
  if (organizationDefault !== null) codes.push(organizationDefault);
  return [...new Set(codes)];
}

/** The value with its currency resolved: the chosen one, else the first available one, else empty. */
export function resolveMoney(
  value: MoneyInputValue,
  currencies: readonly string[],
): MoneyInputValue {
  return {
    amount: value.amount,
    currency: value.currency !== '' ? value.currency : (currencies[0] ?? ''),
  };
}

/** True when the resolved value carries a valid ISO 4217 code. */
export function hasCurrency(value: MoneyInputValue): boolean {
  return CURRENCY_CODE.test(value.currency);
}
