/**
 * ClassificationBadge: the audience classification of a document (`documents.classification`), with a lock for the
 * classifications that restrict reading, and a "Redacted copy" marker so released originals stay distinguishable
 * from redacted copies (PRD §14.1, COM-07).
 */
import type { DocumentsClassification } from '@contracts/enums';

import { t } from '../../lib/i18n';
import { Chip, StatusChip } from '../ui/StatusChip';

const LOCKED: readonly DocumentsClassification[] = [
  'buyer_internal',
  'restricted_assessment',
  'commercially_confidential',
  'sealed',
  'supplier_private',
];

export interface ClassificationBadgeProps {
  readonly classification: DocumentsClassification;
  readonly redactedCopy?: boolean;
}

export function ClassificationBadge({
  classification,
  redactedCopy = false,
}: ClassificationBadgeProps) {
  return (
    <span className="tiq-inline">
      <StatusChip
        enum="documents.classification"
        value={classification}
        size="sm"
        icon={LOCKED.includes(classification) ? 'lock' : 'globe'}
      />
      {redactedCopy && (
        <Chip tone="neutral-outlined" size="sm" icon="eyeOff">
          {t('documentWidget.redactedCopy')}
        </Chip>
      )}
    </span>
  );
}
