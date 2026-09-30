/**
 * Holds on an award file (PRD §8.2, BR-13): each hold is a separate condition with an owner, reason, scope, start,
 * review date, release and the actions it blocks. A hold never changes a date by itself.
 */
import { Link } from 'react-router';

import type { Hold } from '@contracts/awards';

import { Card, DataTable, EmptyState, StatusChip } from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';

export interface HoldsCardProps {
  readonly holds: readonly Hold[];
  readonly timeZone: string;
  /** Link to a complaint case (buyer only). */
  readonly complaintPath?: (complaintId: number) => string;
  readonly title?: string;
}

export interface BlockedActionsProps {
  readonly actions: readonly Hold['blockedActions'][number][];
}

export function BlockedActions({ actions }: BlockedActionsProps) {
  if (actions.length === 0) {
    return <span className="tiq-text-muted">{t('awards.holds.nothingBlocked')}</span>;
  }
  return (
    <span className="tiq-inline">
      {actions.map((action) => (
        <StatusChip key={action} enum="holds.blocked_actions" value={action} size="sm" icon="ban" />
      ))}
    </span>
  );
}

export function HoldsCard({ holds, timeZone, complaintPath, title }: HoldsCardProps) {
  const columns: DataTableColumn<Hold>[] = [
    {
      id: 'hold',
      header: t('awards.holds.col.hold'),
      cell: (row) => (
        <>
          <StatusChip enum="holds.hold_type" value={row.holdType} size="sm" />
          <span className="tiq-cell-sub">{row.subjectLabel}</span>
          {row.complaintId !== null && row.complaintReference !== null && (
            <span className="tiq-cell-sub">
              {complaintPath === undefined ? (
                row.complaintReference
              ) : (
                <Link to={complaintPath(row.complaintId)}>{row.complaintReference}</Link>
              )}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'reason',
      header: t('awards.holds.col.reason'),
      cell: (row) => (
        <>
          <span>{row.reason}</span>
          <span className="tiq-cell-sub">{row.scopeDescription}</span>
        </>
      ),
    },
    {
      id: 'owner',
      header: t('awards.holds.col.owner'),
      cell: (row) => (
        <>
          <span>{row.owner.fullName}</span>
          {row.authorityNote !== null && <span className="tiq-cell-sub">{row.authorityNote}</span>}
        </>
      ),
    },
    {
      id: 'blocked',
      header: t('awards.holds.col.blocked'),
      cell: (row) => <BlockedActions actions={row.blockedActions} />,
    },
    {
      id: 'dates',
      header: t('awards.holds.col.dates'),
      cell: (row) => (
        <>
          <span>{t('awards.holds.started', { at: formatDateTime(row.startedAt, timeZone) })}</span>
          <span className="tiq-cell-sub">
            {row.reviewDate === null
              ? t('awards.holds.noReview')
              : t('awards.holds.review', { date: formatCalendarDate(row.reviewDate) })}
          </span>
        </>
      ),
    },
    {
      id: 'state',
      header: t('awards.holds.col.state'),
      cell: (row) =>
        row.releasedAt === null ? (
          <span className="tiq-text-danger">{t('awards.holds.active')}</span>
        ) : (
          <>
            <span className="tiq-text-success">{t('awards.holds.released')}</span>
            <span className="tiq-cell-sub">
              {t('awards.holds.releasedBy', {
                at: formatDateTime(row.releasedAt, timeZone),
                name: row.releasedBy?.fullName ?? t('awards.common.unknownPerson'),
              })}
            </span>
            {row.releaseReason !== null && (
              <span className="tiq-cell-sub">{row.releaseReason}</span>
            )}
          </>
        ),
    },
  ];
  return (
    <Card title={title ?? t('awards.holds.title')} subtitle={t('awards.holds.subtitle')} flush>
      <DataTable
        caption={title ?? t('awards.holds.title')}
        columns={columns}
        rows={holds}
        rowKey={(row) => String(row.holdId)}
        empty={<EmptyState compact icon="shieldCheck" title={t('awards.holds.empty')} />}
      />
    </Card>
  );
}
