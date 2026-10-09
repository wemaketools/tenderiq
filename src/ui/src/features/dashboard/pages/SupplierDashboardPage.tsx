/**
 * SUP-01 — Supplier dashboard (FR-21, PRD §11.3). Invitations, active pursuits with their official submission status,
 * deadlines, qualifications, expiring evidence, outcomes and contract tasks of the ACTIVE supplier organization only.
 * Only an official receipt establishes submission (BR-18); an unsuccessful notice shows the supplier's own outcome
 * only. A panel or KPI the caller's capacity may not read is left out entirely, never shown as an empty count or a
 * placeholder (BR-43, DD-49).
 */
import { Link } from 'react-router';

import {
  SUPPLIER_DASHBOARD_KPIS,
  SUPPLIER_EVIDENCE_WINDOW_DAYS,
  reportingEndpoints,
} from '@contracts/reporting';
import type {
  SupplierContractTaskItem,
  SupplierDashboard,
  SupplierDashboardKpiKey,
  SupplierPursuitItem,
} from '@contracts/reporting';

import { useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Card,
  Chip,
  DataTable,
  EmptyState,
  ErrorState,
  FooterBar,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Reference,
  SkeletonBlock,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn, IconName } from '../../../components/ui';
import { formatCalendarDate, formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { DeadlineList } from '../components/DeadlineList';
import { PanelGrid } from '../components/PanelGrid';
import { kpiDelta } from '../lib/kpi';

const KPI_ICON: Readonly<Record<SupplierDashboardKpiKey, IconName>> = {
  open_invitations: 'mail',
  active_pursuits: 'target',
  submitted_responses: 'checkCircle',
  deadlines_within_7_days: 'clock',
  expiring_evidence: 'hourglass',
  open_contract_tasks: 'listChecks',
};

const KPI_TONE: Readonly<Record<SupplierDashboardKpiKey, 'accent' | 'warning' | 'success'>> = {
  open_invitations: 'accent',
  active_pursuits: 'accent',
  submitted_responses: 'success',
  deadlines_within_7_days: 'warning',
  expiring_evidence: 'warning',
  open_contract_tasks: 'accent',
};

export default function SupplierDashboardPage() {
  const tenant = useActiveTenant();
  const query = useApiQuery(reportingEndpoints.getSupplierDashboard, {});
  const data = query.data;
  return (
    <div className="tiq-page">
      <PageHeader
        title={t('dashboard.supplier.title')}
        subtitle={t('dashboard.supplier.intro', { organization: tenant?.name ?? '' })}
      />
      {query.error !== null && (
        <ErrorState error={query.error} onRetry={query.reload} title={t('dashboard.loadError')} />
      )}
      {data === undefined ? (
        query.error === null && <SkeletonBlock lines={8} />
      ) : (
        <SupplierBody data={data} />
      )}
      <FooterBar
        currency={null}
        asOf={data?.asOf ?? null}
        timeZone={data?.timeZone ?? tenant?.officialTimeZone ?? 'UTC'}
        refreshing={query.isFetching}
        onRefresh={query.reload}
      />
    </div>
  );
}

function SupplierBody({ data }: { readonly data: SupplierDashboard }) {
  const kpis = SUPPLIER_DASHBOARD_KPIS.map((key) => data.kpis.find((kpi) => kpi.key === key))
    .filter((kpi) => kpi !== undefined)
    .filter((kpi) => !kpi.restricted);
  return (
    <>
      <KpiGrid>
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            label={t(`dashboard.supplierKpi.${kpi.key}`)}
            value={kpi.value === null ? null : formatCount(kpi.value)}
            icon={KPI_ICON[kpi.key]}
            tone={KPI_TONE[kpi.key]}
            delta={kpiDelta(kpi.delta)}
            hint={kpi.hint ?? undefined}
            to={kpi.to ?? undefined}
          />
        ))}
      </KpiGrid>

      <PanelGrid variant="sidebar">
        {!data.pursuits.restricted && <PursuitsCard pursuits={data.pursuits.items} />}
        {!data.deadlines.restricted && (
          <Card
            title={t('dashboard.supplier.deadlines')}
            subtitle={t('dashboard.supplier.deadlinesHint')}
          >
            <DeadlineList
              label={t('dashboard.supplier.deadlines')}
              items={data.deadlines.items.map((item) => ({
                id: `${item.tenderId}-${item.milestone}`,
                reference: item.reference,
                title: item.title,
                milestone: tEnum('tender_milestones.milestone', item.milestone),
                lotLabel: null,
                deadline: item.deadline,
                detail: item.buyerName,
                to: item.to,
              }))}
            />
          </Card>
        )}
      </PanelGrid>

      <PanelGrid>
        {!data.invitations.restricted && (
          <Card
            title={t('dashboard.supplier.invitations')}
            subtitle={t('dashboard.supplier.invitationsHint')}
          >
            {data.invitations.items.length === 0 ? (
              <EmptyState compact icon="mail" title={t('dashboard.supplier.noInvitations')} />
            ) : (
              <ul className="tiq-stack" aria-label={t('dashboard.supplier.invitations')}>
                {data.invitations.items.map((item) => (
                  <li
                    key={item.tenderId}
                    className="tiq-stack"
                    style={{ gap: 'var(--tiq-space-1)' }}
                  >
                    <span className="tiq-inline">
                      <Reference value={item.reference} to={item.to} />
                      <StatusChip
                        enum="participants.invitation_status"
                        value={item.invitationStatus}
                        size="sm"
                      />
                    </span>
                    <span>{item.title}</span>
                    <span className="tiq-cell-sub">{item.buyer.name}</span>
                    {item.closingAt !== null && (
                      <OfficialDeadline
                        deadline={item.closingAt}
                        label={t('dashboard.supplier.closes')}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {!data.qualifications.restricted && (
          <Card
            title={t('dashboard.supplier.qualifications')}
            subtitle={t('dashboard.supplier.qualificationsHint')}
          >
            {data.qualifications.items.length === 0 ? (
              <EmptyState
                compact
                icon="shieldCheck"
                title={t('dashboard.supplier.noQualifications')}
              />
            ) : (
              <ul className="tiq-stack" aria-label={t('dashboard.supplier.qualifications')}>
                {data.qualifications.items.map((item) => (
                  <li
                    key={`${item.buyerName}-${item.programName}`}
                    className="tiq-stack"
                    style={{ gap: 'var(--tiq-space-1)' }}
                  >
                    <span className="tiq-inline">
                      <Link to={item.to}>{item.programName}</Link>
                      <StatusChip
                        enum="v_qualification_status.effective_status"
                        value={item.status}
                        size="sm"
                      />
                    </span>
                    <span className="tiq-cell-sub">
                      {item.scopeLabel === null
                        ? item.buyerName
                        : t('dashboard.supplier.scopeOf', {
                            buyer: item.buyerName,
                            scope: item.scopeLabel,
                          })}
                    </span>
                    <span className="tiq-cell-sub">
                      {item.effectiveTo === null
                        ? t('dashboard.supplier.noExpiry')
                        : t('dashboard.supplier.validTo', {
                            date: formatCalendarDate(item.effectiveTo),
                          })}
                    </span>
                    {item.conditions !== null && (
                      <span className="tiq-text-warning">
                        {t('dashboard.supplier.conditions', { conditions: item.conditions })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {!data.expiringEvidence.restricted && (
          <Card
            title={t('dashboard.supplier.evidence')}
            subtitle={t('dashboard.supplier.evidenceHint', { days: SUPPLIER_EVIDENCE_WINDOW_DAYS })}
          >
            {data.expiringEvidence.items.length === 0 ? (
              <EmptyState compact icon="hourglass" title={t('dashboard.supplier.noEvidence')} />
            ) : (
              <ul className="tiq-stack" aria-label={t('dashboard.supplier.evidence')}>
                {data.expiringEvidence.items.map((item) => (
                  <li
                    key={item.evidenceId}
                    className="tiq-stack"
                    style={{ gap: 'var(--tiq-space-1)' }}
                  >
                    <span className="tiq-inline">
                      <Link to={item.to}>{item.title}</Link>
                      <Chip tone={item.daysRemaining <= 14 ? 'danger' : 'warning'} size="sm">
                        {item.daysRemaining < 0
                          ? t('dashboard.supplier.expired')
                          : t('dashboard.supplier.daysLeft', { count: item.daysRemaining })}
                      </Chip>
                    </span>
                    <span className="tiq-cell-sub">
                      {tEnum('evidence_items.evidence_type', item.evidenceType)} ·{' '}
                      {t('dashboard.supplier.expires', {
                        date: formatCalendarDate(item.expiresAt),
                      })}
                    </span>
                    <span className="tiq-cell-sub">
                      {item.sharedWith.length === 0
                        ? t('dashboard.supplier.notShared')
                        : t('dashboard.supplier.sharedWith', {
                            buyers: item.sharedWith.join(', '),
                          })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </PanelGrid>

      <PanelGrid>
        {!data.outcomes.restricted && (
          <Card
            title={t('dashboard.supplier.outcomes')}
            subtitle={t('dashboard.supplier.outcomesHint')}
          >
            {data.outcomes.items.length === 0 ? (
              <EmptyState compact icon="award" title={t('dashboard.supplier.noOutcomes')} />
            ) : (
              <ul className="tiq-stack" aria-label={t('dashboard.supplier.outcomes')}>
                {data.outcomes.items.map((item) => (
                  <li
                    key={`${item.tenderId}-${item.lotLabel ?? 'event'}`}
                    className="tiq-stack"
                    style={{ gap: 'var(--tiq-space-1)' }}
                  >
                    <span className="tiq-inline">
                      <Reference value={item.reference} to={item.to} />
                      <Chip tone={item.successful ? 'success' : 'neutral'} size="sm">
                        {item.successful
                          ? t('dashboard.supplier.successful')
                          : t('dashboard.supplier.unsuccessful')}
                      </Chip>
                      {item.outcome !== null && (
                        <StatusChip enum="lot_outcomes.outcome" value={item.outcome} size="sm" />
                      )}
                      {item.outcomeStatus !== null && (
                        <StatusChip
                          enum="lot_outcomes.status"
                          value={item.outcomeStatus}
                          size="sm"
                        />
                      )}
                    </span>
                    <span>
                      {item.lotLabel === null
                        ? item.title
                        : t('dashboard.supplier.titleLot', {
                            title: item.title,
                            lot: item.lotLabel,
                          })}
                    </span>
                    <span className="tiq-cell-sub">
                      {t('dashboard.supplier.noticeIssued', {
                        buyer: item.buyerName,
                        date: formatInstantDate(item.noticeIssuedAt, data.timeZone),
                      })}
                    </span>
                    {item.standstillEndsAt !== null && (
                      <OfficialDeadline
                        deadline={item.standstillEndsAt}
                        label={t('dashboard.supplier.standstill')}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        {!data.contractTasks.restricted && <ContractTasksCard tasks={data.contractTasks.items} />}
      </PanelGrid>
    </>
  );
}

function PursuitsCard({ pursuits }: { readonly pursuits: readonly SupplierPursuitItem[] }) {
  const columns: DataTableColumn<SupplierPursuitItem>[] = [
    {
      id: 'tender',
      header: t('dashboard.supplier.col.tender'),
      cell: (row) => (
        <>
          <Reference value={row.reference} to={row.to} />
          <span className="tiq-cell-sub">{row.title}</span>
        </>
      ),
    },
    { id: 'buyer', header: t('dashboard.supplier.col.buyer'), cell: (row) => row.buyer.name },
    {
      id: 'decision',
      header: t('dashboard.supplier.col.decision'),
      cell: (row) => <StatusChip enum="pursuits.decision" value={row.decision} size="sm" />,
    },
    {
      id: 'submission',
      header: t('dashboard.supplier.col.submission'),
      cell: (row) => (
        <>
          <StatusChip enum="bids.submission_state" value={row.submissionState} size="sm" />
          <span className="tiq-cell-sub">
            {row.effectiveReceiptNo !== null
              ? t('dashboard.supplier.receipt', { receipt: row.effectiveReceiptNo })
              : row.latestRevisionStatus !== null
                ? t('dashboard.supplier.revision', {
                    status: tEnum('bid_revisions.status', row.latestRevisionStatus),
                  })
                : t('dashboard.supplier.noReceipt')}
          </span>
        </>
      ),
    },
    {
      id: 'closing',
      header: t('dashboard.supplier.col.closing'),
      cell: (row) =>
        row.closingAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={row.closingAt} showLocal={false} />
        ),
    },
  ];
  return (
    <Card
      flush
      title={t('dashboard.supplier.pursuits')}
      subtitle={t('dashboard.supplier.pursuitsHint')}
    >
      <DataTable
        caption={t('dashboard.supplier.pursuits')}
        columns={columns}
        rows={pursuits}
        rowKey={(row) => String(row.tenderId)}
        empty={<EmptyState compact icon="target" title={t('dashboard.supplier.noPursuits')} />}
      />
    </Card>
  );
}

function ContractTasksCard({ tasks }: { readonly tasks: readonly SupplierContractTaskItem[] }) {
  const columns: DataTableColumn<SupplierContractTaskItem>[] = [
    {
      id: 'contract',
      header: t('dashboard.supplier.col.contract'),
      cell: (row) => (
        <>
          <Reference value={row.contractReference} to={row.to} />
          <span className="tiq-cell-sub">{row.contractTitle}</span>
        </>
      ),
    },
    {
      id: 'obligation',
      header: t('dashboard.supplier.col.obligation'),
      cell: (row) => (
        <>
          <span>{row.obligationTitle}</span>
          <span className="tiq-cell-sub">{tEnum('obligations.kind', row.kind)}</span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('dashboard.supplier.col.status'),
      cell: (row) => <StatusChip enum="obligations.status" value={row.status} size="sm" />,
    },
    {
      id: 'due',
      header: t('dashboard.supplier.col.due'),
      cell: (row) => formatCalendarDate(row.dueOn),
    },
  ];
  return (
    <Card
      flush
      title={t('dashboard.supplier.contractTasks')}
      subtitle={t('dashboard.supplier.contractTasksHint')}
    >
      <DataTable
        caption={t('dashboard.supplier.contractTasks')}
        columns={columns}
        rows={tasks}
        rowKey={(row) => `${row.contractId}-${row.obligationTitle}-${row.dueOn}`}
        empty={
          <EmptyState compact icon="listChecks" title={t('dashboard.supplier.noContractTasks')} />
        }
      />
    </Card>
  );
}
