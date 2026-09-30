/**
 * The lot columns shared by the public notice (PUB-03) and the supplier workspace (SUP-08): lot, scope, delivery
 * location, stage and the lot's own deadline in official time (DD-15, DD-33).
 */
import type { NoticeLot } from '@contracts/publication';

import { OfficialDeadline, OrDash, StatusChip } from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { t } from '../../../lib/i18n';

export function lotColumns<L extends NoticeLot>(): DataTableColumn<L>[] {
  return [
    {
      id: 'lot',
      header: t('publication.shared.col.lot'),
      cell: (lot) => (
        <>
          <strong>{t('publication.common.lotNo', { no: lot.lotNo })}</strong>
          <span className="tiq-cell-sub">{lot.title}</span>
        </>
      ),
    },
    {
      id: 'description',
      header: t('publication.shared.col.scope'),
      cell: (lot) => (
        <>
          <OrDash>{lot.description}</OrDash>
          {lot.quantityDescription !== null && (
            <span className="tiq-cell-sub">{lot.quantityDescription}</span>
          )}
        </>
      ),
    },
    {
      id: 'location',
      header: t('publication.shared.col.location'),
      cell: (lot) => <OrDash>{lot.deliveryLocation}</OrDash>,
    },
    {
      id: 'stage',
      header: t('publication.shared.col.stage'),
      cell: (lot) => (
        <>
          <StatusChip enum="lots.stage" value={lot.stage} size="sm" />
          {lot.outcomeReason !== null && <span className="tiq-cell-sub">{lot.outcomeReason}</span>}
        </>
      ),
    },
    {
      id: 'deadline',
      header: t('publication.shared.col.deadline'),
      cell: (lot) =>
        lot.submissionDeadline === null ? (
          <span className="tiq-text-muted">{t('publication.shared.tenderDeadline')}</span>
        ) : (
          <OfficialDeadline deadline={lot.submissionDeadline} showLocal={false} />
        ),
    },
  ];
}
