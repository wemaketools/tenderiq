/**
 * BUY-23 — Shortlists and stage progression: every shortlist with its stage, selection rule and threshold, included
 * and excluded counts, approval and outcome-notice state (FR-15, AC-22).
 */
import { useNavigate } from 'react-router';

import { SHORTLISTS_STATUS } from '@contracts/enums';
import { selectionEndpoints } from '@contracts/selection';
import type { ShortlistRow } from '@contracts/selection';

import { useApiQuery } from '../../../../api/hooks';
import { useScreenFilters } from '../../../../app/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  ButtonLink,
  Card,
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
import { formatCount, formatDecimalString, formatInstantDate } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { SelectionPage } from '../../components/SelectionPage';
import { TenderSelect } from '../../components/TenderSelect';
import { useOfficialTimeZone, useTenderFilter } from '../../lib/hooks';
import { lotLabel } from '../../lib/labels';
import { compact, directionOf, idOf, oneOf, sortOf, tableSort } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';
import { SELECTION_MANAGE } from '../../lib/permissions';

const SORTS = ['tenderReference', 'status', 'updatedAt'] as const;
const DEFAULTS = {
  q: '',
  tender: '',
  status: '',
  sort: 'updatedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function ShortlistsPage() {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const canManage = usePermission(SELECTION_MANAGE);
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-23', DEFAULTS);
  const [tender, setTender, clearTenderLink] = useTenderFilter(filters.tender, (value) =>
    setFilters({ tender: value, page: 1 }),
  );

  const query = useApiQuery(selectionEndpoints.listShortlists, {
    query: compact({
      q: filters.q.trim(),
      tenderId: idOf(tender),
      status: oneOf(filters.status, SHORTLISTS_STATUS),
      sort: sortOf(filters.sort, SORTS, 'updatedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(selectionEndpoints.listShortlists, {
    query: compact({ tenderId: idOf(tender), pageSize: 100 }),
  });
  const all = overview.data?.items ?? [];
  const loadingValue = overview.data === undefined ? '…' : null;
  const kpiRestricted = overview.error?.kind === 'forbidden';
  const filtered = filters.q !== '' || tender !== '' || filters.status !== '';

  const columns: DataTableColumn<ShortlistRow>[] = [
    {
      id: 'tenderReference',
      header: t('selection.common.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.tender.reference} to={selectionPaths.shortlist(row.shortlistId)} />
          <span className="tiq-cell-sub">
            {row.tender.title} · {lotLabel(row.lot)}
          </span>
        </>
      ),
    },
    {
      id: 'stage',
      header: t('selection.shortlists.col.stage'),
      cell: (row) => t('selection.common.stageNo', { stage: row.stageNo }),
    },
    {
      id: 'rule',
      header: t('selection.shortlists.col.rule'),
      cell: (row) => (
        <>
          <span>{row.selectionRule}</span>
          <span className="tiq-cell-sub">
            {row.threshold === null
              ? t('selection.shortlists.rankOnly')
              : t('selection.shortlists.threshold', {
                  threshold: formatDecimalString(row.threshold, 2),
                })}
          </span>
        </>
      ),
    },
    {
      id: 'counts',
      header: t('selection.shortlists.col.counts'),
      numeric: true,
      cell: (row) =>
        t('selection.shortlists.counts', {
          included: row.includedCount,
          excluded: row.excludedCount,
        }),
    },
    {
      id: 'approval',
      header: t('selection.shortlists.col.approval'),
      cell: (row) =>
        row.approval === null ? (
          <span className="tiq-text-muted">{t('selection.common.notRequested')}</span>
        ) : (
          <StatusChip enum="approval_requests.status" value={row.approval.status} size="sm" />
        ),
    },
    {
      id: 'notified',
      header: t('selection.shortlists.col.notices'),
      cell: (row) =>
        row.notifiedAt === null ? (
          row.status === 'approved' ? (
            <span className="tiq-text-warning">{t('selection.shortlists.noticesDue')}</span>
          ) : (
            <OrDash>{null}</OrDash>
          )
        ) : (
          formatInstantDate(row.notifiedAt, timeZone)
        ),
    },
    {
      id: 'status',
      header: t('selection.common.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="shortlists.status" value={row.status} />,
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
          title={t('selection.shortlists.title')}
          subtitle={t('selection.shortlists.intro')}
          primaryAction={
            canManage ? (
              <ButtonLink
                to={selectionPaths.newShortlist(idOf(tender))}
                variant="primary"
                icon="plus"
              >
                {t('selection.shortlists.new')}
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
          placeholder={t('selection.shortlists.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <TenderSelect mode="filter" value={tender} onChange={setTender} />
        <Select
          label={t('selection.common.status')}
          placeholder={t('selection.common.allStatuses')}
          value={filters.status}
          options={SHORTLISTS_STATUS.map((value) => ({
            value,
            label: tEnum('shortlists.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('selection.shortlists.kpi.total')}
          icon="listChecks"
          value={loadingValue ?? formatCount(all.length)}
          hint={t('selection.shortlists.kpi.totalHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.shortlists.kpi.awaiting')}
          icon="hourglass"
          tone="warning"
          value={
            loadingValue ??
            formatCount(
              all.filter((row) => row.status === 'awaiting_approval' || row.status === 'changed')
                .length,
            )
          }
          hint={t('selection.shortlists.kpi.awaitingHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.shortlists.kpi.approved')}
          icon="checkCircle"
          tone="success"
          value={loadingValue ?? formatCount(all.filter((row) => row.status === 'approved').length)}
          hint={t('selection.shortlists.kpi.approvedHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.shortlists.kpi.notices')}
          icon="mail"
          tone="info"
          value={
            loadingValue ??
            formatCount(
              all.filter((row) => row.status === 'approved' && row.notifiedAt === null).length,
            )
          }
          hint={t('selection.shortlists.kpi.noticesHint')}
          restricted={kpiRestricted}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('selection.shortlists.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.shortlistId)}
          rowLabel={(row) => `${row.tender.reference} ${row.tender.title}`}
          onRowClick={(row) => void navigate(selectionPaths.shortlist(row.shortlistId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('selection.common.emptyFiltered') : t('selection.shortlists.empty')
              }
              description={filtered ? undefined : t('selection.shortlists.emptyHint')}
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
