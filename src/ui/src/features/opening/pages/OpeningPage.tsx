/**
 * BUY-20 — Opening (hub): tenders approaching or in opening and every opening session, with their authority,
 * stage, official times and quorum. Administrators, auditors and operator support hold no opening permission and
 * get the restricted state (AC-15): the route guard and the API both refuse them.
 */
import { useSearchParams } from 'react-router';

import { OPENING_PROGRESS, openingEndpoints } from '@contracts/opening';
import type { OpeningSessionRow, OpeningTenderRow } from '@contracts/opening';
import type {
  OpeningSessionsEnvelope,
  OpeningSessionsStatus,
  TendersOpeningMode,
  TendersStatus,
} from '@contracts/enums';
import type { OpeningProgress } from '@contracts/opening';

import { useActiveTenant, useAppSelector } from '../../../app/hooks';
import { useApiQuery } from '../../../api/hooks';
import {
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
  Tabs,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { oneOf, textOrUndefined, useListState } from '../lib/listState';
import { PROGRESS_TONE, enumSelectOptions, progressLabel, stateOptions } from '../lib/options';
import { openingPaths } from '../lib/paths';

const TABS = ['tenders', 'sessions'] as const;
type Tab = (typeof TABS)[number];

function useTimeZone(): string {
  return useActiveTenant()?.officialTimeZone ?? 'UTC';
}

function TenderFlags({ row }: { readonly row: OpeningTenderRow }) {
  const flags = [];
  if (row.priceGatePending) {
    flags.push(
      <Chip key="gate" tone="warning" size="sm" icon="lock">
        {t('opening.flags.priceGate')}
      </Chip>,
    );
  }
  if (row.pendingClarifications > 0) {
    flags.push(
      <Chip key="clar" tone="info" size="sm">
        {t('opening.flags.clarifications', { count: row.pendingClarifications })}
      </Chip>,
    );
  }
  if (row.activeExclusions > 0) {
    flags.push(
      <Chip key="excl" tone="danger" size="sm">
        {t('opening.flags.exclusions', { count: row.activeExclusions })}
      </Chip>,
    );
  }
  return flags.length === 0 ? null : <span className="tiq-cell-sub tiq-inline">{flags}</span>;
}

function TendersTab() {
  const timeZone = useTimeZone();
  const userId = useAppSelector((state) => state.session.user?.id ?? null);
  const list = useListState(
    'BUY-20',
    {
      q: '',
      status: '',
      openingMode: '',
      progress: '',
      priceGatePending: false as boolean,
      mine: false as boolean,
      closedFrom: '',
      closedTo: '',
    },
    { key: 'deadline' as const, dir: 'asc' },
  );
  const { filters } = list;
  const query = useApiQuery(openingEndpoints.listTenders, {
    query: {
      ...list.paging,
      q: textOrUndefined(filters.q),
      status: oneOf<TendersStatus>(filters.status),
      openingMode: oneOf<TendersOpeningMode>(filters.openingMode),
      progress: oneOf<OpeningProgress>(filters.progress),
      priceGatePending: filters.priceGatePending ? true : undefined,
      ownerUserId: filters.mine && userId !== null ? userId : undefined,
      closedFrom: textOrUndefined(filters.closedFrom),
      closedTo: textOrUndefined(filters.closedTo),
    },
  });

  const columns: DataTableColumn<OpeningTenderRow>[] = [
    {
      id: 'reference',
      header: t('opening.columns.reference'),
      sortable: true,
      cell: (row) => <Reference value={row.reference} to={openingPaths.tender(row.tenderId)} />,
    },
    {
      id: 'title',
      header: t('opening.columns.tender'),
      cell: (row) => (
        <>
          {row.title}
          <span className="tiq-cell-sub">
            {t('opening.hub.tenderSub', {
              procedure: tEnum('tenders.procedure', row.procedure),
              mode: tEnum('tenders.opening_mode', row.openingMode),
              owner: row.owner.fullName,
            })}
          </span>
          <TenderFlags row={row} />
        </>
      ),
    },
    {
      id: 'status',
      header: t('opening.columns.status'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip enum="tenders.status" value={row.status} />
          <span className="tiq-cell-sub">
            <Chip tone={PROGRESS_TONE[row.progress]} size="sm">
              {progressLabel(row.progress)}
            </Chip>
          </span>
        </>
      ),
    },
    {
      id: 'deadline',
      header: t('opening.columns.deadline'),
      sortable: true,
      cell: (row) => (
        <>
          {row.submissionDeadline === null ? (
            <OrDash>{null}</OrDash>
          ) : (
            <OfficialDeadline deadline={row.submissionDeadline} showLocal={false} />
          )}
          {row.closedAt !== null && (
            <span className="tiq-cell-sub">
              {t('opening.hub.closedOn', { at: formatOfficialTime(row.closedAt, timeZone) })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'submissions',
      header: t('opening.columns.submissions'),
      numeric: true,
      cell: (row) => (
        <OrDash>
          {row.effectiveSubmissionCount === null ? null : formatCount(row.effectiveSubmissionCount)}
        </OrDash>
      ),
    },
    {
      id: 'opened',
      header: t('opening.columns.envelopesOpened'),
      cell: (row) =>
        row.envelopesOpened.length === 0 ? (
          <span className="tiq-text-muted">{t('opening.envelopes.noneOpened')}</span>
        ) : (
          row.envelopesOpened
            .map((envelope) => tEnum('tender_envelopes.envelope', envelope))
            .join(', ')
        ),
    },
    {
      id: 'next',
      header: t('opening.columns.nextSession'),
      cell: (row) =>
        row.nextSession === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <Reference
              value={tEnum('opening_sessions.envelope', row.nextSession.envelope)}
              to={openingPaths.session(row.nextSession.sessionId)}
            />
            <span className="tiq-cell-sub">
              <OfficialDeadline deadline={row.nextSession.scheduledAt} showLocal={false} />
            </span>
          </>
        ),
    },
  ];

  return (
    <div className="tiq-stack">
      <FilterBar onClear={list.clear} canClear={list.canClear}>
        <SearchField
          label={t('opening.filters.search')}
          placeholder={t('opening.filters.searchTenders')}
          value={filters.q}
          onChange={(q) => list.update({ q })}
        />
        <Select
          label={t('opening.filters.status')}
          value={filters.status}
          onChange={(status) => list.update({ status })}
          placeholder={t('opening.filters.allStatuses')}
          options={enumSelectOptions('tenders.status', [
            'open',
            'closed',
            'under_assessment',
            'award_pending',
            'partially_awarded',
            'awarded',
          ])}
        />
        <Select
          label={t('opening.filters.openingMode')}
          value={filters.openingMode}
          onChange={(openingMode) => list.update({ openingMode })}
          placeholder={t('opening.filters.allModes')}
          options={enumSelectOptions('tenders.opening_mode')}
        />
        <Select
          label={t('opening.filters.progress')}
          value={filters.progress}
          onChange={(progress) => list.update({ progress })}
          placeholder={t('opening.filters.allProgress')}
          options={stateOptions('progress', OPENING_PROGRESS)}
        />
        <DateInput
          label={t('opening.filters.closedFrom')}
          value={filters.closedFrom}
          onChange={(closedFrom) => list.update({ closedFrom })}
        />
        <DateInput
          label={t('opening.filters.closedTo')}
          value={filters.closedTo}
          onChange={(closedTo) => list.update({ closedTo })}
        />
        <Checkbox
          label={t('opening.filters.priceGatePending')}
          checked={filters.priceGatePending}
          onChange={(priceGatePending) => list.update({ priceGatePending })}
        />
        <Checkbox
          label={t('opening.filters.myTenders')}
          checked={filters.mine}
          onChange={(mine) => list.update({ mine })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('opening.hub.tendersCaption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.tenderId)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={list.sort}
          onSortChange={list.onSortChange}
          empty={
            <EmptyState
              compact
              icon="lock"
              title={t('opening.hub.noTenders')}
              description={t('opening.hub.noTendersHint')}
            />
          }
          pagination={query.data === undefined ? undefined : list.pagination(query.data.total)}
        />
      </Card>
    </div>
  );
}

function SessionsTab() {
  const timeZone = useTimeZone();
  const userId = useAppSelector((state) => state.session.user?.id ?? null);
  const list = useListState(
    'BUY-20.sessions',
    {
      q: '',
      status: '',
      envelope: '',
      mine: false as boolean,
      scheduledFrom: '',
      scheduledTo: '',
    },
    { key: 'scheduledAt' as const, dir: 'asc' },
  );
  const { filters } = list;
  const query = useApiQuery(openingEndpoints.listSessions, {
    query: {
      ...list.paging,
      q: textOrUndefined(filters.q),
      status: oneOf<OpeningSessionsStatus>(filters.status),
      envelope: oneOf<OpeningSessionsEnvelope>(filters.envelope),
      officerUserId: filters.mine && userId !== null ? userId : undefined,
      scheduledFrom: textOrUndefined(filters.scheduledFrom),
      scheduledTo: textOrUndefined(filters.scheduledTo),
    },
  });

  const columns: DataTableColumn<OpeningSessionRow>[] = [
    {
      id: 'reference',
      header: t('opening.columns.reference'),
      sortable: true,
      cell: (row) => <Reference value={row.tenderReference} to={openingPaths.session(row.id)} />,
    },
    {
      id: 'tender',
      header: t('opening.columns.tender'),
      cell: (row) => (
        <>
          {row.tenderTitle}
          <span className="tiq-cell-sub">
            {row.lot === null
              ? t('opening.lot.whole')
              : t('opening.lot.label', { number: row.lot.lotNo, title: row.lot.title })}
          </span>
        </>
      ),
    },
    {
      id: 'envelope',
      header: t('opening.columns.envelope'),
      cell: (row) => tEnum('opening_sessions.envelope', row.envelope),
    },
    {
      id: 'status',
      header: t('opening.columns.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="opening_sessions.status" value={row.status} />,
    },
    {
      id: 'scheduledAt',
      header: t('opening.columns.scheduledAt'),
      sortable: true,
      cell: (row) => <OfficialDeadline deadline={row.scheduledAt} showLocal={false} />,
    },
    {
      id: 'openedAt',
      header: t('opening.columns.openedAt'),
      sortable: true,
      cell: (row) => (
        <OrDash>{row.openedAt === null ? null : formatOfficialTime(row.openedAt, timeZone)}</OrDash>
      ),
    },
    {
      id: 'officer',
      header: t('opening.columns.officer'),
      cell: (row) => row.openingOfficer.fullName,
    },
    {
      id: 'quorum',
      header: t('opening.columns.quorum'),
      cell: (row) => (
        <Chip tone={row.quorum.met ? 'success' : 'warning'} size="sm">
          {t('opening.quorum.short', {
            confirmed: row.quorum.confirmed,
            required: row.quorum.required,
          })}
        </Chip>
      ),
    },
    {
      id: 'envelopesOpened',
      header: t('opening.columns.unsealRecords'),
      numeric: true,
      cell: (row) => formatCount(row.envelopesOpened),
    },
    {
      id: 'public',
      header: t('opening.columns.publicSummary'),
      cell: (row) =>
        row.publicReleaseApproved ? (
          <Chip tone="success" size="sm">
            {t('opening.session.publicReleased')}
          </Chip>
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
  ];

  return (
    <div className="tiq-stack">
      <FilterBar onClear={list.clear} canClear={list.canClear}>
        <SearchField
          label={t('opening.filters.search')}
          placeholder={t('opening.filters.searchSessions')}
          value={filters.q}
          onChange={(q) => list.update({ q })}
        />
        <Select
          label={t('opening.filters.status')}
          value={filters.status}
          onChange={(status) => list.update({ status })}
          placeholder={t('opening.filters.allStatuses')}
          options={enumSelectOptions('opening_sessions.status')}
        />
        <Select
          label={t('opening.filters.envelope')}
          value={filters.envelope}
          onChange={(envelope) => list.update({ envelope })}
          placeholder={t('opening.filters.allEnvelopes')}
          options={enumSelectOptions('opening_sessions.envelope')}
        />
        <DateInput
          label={t('opening.filters.scheduledFrom')}
          value={filters.scheduledFrom}
          onChange={(scheduledFrom) => list.update({ scheduledFrom })}
        />
        <DateInput
          label={t('opening.filters.scheduledTo')}
          value={filters.scheduledTo}
          onChange={(scheduledTo) => list.update({ scheduledTo })}
        />
        <Checkbox
          label={t('opening.filters.mySessions')}
          checked={filters.mine}
          onChange={(mine) => list.update({ mine })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('opening.hub.sessionsCaption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={list.sort}
          onSortChange={list.onSortChange}
          empty={<EmptyState compact icon="calendar" title={t('opening.hub.noSessions')} />}
          pagination={query.data === undefined ? undefined : list.pagination(query.data.total)}
        />
      </Card>
    </div>
  );
}

function HubKpis() {
  const count = { page: 1, pageSize: 1 } as const;
  const awaiting = useApiQuery(openingEndpoints.listTenders, {
    query: { ...count, progress: ['awaiting_opening'] },
  });
  const partial = useApiQuery(openingEndpoints.listTenders, {
    query: { ...count, progress: ['partially_opened'] },
  });
  const gate = useApiQuery(openingEndpoints.listTenders, {
    query: { ...count, priceGatePending: true },
  });
  const quorum = useApiQuery(openingEndpoints.listSessions, {
    query: { ...count, status: ['awaiting_quorum'] },
  });
  const value = (total: number | undefined) =>
    total === undefined ? t('opening.kpi.loading') : formatCount(total);
  return (
    <KpiGrid>
      <KpiCard
        label={t('opening.kpi.awaitingOpening')}
        value={value(awaiting.data?.total)}
        icon="lock"
        tone="warning"
        hint={t('opening.kpi.awaitingOpeningHint')}
      />
      <KpiCard
        label={t('opening.kpi.partiallyOpened')}
        value={value(partial.data?.total)}
        icon="unlock"
        tone="info"
        hint={t('opening.kpi.partiallyOpenedHint')}
      />
      <KpiCard
        label={t('opening.kpi.priceGatePending')}
        value={value(gate.data?.total)}
        icon="shield"
        tone="danger"
        hint={t('opening.kpi.priceGatePendingHint')}
      />
      <KpiCard
        label={t('opening.kpi.awaitingQuorum')}
        value={value(quorum.data?.total)}
        icon="users"
        tone="accent"
        hint={t('opening.kpi.awaitingQuorumHint')}
      />
    </KpiGrid>
  );
}

export default function OpeningPage() {
  const tenant = useActiveTenant();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = requested === 'sessions' ? 'sessions' : 'tenders';

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('opening.hub.title')}
        subtitle={t('opening.hub.subtitle')}
        meta={
          tenant === null ? undefined : (
            <span className="tiq-text-muted">
              {t('opening.hub.context', {
                organization: tenant.name,
                capacity: tenant.capacity ?? '',
              })}
            </span>
          )
        }
      />
      <HubKpis />
      <Tabs
        label={t('opening.hub.tabs')}
        selected={tab}
        onSelect={(id) => setParams(id === 'tenders' ? {} : { tab: id }, { replace: true })}
        tabs={TABS.map((id) => ({ id, label: t(`opening.hub.tab.${id}`) }))}
      >
        {tab === 'tenders' ? <TendersTab /> : <SessionsTab />}
      </Tabs>
    </div>
  );
}
