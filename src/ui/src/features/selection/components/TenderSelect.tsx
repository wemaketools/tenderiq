/**
 * A tender picker over the selection register (`buyer.selection.tenders`). As a filter it offers "All tenders"; in a
 * form it is required. When the register cannot be read (for example an evaluator without selection access), the
 * filter is omitted instead of failing the page.
 */
import { Select } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useSelectionTenders } from '../lib/hooks';

export interface TenderSelectProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly mode: 'filter' | 'form';
  readonly error?: string;
  readonly fieldClassName?: string;
}

export function TenderSelect({ value, onChange, mode, error, fieldClassName }: TenderSelectProps) {
  const tenders = useSelectionTenders();
  if (tenders.error?.kind === 'forbidden') return null;
  const options = (tenders.data?.items ?? []).map((row) => ({
    value: String(row.tenderId),
    label: `${row.reference} ${row.title}`,
  }));
  return (
    <Select
      label={t('selection.common.tender')}
      placeholder={
        mode === 'filter' ? t('selection.common.allTenders') : t('selection.common.selectTender')
      }
      value={value}
      options={options}
      onChange={onChange}
      required={mode === 'form'}
      error={
        error ?? (tenders.error !== null ? t('selection.common.tendersUnavailable') : undefined)
      }
      fieldClassName={fieldClassName}
    />
  );
}
