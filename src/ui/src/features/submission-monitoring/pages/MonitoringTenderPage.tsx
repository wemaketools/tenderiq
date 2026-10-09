/**
 * BUY-19 — Submission monitoring and closing of one tender: permitted receipt metadata (`v_bid_receipt_metadata`:
 * receipt numbers, suppliers, times, statuses and document counts — never content, never drafts), the effective
 * submission count as unique suppliers, deadlines by lot, the closing status, late attempts with their true times
 * and service incidents. Closing is confirmed under the approved rules (COM-02); the buyer never sees sealed content.
 * Receipt and attempt times render to the second with the official offset, so a late attempt never reads as the
 * deadline minute (BR-20, AC-13).
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { closeTender, getMonitoring, listMonitoringReceipts } from '@contracts/bids';
import type {
  ClosingRecord,
  LateAttemptRow,
  MonitoringIncident,
  ReceiptMetadataRow,
} from '@contracts/bids';
import { SUBMISSION_RECEIPTS_STATUS } from '@contracts/enums';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import { BarList } from '../../../components/charts';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  PageHeader,
  Select,
  SkeletonBlock,
  StatusChip,
  Timeline,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { formatReceiptTime } from '../../responses/lib/time';
import { CLOSING_TONE } from '../lib/closing';
import { withMonitoringMessage } from '../lib/errors';
import { monitoringPaths } from '../lib/paths';

function useTenderId(): number | null {
  const raw = useParams().tenderId;
  return raw !== undefined && /^[1-9]\d*$/.test(raw) ? Number(raw) : null;
}

const RECEIPT_SORTS = ['receivedAt', 'supplierLegalName', 'receiptNo'] as const;

export default function MonitoringTenderPage() {
  const tenderId = useTenderId();
  const tenant = useActiveTenant();
  const canClosePermission = usePermission('tender.close');
  const query = useApiQuery(getMonitoring, tenderId === null ? null : { params: { tenderId } });
  const [effectiveOnly, setEffectiveOnly] = useState(true);
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'receivedAt',
    dir: 'asc',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const receipts = useApiQuery(
    listMonitoringReceipts,
    tenderId === null
      ? null
      : {
          params: { tenderId },
          query: {
            effectiveOnly,
            ...(status === ''
              ? {}
              : { status: [status as (typeof SUBMISSION_RECEIPTS_STATUS)[number]] }),
            sort: (RECEIPT_SORTS as readonly string[]).includes(sort.key)
              ? (sort.key as (typeof RECEIPT_SORTS)[number])
              : 'receivedAt',
            dir: sort.dir,
            page,
            pageSize,
          },
        },
  );
  const close = useApiMutation(closeTender);
  const [confirming, setConfirming] = useState(false);
  const [closed, setClosed] = useState<ClosingRecord | null>(null);
  const back = { to: monitoringPaths.list, label: t('submission-monitoring.detail.back') };

  if (tenderId === null || query.error?.kind === 'not_found') {
    return (
      <div className="tiq-page">
        <PageHeader title={t('submission-monitoring.detail.title')} back={back} />
        <EmptyState
          title={t('submission-monitoring.detail.notFound')}
          description={t('submission-monitoring.detail.notFoundHint')}
        />
      </div>
    );
  }
  const detail = query.data;
  if (detail === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('submission-monitoring.detail.title')} back={back} />
        {query.error !== null ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : (
          <SkeletonBlock lines={8} />
        )}
      </div>
    );
  }

  const timeZone = detail.officialTimeZone;
  const closingStatus = closed?.closingStatus ?? detail.closingStatus;
  const canClose = detail.canClose && canClosePermission && closed === null && tenant !== null;
  const nextKey =
    closingStatus === 'closed'
      ? 'closed'
      : closingStatus === 'deadline_passed'
        ? canClosePermission
          ? 'close'
          : 'closeByOfficer'
        : 'monitor';

  const confirm = async ({ reason }: { readonly reason: string }): Promise<void> => {
    if (tenant === null) return;
    try {
      const record = await close.mutate({
        params: { tenderId },
        body: {
          confirmation: { tenantId: tenant.tenantId, capacity: tenant.capacity ?? tenant.name },
          ...(reason === '' ? {} : { note: reason }),
        },
      });
      setClosed(record);
      setConfirming(false);
      query.reload();
    } catch {
      // Shown in the dialog.
    }
  };

  const receiptColumns: DataTableColumn<ReceiptMetadataRow>[] = [
    {
      id: 'receiptNo',
      header: t('submission-monitoring.receipts.col.receipt'),
      sortable: true,
      cell: (row) => (
        <>
          <span className="tiq-mono">{row.receiptNo}</span>
          {row.isEffective && (
            <Chip tone="success" size="sm">
              {t('submission-monitoring.receipts.effective')}
            </Chip>
          )}
        </>
      ),
    },
    {
      id: 'supplierLegalName',
      header: t('submission-monitoring.receipts.col.supplier'),
      sortable: true,
      cell: (row) => row.supplierLegalName,
    },
    {
      id: 'receivedAt',
      header: t('submission-monitoring.receipts.col.received'),
      sortable: true,
      cell: (row) => formatReceiptTime(row.receivedAt, timeZone),
    },
    {
      id: 'round',
      header: t('submission-monitoring.receipts.col.round'),
      cell: (row) => tEnum('bids.round_type', row.roundType),
    },
    {
      id: 'status',
      header: t('submission-monitoring.receipts.col.status'),
      cell: (row) => <StatusChip enum="submission_receipts.status" value={row.status} size="sm" />,
    },
    {
      id: 'documents',
      header: t('submission-monitoring.receipts.col.documents'),
      numeric: true,
      cell: (row) => formatCount(row.documentCount),
    },
  ];

  const lateColumns: DataTableColumn<LateAttemptRow>[] = [
    {
      id: 'supplier',
      header: t('submission-monitoring.late.col.supplier'),
      cell: (row) => row.supplierLegalName,
    },
    {
      id: 'completed',
      header: t('submission-monitoring.late.col.completed'),
      cell: (row) => (
        <>
          <span>{formatReceiptTime(row.completedAt, timeZone)}</span>
          <span className="tiq-cell-sub tiq-text-danger">
            {t('submission-monitoring.late.lateBy', { seconds: row.lateBySeconds })}
          </span>
        </>
      ),
    },
    {
      id: 'deadline',
      header: t('submission-monitoring.late.col.deadline'),
      cell: (row) => <OfficialDeadline deadline={row.deadlineAtAttempt} showLocal={false} />,
    },
    {
      id: 'decision',
      header: t('submission-monitoring.late.col.decision'),
      cell: (row) =>
        row.exceptionDecision === null ? (
          t('submission-monitoring.late.rejectedByDefault')
        ) : (
          <StatusChip
            enum="late_submission_exceptions.decision"
            value={row.exceptionDecision}
            size="sm"
          />
        ),
    },
  ];

  const lotColumns: DataTableColumn<(typeof detail.lots)[number]>[] = [
    {
      id: 'lot',
      header: t('submission-monitoring.lots.col.lot'),
      cell: (row) => t('submission-monitoring.lots.lot', { no: row.lotNo, title: row.title }),
    },
    {
      id: 'stage',
      header: t('submission-monitoring.lots.col.stage'),
      cell: (row) => <StatusChip enum="lots.stage" value={row.stage} size="sm" />,
    },
    {
      id: 'deadline',
      header: t('submission-monitoring.lots.col.deadline'),
      cell: (row) => <OfficialDeadline deadline={row.deadline} showLocal={false} />,
    },
    {
      id: 'suppliers',
      header: t('submission-monitoring.lots.col.suppliers'),
      numeric: true,
      cell: (row) => formatCount(row.effectiveSupplierCount),
    },
  ];

  const incidentItems = detail.incidents.map((incident: MonitoringIncident) => ({
    id: incident.incidentId,
    icon: 'alertTriangle' as const,
    tone: incident.status === 'resolved' ? ('success' as const) : ('warning' as const),
    title: `${incident.title} · ${tEnum('service_incidents.status', incident.status)}`,
    meta: t('submission-monitoring.incidents.window', {
      severity: t(`submission-monitoring.incidents.severity.${incident.severity}`),
      start: formatDateTime(incident.startedAt, timeZone),
      end:
        incident.resolvedAt === null
          ? t('submission-monitoring.incidents.ongoing')
          : formatDateTime(incident.resolvedAt, timeZone),
    }),
    detail: [incident.impactNote, incident.buyerDecisionNote]
      .filter((line) => line !== null)
      .join(' · '),
  }));

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('submission-monitoring.detail.titleWith', { reference: detail.reference })}
        back={back}
        subtitle={detail.title}
        meta={
          <>
            <StatusChip enum="tenders.status" value={closed?.status ?? detail.status} />
            <Chip tone={CLOSING_TONE[closingStatus]}>
              {t(`submission-monitoring.closing.${closingStatus}`)}
            </Chip>
            <OfficialDeadline deadline={detail.deadline} showRemaining={closingStatus === 'open'} />
            <span>
              {t('submission-monitoring.detail.next', {
                action: t(`submission-monitoring.detail.nextAction.${nextKey}`),
              })}
            </span>
          </>
        }
        primaryAction={
          canClose ? (
            <Button variant="primary" icon="lock" onClick={() => setConfirming(true)}>
              {t('submission-monitoring.close.action')}
            </Button>
          ) : undefined
        }
      />
      <Banner tone="info" title={t('submission-monitoring.detail.sealedTitle')}>
        <p>{t('submission-monitoring.detail.sealedDetail')}</p>
      </Banner>
      {closed !== null && (
        <div role="status" aria-live="polite">
          <Banner
            tone="success"
            title={t('submission-monitoring.close.done', { reference: closed.reference })}
          >
            <p>
              {t('submission-monitoring.close.doneDetail', {
                time: formatReceiptTime(closed.closedAt, timeZone),
                name: closed.closedBy.fullName,
                suppliers: closed.effectiveSupplierCount,
                late: closed.lateAttemptCount,
              })}
            </p>
          </Banner>
        </div>
      )}
      {closed === null && closingStatus !== 'closed' && !detail.canClose && (
        <Banner tone="warning" title={t('submission-monitoring.close.blockedTitle')}>
          <ul>
            {detail.closeBlockers.map((blocker) => (
              <li key={blocker}>{t(`submission-monitoring.close.blocker.${blocker}`)}</li>
            ))}
          </ul>
        </Banner>
      )}
      {detail.closedAt !== null && closed === null && (
        <Banner tone="info" title={t('submission-monitoring.close.closedTitle')}>
          <p>
            {t('submission-monitoring.close.closedDetail', {
              time: formatDateTime(detail.closedAt, timeZone),
              name: detail.closedBy?.fullName ?? t('submission-monitoring.close.system'),
            })}
          </p>
        </Banner>
      )}
      <KpiGrid>
        <KpiCard
          label={t('submission-monitoring.kpi.suppliers')}
          icon="users"
          tone="accent"
          value={formatCount(detail.counts.effectiveSuppliers)}
          hint={t('submission-monitoring.kpi.suppliersHint')}
        />
        <KpiCard
          label={t('submission-monitoring.kpi.received')}
          icon="receipt"
          tone="success"
          value={formatCount(detail.counts.received)}
          hint={t('submission-monitoring.kpi.receivedHint', {
            superseded: detail.counts.superseded,
            withdrawn: detail.counts.withdrawn,
          })}
        />
        <KpiCard
          label={t('submission-monitoring.kpi.late')}
          icon="clock"
          tone="danger"
          value={formatCount(detail.counts.lateRejected)}
          hint={t('submission-monitoring.kpi.lateHint')}
        />
        <KpiCard
          label={t('submission-monitoring.kpi.incidents')}
          icon="alertTriangle"
          tone="warning"
          value={formatCount(detail.incidents.length)}
          hint={t('submission-monitoring.kpi.incidentsHint')}
        />
      </KpiGrid>
      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          <Card
            title={t('submission-monitoring.receipts.title')}
            subtitle={t('submission-monitoring.receipts.subtitle')}
            flush
          >
            <div className="tiq-inline tiq-table-toolbar">
              <Checkbox
                label={t('submission-monitoring.receipts.effectiveOnly')}
                checked={effectiveOnly}
                onChange={(checked) => {
                  setEffectiveOnly(checked);
                  setPage(1);
                }}
              />
              <Select
                label={t('submission-monitoring.receipts.status')}
                placeholder={t('submission-monitoring.common.all')}
                value={status}
                options={SUBMISSION_RECEIPTS_STATUS.map((value) => ({
                  value,
                  label: tEnum('submission_receipts.status', value),
                }))}
                onChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              />
            </div>
            <DataTable
              caption={t('submission-monitoring.receipts.title')}
              columns={receiptColumns}
              rows={receipts.data?.items}
              rowKey={(row) => String(row.receiptId)}
              loading={receipts.isFetching}
              error={receipts.error}
              onRetry={receipts.reload}
              sort={sort}
              onSortChange={(next) => {
                setSort(next);
                setPage(1);
              }}
              empty={<EmptyState compact title={t('submission-monitoring.receipts.empty')} />}
              pagination={
                receipts.data === undefined
                  ? undefined
                  : {
                      page: receipts.data.page,
                      pageSize: receipts.data.pageSize,
                      total: receipts.data.total,
                      onPageChange: setPage,
                      onPageSizeChange: (size) => {
                        setPageSize(size);
                        setPage(1);
                      },
                    }
              }
            />
          </Card>
          <Card title={t('submission-monitoring.lots.title')} flush>
            <DataTable
              caption={t('submission-monitoring.lots.title')}
              columns={lotColumns}
              rows={detail.lots}
              rowKey={(row) => String(row.lotId)}
              empty={<EmptyState compact title={t('submission-monitoring.lots.empty')} />}
            />
          </Card>
          <Card
            title={t('submission-monitoring.late.title')}
            subtitle={t('submission-monitoring.late.subtitle')}
            flush
          >
            <DataTable
              caption={t('submission-monitoring.late.title')}
              columns={lateColumns}
              rows={detail.lateAttempts}
              rowKey={(row) => String(row.attemptId)}
              empty={<EmptyState compact title={t('submission-monitoring.late.empty')} />}
            />
          </Card>
        </div>
        <div className="tiq-stack">
          <Card
            title={t('submission-monitoring.byDay.title')}
            subtitle={t('submission-monitoring.byDay.subtitle')}
          >
            <BarList
              label={t('submission-monitoring.byDay.title')}
              showShare={false}
              items={detail.receiptsByDay.map((row) => ({
                id: row.date,
                label: formatCalendarDate(row.date),
                value: row.count,
              }))}
            />
          </Card>
          <Card title={t('submission-monitoring.incidents.title')}>
            {incidentItems.length === 0 ? (
              <EmptyState
                compact
                icon="checkCircle"
                title={t('submission-monitoring.incidents.empty')}
              />
            ) : (
              <Timeline label={t('submission-monitoring.incidents.title')} items={incidentItems} />
            )}
          </Card>
          <Card title={t('submission-monitoring.detail.summaryTitle')}>
            <DetailList
              stacked
              items={[
                {
                  label: t('submission-monitoring.detail.type'),
                  value: `${tEnum('tenders.event_type', detail.eventType)} · ${tEnum('tenders.participation', detail.participation)}`,
                },
                { label: t('submission-monitoring.detail.owner'), value: detail.owner.fullName },
                {
                  label: t('submission-monitoring.detail.lastReceipt'),
                  value:
                    detail.lastReceiptAt === null
                      ? null
                      : formatReceiptTime(detail.lastReceiptAt, timeZone),
                },
                {
                  label: t('submission-monitoring.detail.selected'),
                  value: formatCount(detail.counts.selectedForEvaluation),
                },
              ]}
            />
          </Card>
        </div>
      </div>
      <ConfirmActionDialog
        open={confirming}
        title={t('submission-monitoring.close.title')}
        scope={t('submission-monitoring.close.scope', {
          reference: detail.reference,
          title: detail.title,
          suppliers: detail.counts.effectiveSuppliers,
        })}
        consequence={t('submission-monitoring.close.consequence')}
        confirmLabel={t('submission-monitoring.close.confirm')}
        reason={{ label: t('submission-monitoring.close.note'), required: false }}
        acknowledgement={t('submission-monitoring.close.acknowledge')}
        pending={close.pending}
        error={withMonitoringMessage(close.error)}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      >
        <OfficialDeadline
          deadline={detail.deadline}
          variant="block"
          label={t('submission-monitoring.close.deadlineLabel')}
        />
      </ConfirmActionDialog>
    </div>
  );
}
