/**
 * BUY-21 — Compliance and exclusions (hub): the tenders whose submissions are open for compliance review, and every
 * exclusion with its grounds, approval, notice and the state of the excluded bid's commercial envelope (AC-17).
 */
import { useSearchParams } from 'react-router';

import { openingEndpoints } from '@contracts/opening';
import type { ExclusionRow, OpeningTenderRow } from '@contracts/opening';
import type { ExclusionsStatus, TendersStatus } from '@contracts/enums';

import { useActiveTenant } from '../../../app/hooks';
import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Card,
  Chip,
  DataTable,
  DateInput,
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
  Tabs,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { oneOf, textOrUndefined, useListState } from '../lib/listState';
import {
  ENVELOPE_STATE_TONE,
  PROGRESS_TONE,
  enumSelectOptions,
  envelopeStateLabel,
  progressLabel,
} from '../lib/options';
import { openingPaths } from '../lib/paths';

const EXCLUSION_PERMISSIONS = ['compliance.assess', 'exclusion.approve'] as const;

function TendersTab() {
  const list = useListState(
    'BUY-21',
    { q: '', status: '', progress: 'opened' },
    { key: 'closedAt' as const, dir: 'desc' },
  );
  const { filters } = list;
  const query = useApiQuery(openingEndpoints.listTenders, {
    query: {
      ...list.paging,
      q: textOrUndefined(filters.q),
      status: oneOf<TendersStatus>(filters.status),
      progress:
        filters.progress === 'opened'
          ? ['partially_opened', 'fully_opened']
          : filters.progress === 'awaiting'
            ? ['awaiting_opening']
            : undefined,
    },
  });

  const columns: DataTableColumn<OpeningTenderRow>[] = [
    {
      id: 'reference',
      header: t('opening.columns.reference'),
      sortable: true,
      cell: (row) => <Reference value={row.reference} to={openingPaths.register(row.tenderId)} />,
    },
    {
      id: 'title',
      header: t('opening.columns.tender'),
      cell: (row) => (
        <>
          {row.title}
          <span className="tiq-cell-sub">{tEnum('tenders.opening_mode', row.openingMode)}</span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('opening.columns.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="tenders.status" value={row.status} />,
    },
    {
      id: 'progress',
      header: t('opening.columns.progress'),
      cell: (row) => <Chip tone={PROGRESS_TONE[row.progress]}>{progressLabel(row.progress)}</Chip>,
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
      id: 'clarifications',
      header: t('opening.columns.openClarifications'),
      numeric: true,
      cell: (row) => formatCount(row.pendingClarifications),
    },
    {
      id: 'exclusions',
      header: t('opening.columns.activeExclusions'),
      numeric: true,
      cell: (row) =>
        row.activeExclusions > 0 ? (
          <span className="tiq-text-danger">{formatCount(row.activeExclusions)}</span>
        ) : (
          formatCount(0)
        ),
    },
    { id: 'owner', header: t('opening.columns.owner'), cell: (row) => row.owner.fullName },
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
            'closed',
            'under_assessment',
            'award_pending',
            'partially_awarded',
            'awarded',
          ])}
        />
        <Select
          label={t('opening.filters.progress')}
          value={filters.progress}
          onChange={(progress) => list.update({ progress })}
          placeholder={t('opening.filters.allProgress')}
          options={[
            { value: 'opened', label: t('opening.compliance.openedOnly') },
            { value: 'awaiting', label: t('opening.progress.awaiting_opening') },
          ]}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('opening.compliance.tendersCaption')}
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
              icon="clipboardCheck"
              title={t('opening.compliance.noTenders')}
              description={t('opening.compliance.noTendersHint')}
            />
          }
          pagination={query.data === undefined ? undefined : list.pagination(query.data.total)}
        />
      </Card>
    </div>
  );
}

function ExclusionsTab() {
  const timeZone = useActiveTenant()?.officialTimeZone ?? 'UTC';
  const list = useListState(
    'BUY-21.exclusions',
    { q: '', status: '', proposedFrom: '', proposedTo: '' },
    { key: 'proposedAt' as const, dir: 'desc' },
  );
  const { filters } = list;
  const query = useApiQuery(openingEndpoints.listExclusions, {
    query: {
      ...list.paging,
      q: textOrUndefined(filters.q),
      status: oneOf<ExclusionsStatus>(filters.status),
      proposedFrom: textOrUndefined(filters.proposedFrom),
      proposedTo: textOrUndefined(filters.proposedTo),
    },
  });

  const columns: DataTableColumn<ExclusionRow>[] = [
    {
      id: 'reference',
      header: t('opening.columns.reference'),
      sortable: true,
      cell: (row) => <Reference value={row.tenderReference} to={openingPaths.exclusion(row.id)} />,
    },
    {
      id: 'supplier',
      header: t('opening.columns.supplier'),
      cell: (row) => (
        <>
          {row.supplier.name}
          <span className="tiq-cell-sub">{row.tenderTitle}</span>
        </>
      ),
    },
    {
      id: 'grounds',
      header: t('opening.columns.grounds'),
      cell: (row) => (row.grounds.length > 120 ? `${row.grounds.slice(0, 120)}…` : row.grounds),
    },
    {
      id: 'status',
      header: t('opening.columns.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="exclusions.status" value={row.status} />,
    },
    {
      id: 'approval',
      header: t('opening.columns.approval'),
      cell: (row) =>
        row.approvalStatus === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <StatusChip enum="approval_requests.status" value={row.approvalStatus} size="sm" />
        ),
    },
    {
      id: 'notice',
      header: t('opening.columns.notice'),
      cell: (row) =>
        row.noticeStatus === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <StatusChip enum="notices.status" value={row.noticeStatus} size="sm" />
        ),
    },
    {
      id: 'commercial',
      header: t('opening.columns.commercialEnvelope'),
      cell: (row) => (
        <Chip tone={ENVELOPE_STATE_TONE[row.commercialEnvelope]} size="sm" icon="lock">
          {envelopeStateLabel(row.commercialEnvelope)}
        </Chip>
      ),
    },
    {
      id: 'proposedAt',
      header: t('opening.columns.proposed'),
      sortable: true,
      cell: (row) => (
        <>
          {row.proposedBy.fullName}
          <span className="tiq-cell-sub">{formatOfficialTime(row.proposedAt, timeZone)}</span>
        </>
      ),
    },
  ];

  return (
    <div className="tiq-stack">
      <FilterBar onClear={list.clear} canClear={list.canClear}>
        <SearchField
          label={t('opening.filters.search')}
          placeholder={t('opening.filters.searchExclusions')}
          value={filters.q}
          onChange={(q) => list.update({ q })}
        />
        <Select
          label={t('opening.filters.status')}
          value={filters.status}
          onChange={(status) => list.update({ status })}
          placeholder={t('opening.filters.allStatuses')}
          options={enumSelectOptions('exclusions.status')}
        />
        <DateInput
          label={t('opening.filters.proposedFrom')}
          value={filters.proposedFrom}
          onChange={(proposedFrom) => list.update({ proposedFrom })}
        />
        <DateInput
          label={t('opening.filters.proposedTo')}
          value={filters.proposedTo}
          onChange={(proposedTo) => list.update({ proposedTo })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('opening.exclusions.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={list.sort}
          onSortChange={list.onSortChange}
          empty={<EmptyState compact icon="shieldCheck" title={t('opening.exclusions.none')} />}
          pagination={query.data === undefined ? undefined : list.pagination(query.data.total)}
        />
      </Card>
    </div>
  );
}

function ComplianceKpis({ exclusions }: { readonly exclusions: boolean }) {
  const count = { page: 1, pageSize: 1 } as const;
  const opened = useApiQuery(openingEndpoints.listTenders, {
    query: { ...count, progress: ['partially_opened', 'fully_opened'] },
  });
  const awaiting = useApiQuery(
    openingEndpoints.listExclusions,
    exclusions ? { query: { ...count, status: ['proposed', 'awaiting_approval'] } } : null,
  );
  const approved = useApiQuery(
    openingEndpoints.listExclusions,
    exclusions ? { query: { ...count, status: ['approved'] } } : null,
  );
  const issued = useApiQuery(openingEndpoints.listClarifications, {
    query: { ...count, status: ['issued'] },
  });
  const value = (total: number | undefined) =>
    total === undefined ? t('opening.kpi.loading') : formatCount(total);
  return (
    <KpiGrid>
      <KpiCard
        label={t('opening.kpi.tendersInReview')}
        value={value(opened.data?.total)}
        icon="clipboardCheck"
        tone="accent"
      />
      <KpiCard
        label={t('opening.kpi.clarificationsOpen')}
        value={value(issued.data?.total)}
        icon="messageQuestion"
        tone="info"
        to={openingPaths.clarifications}
      />
      <KpiCard
        label={t('opening.kpi.exclusionsPending')}
        value={value(awaiting.data?.total)}
        icon="hourglass"
        tone="warning"
        restricted={!exclusions}
      />
      <KpiCard
        label={t('opening.kpi.exclusionsApproved')}
        value={value(approved.data?.total)}
        icon="ban"
        tone="danger"
        restricted={!exclusions}
      />
    </KpiGrid>
  );
}

export default function CompliancePage() {
  const tenant = useActiveTenant();
  const canSeeExclusions = usePermission(EXCLUSION_PERMISSIONS);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'exclusions' && canSeeExclusions ? 'exclusions' : 'tenders';

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('opening.compliance.title')}
        subtitle={t('opening.compliance.subtitle')}
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
      <ComplianceKpis exclusions={canSeeExclusions} />
      <Tabs
        label={t('opening.compliance.tabs')}
        selected={tab}
        onSelect={(id) => setParams(id === 'tenders' ? {} : { tab: id }, { replace: true })}
        tabs={[
          { id: 'tenders', label: t('opening.compliance.tab.tenders') },
          ...(canSeeExclusions
            ? [{ id: 'exclusions', label: t('opening.compliance.tab.exclusions') }]
            : []),
        ]}
      >
        {tab === 'tenders' ? <TendersTab /> : <ExclusionsTab />}
      </Tabs>
    </div>
  );
}
