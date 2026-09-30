/**
 * The tender picker of the buyer clarification screens (filters and forms), fed by
 * `buyer.clarifications.tenders` so it only lists the active buyer's tenders.
 */
import type { BuyerClarificationTender } from '@contracts/clarifications';

import { Select } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export interface BuyerTenderSelectProps {
  readonly tenders: readonly BuyerClarificationTender[] | undefined;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** "All tenders" in filters; "Select a tender" in forms. */
  readonly placeholder: string;
  readonly label?: string;
  readonly required?: boolean;
  readonly error?: string;
  readonly disabled?: boolean;
}

export function BuyerTenderSelect({
  tenders,
  value,
  onChange,
  placeholder,
  label,
  required,
  error,
  disabled,
}: BuyerTenderSelectProps) {
  return (
    <Select
      label={label ?? t('clarifications.filters.tender')}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      error={error}
      disabled={disabled === true || tenders === undefined}
      options={(tenders ?? []).map((tender) => ({
        value: String(tender.tenderId),
        label: `${tender.reference} · ${tender.title}`,
      }))}
    />
  );
}
