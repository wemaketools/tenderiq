/**
 * Selection overview: the tenders in the selection stage with their shortlist, preferred-bidder, diligence and
 * negotiation status and the number of blocked actions (entry point of BUY-22..BUY-25, BUY-27).
 */
import { Navigate } from 'react-router';

import { TENDERS_PROCEDURE, TENDERS_STATUS } from '@contracts/enums';
import { selectionEndpoints } from '@contracts/selection';
import type { SelectionTenderRow } from '@contracts/selection';

import { useApiQuery } from '../../../../api/hooks';
import { useScreenFilters } from '../../../../app/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Card,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OrDash,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatCount, formatInstantDate } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { SelectionPage } from '../../components/SelectionPage';
import { useOfficialTimeZone } from '../../lib/hooks';
import { booleanOf, compact, directionOf, idOf, oneOf, sortOf, tableSort } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';
import { SELECTION_READ } from '../../lib/permissions';

const SORTS = ['reference', 'updatedAt', 'status'] as const;
const DEFAULTS = {
  q: '',
  status: '',
  procedure: '',
  owner: '',
  blockers: '',
  sort: 'updatedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function SelectionRegisterPage() {
  const canRead = usePermission(SELECTION_READ);
  if (!canRead) return <Navigate to={selectionPaths.assessments} replace />;
  return <SelectionRegister />;
}

/** The register itself (the caller holds a selection read permission). */
function SelectionRegister() {
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-SELECTION', DEFAULTS);

  const query = useApiQuery(selectionEndpoints.listTenders, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, TENDERS_STATUS),
      procedure: oneOf(filters.procedure, TENDERS_PROCEDURE),
      ownerUserId: idOf(filters.owner),
      hasBlockers: booleanOf(filters.blockers),
      sort: sortOf(filters.sort, SORTS, 'updatedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(selectionEndpoints.listTenders, { query: { pageSize: 100 } });
  const all = overview.data?.items ?? [];
  const kpiRestricted = overview.error?.kind === 'forbidden';
  const loadingValue = overview.data === undefined ? '…' : null;
  const owners = new Map(all.map((row) => [row.owner.userId, row.owner.fullName]));

  const filtered =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.procedure !== '' ||
    filters.owner !== '' ||
    filters.blockers !== '';

  const columns: DataTableColumn<SelectionTenderRow>[] = [
    {
      id: 'reference',
      header: t('selection.register.col.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.reference} to={selectionPaths.tender(row.tenderId)} />
          <span className="tiq-cell-sub">{row.title}</span>
        </>
      ),
    },
    {
      id: 'procedure',
      header: t('selection.register.col.procedure'),
      cell: (row) => (
        <>
          <span>{tEnum('tenders.procedure', row.procedure)}</span>
          <span className="tiq-cell-sub">
            {t('selection.common.stageNo', { stage: row.stageNo })}
          </span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('selection.register.col.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="tenders.status" value={row.status} />,
    },
    {
      id: 'shortlist',
      header: t('selection.register.col.shortlist'),
      cell: (row) =>
        row.shortlistStatus === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <StatusChip enum="shortlists.status" value={row.shortlistStatus} size="sm" />
        ),
    },
    {
      id: 'preferred',
      header: t('selection.register.col.preferred'),
      cell: (row) =>
        row.preferredBidderStatus === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <StatusChip enum="preferred_bidders.status" value={row.preferredBidderStatus} size="sm" />
        ),
    },
    {
      id: 'diligence',
      header: t('selection.register.col.diligence'),
      cell: (row) =>
        row.dueDiligenceStatus === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <StatusChip enum="due_diligence_cases.status" value={row.dueDiligenceStatus} size="sm" />
        ),
    },
    {
      id: 'negotiation',
      header: t('selection.register.col.negotiation'),
      cell: (row) =>
        row.negotiationStatus === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <StatusChip enum="negotiations.status" value={row.negotiationStatus} size="sm" />
        ),
    },
    {
      id: 'blockers',
      header: t('selection.register.col.blockers'),
      numeric: true,
      cell: (row) =>
        row.blockerCount === 0 ? (
          <span className="tiq-text-muted">{formatCount(0)}</span>
        ) : (
          <Chip tone="danger" size="sm" icon="ban">
            {t('selection.register.blocked', { count: row.blockerCount })}
          </Chip>
        ),
    },
    {
      id: 'owner',
      header: t('selection.register.col.owner'),
      cell: (row) => row.owner.fullName,
    },
    {
      id: 'updatedAt',
      header: t('selection.register.col.updated'),
      sortable: true,
      cell: (row) => formatInstantDate(row.updatedAt, timeZone),
    },
  ];

  return (
    <SelectionPage
      header={
        <PageHeader
          title={t('selection.register.title')}
          subtitle={t('selection.register.intro')}
        />
      }
    >
      <FilterBar label={t('selection.common.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('selection.common.search')}
          placeholder={t('selection.register.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('selection.register.filter.status')}
          placeholder={t('selection.common.allStatuses')}
          value={filters.status}
          options={TENDERS_STATUS.map((value) => ({
            value,
            label: tEnum('tenders.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('selection.register.filter.procedure')}
          placeholder={t('selection.register.filter.allProcedures')}
          value={filters.procedure}
          options={TENDERS_PROCEDURE.map((value) => ({
            value,
            label: tEnum('tenders.procedure', value),
          }))}
          onChange={(procedure) => setFilters({ procedure, page: 1 })}
        />
        <Select
          label={t('selection.common.owner')}
          placeholder={t('selection.common.allOwners')}
          value={filters.owner}
          options={[...owners].map(([value, label]) => ({ value: String(value), label }))}
          onChange={(owner) => setFilters({ owner, page: 1 })}
        />
        <Select
          label={t('selection.register.filter.blockers')}
          placeholder={t('selection.register.filter.anyBlockers')}
          value={filters.blockers}
          options={[
            { value: 'true', label: t('selection.register.filter.withBlockers') },
            { value: 'false', label: t('selection.register.filter.withoutBlockers') },
          ]}
          onChange={(blockers) => setFilters({ blockers, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('selection.register.kpi.tenders')}
          icon="layers"
          value={loadingValue ?? formatCount(all.length)}
          hint={t('selection.register.kpi.tendersHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.register.kpi.blocked')}
          icon="ban"
          tone="danger"
          value={loadingValue ?? formatCount(all.filter((row) => row.blockerCount > 0).length)}
          hint={t('selection.register.kpi.blockedHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.register.kpi.negotiating')}
          icon="handshake"
          tone="info"
          value={
            loadingValue ??
            formatCount(all.filter((row) => row.negotiationStatus === 'active').length)
          }
          hint={t('selection.register.kpi.negotiatingHint')}
          to={selectionPaths.negotiations}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.register.kpi.diligence')}
          icon="shieldCheck"
          tone="warning"
          value={
            loadingValue ??
            formatCount(
              all.filter(
                (row) =>
                  row.dueDiligenceStatus === 'open' ||
                  row.dueDiligenceStatus === 'ready_for_decision',
              ).length,
            )
          }
          hint={t('selection.register.kpi.diligenceHint')}
          to={selectionPaths.diligence}
          restricted={kpiRestricted}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('selection.register.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.tenderId)}
          rowLabel={(row) => `${row.reference} ${row.title}`}
          rowHref={(row) => selectionPaths.tender(row.tenderId)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={filtered ? t('selection.common.emptyFiltered') : t('selection.register.empty')}
              description={filtered ? undefined : t('selection.register.emptyHint')}
            />
          }
          pagination={
            query.data === undefined
              ? undefined
              : {
                  page: query.data.page,
                  pageSize: query.data.pageSize,
                  total: query.data.total,
                  onPageChange: (page) => setFilters({ page }),
                  onPageSizeChange: (pageSize) => setFilters({ pageSize, page: 1 }),
                }
          }
        />
      </Card>
    </SelectionPage>
  );
}
