/**
 * Picks the supporting evidence of a finding among the documents attached to the record (the shared document panel
 * of an assessment session or a diligence case). Evidence is optional; when the documents cannot be read the select
 * explains it instead of failing the form.
 */
import { listBuyerDocuments } from '@contracts/documents';
import type { DocumentsRelatedType } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { Select } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export interface EvidenceSelectProps {
  readonly relatedType: DocumentsRelatedType;
  readonly relatedId: number;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error?: string;
}

export function EvidenceSelect({
  relatedType,
  relatedId,
  value,
  onChange,
  error,
}: EvidenceSelectProps) {
  const documents = useApiQuery(listBuyerDocuments, {
    query: { relatedType, relatedId, pageSize: 100 },
  });
  const options = (documents.data?.items ?? []).map((document) => ({
    value: String(document.id),
    label: document.title,
  }));
  return (
    <Select
      label={t('selection.evidence.label')}
      placeholder={t('selection.evidence.none')}
      hint={
        documents.error !== null
          ? t('selection.evidence.unavailable')
          : options.length === 0 && documents.data !== undefined
            ? t('selection.evidence.empty')
            : t('selection.evidence.hint')
      }
      value={value}
      options={options}
      onChange={onChange}
      error={error}
    />
  );
}
