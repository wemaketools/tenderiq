/**
 * ADM-14 — Audit, retention and legal holds: overview (FR-22, PRD §13.2, §18; BR-38–BR-40; AC-35). The volume of
 * business actions and access events, the retention schedules and records past retention, active holds with the
 * records they protect, disposal requests blocked by a hold, and evidence packs. A block the membership may not
 * read is restricted, without counts (BR-43).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { recordsEndpoints } from '@contracts/records';
import type { DisposalRequestRow, Hold } from '@contracts/records';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  CardLink,
  DataTable,
  EmptyState,
  ErrorState,
  FooterBar,
  KpiCard,
  KpiGrid,
  SkeletonBlock,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatCount } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import { CreateHoldDialog } from '../components/CreateHoldDialog';
import { EvidencePackDialog } from '../components/EvidencePackDialog';
import { RecordsHeader } from '../components/RecordsHeader';
import { tomorrowOf } from '../lib/dates';
import { RECORDS_READ, recordsPaths } from '../lib/permissions';

export default function RecordsOverviewPage() {
  const navigate = useNavigate();
  const tenant = useActiveTenant();
  const now = useNow();
  const canRecords = usePermission(RECORDS_READ);
  const canHold = usePermission('records.hold.manage');
  const canPack = usePermission('export.create');
  const [holding, setHolding] = useState(false);
  const [packing, setPacking] = useState(false);
  const summary = useApiQuery(recordsEndpoints.getRecordsSummary, {});
  const holds = useApiQuery(
    recordsEndpoints.listHolds,
    canRecords
      ? { query: { state: ['active'], sort: 'reviewDate', dir: 'asc', pageSize: 10 } }
      : null,
  );
  const blocked = useApiQuery(
    recordsEndpoints.listDisposalRequests,
    canRecords
      ? { query: { status: ['blocked'], sort: 'proposedAt', dir: 'desc', pageSize: 10 } }
      : null,
  );
  const data = summary.data;

  const holdColumns: DataTableColumn<Hold>[] = [
    {
      id: 'subject',
      header: t('records.holds.col.record'),
      cell: (row) => (
        <>
          {row.subjectReference !== null && <span className="tiq-ref">{row.subjectReference}</span>}{' '}
          <span>{row.subjectLabel}</span>
          <span className="tiq-cell-sub">{tEnum('holds.hold_type', row.holdType)}</span>
        </>
      ),
    },
    {
      id: 'records',
      header: t('records.holds.col.records'),
      numeric: true,
      cell: (row) => formatCount(row.affectedRecordCount),
    },
    {
      id: 'blocked',
      header: t('records.holds.col.blocked'),
      numeric: true,
      cell: (row) => formatCount(row.blockedDisposalCount),
    },
    {
      id: 'review',
      header: t('records.holds.col.review'),
      cell: (row) => (
        <span className={row.reviewDue ? 'tiq-text-warning' : undefined}>
          {formatCalendarDate(row.reviewDate)}
          {row.reviewDue && ` · ${t('records.holds.reviewDue')}`}
        </span>
      ),
    },
  ];
  const disposalColumns: DataTableColumn<DisposalRequestRow>[] = [
    {
      id: 'scope',
      header: t('records.disposals.col.scope'),
      cell: (row) => (
        <>
          <span>{row.scopeLabel}</span>
          <span className="tiq-cell-sub">
            {tEnum('retention_classes.record_class', row.recordClass)}
          </span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('records.disposals.col.status'),
      cell: (row) => <StatusChip enum="disposal_requests.status" value={row.status} size="sm" />,
    },
    {
      id: 'holds',
      header: t('records.disposals.col.holds'),
      cell: (row) =>
        row.blockedByHoldIds.map((id) => t('records.disposals.holdRef', { id })).join(', '),
    },
  ];

  return (
    <div className="tiq-page">
      <RecordsHeader
        subtitle={t('records.intro')}
        primaryAction={
          canHold ? (
            <Button variant="primary" icon="lock" onClick={() => setHolding(true)}>
              {t('records.hold.create')}
            </Button>
          ) : undefined
        }
        actions={
          canPack ? (
            <Button icon="package" onClick={() => setPacking(true)}>
              {t('records.packs.create')}
            </Button>
          ) : undefined
        }
      />
      {summary.error !== null && (
        <ErrorState error={summary.error} onRetry={summary.reload} title={t('records.loadError')} />
      )}
      {data === undefined ? (
        summary.error === null && <SkeletonBlock lines={4} />
      ) : (
        <KpiGrid>
          <KpiCard
            label={t('records.kpi.events')}
            icon="history"
            restricted={data.audit === null}
            value={data.audit === null ? null : formatCount(data.audit.eventsLast30Days)}
            hint={
              data.audit === null
                ? undefined
                : t('records.kpi.eventsHint', {
                    restricted: data.audit.restrictedEventsLast30Days,
                    access: data.audit.accessEventsLast30Days,
                  })
            }
            to={data.audit === null ? undefined : recordsPaths.audit}
          />
          <KpiCard
            label={t('records.kpi.pastRetention')}
            icon="hourglass"
            tone="info"
            restricted={data.retention === null}
            value={
              data.retention === null ? null : formatCount(data.retention.recordsPastRetention)
            }
            hint={
              data.retention === null
                ? undefined
                : t('records.kpi.classes', { count: data.retention.classes })
            }
            to={data.retention === null ? undefined : recordsPaths.retention}
          />
          <KpiCard
            label={t('records.kpi.holds')}
            icon="lock"
            tone="warning"
            restricted={data.holds === null}
            value={data.holds === null ? null : formatCount(data.holds.active)}
            hint={
              data.holds === null
                ? undefined
                : t('records.kpi.holdsHint', {
                    records: data.holds.heldRecords,
                    due: data.holds.reviewDueWithin30Days,
                  })
            }
            to={data.holds === null ? undefined : recordsPaths.holds}
          />
          <KpiCard
            label={t('records.kpi.blocked')}
            icon="ban"
            tone="danger"
            restricted={data.disposals === null}
            value={data.disposals === null ? null : formatCount(data.disposals.blocked)}
            hint={
              data.disposals === null
                ? undefined
                : t('records.kpi.disposalsHint', {
                    proposed: data.disposals.proposed,
                    approved: data.disposals.approved,
                    executed: data.disposals.executed,
                  })
            }
            to={data.disposals === null ? undefined : recordsPaths.disposals}
          />
          <KpiCard
            label={t('records.kpi.packs')}
            icon="package"
            tone="success"
            restricted={data.evidencePacks === null}
            value={data.evidencePacks === null ? null : formatCount(data.evidencePacks.ready)}
            hint={
              data.evidencePacks === null
                ? undefined
                : t('records.kpi.packsHint', { count: data.evidencePacks.inProgress })
            }
            to={data.evidencePacks === null ? undefined : recordsPaths.evidencePacks}
          />
        </KpiGrid>
      )}

      {canRecords && (
        <>
          {data?.disposals !== null && data !== undefined && data.disposals.blocked > 0 && (
            <Banner tone="warning" title={t('records.blockedBannerTitle')}>
              <p>{t('records.blockedBanner', { count: data.disposals.blocked })}</p>
            </Banner>
          )}
          <div className="tiq-grid tiq-grid--2">
            <Card
              flush
              title={t('records.holds.activeTitle')}
              subtitle={t('records.holds.activeSubtitle')}
              actions={<CardLink to={recordsPaths.holds}>{t('records.holds.viewAll')}</CardLink>}
            >
              <DataTable
                caption={t('records.holds.activeTitle')}
                columns={holdColumns}
                rows={holds.data?.items}
                rowKey={(row) => String(row.id)}
                rowLabel={(row) => t('records.holds.openNamed', { subject: row.subjectLabel })}
                onRowClick={(row) => void navigate(recordsPaths.hold(row.id))}
                loading={holds.isFetching}
                error={holds.error}
                onRetry={holds.reload}
                empty={<EmptyState compact icon="unlock" title={t('records.holds.noneActive')} />}
              />
            </Card>
            <Card
              flush
              title={t('records.disposals.blockedTitle')}
              subtitle={t('records.disposals.blockedSubtitle')}
              actions={
                <CardLink to={recordsPaths.disposals}>{t('records.disposals.viewAll')}</CardLink>
              }
            >
              <DataTable
                caption={t('records.disposals.blockedTitle')}
                columns={disposalColumns}
                rows={blocked.data?.items}
                rowKey={(row) => String(row.id)}
                rowLabel={(row) => t('records.disposals.openNamed', { scope: row.scopeLabel })}
                onRowClick={(row) => void navigate(recordsPaths.disposal(row.id))}
                loading={blocked.isFetching}
                error={blocked.error}
                onRetry={blocked.reload}
                empty={
                  <EmptyState
                    compact
                    icon="checkCircle"
                    title={t('records.disposals.noneBlocked')}
                  />
                }
              />
            </Card>
          </div>
        </>
      )}

      <CreateHoldDialog
        open={holding}
        onClose={() => setHolding(false)}
        minReviewDate={tomorrowOf(now)}
        onCreated={() => {
          setHolding(false);
          void navigate(recordsPaths.holds);
        }}
      />
      <EvidencePackDialog
        open={packing}
        onClose={() => setPacking(false)}
        onCreated={() => {
          setPacking(false);
          void navigate(recordsPaths.evidencePacks);
        }}
      />
      <FooterBar
        currency={null}
        asOf={data?.asOf ?? null}
        timeZone={tenant?.officialTimeZone ?? 'UTC'}
        refreshing={summary.isFetching}
        onRefresh={summary.reload}
      />
    </div>
  );
}
