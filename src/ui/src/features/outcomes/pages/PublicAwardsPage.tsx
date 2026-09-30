/**
 * PUB-05 — Award search: published, redacted award notices across buyers, with the buyer, event, awarded lots,
 * supplier names, disclosed values and publication date. Only approved public notices appear; unpublished contract
 * schedules and losing bids are never exposed (BR-34).
 */
import { useNavigate } from 'react-router';

import { PUBLIC_AWARD_SORT_FIELDS, listPublicAwards } from '@contracts/awards';
import type { PublicAwardRow } from '@contracts/awards';
import { LOT_OUTCOMES_OUTCOME, TENDERS_EVENT_TYPE } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Card,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  MoneyText,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { browserTimeZone, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { compact, dateOf, directionOf, oneOf, sortOf, tableSort } from '../../awards/lib/lists';
import { outcomePaths } from '../lib/paths';

const DEFAULTS = {
  q: '',
  buyerSlug: '',
  outcome: '',
  eventType: '',
  publishedFrom: '',
  publishedTo: '',
  sort: 'publishedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function PublicAwardsPage() {
  const navigate = useNavigate();
  const zone = browserTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('PUB-05', DEFAULTS);

  const query = useApiQuery(listPublicAwards, {
    query: compact({
      q: filters.q.trim(),
      buyerSlug: filters.buyerSlug === '' ? undefined : filters.buyerSlug,
      outcome: oneOf(filters.outcome, LOT_OUTCOMES_OUTCOME),
      eventType: oneOf(filters.eventType, TENDERS_EVENT_TYPE),
      publishedFrom: dateOf(filters.publishedFrom),
      publishedTo: dateOf(filters.publishedTo),
      sort: sortOf(filters.sort, PUBLIC_AWARD_SORT_FIELDS, 'publishedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const buyersQuery = useApiQuery(listPublicAwards, { query: { pageSize: 100 } });
  const buyers = [
    ...new Map((buyersQuery.data?.items ?? []).map((row) => [row.buyer.slug, row.buyer.name])),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  const filtered =
    filters.q !== '' ||
    filters.buyerSlug !== '' ||
    filters.outcome !== '' ||
    filters.eventType !== '' ||
    filters.publishedFrom !== '' ||
    filters.publishedTo !== '';

  const columns: DataTableColumn<PublicAwardRow>[] = [
    {
      id: 'reference',
      header: t('outcomes.public.col.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.reference} />
          <span className="tiq-cell-sub">{row.title}</span>
        </>
      ),
    },
    { id: 'buyer', header: t('outcomes.public.col.buyer'), cell: (row) => row.buyer.name },
    {
      id: 'eventType',
      header: t('outcomes.public.col.event'),
      cell: (row) => tEnum('tenders.event_type', row.eventType),
    },
    {
      id: 'status',
      header: t('outcomes.public.col.status'),
      cell: (row) => <StatusChip enum="tenders.status" value={row.tenderStatus} />,
    },
    {
      id: 'suppliers',
      header: t('outcomes.public.col.suppliers'),
      cell: (row) => {
        const names = [
          ...new Set(row.lots.map((lot) => lot.supplierName).filter((name) => name !== null)),
        ];
        return names.length === 0 ? (
          <span className="tiq-text-muted">{t('outcomes.public.noSupplier')}</span>
        ) : (
          names.join(', ')
        );
      },
    },
    {
      id: 'value',
      header: t('outcomes.public.col.value'),
      numeric: true,
      cell: (row) =>
        !row.disclosedValues || row.totalAwardedValue === null ? (
          <span className="tiq-text-muted">{t('outcomes.public.notDisclosed')}</span>
        ) : (
          <MoneyText value={row.totalAwardedValue} />
        ),
    },
    {
      id: 'publishedAt',
      header: t('outcomes.public.col.published'),
      sortable: true,
      cell: (row) => formatInstantDate(row.publishedAt, zone),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader title={t('outcomes.public.title')} subtitle={t('outcomes.public.intro')} />
      <FilterBar label={t('outcomes.public.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('outcomes.common.search')}
          placeholder={t('outcomes.public.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('outcomes.public.filter.buyer')}
          placeholder={t('outcomes.public.filter.allBuyers')}
          value={filters.buyerSlug}
          options={buyers.map(([value, label]) => ({ value, label }))}
          onChange={(buyerSlug) => setFilters({ buyerSlug, page: 1 })}
        />
        <Select
          label={t('outcomes.public.filter.outcome')}
          placeholder={t('outcomes.public.filter.allOutcomes')}
          value={filters.outcome}
          options={LOT_OUTCOMES_OUTCOME.map((value) => ({
            value,
            label: tEnum('lot_outcomes.outcome', value),
          }))}
          onChange={(outcome) => setFilters({ outcome, page: 1 })}
        />
        <Select
          label={t('outcomes.public.filter.event')}
          placeholder={t('outcomes.public.filter.allEvents')}
          value={filters.eventType}
          options={TENDERS_EVENT_TYPE.map((value) => ({
            value,
            label: tEnum('tenders.event_type', value),
          }))}
          onChange={(eventType) => setFilters({ eventType, page: 1 })}
        />
        <DateInput
          label={t('outcomes.public.filter.publishedFrom')}
          value={filters.publishedFrom}
          onChange={(publishedFrom) => setFilters({ publishedFrom, page: 1 })}
        />
        <DateInput
          label={t('outcomes.public.filter.publishedTo')}
          value={filters.publishedTo}
          onChange={(publishedTo) => setFilters({ publishedTo, page: 1 })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('outcomes.public.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => `${row.buyer.slug}-${row.reference}`}
          rowLabel={(row) => `${row.reference} ${row.title}`}
          onRowClick={(row) =>
            void navigate(outcomePaths.publicAward(row.buyer.slug, row.reference))
          }
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="award"
              title={filtered ? t('outcomes.public.emptyFiltered') : t('outcomes.public.empty')}
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
    </div>
  );
}
