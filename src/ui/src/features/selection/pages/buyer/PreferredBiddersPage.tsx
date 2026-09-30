/**
 * BUY-24 — Preferred bidders: every conditional preferred-bidder recommendation with scope, proposed value, decision
 * owner, approval, diligence state and fallback. Preferred status is conditional and never an award (BR-31).
 */
import { useNavigate } from 'react-router';

import { PREFERRED_BIDDERS_STATUS } from '@contracts/enums';
import { selectionEndpoints } from '@contracts/selection';
import type { PreferredBidderRow } from '@contracts/selection';

import { useApiQuery } from '../../../../api/hooks';
import { useScreenFilters } from '../../../../app/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  ButtonLink,
  Card,
  Chip,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  MoneyText,
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
import { bidLabel, lotLabel } from '../../lib/labels';
import { compact, directionOf, idOf, oneOf, sortOf, tableSort } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';
import { SELECTION_MANAGE } from '../../lib/permissions';

const SORTS = ['tenderReference', 'status', 'updatedAt'] as const;
const DEFAULTS = {
  q: '',
  tender: '',
  status: '',
  owner: '',
  sort: 'updatedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function PreferredBiddersPage() {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const canManage = usePermission(SELECTION_MANAGE);
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-24', DEFAULTS);
  const [tender, setTender, clearTenderLink] = useTenderFilter(filters.tender, (value) =>
    setFilters({ tender: value, page: 1 }),
  );
  const query = useApiQuery(selectionEndpoints.listPreferredBidders, {
    query: compact({
      q: filters.q.trim(),
      tenderId: idOf(tender),
      status: oneOf(filters.status, PREFERRED_BIDDERS_STATUS),
      decisionOwnerUserId: idOf(filters.owner),
      sort: sortOf(filters.sort, SORTS, 'updatedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(selectionEndpoints.listPreferredBidders, {
    query: compact({ tenderId: idOf(tender), pageSize: 100 }),
  });
  const all = overview.data?.items ?? [];
  const loadingValue = overview.data === undefined ? '…' : null;
  const kpiRestricted = overview.error?.kind === 'forbidden';
  const owners = new Map(all.map((row) => [row.decisionOwner.userId, row.decisionOwner.fullName]));
  const filtered =
    filters.q !== '' || tender !== '' || filters.status !== '' || filters.owner !== '';

  const columns: DataTableColumn<PreferredBidderRow>[] = [
    {
      id: 'tenderReference',
      header: t('selection.common.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference
            value={row.tender.reference}
            to={selectionPaths.preferredBidder(row.preferredBidderId)}
          />
          <span className="tiq-cell-sub">{lotLabel(row.lot)}</span>
        </>
      ),
    },
    {
      id: 'supplier',
      header: t('selection.preferred.col.supplier'),
      cell: (row) => (
        <>
          <BidName bid={row.bid} />
          <span className="tiq-cell-sub">{row.scope}</span>
        </>
      ),
    },
    {
      id: 'value',
      header: t('selection.preferred.col.value'),
      numeric: true,
      cell: (row) => <MoneyText value={row.proposedValue} />,
    },
    {
      id: 'diligence',
      header: t('selection.preferred.col.diligence'),
      cell: (row) =>
        row.dueDiligence === null ? (
          <span className="tiq-text-muted">{t('selection.preferred.noCase')}</span>
        ) : (
          <>
            <StatusChip
              enum="due_diligence_cases.status"
              value={row.dueDiligence.status}
              size="sm"
            />
            {row.dueDiligence.awardBlockingCount > 0 && (
              <span className="tiq-cell-sub">
                <Chip tone="danger" size="sm" icon="ban">
                  {t('selection.preferred.blocking', {
                    count: row.dueDiligence.awardBlockingCount,
                  })}
                </Chip>
              </span>
            )}
          </>
        ),
    },
    {
      id: 'fallback',
      header: t('selection.preferred.col.fallback'),
      cell: (row) => <OrDash>{row.fallbackBid === null ? null : bidLabel(row.fallbackBid)}</OrDash>,
    },
    {
      id: 'approval',
      header: t('selection.preferred.col.approval'),
      cell: (row) =>
        row.approval === null ? (
          <span className="tiq-text-muted">{t('selection.common.notRequested')}</span>
        ) : (
          <StatusChip enum="approval_requests.status" value={row.approval.status} size="sm" />
        ),
    },
    {
      id: 'status',
      header: t('selection.common.status'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip enum="preferred_bidders.status" value={row.status} />
          {row.statusReason !== null && <span className="tiq-cell-sub">{row.statusReason}</span>}
        </>
      ),
    },
    {
      id: 'owner',
      header: t('selection.preferred.col.owner'),
      cell: (row) => row.decisionOwner.fullName,
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
          title={t('selection.preferred.title')}
          subtitle={t('selection.preferred.intro')}
          primaryAction={
            canManage ? (
              <ButtonLink
                to={selectionPaths.newPreferredBidder(idOf(tender))}
                variant="primary"
                icon="plus"
              >
                {t('selection.preferred.new')}
              </ButtonLink>
            ) : undefined
          }
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
          placeholder={t('selection.preferred.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <TenderSelect mode="filter" value={tender} onChange={setTender} />
        <Select
          label={t('selection.common.status')}
          placeholder={t('selection.common.allStatuses')}
          value={filters.status}
          options={PREFERRED_BIDDERS_STATUS.map((value) => ({
            value,
            label: tEnum('preferred_bidders.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('selection.preferred.col.owner')}
          placeholder={t('selection.common.allOwners')}
          value={filters.owner}
          options={[...owners].map(([value, label]) => ({ value: String(value), label }))}
          onChange={(owner) => setFilters({ owner, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('selection.preferred.kpi.active')}
          icon="star"
          value={
            loadingValue ??
            formatCount(
              all.filter((row) =>
                ['proposed', 'awaiting_approval', 'approved'].includes(row.status),
              ).length,
            )
          }
          hint={t('selection.preferred.kpi.activeHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.preferred.kpi.awaiting')}
          icon="hourglass"
          tone="warning"
          value={
            loadingValue ??
            formatCount(all.filter((row) => row.status === 'awaiting_approval').length)
          }
          hint={t('selection.preferred.kpi.awaitingHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.preferred.kpi.failed')}
          icon="alertOctagon"
          tone="danger"
          value={
            loadingValue ??
            formatCount(all.filter((row) => row.status === 'failed_diligence').length)
          }
          hint={t('selection.preferred.kpi.failedHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.preferred.kpi.blocking')}
          icon="ban"
          tone="info"
          value={
            loadingValue ??
            formatCount(
              all.reduce((sum, row) => sum + (row.dueDiligence?.awardBlockingCount ?? 0), 0),
            )
          }
          hint={t('selection.preferred.kpi.blockingHint')}
          to={selectionPaths.diligence}
          restricted={kpiRestricted}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('selection.preferred.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.preferredBidderId)}
          rowLabel={(row) => `${row.tender.reference} ${row.bid.supplierName}`}
          onRowClick={(row) => void navigate(selectionPaths.preferredBidder(row.preferredBidderId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('selection.common.emptyFiltered') : t('selection.preferred.empty')
              }
              description={filtered ? undefined : t('selection.preferred.emptyHint')}
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
