/**
 * BUY-25 — Due-diligence cases: the preferred bidder's case per tender with its owner, findings by disposition,
 * award-blocking findings and the next due date (FR-16, AC-24).
 */

import { DUE_DILIGENCE_CASES_STATUS, DUE_DILIGENCE_FINDINGS_AREA } from '@contracts/enums';
import { selectionEndpoints } from '@contracts/selection';
import type { DueDiligenceCaseRow } from '@contracts/selection';

import { useApiQuery } from '../../../../api/hooks';
import { useScreenFilters } from '../../../../app/hooks';
import {
  Card,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
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
import { BidName } from '../../components/BidName';
import { SelectionPage } from '../../components/SelectionPage';
import { TenderSelect } from '../../components/TenderSelect';
import { useOfficialTimeZone, useTenderFilter } from '../../lib/hooks';
import { booleanOf, compact, directionOf, idOf, oneOf, sortOf, tableSort } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';

const SORTS = ['tenderReference', 'status', 'nextDueAt', 'updatedAt'] as const;
const DEFAULTS = {
  q: '',
  tender: '',
  status: '',
  owner: '',
  area: '',
  blocking: '',
  sort: 'nextDueAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

export default function DiligenceCasesPage() {
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-25', DEFAULTS);
  const [tender, setTender, clearTenderLink] = useTenderFilter(filters.tender, (value) =>
    setFilters({ tender: value, page: 1 }),
  );
  const query = useApiQuery(selectionEndpoints.listDiligenceCases, {
    query: compact({
      q: filters.q.trim(),
      tenderId: idOf(tender),
      status: oneOf(filters.status, DUE_DILIGENCE_CASES_STATUS),
      ownerUserId: idOf(filters.owner),
      area: oneOf(filters.area, DUE_DILIGENCE_FINDINGS_AREA),
      awardBlocking: booleanOf(filters.blocking),
      sort: sortOf(filters.sort, SORTS, 'nextDueAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(selectionEndpoints.listDiligenceCases, {
    query: compact({ tenderId: idOf(tender), pageSize: 100 }),
  });
  const all = overview.data?.items ?? [];
  const loadingValue = overview.data === undefined ? '…' : null;
  const kpiRestricted = overview.error?.kind === 'forbidden';
  const owners = new Map(all.map((row) => [row.owner.userId, row.owner.fullName]));
  const filtered =
    filters.q !== '' ||
    tender !== '' ||
    filters.status !== '' ||
    filters.owner !== '' ||
    filters.area !== '' ||
    filters.blocking !== '';

  const columns: DataTableColumn<DueDiligenceCaseRow>[] = [
    {
      id: 'tenderReference',
      header: t('selection.common.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.tender.reference} to={selectionPaths.diligenceCase(row.caseId)} />
          <span className="tiq-cell-sub">{row.tender.title}</span>
        </>
      ),
    },
    {
      id: 'supplier',
      header: t('selection.diligence.col.supplier'),
      cell: (row) => (
        <>
          <BidName bid={row.bid} />
          <span className="tiq-cell-sub">
            {tEnum('preferred_bidders.status', row.preferredBidder.status)}
          </span>
        </>
      ),
    },
    {
      id: 'findings',
      header: t('selection.diligence.col.findings'),
      cell: (row) => (
        <span className="tiq-inline">
          <Chip tone="success" size="sm">
            {t('selection.diligence.satisfied', { count: row.dispositionCounts.satisfied })}
          </Chip>
          <Chip tone="info" size="sm">
            {t('selection.diligence.condition', { count: row.dispositionCounts.condition })}
          </Chip>
          <Chip tone="warning" size="sm">
            {t('selection.diligence.unresolved', { count: row.dispositionCounts.unresolved })}
          </Chip>
          <Chip tone="danger" size="sm">
            {t('selection.diligence.failed', { count: row.dispositionCounts.failed })}
          </Chip>
        </span>
      ),
    },
    {
      id: 'blocking',
      header: t('selection.diligence.col.blocking'),
      numeric: true,
      cell: (row) =>
        row.awardBlockingCount === 0 ? (
          <span className="tiq-text-muted">{formatCount(0)}</span>
        ) : (
          <Chip tone="danger" size="sm" icon="ban">
            {formatCount(row.awardBlockingCount)}
          </Chip>
        ),
    },
    {
      id: 'nextDueAt',
      header: t('selection.diligence.col.nextDue'),
      sortable: true,
      cell: (row) =>
        row.nextDueAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline
            deadline={{ at: row.nextDueAt, timeZone: row.tender.officialTimeZone }}
            showLocal={false}
          />
        ),
    },
    {
      id: 'status',
      header: t('selection.common.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="due_diligence_cases.status" value={row.status} />,
    },
    {
      id: 'owner',
      header: t('selection.common.owner'),
      cell: (row) => row.owner.fullName,
    },
    {
      id: 'updatedAt',
      header: t('selection.common.updated'),
      sortable: true,
      cell: (row) => formatInstantDate(row.updatedAt, timeZone),
    },
  ];

  return (
    <SelectionPage
      header={
        <PageHeader
          title={t('selection.diligence.title')}
          subtitle={t('selection.diligence.intro')}
        />
      }
    >
      <FilterBar
        label={t('selection.common.filters')}
        onClear={() => {
          clearFilters();
          clearTenderLink();
        }}
        canClear={filtered}
      >
        <SearchField
          label={t('selection.common.search')}
          placeholder={t('selection.diligence.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <TenderSelect mode="filter" value={tender} onChange={setTender} />
        <Select
          label={t('selection.common.status')}
          placeholder={t('selection.common.allStatuses')}
          value={filters.status}
          options={DUE_DILIGENCE_CASES_STATUS.map((value) => ({
            value,
            label: tEnum('due_diligence_cases.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('selection.diligence.filter.area')}
          placeholder={t('selection.diligence.filter.allAreas')}
          value={filters.area}
          options={DUE_DILIGENCE_FINDINGS_AREA.map((value) => ({
            value,
            label: tEnum('due_diligence_findings.area', value),
          }))}
          onChange={(area) => setFilters({ area, page: 1 })}
        />
        <Select
          label={t('selection.common.owner')}
          placeholder={t('selection.common.allOwners')}
          value={filters.owner}
          options={[...owners].map(([value, label]) => ({ value: String(value), label }))}
          onChange={(owner) => setFilters({ owner, page: 1 })}
        />
        <Select
          label={t('selection.diligence.filter.blocking')}
          placeholder={t('selection.common.all')}
          value={filters.blocking}
          options={[
            { value: 'true', label: t('selection.diligence.filter.withBlocking') },
            { value: 'false', label: t('selection.diligence.filter.withoutBlocking') },
          ]}
          onChange={(blocking) => setFilters({ blocking, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('selection.diligence.kpi.open')}
          icon="clipboard"
          value={
            loadingValue ??
            formatCount(
              all.filter((row) => row.status === 'open' || row.status === 'ready_for_decision')
                .length,
            )
          }
          hint={t('selection.diligence.kpi.openHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.diligence.kpi.blocking')}
          icon="ban"
          tone="danger"
          value={
            loadingValue ?? formatCount(all.reduce((sum, row) => sum + row.awardBlockingCount, 0))
          }
          hint={t('selection.diligence.kpi.blockingHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.diligence.kpi.unresolved')}
          icon="alertTriangle"
          tone="warning"
          value={
            loadingValue ??
            formatCount(all.reduce((sum, row) => sum + row.dispositionCounts.unresolved, 0))
          }
          hint={t('selection.diligence.kpi.unresolvedHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.diligence.kpi.failed')}
          icon="xCircle"
          tone="info"
          value={loadingValue ?? formatCount(all.filter((row) => row.status === 'failed').length)}
          hint={t('selection.diligence.kpi.failedHint')}
          restricted={kpiRestricted}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('selection.diligence.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.caseId)}
          rowLabel={(row) => `${row.tender.reference} ${row.bid.supplierName}`}
          rowHref={(row) => selectionPaths.diligenceCase(row.caseId)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('selection.common.emptyFiltered') : t('selection.diligence.empty')
              }
              description={filtered ? undefined : t('selection.diligence.emptyHint')}
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
