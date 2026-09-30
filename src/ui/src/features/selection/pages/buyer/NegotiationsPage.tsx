/**
 * BUY-27 — Negotiations: every negotiation with its authorized topics, negotiators, commercial authority, mandate
 * approval, round history and status. Negotiation requires explicit procedural authority (BR-30); where it is not
 * permitted the action is refused with the reason (AC-23).
 */
import { useNavigate } from 'react-router';

import { NEGOTIATIONS_STATUS } from '@contracts/enums';
import { selectionEndpoints } from '@contracts/selection';
import type { NegotiationRow } from '@contracts/selection';

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
import { formatCount, formatDateTime, formatInstantDate } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { BidName } from '../../components/BidName';
import { SelectionPage } from '../../components/SelectionPage';
import { TenderSelect } from '../../components/TenderSelect';
import { useOfficialTimeZone, useTenderFilter } from '../../lib/hooks';
import { lotLabel } from '../../lib/labels';
import { compact, directionOf, idOf, oneOf, sortOf, tableSort } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';
import { NEGOTIATION_CONDUCT } from '../../lib/permissions';

const SORTS = ['tenderReference', 'status', 'lastMeetingAt', 'updatedAt'] as const;
const DEFAULTS = {
  q: '',
  tender: '',
  status: '',
  negotiator: '',
  sort: 'updatedAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function NegotiationsPage() {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const canConduct = usePermission(NEGOTIATION_CONDUCT);
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-27', DEFAULTS);
  const [tender, setTender, clearTenderLink] = useTenderFilter(filters.tender, (value) =>
    setFilters({ tender: value, page: 1 }),
  );
  const query = useApiQuery(selectionEndpoints.listNegotiations, {
    query: compact({
      q: filters.q.trim(),
      tenderId: idOf(tender),
      status: oneOf(filters.status, NEGOTIATIONS_STATUS),
      negotiatorUserId: idOf(filters.negotiator),
      sort: sortOf(filters.sort, SORTS, 'updatedAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(selectionEndpoints.listNegotiations, {
    query: compact({ tenderId: idOf(tender), pageSize: 100 }),
  });
  const all = overview.data?.items ?? [];
  const loadingValue = overview.data === undefined ? '…' : null;
  const kpiRestricted = overview.error?.kind === 'forbidden';
  const negotiators = new Map(
    all.flatMap((row) =>
      row.authorizedNegotiators.map((person) => [person.userId, person.fullName] as const),
    ),
  );
  const filtered =
    filters.q !== '' || tender !== '' || filters.status !== '' || filters.negotiator !== '';
  const count = (status: NegotiationRow['status']): string =>
    loadingValue ?? formatCount(all.filter((row) => row.status === status).length);

  const columns: DataTableColumn<NegotiationRow>[] = [
    {
      id: 'tenderReference',
      header: t('selection.common.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference
            value={row.tender.reference}
            to={selectionPaths.negotiation(row.negotiationId)}
          />
          <span className="tiq-cell-sub">{lotLabel(row.lot)}</span>
        </>
      ),
    },
    {
      id: 'supplier',
      header: t('selection.negotiations.col.supplier'),
      cell: (row) => <BidName bid={row.bid} />,
    },
    {
      id: 'topics',
      header: t('selection.negotiations.col.topics'),
      cell: (row) => (
        <>
          <span>{row.allowedTopics.slice(0, 2).join(', ')}</span>
          {row.allowedTopics.length > 2 && (
            <span className="tiq-cell-sub">
              {t('selection.negotiations.moreTopics', { count: row.allowedTopics.length - 2 })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'authority',
      header: t('selection.negotiations.col.authority'),
      numeric: true,
      cell: (row) => <MoneyText value={row.commercialAuthority} />,
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
      id: 'mandate',
      header: t('selection.negotiations.col.mandate'),
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
          <StatusChip enum="negotiations.status" value={row.status} />
          {row.affectsCompetitionBasis && (
            <span className="tiq-cell-sub">
              <Chip tone="warning" size="sm" icon="alertTriangle">
                {t('selection.negotiations.affectsBasis')}
              </Chip>
            </span>
          )}
        </>
      ),
    },
    {
      id: 'negotiators',
      header: t('selection.negotiations.col.negotiators'),
      cell: (row) => row.authorizedNegotiators.map((person) => person.fullName).join(', '),
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
          title={t('selection.negotiations.title')}
          subtitle={t('selection.negotiations.intro')}
          primaryAction={
            canConduct ? (
              <ButtonLink
                to={selectionPaths.newNegotiation(idOf(tender))}
                variant="primary"
                icon="plus"
              >
                {t('selection.negotiations.new')}
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
          placeholder={t('selection.negotiations.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <TenderSelect mode="filter" value={tender} onChange={setTender} />
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
          label={t('selection.negotiations.col.negotiators')}
          placeholder={t('selection.negotiations.allNegotiators')}
          value={filters.negotiator}
          options={[...negotiators].map(([value, label]) => ({ value: String(value), label }))}
          onChange={(negotiator) => setFilters({ negotiator, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('selection.negotiations.kpi.active')}
          icon="handshake"
          value={count('active')}
          hint={t('selection.negotiations.kpi.activeHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.negotiations.kpi.mandate')}
          icon="hourglass"
          tone="warning"
          value={count('awaiting_mandate')}
          hint={t('selection.negotiations.kpi.mandateHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.negotiations.kpi.planned')}
          icon="calendar"
          tone="info"
          value={count('planned')}
          hint={t('selection.negotiations.kpi.plannedHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.negotiations.kpi.concluded')}
          icon="checkCircle"
          tone="success"
          value={count('concluded')}
          hint={t('selection.negotiations.kpi.concludedHint')}
          restricted={kpiRestricted}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('selection.negotiations.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.negotiationId)}
          rowLabel={(row) => `${row.tender.reference} ${row.bid.supplierName}`}
          onRowClick={(row) => void navigate(selectionPaths.negotiation(row.negotiationId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('selection.common.emptyFiltered') : t('selection.negotiations.empty')
              }
              description={filtered ? undefined : t('selection.negotiations.emptyHint')}
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
