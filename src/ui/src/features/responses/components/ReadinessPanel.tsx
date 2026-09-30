/**
 * Readiness of a revision (FR-11): blocking errors are separated from warnings, every finding links to where it is
 * fixed, and the panel states that readiness is never a submission (AC-11).
 */
import type { ReactNode } from 'react';

import type { BidReadiness } from '@contracts/bids';

import { Card, ReadinessChecklist } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { toChecklistItems } from '../lib/readiness';

export interface ReadinessPanelProps {
  readonly readiness: BidReadiness;
  readonly timeZone: string;
  readonly title?: string;
  readonly actions?: ReactNode;
}

export function ReadinessPanel({ readiness, timeZone, title, actions }: ReadinessPanelProps) {
  return (
    <Card
      title={title ?? t('responses.readiness.title')}
      subtitle={t('responses.readiness.subtitle', {
        no: readiness.revisionNo,
        time: formatDateTime(readiness.checkedAt, timeZone),
      })}
      actions={actions}
    >
      <ReadinessChecklist
        items={toChecklistItems(readiness.items)}
        label={t('responses.readiness.listLabel')}
      />
      <p className="tiq-text-muted">
        {readiness.ready
          ? t('responses.readiness.readyNote')
          : t('responses.readiness.notReadyNote', { count: readiness.blockingCount })}
      </p>
    </Card>
  );
}
