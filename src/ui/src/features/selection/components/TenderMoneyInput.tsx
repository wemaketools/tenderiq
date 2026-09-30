/**
 * A money field of a selection form whose currency comes from API data only: the currencies of the tender's
 * evaluated offers first, then the organization's default currency. When neither is known, the user enters the
 * ISO 4217 code, and the form requires it (no literal currency in UI code, DD-32).
 */
import { MoneyInput, TextField } from '../../../components/ui';
import type { MoneyInputValue } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { resolveMoney } from '../lib/money';

export interface TenderMoneyInputProps {
  readonly label: string;
  readonly hint?: string;
  readonly required?: boolean;
  readonly value: MoneyInputValue;
  readonly currencies: readonly string[];
  readonly onChange: (value: MoneyInputValue) => void;
  readonly error?: string;
  /** Shown on the currency code field when no currency is available and none was entered. */
  readonly currencyError?: string;
}

export function TenderMoneyInput({
  label,
  hint,
  required,
  value,
  currencies,
  onChange,
  error,
  currencyError,
}: TenderMoneyInputProps) {
  const resolved = resolveMoney(value, currencies);
  if (currencies.length > 0) {
    return (
      <MoneyInput
        label={label}
        hint={hint}
        required={required}
        currencies={currencies}
        value={resolved}
        onChange={onChange}
        error={error}
      />
    );
  }
  return (
    <>
      <TextField
        label={t('selection.form.currency')}
        hint={t('selection.form.currencyHint')}
        required
        maxLength={3}
        value={value.currency}
        onChange={(currency) => onChange({ ...value, currency: currency.trim().toUpperCase() })}
        error={currencyError}
      />
      <MoneyInput
        label={label}
        hint={hint}
        required={required}
        currencies={[resolved.currency]}
        value={resolved}
        onChange={onChange}
        error={error}
      />
    </>
  );
}
