/**
 * BUY-14 Publication and distribution: the register of every publication of the buyer's tenders (portal and
 * external notice channels), with the release queue of tenders awaiting publication. Unconfirmed or failed external
 * notices are flagged: a tender is advertised only when every external channel is confirmed and reconciled
 * (FR-08, AC-33).
 */
import { useNavigate } from 'react-router';

import { PUBLICATIONS_CHANNEL, PUBLICATIONS_STATUS } from '@contracts/enums';
import { PUBLICATION_SORT_FIELDS, publicationEndpoints } from '@contracts/publication';
import type { PublicationRow } from '@contracts/publication';
import { listTenders } from '@contracts/tenders';
import type { TenderRow } from '@contracts/tenders';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  ButtonLink,
  Card,
  Checkbox,
  Chip,
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
import { formatCount, formatDateTime, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useOfficialTimeZone } from '../lib/hooks';
import {
  compact,
  dateOrUndefined,
  directionOf,
  idOrUndefined,
  oneOf,
  paginationOf,
  sortOf,
  tableSort,
} from '../lib/lists';
import { publicationPaths } from '../lib/paths';

const DEFAULTS = {
  q: '',
  tenderId: '',
  channel: '',
  status: '',
  needsAttention: false,
  from: '',
  to: '',
  sort: 'updatedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

/** Tender states that still need a publication decision. */
const QUEUE_STATUSES: readonly TenderRow['status'][] = ['ready', 'awaiting_release_approval'];

function needsAttention(row: PublicationRow): boolean {
  return (
    (row.exception !== null && row.exception.status !== 'reconciled') ||
    (row.channel === 'external_notice' &&
      row.isCurrentVersion &&
      (row.status === 'failed' ||
        (row.publishedAt !== null && !(row.status === 'confirmed' && row.reconciled))))
  );
}

export default function PublicationRegisterPage() {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-14', DEFAULTS);

  const query = useApiQuery(publicationEndpoints.listPublications, {
    query: compact({
      q: filters.q.trim(),
      tenderId: idOrUndefined(filters.tenderId),
      channel: oneOf(filters.channel, PUBLICATIONS_CHANNEL),
      status: oneOf(filters.status, PUBLICATIONS_STATUS),
      needsAttention: filters.needsAttention,
      from: dateOrUndefined(filters.from),
      to: dateOrUndefined(filters.to),
      sort: sortOf(filters.sort, PUBLICATION_SORT_FIELDS, 'updatedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(publicationEndpoints.listPublications, {
    query: { pageSize: 100 },
  });
  const tenders = useApiQuery(listTenders, { query: { pageSize: 100 } });

  const all = overview.data?.items ?? [];
  const kpi = (value: number): string => (overview.data === undefined ? '…' : formatCount(value));
  const restricted = overview.error?.kind === 'forbidden';
  const attention = all.filter(needsAttention).length;
  const awaiting = all.filter(
    (row) => row.isCurrentVersion && row.status === 'awaiting_confirmation',
  ).length;
  const scheduled = all.filter((row) => row.status === 'scheduled').length;
  const published = all.filter(
    (row) => row.isCurrentVersion && (row.status === 'published' || row.status === 'confirmed'),
  ).length;

  const queue = (tenders.data?.items ?? []).filter((row) => QUEUE_STATUSES.includes(row.status));
  const tenderOptions = (tenders.data?.items ?? [])
    .filter((row) => row.status !== 'draft')
    .map((row) => ({ value: String(row.id), label: `${row.reference} · ${row.title}` }));

  const filtered =
    filters.q !== '' ||
    filters.tenderId !== '' ||
    filters.channel !== '' ||
    filters.status !== '' ||
    filters.needsAttention ||
    filters.from !== '' ||
    filters.to !== '';

  const columns: DataTableColumn<PublicationRow>[] = [
    {
      id: 'tender',
      header: t('publication.register.col.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference
            value={row.tender.reference}
            to={publicationPaths.tender(row.tender.tenderId)}
          />
          <span className="tiq-cell-sub">{row.tender.title}</span>
        </>
      ),
    },
    {
      id: 'version',
      header: t('publication.register.col.version'),
      cell: (row) => (
        <span className="tiq-inline">
          {t('publication.common.versionNo', { no: row.versionNo })}
          {!row.isCurrentVersion && (
            <Chip tone="neutral" size="sm">
              {t('publication.common.superseded')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'channel',
      header: t('publication.register.col.channel'),
      cell: (row) => (
        <>
          <span>{tEnum('publications.channel', row.channel)}</span>
          {row.channelName !== null && <span className="tiq-cell-sub">{row.channelName}</span>}
        </>
      ),
    },
    {
      id: 'status',
      header: t('publication.register.col.status'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip enum="publications.status" value={row.status} />
          {needsAttention(row) && (
            <Chip tone="danger" outlined size="sm" icon="alertTriangle">
              {t('publication.common.notAdvertised')}
            </Chip>
          )}
        </>
      ),
    },
    {
      id: 'scheduledAt',
      header: t('publication.register.col.scheduled'),
      sortable: true,
      cell: (row) => <OrDash>{formatScheduled(row.scheduledAt, timeZone)}</OrDash>,
    },
    {
      id: 'publishedAt',
      header: t('publication.register.col.published'),
      sortable: true,
      cell: (row) => <OrDash>{formatScheduled(row.publishedAt, timeZone)}</OrDash>,
    },
    {
      id: 'confirmation',
      header: t('publication.register.col.confirmation'),
      cell: (row) =>
        row.channel === 'portal' ? (
          <span className="tiq-text-muted">{t('publication.common.portalNoConfirmation')}</span>
        ) : row.confirmationReceivedAt !== null ? (
          <>
            <span>{formatDateTime(row.confirmationReceivedAt, timeZone)}</span>
            <span className="tiq-cell-sub tiq-mono">{row.externalReference}</span>
          </>
        ) : (
          <span className="tiq-text-warning">{t('publication.common.notConfirmed')}</span>
        ),
    },
    {
      id: 'exception',
      header: t('publication.register.col.exception'),
      cell: (row) =>
        row.exception === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <StatusChip
              enum="integration_exceptions.status"
              value={row.exception.status}
              size="sm"
            />
            <span className="tiq-cell-sub">
              {row.exception.owner?.fullName ?? t('publication.common.unassigned')}
            </span>
          </>
        ),
    },
    {
      id: 'updatedAt',
      header: t('publication.register.col.updated'),
      sortable: true,
      cell: (row) => formatDateTime(row.updatedAt, timeZone),
    },
  ];

  const queueColumns: DataTableColumn<TenderRow>[] = [
    {
      id: 'reference',
      header: t('publication.register.col.tender'),
      cell: (row) => (
        <>
          <Reference value={row.reference} to={publicationPaths.tender(row.id)} />
          <span className="tiq-cell-sub">{row.title}</span>
        </>
      ),
    },
    {
      id: 'participation',
      header: t('publication.register.col.audience'),
      cell: (row) => tEnum('tenders.participation', row.participation),
    },
    {
      id: 'status',
      header: t('publication.register.col.tenderStatus'),
      cell: (row) => <StatusChip enum="tenders.status" value={row.status} />,
    },
    {
      id: 'approval',
      header: t('publication.register.col.releaseApproval'),
      cell: (row) =>
        row.releaseApprovalStatus === null ? (
          <span className="tiq-text-warning">{t('publication.common.noReleaseApproval')}</span>
        ) : (
          <StatusChip enum="approval_requests.status" value={row.releaseApprovalStatus} size="sm" />
        ),
    },
    {
      id: 'scheduled',
      header: t('publication.register.col.scheduledRelease'),
      cell: (row) => <OrDash>{formatScheduled(row.scheduledReleaseAt, timeZone)}</OrDash>,
    },
    {
      id: 'deadline',
      header: t('publication.register.col.deadline'),
      cell: (row) =>
        row.submissionDeadline === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <OfficialDeadline deadline={row.submissionDeadline} showLocal={false} />
        ),
    },
    {
      id: 'owner',
      header: t('publication.register.col.owner'),
      cell: (row) => row.owner.fullName,
    },
    {
      id: 'open',
      header: <span className="tiq-visually-hidden">{t('publication.register.col.actions')}</span>,
      cell: (row) => (
        <ButtonLink to={publicationPaths.tender(row.id)} size="sm" iconAfter="arrowRight">
          {t('publication.register.openPublication')}
        </ButtonLink>
      ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('publication.register.title')}
        subtitle={t('publication.register.intro')}
      />
      <FilterBar
        label={t('publication.register.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('publication.common.search')}
          placeholder={t('publication.register.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('publication.register.filter.tender')}
          placeholder={t('publication.common.allTenders')}
          value={filters.tenderId}
          options={tenderOptions}
          onChange={(tenderId) => setFilters({ tenderId, page: 1 })}
        />
        <Select
          label={t('publication.register.filter.channel')}
          placeholder={t('publication.common.all')}
          value={filters.channel}
          options={PUBLICATIONS_CHANNEL.map((value) => ({
            value,
            label: tEnum('publications.channel', value),
          }))}
          onChange={(channel) => setFilters({ channel, page: 1 })}
        />
        <Select
          label={t('publication.register.filter.status')}
          placeholder={t('publication.common.all')}
          value={filters.status}
          options={PUBLICATIONS_STATUS.map((value) => ({
            value,
            label: tEnum('publications.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <DateInput
          label={t('publication.register.filter.from')}
          value={filters.from}
          onChange={(from) => setFilters({ from, page: 1 })}
        />
        <DateInput
          label={t('publication.register.filter.to')}
          value={filters.to}
          onChange={(to) => setFilters({ to, page: 1 })}
        />
        <Checkbox
          label={t('publication.register.filter.needsAttention')}
          checked={filters.needsAttention}
          onChange={(value) => setFilters({ needsAttention: value, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('publication.register.kpi.attention')}
          icon="alertTriangle"
          tone={attention > 0 ? 'danger' : 'success'}
          value={kpi(attention)}
          hint={t('publication.register.kpi.attentionHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('publication.register.kpi.awaiting')}
          icon="hourglass"
          tone="warning"
          value={kpi(awaiting)}
          hint={t('publication.register.kpi.awaitingHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('publication.register.kpi.scheduled')}
          icon="calendar"
          tone="info"
          value={kpi(scheduled)}
          hint={t('publication.register.kpi.scheduledHint')}
          restricted={restricted}
        />
        <KpiCard
          label={t('publication.register.kpi.published')}
          icon="megaphone"
          value={kpi(published)}
          hint={t('publication.register.kpi.publishedHint')}
          restricted={restricted}
        />
      </KpiGrid>
      <Card
        flush
        title={t('publication.register.queueTitle')}
        subtitle={t('publication.register.queueIntro')}
      >
        <DataTable
          caption={t('publication.register.queueCaption')}
          columns={queueColumns}
          rows={tenders.status === 'success' ? queue : undefined}
          rowKey={(row) => String(row.id)}
          loading={tenders.isFetching}
          error={tenders.error}
          onRetry={tenders.reload}
          restricted={
            tenders.error?.kind === 'forbidden' ? t('publication.register.queueRestricted') : false
          }
          empty={
            <EmptyState compact icon="checkCircle" title={t('publication.register.queueEmpty')} />
          }
        />
      </Card>
      <Card flush title={t('publication.register.tableTitle')}>
        <DataTable
          caption={t('publication.register.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) =>
            `${row.tender.reference} ${tEnum('publications.channel', row.channel)} ${t('publication.common.versionNo', { no: row.versionNo })}`
          }
          onRowClick={(row) => void navigate(publicationPaths.tender(row.tender.tenderId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="megaphone"
              title={
                filtered ? t('publication.register.emptyFiltered') : t('publication.register.empty')
              }
              description={filtered ? undefined : t('publication.register.emptyHint')}
            />
          }
          pagination={paginationOf(query.data, setFilters)}
        />
      </Card>
    </div>
  );
}

/** A release or publication time in the buyer's official time, with its offset and zone (DD-33). */
function formatScheduled(at: string | null, timeZone: string): string | null {
  return at === null ? null : formatOfficialTime(at, timeZone);
}
