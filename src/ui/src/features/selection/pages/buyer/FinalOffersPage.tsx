/**
 * BUY-27 — Final-offer (BAFO) rounds: every round with its deadline, invitees, procedural authority, approval and
 * status. Final offers require explicit procedural authority; where the issued conditions do not permit them the
 * round stays blocked pending a process decision (AC-23).
 */

import { FINAL_OFFER_ROUNDS_STATUS } from '@contracts/enums';
import { selectionEndpoints } from '@contracts/selection';
import type { FinalOfferRoundRow } from '@contracts/selection';

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
import { SelectionPage } from '../../components/SelectionPage';
import { TenderSelect } from '../../components/TenderSelect';
import { useOfficialTimeZone, useTenderFilter } from '../../lib/hooks';
import { lotLabel } from '../../lib/labels';
import { compact, directionOf, idOf, oneOf, sortOf, tableSort } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';
import { SELECTION_MANAGE } from '../../lib/permissions';

const SORTS = ['tenderReference', 'status', 'deadline', 'updatedAt'] as const;
const DEFAULTS = {
  q: '',
  tender: '',
  status: '',
  sort: 'updatedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function FinalOffersPage() {
  const timeZone = useOfficialTimeZone();
  const canManage = usePermission(SELECTION_MANAGE);
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-27-BAFO', DEFAULTS);
  const [tender, setTender, clearTenderLink] = useTenderFilter(filters.tender, (value) =>
    setFilters({ tender: value, page: 1 }),
  );
  const query = useApiQuery(selectionEndpoints.listFinalOfferRounds, {
    query: compact({
      q: filters.q.trim(),
      tenderId: idOf(tender),
      status: oneOf(filters.status, FINAL_OFFER_ROUNDS_STATUS),
      sort: sortOf(filters.sort, SORTS, 'updatedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(selectionEndpoints.listFinalOfferRounds, {
    query: compact({ tenderId: idOf(tender), pageSize: 100 }),
  });
  const all = overview.data?.items ?? [];
  const loadingValue = overview.data === undefined ? '…' : null;
  const kpiRestricted = overview.error?.kind === 'forbidden';
  const filtered = filters.q !== '' || tender !== '' || filters.status !== '';
  const count = (statuses: readonly FinalOfferRoundRow['status'][]): string =>
    loadingValue ?? formatCount(all.filter((row) => statuses.includes(row.status)).length);

  const columns: DataTableColumn<FinalOfferRoundRow>[] = [
    {
      id: 'tenderReference',
      header: t('selection.common.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.tender.reference} to={selectionPaths.finalOffer(row.roundId)} />
          <span className="tiq-cell-sub">{lotLabel(row.lot)}</span>
        </>
      ),
    },
    {
      id: 'deadline',
      header: t('selection.finalOffers.col.deadline'),
      sortable: true,
      cell: (row) =>
        row.deadline === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={row.deadline} showLocal={false} />
        ),
    },
    {
      id: 'invitees',
      header: t('selection.finalOffers.col.invitees'),
      numeric: true,
      cell: (row) => formatCount(row.inviteeCount),
    },
    {
      id: 'authority',
      header: t('selection.finalOffers.col.authority'),
      cell: (row) => row.proceduralAuthorityRef,
    },
    {
      id: 'approval',
      header: t('selection.finalOffers.col.approval'),
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
      cell: (row) => <StatusChip enum="final_offer_rounds.status" value={row.status} />,
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
          title={t('selection.finalOffers.title')}
          subtitle={t('selection.finalOffers.intro')}
          primaryAction={
            canManage ? (
              <ButtonLink
                to={selectionPaths.newFinalOffer(idOf(tender))}
                variant="primary"
                icon="plus"
              >
                {t('selection.finalOffers.new')}
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
          placeholder={t('selection.finalOffers.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <TenderSelect mode="filter" value={tender} onChange={setTender} />
        <Select
          label={t('selection.common.status')}
          placeholder={t('selection.common.allStatuses')}
          value={filters.status}
          options={FINAL_OFFER_ROUNDS_STATUS.map((value) => ({
            value,
            label: tEnum('final_offer_rounds.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('selection.finalOffers.kpi.draft')}
          icon="edit"
          tone="warning"
          value={count(['draft', 'awaiting_approval'])}
          hint={t('selection.finalOffers.kpi.draftHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.finalOffers.kpi.issued')}
          icon="send"
          value={count(['issued'])}
          hint={t('selection.finalOffers.kpi.issuedHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.finalOffers.kpi.closed')}
          icon="checkCircle"
          tone="success"
          value={count(['closed', 'evaluated'])}
          hint={t('selection.finalOffers.kpi.closedHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.finalOffers.kpi.cancelled')}
          icon="ban"
          tone="info"
          value={count(['cancelled'])}
          hint={t('selection.finalOffers.kpi.cancelledHint')}
          restricted={kpiRestricted}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('selection.finalOffers.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.roundId)}
          rowLabel={(row) => `${row.tender.reference} ${t('selection.finalOffers.round')}`}
          rowHref={(row) => selectionPaths.finalOffer(row.roundId)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('selection.common.emptyFiltered') : t('selection.finalOffers.empty')
              }
              description={filtered ? undefined : t('selection.finalOffers.emptyHint')}
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
