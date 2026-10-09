/**
 * BUY-35 screening flags: integrity screening results across suppliers. A possible match only prompts a human review
 * (BR-48); the reviewer records the disposition and effect and may raise a reassessment trigger. The caller leaves
 * the table out for a membership that cannot list screenings; a refused list renders nothing (DD-49).
 */
import { useState } from 'react';

import { qualificationEndpoints as api } from '@contracts/qualification';
import type { Screening, ScreeningListQuery } from '@contracts/qualification';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Chip,
  DataTable,
  EmptyState,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ScreeningReviewDialog } from './ScreeningReviewDialog';

export function ScreeningsTable({
  query,
  timeZone,
  onPageChange,
}: {
  readonly query: Partial<ScreeningListQuery>;
  readonly timeZone: string;
  readonly onPageChange: (page: number) => void;
}) {
  const toast = useToast();
  const canReview = usePermission('qualification.review');
  const list = useApiQuery(api.listScreenings, { query });
  const [reviewing, setReviewing] = useState<Screening | null>(null);
  const [reviewed, setReviewed] = useState<ReadonlyMap<number, Screening>>(new Map());
  const rows = list.data?.items.map((row) => reviewed.get(row.id) ?? row);

  const columns: DataTableColumn<Screening>[] = [
    {
      id: 'supplier',
      header: t('qualification.monitoring.col.supplier'),
      cell: (row) => row.supplier.name,
    },
    {
      id: 'check',
      header: t('qualification.screening.check'),
      cell: (row) => (
        <>
          <span>{tEnum('integrity_screenings.check_type', row.checkType)}</span>
          <span className="tiq-cell-sub">{row.source}</span>
        </>
      ),
    },
    {
      id: 'result',
      header: t('qualification.screening.result'),
      cell: (row) => (
        <>
          <StatusChip enum="integrity_screenings.result" value={row.result} size="sm" />
          {row.matchDetail !== null && <span className="tiq-cell-sub">{row.matchDetail}</span>}
        </>
      ),
    },
    {
      id: 'checkedAt',
      header: t('qualification.screening.checkedAt'),
      cell: (row) => formatDateTime(row.checkedAt, timeZone),
    },
    {
      id: 'review',
      header: t('qualification.screening.review'),
      cell: (row) =>
        row.reviewedAt === null ? (
          row.result === 'no_match' ? (
            <span className="tiq-text-muted">{t('qualification.screening.noReviewNeeded')}</span>
          ) : (
            <Chip tone="warning" size="sm" icon="flag">
              {t('qualification.screening.awaitingReview')}
            </Chip>
          )
        ) : (
          <>
            <span>{row.disposition}</span>
            <span className="tiq-cell-sub">
              {t('qualification.screening.reviewedBy', {
                name: row.reviewedBy?.fullName ?? '',
                at: formatDateTime(row.reviewedAt, timeZone),
              })}
            </span>
          </>
        ),
    },
  ];
  if (canReview) {
    columns.push({
      id: 'actions',
      header: t('qualification.common.actions'),
      cell: (row) =>
        row.reviewedAt === null && row.result !== 'no_match' ? (
          <Button size="sm" icon="shieldCheck" onClick={() => setReviewing(row)}>
            {t('qualification.screening.reviewAction')}
          </Button>
        ) : null,
    });
  }

  if (list.error?.kind === 'forbidden') return null;

  return (
    <Card flush>
      <Banner tone="info">{t('qualification.screening.flagOnly')}</Banner>
      <DataTable
        caption={t('qualification.monitoring.screeningsCaption')}
        columns={columns}
        rows={rows}
        rowKey={(row) => String(row.id)}
        loading={list.isFetching}
        error={list.error}
        onRetry={list.reload}
        empty={<EmptyState compact title={t('qualification.screening.none')} />}
        pagination={
          list.data === undefined
            ? undefined
            : {
                page: list.data.page,
                pageSize: list.data.pageSize,
                total: list.data.total,
                onPageChange,
              }
        }
      />
      {reviewing !== null && (
        <ScreeningReviewDialog
          screening={reviewing}
          timeZone={timeZone}
          onClose={() => setReviewing(null)}
          onReviewed={(screening) => {
            setReviewed((previous) => new Map(previous).set(screening.id, screening));
            setReviewing(null);
            toast.show(t('qualification.screening.reviewed'), 'success');
          }}
        />
      )}
    </Card>
  );
}
