/**
 * SUP-24 — Qualification decisions and renewals (FR-06, BR-25, BR-45; AC-09): the supplier's decisions grouped by
 * the buyer that made them (a decision of one buyer never applies at another), with scope, effective dates,
 * conditions and the blocked gate, expiry and renewal deadlines. Each decision opens for tracking actions, supplying
 * updated evidence, renewing and requesting reconsideration.
 */
import { useNavigate } from 'react-router';

import {
  SUPPLIER_DECISION_SORT_FIELDS,
  qualificationEndpoints as api,
} from '@contracts/qualification';
import type { SupplierDecision } from '@contracts/qualification';
import { V_QUALIFICATION_STATUS_EFFECTIVE_STATUS } from '@contracts/enums';

import { useApiQuery } from '../../../../api/hooks';
import { useScreenFilters } from '../../../../app/hooks';
import {
  Banner,
  ButtonLink,
  Card,
  Checkbox,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  ErrorState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OrDash,
  PageHeader,
  Pagination,
  Reference,
  RestrictedState,
  Select,
  SkeletonBlock,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatCount } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { EffectiveStatusChip, OutcomeChip } from '../../components/shared';
import { compact, dateOf, directionOf, flagOf, idOf, oneOf, sortOf } from '../../lib/lists';
import { supplierQualificationPaths } from '../../lib/paths';
import { dateOrDash, gateText, scopeText, cellStack } from '../../lib/text';

const DEFAULTS = {
  buyerTenantId: '',
  effectiveStatus: '',
  includeSuperseded: false,
  expiringBefore: '',
  sort: 'buyerName',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

export default function SupplierDecisionsPage() {
  const navigate = useNavigate();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-24', DEFAULTS);
  const overview = useApiQuery(api.getSupplierOverview, {});
  const query = useApiQuery(api.listSupplierDecisions, {
    query: compact({
      buyerTenantId: idOf(filters.buyerTenantId),
      effectiveStatus: oneOf(filters.effectiveStatus, V_QUALIFICATION_STATUS_EFFECTIVE_STATUS),
      includeSuperseded: flagOf(filters.includeSuperseded),
      expiringBefore: dateOf(filters.expiringBefore),
      sort: sortOf(filters.sort, SUPPLIER_DECISION_SORT_FIELDS, 'buyerName'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const buyers = new Map<number, string>();
  for (const row of overview.data?.statuses ?? [])
    buyers.set(row.buyer.buyerTenantId, row.buyer.name);
  const items = query.data?.items ?? [];
  const groups = new Map<number, { name: string; rows: SupplierDecision[] }>();
  for (const row of items) {
    const group = groups.get(row.buyer.buyerTenantId) ?? { name: row.buyer.name, rows: [] };
    group.rows.push(row);
    groups.set(row.buyer.buyerTenantId, group);
  }
  const current = items.filter((row) => row.current);
  const filtered =
    filters.buyerTenantId !== '' ||
    filters.effectiveStatus !== '' ||
    filters.includeSuperseded ||
    filters.expiringBefore !== '';

  const columns: DataTableColumn<SupplierDecision>[] = [
    {
      id: 'program',
      header: t('qualification.supplierDecisions.col.program'),
      cell: (row) => (
        <>
          <Reference
            value={t('qualification.decision.decisionNo', { id: row.id })}
            to={supplierQualificationPaths.decision(row.id)}
          />
          <span className="tiq-cell-sub">
            {t('qualification.common.programVersion', {
              name: row.program.programName,
              no: row.program.versionNo,
            })}
          </span>
        </>
      ),
    },
    {
      id: 'outcome',
      header: t('qualification.supplierDecisions.col.outcome'),
      cell: (row) => (
        <span className="tiq-stack" style={cellStack}>
          <OutcomeChip outcome={row.outcome} />
          {row.effectiveStatus !== row.outcome && (
            <EffectiveStatusChip status={row.effectiveStatus} size="sm" />
          )}
          {!row.current && (
            <Chip tone="neutral" size="sm">
              {t('qualification.decision.superseded')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'scope',
      header: t('qualification.supplierDecisions.col.scope'),
      cell: (row) => scopeText(row.scopeCategory, row.scopeMaxValue, row.scopeGeography),
    },
    {
      id: 'dates',
      header: t('qualification.supplierDecisions.col.dates'),
      cell: (row) => (
        <>
          <span>
            {t('qualification.common.dateRange', {
              from: dateOrDash(row.effectiveFrom) ?? '',
              to: dateOrDash(row.effectiveTo) ?? t('qualification.terms.openEnded'),
            })}
          </span>
          {row.renewalDueFrom !== null && (
            <span className="tiq-cell-sub">
              {t('qualification.supplierDecisions.renewFrom', {
                date: dateOrDash(row.renewalDueFrom) ?? '',
              })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'conditions',
      header: t('qualification.supplierDecisions.col.conditions'),
      cell: (row) =>
        row.conditions === null && row.blockedGate === 'none' ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <span>{row.conditions}</span>
            <span className="tiq-cell-sub tiq-text-warning">{gateText(row.blockedGate)}</span>
          </>
        ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('qualification.supplierDecisions.title')}
        subtitle={t('qualification.supplierDecisions.intro')}
        actions={
          <ButtonLink to={supplierQualificationPaths.home} icon="clipboard">
            {t('qualification.supplierDecisions.toApplications')}
          </ButtonLink>
        }
      />
      <Banner tone="info" title={t('qualification.supplierDecisions.buyerSpecificTitle')}>
        {t('qualification.supplierDecisions.buyerSpecific')}
      </Banner>
      <FilterBar
        label={t('qualification.supplierDecisions.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <Select
          label={t('qualification.supplier.col.buyer')}
          placeholder={t('qualification.common.allBuyers')}
          value={filters.buyerTenantId}
          onChange={(buyerTenantId) => setFilters({ buyerTenantId, page: 1 })}
          options={[...buyers.entries()].map(([id, name]) => ({ value: String(id), label: name }))}
        />
        <Select
          label={t('qualification.monitoring.filter.status')}
          placeholder={t('qualification.common.allStatuses')}
          value={filters.effectiveStatus}
          onChange={(effectiveStatus) => setFilters({ effectiveStatus, page: 1 })}
          options={V_QUALIFICATION_STATUS_EFFECTIVE_STATUS.map((value) => ({
            value,
            label: tEnum('v_qualification_status.effective_status', value),
          }))}
        />
        <Select
          label={t('qualification.supplierDecisions.sort')}
          value={`${filters.sort}:${filters.dir}`}
          onChange={(value) => {
            const [sort = 'buyerName', dir = 'asc'] = value.split(':');
            setFilters({ sort, dir, page: 1 });
          }}
          options={SUPPLIER_DECISION_SORT_FIELDS.flatMap((field) => [
            {
              value: `${field}:asc`,
              label: t(`qualification.supplierDecisions.sortBy.${field}_asc`),
            },
            {
              value: `${field}:desc`,
              label: t(`qualification.supplierDecisions.sortBy.${field}_desc`),
            },
          ])}
        />
        <DateInput
          label={t('qualification.monitoring.filter.expiringBefore')}
          value={filters.expiringBefore}
          onChange={(expiringBefore) => setFilters({ expiringBefore, page: 1 })}
        />
        <Checkbox
          label={t('qualification.monitoring.filter.includeSuperseded')}
          checked={filters.includeSuperseded}
          onChange={(includeSuperseded) => setFilters({ includeSuperseded, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('qualification.supplierDecisions.kpi.current')}
          icon="shieldCheck"
          tone="success"
          value={query.data === undefined ? '…' : formatCount(current.length)}
          hint={t('qualification.supplierDecisions.kpi.currentHint')}
        />
        <KpiCard
          label={t('qualification.supplierDecisions.kpi.conditional')}
          icon="alertTriangle"
          tone="warning"
          value={
            query.data === undefined
              ? '…'
              : formatCount(current.filter((row) => row.blockedGate !== 'none').length)
          }
          hint={t('qualification.supplierDecisions.kpi.conditionalHint')}
        />
        <KpiCard
          label={t('qualification.supplierDecisions.kpi.renewal')}
          icon="repeat"
          tone="info"
          value={
            query.data === undefined
              ? '…'
              : formatCount(current.filter((row) => row.renewalDueFrom !== null).length)
          }
          hint={t('qualification.supplierDecisions.kpi.renewalHint')}
        />
        <KpiCard
          label={t('qualification.supplierDecisions.kpi.buyers')}
          icon="building"
          value={query.data === undefined ? '…' : formatCount(groups.size)}
          hint={t('qualification.supplierDecisions.kpi.buyersHint')}
        />
      </KpiGrid>
      {query.error?.kind === 'forbidden' ? (
        <RestrictedState description={t('qualification.supplierDecisions.restricted')} />
      ) : query.error !== null && query.data === undefined ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : query.data === undefined ? (
        <SkeletonBlock lines={6} />
      ) : groups.size === 0 ? (
        <EmptyState
          title={
            filtered
              ? t('qualification.supplierDecisions.emptyFiltered')
              : t('qualification.supplierDecisions.empty')
          }
          description={filtered ? undefined : t('qualification.supplierDecisions.emptyHint')}
        />
      ) : (
        <>
          {[...groups.entries()].map(([buyerId, group]) => (
            <Card
              key={buyerId}
              flush
              title={t('qualification.supplierDecisions.byBuyer', { buyer: group.name })}
              subtitle={t('qualification.supplierDecisions.byBuyerHint', { buyer: group.name })}
            >
              <DataTable
                caption={t('qualification.supplierDecisions.byBuyer', { buyer: group.name })}
                columns={columns}
                rows={group.rows}
                rowKey={(row) => String(row.id)}
                rowLabel={(row) => `${row.program.programName} ${row.buyer.name}`}
                onRowClick={(row) => void navigate(supplierQualificationPaths.decision(row.id))}
              />
            </Card>
          ))}
          <Pagination
            page={query.data.page}
            pageSize={query.data.pageSize}
            total={query.data.total}
            onPageChange={(page) => setFilters({ page })}
            onPageSizeChange={(pageSize) => setFilters({ pageSize, page: 1 })}
          />
        </>
      )}
    </div>
  );
}
