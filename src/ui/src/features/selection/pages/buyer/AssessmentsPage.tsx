/**
 * BUY-22 — Demonstrations and references: the register of assessment sessions (demonstrations, interviews,
 * presentations, samples, site inspections, reference checks) with their declared basis, equal-treatment state,
 * invitations and findings (FR-15, AC-21).
 */
import { useNavigate } from 'react-router';

import {
  ASSESSMENT_SESSIONS_ASSESSMENT_BASIS,
  ASSESSMENT_SESSIONS_SESSION_TYPE,
  ASSESSMENT_SESSIONS_STATUS,
} from '@contracts/enums';
import { selectionEndpoints } from '@contracts/selection';
import type { AssessmentSessionRow } from '@contracts/selection';

import { useApiQuery } from '../../../../api/hooks';
import { useScreenFilters } from '../../../../app/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  ButtonLink,
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
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatCount, formatDateTime, formatInstantDate } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { SelectionPage } from '../../components/SelectionPage';
import { TenderSelect } from '../../components/TenderSelect';
import { useOfficialTimeZone, useTenderFilter } from '../../lib/hooks';
import { lotLabel } from '../../lib/labels';
import { compact, directionOf, idOf, oneOf, sortOf, tableSort } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';
import { SELECTION_MANAGE } from '../../lib/permissions';

const SORTS = ['firstScheduledAt', 'tenderReference', 'status', 'updatedAt'] as const;
const DEFAULTS = {
  q: '',
  tender: '',
  type: '',
  basis: '',
  status: '',
  createdBy: '',
  from: '',
  to: '',
  sort: 'firstScheduledAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

export default function AssessmentsPage() {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const canManage = usePermission(SELECTION_MANAGE);
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-22', DEFAULTS);
  const [tender, setTender, clearTenderLink] = useTenderFilter(filters.tender, (value) =>
    setFilters({ tender: value, page: 1 }),
  );

  const query = useApiQuery(selectionEndpoints.listSessions, {
    query: compact({
      q: filters.q.trim(),
      tenderId: idOf(tender),
      sessionType: oneOf(filters.type, ASSESSMENT_SESSIONS_SESSION_TYPE),
      assessmentBasis: oneOf(filters.basis, ASSESSMENT_SESSIONS_ASSESSMENT_BASIS),
      status: oneOf(filters.status, ASSESSMENT_SESSIONS_STATUS),
      createdByUserId: idOf(filters.createdBy),
      from: filters.from,
      to: filters.to,
      sort: sortOf(filters.sort, SORTS, 'firstScheduledAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(selectionEndpoints.listSessions, {
    query: compact({ tenderId: idOf(tender), pageSize: 100 }),
  });
  const all = overview.data?.items ?? [];
  const loadingValue = overview.data === undefined ? '…' : null;
  const kpiRestricted = overview.error?.kind === 'forbidden';
  const creators = new Map(all.map((row) => [row.createdBy.userId, row.createdBy.fullName]));

  const filtered =
    filters.q !== '' ||
    tender !== '' ||
    filters.type !== '' ||
    filters.basis !== '' ||
    filters.status !== '' ||
    filters.createdBy !== '' ||
    filters.from !== '' ||
    filters.to !== '';

  const columns: DataTableColumn<AssessmentSessionRow>[] = [
    {
      id: 'session',
      header: t('selection.assessments.col.session'),
      cell: (row) => (
        <>
          <span>{tEnum('assessment_sessions.session_type', row.sessionType)}</span>
          <span className="tiq-cell-sub">{row.purpose}</span>
        </>
      ),
    },
    {
      id: 'tenderReference',
      header: t('selection.common.tender'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.tender.reference} to={selectionPaths.tender(row.tender.tenderId)} />
          <span className="tiq-cell-sub">{lotLabel(row.lot)}</span>
        </>
      ),
    },
    {
      id: 'basis',
      header: t('selection.assessments.col.basis'),
      cell: (row) => (
        <>
          <span>{tEnum('assessment_sessions.assessment_basis', row.assessmentBasis)}</span>
          {row.criterion !== null && <span className="tiq-cell-sub">{row.criterion.name}</span>}
        </>
      ),
    },
    {
      id: 'firstScheduledAt',
      header: t('selection.assessments.col.scheduled'),
      sortable: true,
      cell: (row) =>
        row.firstScheduledAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          formatDateTime(row.firstScheduledAt, row.tender.officialTimeZone)
        ),
    },
    {
      id: 'invites',
      header: t('selection.assessments.col.invites'),
      numeric: true,
      cell: (row) =>
        t('selection.assessments.confirmedOf', {
          confirmed: row.confirmedCount,
          total: row.inviteCount,
        }),
    },
    {
      id: 'findings',
      header: t('selection.assessments.col.findings'),
      numeric: true,
      cell: (row) => formatCount(row.findingCount),
    },
    {
      id: 'equalTreatment',
      header: t('selection.assessments.col.equalTreatment'),
      cell: (row) =>
        row.equalTreatmentConfirmed ? (
          <Chip tone="success" size="sm" icon="checkCircle">
            {t('selection.assessments.confirmed')}
          </Chip>
        ) : (
          <Chip tone="warning" size="sm" icon="alertTriangle">
            {t('selection.assessments.notConfirmed')}
          </Chip>
        ),
    },
    {
      id: 'status',
      header: t('selection.common.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="assessment_sessions.status" value={row.status} />,
    },
    {
      id: 'owner',
      header: t('selection.common.owner'),
      cell: (row) => row.createdBy.fullName,
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
          title={t('selection.assessments.title')}
          subtitle={t('selection.assessments.intro')}
          primaryAction={
            canManage ? (
              <ButtonLink
                to={selectionPaths.newSession(idOf(tender))}
                variant="primary"
                icon="plus"
              >
                {t('selection.assessments.new')}
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
          placeholder={t('selection.assessments.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <TenderSelect mode="filter" value={tender} onChange={setTender} />
        <Select
          label={t('selection.assessments.filter.type')}
          placeholder={t('selection.assessments.filter.allTypes')}
          value={filters.type}
          options={ASSESSMENT_SESSIONS_SESSION_TYPE.map((value) => ({
            value,
            label: tEnum('assessment_sessions.session_type', value),
          }))}
          onChange={(type) => setFilters({ type, page: 1 })}
        />
        <Select
          label={t('selection.assessments.filter.basis')}
          placeholder={t('selection.assessments.filter.allBases')}
          value={filters.basis}
          options={ASSESSMENT_SESSIONS_ASSESSMENT_BASIS.map((value) => ({
            value,
            label: tEnum('assessment_sessions.assessment_basis', value),
          }))}
          onChange={(basis) => setFilters({ basis, page: 1 })}
        />
        <Select
          label={t('selection.common.status')}
          placeholder={t('selection.common.allStatuses')}
          value={filters.status}
          options={ASSESSMENT_SESSIONS_STATUS.map((value) => ({
            value,
            label: tEnum('assessment_sessions.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('selection.common.owner')}
          placeholder={t('selection.common.allOwners')}
          value={filters.createdBy}
          options={[...creators].map(([value, label]) => ({ value: String(value), label }))}
          onChange={(createdBy) => setFilters({ createdBy, page: 1 })}
        />
        <DateInput
          label={t('selection.assessments.filter.from')}
          value={filters.from}
          onChange={(from) => setFilters({ from, page: 1 })}
        />
        <DateInput
          label={t('selection.assessments.filter.to')}
          value={filters.to}
          onChange={(to) => setFilters({ to, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('selection.assessments.kpi.upcoming')}
          icon="calendar"
          value={
            loadingValue ??
            formatCount(
              all.filter((row) => row.status === 'planned' || row.status === 'scheduled').length,
            )
          }
          hint={t('selection.assessments.kpi.upcomingHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.assessments.kpi.equalTreatment')}
          icon="scale"
          tone="warning"
          value={
            loadingValue ??
            formatCount(
              all.filter((row) => !row.equalTreatmentConfirmed && row.status !== 'cancelled')
                .length,
            )
          }
          hint={t('selection.assessments.kpi.equalTreatmentHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.assessments.kpi.completed')}
          icon="checkCircle"
          tone="success"
          value={
            loadingValue ?? formatCount(all.filter((row) => row.status === 'completed').length)
          }
          hint={t('selection.assessments.kpi.completedHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.assessments.kpi.findings')}
          icon="clipboardCheck"
          tone="info"
          value={loadingValue ?? formatCount(all.reduce((sum, row) => sum + row.findingCount, 0))}
          hint={t('selection.assessments.kpi.findingsHint')}
          restricted={kpiRestricted}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('selection.assessments.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.sessionId)}
          rowLabel={(row) =>
            `${tEnum('assessment_sessions.session_type', row.sessionType)} ${row.tender.reference}`
          }
          onRowClick={(row) => void navigate(selectionPaths.session(row.sessionId))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('selection.common.emptyFiltered') : t('selection.assessments.empty')
              }
              description={filtered ? undefined : t('selection.assessments.emptyHint')}
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
