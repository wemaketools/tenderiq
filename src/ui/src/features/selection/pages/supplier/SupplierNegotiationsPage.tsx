/**
 * SUP-19 — Negotiation and final-offer rounds (register): the supplier's own negotiations with their authorized
 * topics, rounds and whether a response is awaited, and the final-offer rounds it is invited to with their official
 * deadlines. Other suppliers' negotiation records are never shown.
 */

import { FINAL_OFFER_ROUNDS_STATUS, NEGOTIATIONS_STATUS } from '@contracts/enums';
import { selectionEndpoints } from '@contracts/selection';
import type { SupplierFinalOfferRound, SupplierNegotiationRow } from '@contracts/selection';

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
  SearchField,
  Select,
  StatusChip,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatCount, formatDateTime } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { booleanOf, compact, directionOf, oneOf, sortOf, tableSort } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';

const SORTS = ['updatedAt', 'lastMeetingAt', 'status'] as const;
const DEFAULTS = {
  q: '',
  status: '',
  awaiting: '',
  roundStatus: '',
  sort: 'updatedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function SupplierNegotiationsPage() {
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-19', DEFAULTS);
  const query = useApiQuery(selectionEndpoints.listSupplierNegotiations, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, NEGOTIATIONS_STATUS),
      awaitingResponse: booleanOf(filters.awaiting),
      sort: sortOf(filters.sort, SORTS, 'updatedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(selectionEndpoints.listSupplierNegotiations, {
    query: { pageSize: 100 },
  });
  const rounds = useApiQuery(selectionEndpoints.listSupplierFinalOffers, {
    query: compact({
      status: oneOf(filters.roundStatus, FINAL_OFFER_ROUNDS_STATUS),
      sort: 'deadline',
      dir: 'asc',
      pageSize: 100,
    }),
  });
  const all = overview.data?.items ?? [];
  const loadingValue = overview.data === undefined ? '…' : null;
  const kpiRestricted = overview.error?.kind === 'forbidden';
  const filtered =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.awaiting !== '' ||
    filters.roundStatus !== '';

  const columns: DataTableColumn<SupplierNegotiationRow>[] = [
    {
      id: 'tender',
      header: t('selection.common.tender'),
      cell: (row) => (
        <>
          <span className="tiq-ref">{row.tender.reference}</span>
          <span className="tiq-cell-sub">
            {row.tender.title} · {row.buyer.name}
          </span>
        </>
      ),
    },
    {
      id: 'topics',
      header: t('selection.negotiations.col.topics'),
      cell: (row) => row.allowedTopics.join(', '),
    },
    {
      id: 'lastMeetingAt',
      header: t('selection.negotiations.col.rounds'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{t('selection.negotiations.rounds', { count: row.roundCount })}</span>
          <span className="tiq-cell-sub">
            <OrDash>
              {row.lastMeetingAt === null
                ? null
                : formatDateTime(row.lastMeetingAt, row.tender.officialTimeZone)}
            </OrDash>
          </span>
        </>
      ),
    },
    {
      id: 'awaiting',
      header: t('selection.supplierNegotiations.col.response'),
      cell: (row) =>
        row.awaitingResponse ? (
          <Chip tone="warning" size="sm" icon="hourglass">
            {t('selection.supplierNegotiations.responseDue')}
          </Chip>
        ) : (
          <span className="tiq-text-muted">
            {t('selection.supplierNegotiations.noResponseDue')}
          </span>
        ),
    },
    {
      id: 'status',
      header: t('selection.common.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="negotiations.status" value={row.status} />,
    },
    {
      id: 'updatedAt',
      header: t('selection.common.updated'),
      sortable: true,
      cell: (row) => formatDateTime(row.updatedAt, row.tender.officialTimeZone),
    },
  ];

  const roundColumns: DataTableColumn<SupplierFinalOfferRound>[] = [
    {
      id: 'tender',
      header: t('selection.common.tender'),
      cell: (row) => (
        <>
          <span className="tiq-ref">{row.tender.reference}</span>
          <span className="tiq-cell-sub">{row.buyer.name}</span>
        </>
      ),
    },
    {
      id: 'deadline',
      header: t('selection.finalOffers.col.deadline'),
      cell: (row) =>
        row.deadline === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={row.deadline} showRemaining />
        ),
    },
    {
      id: 'received',
      header: t('selection.finalOffer.col.received'),
      cell: (row) =>
        row.finalOfferReceivedAt === null ? (
          <span className="tiq-text-warning">{t('selection.supplierFinalOffer.notSubmitted')}</span>
        ) : (
          formatDateTime(row.finalOfferReceivedAt, row.tender.officialTimeZone)
        ),
    },
    {
      id: 'status',
      header: t('selection.common.status'),
      cell: (row) => <StatusChip enum="final_offer_rounds.status" value={row.status} />,
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('selection.supplierNegotiations.title')}
        subtitle={t('selection.supplierNegotiations.intro')}
      />
      <FilterBar label={t('selection.common.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('selection.common.search')}
          placeholder={t('selection.supplierNegotiations.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('selection.common.status')}
          placeholder={t('selection.common.allStatuses')}
          value={filters.status}
          options={NEGOTIATIONS_STATUS.map((value) => ({
            value,
            label: tEnum('negotiations.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('selection.supplierNegotiations.col.response')}
          placeholder={t('selection.common.all')}
          value={filters.awaiting}
          options={[
            { value: 'true', label: t('selection.supplierNegotiations.responseDue') },
            { value: 'false', label: t('selection.supplierNegotiations.noResponseDue') },
          ]}
          onChange={(awaiting) => setFilters({ awaiting, page: 1 })}
        />
        <Select
          label={t('selection.supplierNegotiations.roundStatus')}
          placeholder={t('selection.common.allStatuses')}
          value={filters.roundStatus}
          options={FINAL_OFFER_ROUNDS_STATUS.map((value) => ({
            value,
            label: tEnum('final_offer_rounds.status', value),
          }))}
          onChange={(roundStatus) => setFilters({ roundStatus })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('selection.supplierNegotiations.kpi.active')}
          icon="handshake"
          value={loadingValue ?? formatCount(all.filter((row) => row.status === 'active').length)}
          hint={t('selection.supplierNegotiations.kpi.activeHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.supplierNegotiations.kpi.awaiting')}
          icon="hourglass"
          tone="warning"
          value={loadingValue ?? formatCount(all.filter((row) => row.awaitingResponse).length)}
          hint={t('selection.supplierNegotiations.kpi.awaitingHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.supplierNegotiations.kpi.rounds')}
          icon="send"
          tone="info"
          value={
            rounds.data === undefined
              ? '…'
              : formatCount(rounds.data.items.filter((row) => row.status === 'issued').length)
          }
          hint={t('selection.supplierNegotiations.kpi.roundsHint')}
          restricted={rounds.error?.kind === 'forbidden'}
        />
        <KpiCard
          label={t('selection.supplierNegotiations.kpi.concluded')}
          icon="checkCircle"
          tone="success"
          value={
            loadingValue ?? formatCount(all.filter((row) => row.status === 'concluded').length)
          }
          hint={t('selection.supplierNegotiations.kpi.concludedHint')}
          restricted={kpiRestricted}
        />
      </KpiGrid>
      <Card title={t('selection.supplierNegotiations.negotiations')} flush>
        <DataTable
          caption={t('selection.supplierNegotiations.negotiations')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.negotiationId)}
          rowLabel={(row) => `${row.tender.reference} ${row.buyer.name}`}
          rowHref={(row) => selectionPaths.supplierNegotiation(row.negotiationId)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered
                  ? t('selection.common.emptyFiltered')
                  : t('selection.supplierNegotiations.empty')
              }
              description={filtered ? undefined : t('selection.supplierNegotiations.emptyHint')}
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
      <Card
        title={t('selection.supplierNegotiations.finalOffers')}
        subtitle={t('selection.supplierNegotiations.finalOffersHint')}
        flush
      >
        <DataTable
          caption={t('selection.supplierNegotiations.finalOffers')}
          columns={roundColumns}
          rows={rounds.data?.items}
          rowKey={(row) => String(row.roundId)}
          rowLabel={(row) => `${row.tender.reference} ${t('selection.finalOffers.round')}`}
          rowHref={(row) => selectionPaths.supplierFinalOffer(row.roundId)}
          loading={rounds.isFetching}
          error={rounds.error}
          onRetry={rounds.reload}
          empty={<EmptyState compact title={t('selection.supplierNegotiations.noFinalOffers')} />}
        />
      </Card>
    </div>
  );
}
