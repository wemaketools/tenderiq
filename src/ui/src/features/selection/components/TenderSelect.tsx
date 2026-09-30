/**
 * A tender picker over the selection register (`buyer.selection.tenders`). As a filter it offers "All tenders"; in a
 * form it is required. Whether the register can be read is decided from the active membership's permissions: a
 * caller without selection access (for example an evaluator or the evaluation chair) gets no picker and the register
 * is never requested, so no 403 is provoked. A forbidden answer (permissions changed server side) still hides it.
 */
import { usePermission } from '../../../auth/permissions';
import { Select } from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { useSelectionTenders } from '../lib/hooks';
import { SELECTION_READ } from '../lib/permissions';

export interface TenderSelectProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly mode: 'filter' | 'form';
  readonly error?: string;
  readonly fieldClassName?: string;
}

export function TenderSelect(props: TenderSelectProps) {
  const canRead = usePermission(SELECTION_READ);
  if (!canRead) return null;
  return <TenderSelectField {...props} />;
}

function TenderSelectField({ value, onChange, mode, error, fieldClassName }: TenderSelectProps) {
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
