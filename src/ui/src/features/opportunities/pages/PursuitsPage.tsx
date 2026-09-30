/**
 * SUP-09 pursuits register: every private pursuit of the supplier organization with its decision, attractiveness,
 * effort, owner, team size and the intent the buyer can see (shared only through "Notify buyer", DD-41).
 */
import { useNavigate } from 'react-router';

import { PURSUITS_DECISION } from '@contracts/enums';
import { PURSUIT_SORT_FIELDS, publicationEndpoints } from '@contracts/publication';
import type { PursuitRow } from '@contracts/publication';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Card,
  Checkbox,
  DataTable,
  DateInput,
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
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useOfficialTimeZone } from '../../publication/lib/hooks';
import {
  compact,
  dateOrUndefined,
  directionOf,
  oneOf,
  paginationOf,
  sortOf,
  tableSort,
} from '../../publication/lib/lists';
import { opportunityPaths } from '../../publication/lib/paths';

const DEFAULTS = {
  q: '',
  decision: '',
  mine: false,
  closingFrom: '',
  closingTo: '',
  sort: 'closingAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

export default function PursuitsPage() {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-09', DEFAULTS);
  const query = useApiQuery(publicationEndpoints.listPursuits, {
    query: compact({
      q: filters.q.trim(),
      decision: oneOf(filters.decision, PURSUITS_DECISION),
      mine: filters.mine,
      closingFrom: dateOrUndefined(filters.closingFrom),
      closingTo: dateOrUndefined(filters.closingTo),
      sort: sortOf(filters.sort, PURSUIT_SORT_FIELDS, 'closingAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(publicationEndpoints.listPursuits, { query: { pageSize: 100 } });
  const all = overview.data?.items ?? [];
  const kpi = (value: number): string => (overview.data === undefined ? '…' : formatCount(value));
  const restricted = overview.error?.kind === 'forbidden';

  const filtered =
    filters.q !== '' ||
    filters.decision !== '' ||
    filters.mine ||
    filters.closingFrom !== '' ||
    filters.closingTo !== '';

  const columns: DataTableColumn<PursuitRow>[] = [
    {
      id: 'title',
      header: t('opportunities.discover.col.opportunity'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.tender.reference} to={row.linkPath} />
          <span className="tiq-cell-sub">{row.tender.title}</span>
          <span className="tiq-cell-sub">{row.buyer.name}</span>
        </>
      ),
    },
    {
      id: 'decision',
      header: t('opportunities.pursuits.col.decision'),
      cell: (row) => <StatusChip enum="pursuits.decision" value={row.decision} size="sm" />,
    },
    {
      id: 'attractiveness',
      header: t('opportunities.pursuits.col.attractiveness'),
      sortable: true,
      numeric: true,
      cell: (row) => (
        <OrDash>
          {row.attractiveness === null
            ? null
            : t('opportunities.pursuits.rating', { value: row.attractiveness })}
        </OrDash>
      ),
    },
    {
      id: 'effort',
      header: t('opportunities.pursuits.col.effort'),
      numeric: true,
      cell: (row) => (
        <OrDash>
          {row.estimatedEffortHours === null
            ? null
            : t('opportunities.pursuits.hours', { count: row.estimatedEffortHours })}
        </OrDash>
      ),
    },
    {
      id: 'owner',
      header: t('opportunities.pursuits.col.owner'),
      cell: (row) => (
        <>
          <OrDash>{row.pursuitOwner?.fullName}</OrDash>
          <span className="tiq-cell-sub">
            {t('opportunities.pursuits.team', { count: row.teamSize })}
          </span>
        </>
      ),
    },
    {
      id: 'intent',
      header: t('opportunities.pursuits.col.intent'),
      cell: (row) =>
        row.bidIntent === null ? (
          <span className="tiq-text-muted">{t('opportunities.pursuits.notParticipant')}</span>
        ) : (
          <StatusChip enum="participants.bid_intent" value={row.bidIntent} size="sm" />
        ),
    },
    {
      id: 'closingAt',
      header: t('opportunities.discover.col.closing'),
      sortable: true,
      cell: (row) =>
        row.closingAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={row.closingAt} showLocal={false} />
        ),
    },
    {
      id: 'updatedAt',
      header: t('opportunities.pursuits.col.updated'),
      sortable: true,
      cell: (row) => formatDateTime(row.updatedAt, timeZone),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('opportunities.pursuits.title')}
        subtitle={t('opportunities.pursuits.intro')}
      />
      <FilterBar
        label={t('opportunities.pursuits.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('opportunities.common.search')}
          placeholder={t('opportunities.discover.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('opportunities.pursuits.col.decision')}
          placeholder={t('opportunities.common.all')}
          value={filters.decision}
          options={PURSUITS_DECISION.map((value) => ({
            value,
            label: tEnum('pursuits.decision', value),
          }))}
          onChange={(decision) => setFilters({ decision, page: 1 })}
        />
        <DateInput
          label={t('opportunities.discover.closingFrom')}
          value={filters.closingFrom}
          onChange={(closingFrom) => setFilters({ closingFrom, page: 1 })}
        />
        <DateInput
          label={t('opportunities.discover.closingTo')}
          value={filters.closingTo}
          onChange={(closingTo) => setFilters({ closingTo, page: 1 })}
        />
        <Checkbox
          label={t('opportunities.pursuits.mine')}
          checked={filters.mine}
          onChange={(mine) => setFilters({ mine, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('opportunities.pursuits.kpi.bid')}
          icon="target"
          tone="success"
          value={kpi(all.filter((row) => row.decision === 'bid').length)}
          hint={t('opportunities.pursuits.kpi.bidHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('opportunities.pursuits.kpi.undecided')}
          icon="hourglass"
          tone="warning"
          value={kpi(all.filter((row) => row.decision === 'undecided').length)}
          hint={t('opportunities.pursuits.kpi.undecidedHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('opportunities.pursuits.kpi.noBid')}
          icon="ban"
          value={kpi(all.filter((row) => row.decision === 'no_bid').length)}
          hint={t('opportunities.pursuits.kpi.noBidHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('opportunities.pursuits.kpi.unshared')}
          icon="send"
          tone="info"
          value={kpi(
            all.filter((row) => row.decision !== 'undecided' && row.bidIntent === 'undecided')
              .length,
          )}
          hint={t('opportunities.pursuits.kpi.unsharedHint')}
          restricted={restricted}
        />
      </KpiGrid>
      <Card flush title={t('opportunities.pursuits.tableTitle')}>
        <DataTable
          caption={t('opportunities.pursuits.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => `${row.tender.reference} ${row.tender.title}`}
          onRowClick={(row) => void navigate(opportunityPaths.pursuit(row.tender.tenderId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="target"
              title={
                filtered
                  ? t('opportunities.pursuits.emptyFiltered')
                  : t('opportunities.pursuits.empty')
              }
              description={filtered ? undefined : t('opportunities.pursuits.emptyHint')}
            />
          }
          pagination={paginationOf(query.data, setFilters)}
        />
      </Card>
    </div>
  );
}
