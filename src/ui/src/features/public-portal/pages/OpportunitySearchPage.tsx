/**
 * PUB-02 Opportunity search: title, buyer, category, region, procedure, status, published date and closing date of
 * every PUBLIC notice, with filters, sort and pagination. Closed and cancelled notices stay listed and are labelled
 * explicitly. Filter options and counts cover public notices only (AC-01, BR-43). Visitors subscribe through the
 * appropriate route: a signed-in supplier goes to its subscriptions, others register or sign in. The filters live in
 * the URL so a search can be shared.
 */
import { useSearchParams } from 'react-router';

import { TENDERS_EVENT_TYPE, TENDERS_PROCEDURE, TENDERS_STATUS } from '@contracts/enums';
import { PUBLIC_NOTICE_SORT_FIELDS, publicationEndpoints } from '@contracts/publication';
import type { FilterOption, PublicNoticeSummary } from '@contracts/publication';

import { useApiQuery } from '../../../api/hooks';
import {
  Banner,
  ButtonLink,
  Card,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Reference,
  SearchField,
  Select,
} from '../../../components/ui';
import type { DataTableColumn, SelectOption } from '../../../components/ui';
import { formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { publicationErrorMessage } from '../../publication/lib/errors';
import {
  compact,
  dateOrUndefined,
  directionOf,
  oneOf,
  sortOf,
  tableSort,
} from '../../publication/lib/lists';
import { opportunityPaths, portalPaths } from '../../publication/lib/paths';
import { NoticeStatus } from '../components/PortalBits';
import { usePortalViewer } from '../lib/viewer';

const KEYS = [
  'q',
  'buyer',
  'category',
  'region',
  'procedure',
  'eventType',
  'status',
  'publishedFrom',
  'publishedTo',
  'closingFrom',
  'closingTo',
] as const;
type FilterKey = (typeof KEYS)[number];

const PAGE_SIZE = 25;

function optionsOf(options: readonly FilterOption[] | undefined): SelectOption[] {
  return (options ?? []).map((option) => ({
    value: option.value,
    label: `${option.label} (${option.count})`,
  }));
}

export default function OpportunitySearchPage() {
  const viewer = usePortalViewer();
  const [params, setParams] = useSearchParams();
  const value = (key: FilterKey): string => params.get(key) ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const sort = sortOf(params.get('sort') ?? '', PUBLIC_NOTICE_SORT_FIELDS, 'publishedAt');
  const dir = directionOf(params.get('dir') ?? 'desc');

  const update = (values: Partial<Record<FilterKey | 'page' | 'sort' | 'dir', string>>): void => {
    const next = new URLSearchParams(params);
    for (const [key, raw] of Object.entries(values)) {
      if (raw === undefined || raw === '') next.delete(key);
      else next.set(key, raw);
    }
    if (!('page' in values)) next.delete('page');
    setParams(next, { replace: true });
  };

  const filters = useApiQuery(publicationEndpoints.publicFilters, {});
  const query = useApiQuery(publicationEndpoints.searchPublic, {
    query: compact({
      q: value('q').trim(),
      buyer: value('buyer') === '' ? undefined : [value('buyer')],
      category: value('category') === '' ? undefined : [value('category')],
      region: value('region') === '' ? undefined : [value('region')],
      procedure: oneOf(value('procedure'), TENDERS_PROCEDURE),
      eventType: oneOf(value('eventType'), TENDERS_EVENT_TYPE),
      status: oneOf(value('status'), TENDERS_STATUS),
      publishedFrom: dateOrUndefined(value('publishedFrom')),
      publishedTo: dateOrUndefined(value('publishedTo')),
      closingFrom: dateOrUndefined(value('closingFrom')),
      closingTo: dateOrUndefined(value('closingTo')),
      sort,
      dir,
      page,
      pageSize: PAGE_SIZE,
    }),
  });

  const filtered = KEYS.some((key) => value(key) !== '');
  const dateError =
    query.error?.code === 'INVALID_DATE_RANGE' ? publicationErrorMessage(query.error) : null;

  const columns: DataTableColumn<PublicNoticeSummary>[] = [
    {
      id: 'title',
      header: t('public-portal.search.col.notice'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.reference} to={row.linkPath} />
          <span className="tiq-cell-sub">{row.title}</span>
          {row.amendmentCount > 0 && (
            <span className="tiq-cell-sub tiq-text-warning">
              {t('public-portal.search.amended', { count: row.amendmentCount })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'buyer',
      header: t('public-portal.search.col.buyer'),
      sortable: true,
      cell: (row) => row.buyer.name,
    },
    {
      id: 'category',
      header: t('public-portal.search.col.category'),
      cell: (row) => (
        <>
          <span>{row.category.name}</span>
          <span className="tiq-cell-sub">{row.regions.join(', ')}</span>
        </>
      ),
    },
    {
      id: 'procedure',
      header: t('public-portal.search.col.procedure'),
      cell: (row) => (
        <>
          <span>{tEnum('tenders.procedure', row.procedure)}</span>
          <span className="tiq-cell-sub">{tEnum('tenders.event_type', row.eventType)}</span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('public-portal.search.col.status'),
      cell: (row) => <NoticeStatus notice={row} />,
    },
    {
      id: 'publishedAt',
      header: t('public-portal.search.col.published'),
      sortable: true,
      cell: (row) => formatInstantDate(row.publishedAt, row.buyer.officialTimeZone),
    },
    {
      id: 'closingAt',
      header: t('public-portal.search.col.closing'),
      sortable: true,
      cell: (row) =>
        row.closingAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={row.closingAt} showLocal={false} />
        ),
    },
  ];

  const subscribePath =
    viewer.supplierName !== null ? opportunityPaths.discoveryTab('subscriptions') : null;

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('public-portal.search.title')}
        subtitle={t('public-portal.search.intro')}
        back={{ to: portalPaths.home, label: t('public-portal.actions.backHome') }}
      />
      <FilterBar
        label={t('public-portal.search.filters')}
        onClear={() => setParams({})}
        canClear={filtered}
      >
        <SearchField
          label={t('public-portal.search.keywords')}
          placeholder={t('public-portal.search.placeholder')}
          value={value('q')}
          onChange={(q) => update({ q })}
        />
        <Select
          label={t('public-portal.search.col.buyer')}
          placeholder={t('public-portal.search.all')}
          value={value('buyer')}
          options={optionsOf(filters.data?.buyers)}
          onChange={(buyer) => update({ buyer })}
        />
        <Select
          label={t('public-portal.search.category')}
          placeholder={t('public-portal.search.all')}
          value={value('category')}
          options={optionsOf(filters.data?.categories)}
          onChange={(category) => update({ category })}
        />
        <Select
          label={t('public-portal.search.region')}
          placeholder={t('public-portal.search.all')}
          value={value('region')}
          options={optionsOf(filters.data?.regions)}
          onChange={(region) => update({ region })}
        />
        <Select
          label={t('public-portal.search.col.procedure')}
          placeholder={t('public-portal.search.all')}
          value={value('procedure')}
          options={optionsOf(filters.data?.procedures)}
          onChange={(procedure) => update({ procedure })}
        />
        <Select
          label={t('public-portal.search.eventType')}
          placeholder={t('public-portal.search.all')}
          value={value('eventType')}
          options={optionsOf(filters.data?.eventTypes)}
          onChange={(eventType) => update({ eventType })}
        />
        <Select
          label={t('public-portal.search.col.status')}
          placeholder={t('public-portal.search.all')}
          value={value('status')}
          options={optionsOf(filters.data?.statuses)}
          onChange={(status) => update({ status })}
        />
        <DateInput
          label={t('public-portal.search.publishedFrom')}
          value={value('publishedFrom')}
          onChange={(publishedFrom) => update({ publishedFrom })}
        />
        <DateInput
          label={t('public-portal.search.publishedTo')}
          value={value('publishedTo')}
          onChange={(publishedTo) => update({ publishedTo })}
        />
        <DateInput
          label={t('public-portal.search.closingFrom')}
          value={value('closingFrom')}
          onChange={(closingFrom) => update({ closingFrom })}
        />
        <DateInput
          label={t('public-portal.search.closingTo')}
          value={value('closingTo')}
          onChange={(closingTo) => update({ closingTo })}
        />
      </FilterBar>
      {dateError !== null && <Banner tone="warning">{dateError}</Banner>}

      <Card
        flush
        title={
          query.data === undefined
            ? t('public-portal.search.resultsTitle')
            : t('public-portal.search.results', { count: query.data.total })
        }
        subtitle={t('public-portal.search.statusNote')}
      >
        <DataTable
          caption={t('public-portal.search.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => `${row.buyer.slug}/${row.reference}`}
          rowLabel={(row) => `${row.reference} ${row.title}`}
          rowHref={(row) => row.linkPath}
          loading={query.isFetching}
          error={dateError === null ? query.error : null}
          onRetry={query.reload}
          sort={tableSort(sort, dir)}
          onSortChange={(next) => update({ sort: next.key, dir: next.dir })}
          empty={
            <EmptyState
              compact
              icon="search"
              title={
                filtered ? t('public-portal.search.emptyFiltered') : t('public-portal.search.empty')
              }
              description={t('public-portal.search.emptyHint')}
            />
          }
          pagination={
            query.data === undefined
              ? undefined
              : {
                  page: query.data.page,
                  pageSize: query.data.pageSize,
                  total: query.data.total,
                  onPageChange: (next) => update({ page: String(next) }),
                }
          }
        />
      </Card>

      <Card title={t('public-portal.subscribe.title')}>
        <div className="tiq-stack">
          <p>{t('public-portal.subscribe.body')}</p>
          {subscribePath !== null ? (
            <ButtonLink to={subscribePath} variant="primary" icon="bell">
              {t('public-portal.subscribe.manage', { name: viewer.supplierName ?? '' })}
            </ButtonLink>
          ) : viewer.signedIn ? (
            <p className="tiq-text-muted">{t('public-portal.subscribe.supplierOnly')}</p>
          ) : (
            <div className="tiq-inline">
              <ButtonLink to={portalPaths.register} variant="primary" icon="userPlus">
                {t('public-portal.actions.register')}
              </ButtonLink>
              <ButtonLink to={portalPaths.signIn} icon="logIn">
                {t('public-portal.subscribe.signIn')}
              </ButtonLink>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
