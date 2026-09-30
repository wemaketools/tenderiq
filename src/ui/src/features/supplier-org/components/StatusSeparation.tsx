/**
 * The separate decisions about a supplier organization (FR-02, BR-03, AC-07): registration, contact verification,
 * membership approval, identity verification and qualification are shown side by side, each with what it does and
 * does not prove. Registration is never presented as qualification.
 */
import type { ReactNode } from 'react';

import { Banner, Card, DetailList } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export interface SeparateStatus {
  readonly id: string;
  readonly label: string;
  readonly value: ReactNode;
  readonly explanation: string;
}

export interface StatusSeparationProps {
  readonly statuses: readonly SeparateStatus[];
  readonly title?: string;
  /** Adds the AC-07 statement that registration is not qualification. */
  readonly showQualificationNote?: boolean;
}

export function StatusSeparation({
  statuses,
  title,
  showQualificationNote = true,
}: StatusSeparationProps) {
  return (
    <Card
      title={title ?? t('supplier-org.statuses.title')}
      subtitle={t('supplier-org.statuses.subtitle')}
    >
      <div className="tiq-stack">
        <DetailList
          items={statuses.map((status) => ({
            key: status.id,
            label: status.label,
            value: (
              <span className="tiq-stack">
                <span>{status.value}</span>
                <span className="tiq-cell-sub">{status.explanation}</span>
              </span>
            ),
          }))}
        />
        {showQualificationNote && (
          <Banner tone="info" title={t('supplier-org.statuses.notQualificationTitle')}>
            <p>{t('supplier-org.statuses.notQualification')}</p>
          </Banner>
        )}
      </div>
    </Card>
  );
}
