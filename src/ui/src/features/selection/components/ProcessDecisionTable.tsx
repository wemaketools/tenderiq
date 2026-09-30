/**
 * The process decisions recorded for a selection record: type, reason, status, who proposed and decided it, and the
 * linked approval. Rejected decisions stay visible so the record shows why an alternative was refused (AC-23).
 */
import type { ProcessDecision } from '@contracts/selection';

import { DataTable, EmptyState, OrDash, StatusChip } from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { lotLabel } from '../lib/labels';

export interface ProcessDecisionTableProps {
  readonly decisions: readonly ProcessDecision[];
  readonly timeZone: string;
  readonly caption?: string;
}

export function ProcessDecisionTable({ decisions, timeZone, caption }: ProcessDecisionTableProps) {
  const columns: DataTableColumn<ProcessDecision>[] = [
    {
      id: 'type',
      header: t('selection.processDecision.col.type'),
      cell: (row) => (
        <>
          <span>{tEnum('process_decisions.decision_type', row.decisionType)}</span>
          <span className="tiq-cell-sub">{lotLabel(row.lot)}</span>
        </>
      ),
    },
    {
      id: 'reason',
      header: t('selection.processDecision.col.reason'),
      cell: (row) => row.reason,
    },
    {
      id: 'status',
      header: t('selection.processDecision.col.status'),
      cell: (row) => <StatusChip enum="process_decisions.status" value={row.status} />,
    },
    {
      id: 'people',
      header: t('selection.processDecision.col.people'),
      cell: (row) => (
        <>
          <span>
            {t('selection.processDecision.proposedBy', { name: row.proposedBy.fullName })}
          </span>
          <span className="tiq-cell-sub">
            {row.decidedBy === null
              ? t('selection.processDecision.notDecided')
              : t('selection.processDecision.decidedBy', { name: row.decidedBy.fullName })}
          </span>
        </>
      ),
    },
    {
      id: 'approval',
      header: t('selection.processDecision.col.approval'),
      cell: (row) =>
        row.approval === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <StatusChip enum="approval_requests.status" value={row.approval.status} size="sm" />
        ),
    },
    {
      id: 'createdAt',
      header: t('selection.processDecision.col.created'),
      cell: (row) => formatInstantDate(row.createdAt, timeZone),
    },
  ];
  return (
    <DataTable
      caption={caption ?? t('selection.processDecision.caption')}
      columns={columns}
      rows={decisions}
      rowKey={(row) => String(row.processDecisionId)}
      empty={<EmptyState compact title={t('selection.processDecision.empty')} />}
    />
  );
}
