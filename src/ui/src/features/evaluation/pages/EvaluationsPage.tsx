/**
 * Evaluations: the entry point to the evaluation workspaces (EVA-01, EVA-05, EVA-06). Each row is a tender, or one
 * lot of it, with its stage, the caller's role, the chair, assignment progress (missing work counted, never scored as
 * zero), the price gate, moderation and report status and the next due date in the official time zone.
 */
import { useNavigate } from 'react-router';

import {
  EVALUATION_ROLES,
  EVALUATION_SORT_FIELDS,
  EVALUATION_STAGES,
  listEvaluations,
} from '@contracts/evaluation';
import type { EvaluationSummaryRow } from '@contracts/evaluation';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  ButtonLink,
  Card,
  Checkbox,
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
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { PriceGateChip, StageChip } from '../components/chips';
import { ProgressMeter } from '../components/ProgressMeter';
import { lotLabel } from '../lib/labels';
import { compact, directionOf, oneOf, sortFieldOf, tableSort } from '../lib/lists';
import { evaluationPaths } from '../lib/paths';
import { ASSIGNMENT_VIEW_PERMISSIONS } from '../lib/permissions';

const DEFAULTS = {
  q: '',
  stage: '',
  myRole: '',
  overdue: false,
  sort: 'reference',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

export default function EvaluationsPage() {
  const navigate = useNavigate();
  const canSeeAssignments = usePermission(ASSIGNMENT_VIEW_PERMISSIONS);
  const [filters, setFilters, clearFilters] = useScreenFilters('EVA-list', DEFAULTS);

  const query = useApiQuery(listEvaluations, {
    query: compact({
      q: filters.q.trim(),
      stage: oneOf(filters.stage, EVALUATION_STAGES),
      myRole: oneOf(filters.myRole, EVALUATION_ROLES),
      overdue: filters.overdue ? true : undefined,
      sort: sortFieldOf(filters.sort, EVALUATION_SORT_FIELDS, 'reference'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const all = useApiQuery(listEvaluations, { query: { pageSize: 100 } });
  const rows = all.data?.items ?? [];
  const kpiRestricted = all.error?.kind === 'forbidden';
  const loadingKpi = all.data === undefined;
  const inProgress = rows.filter((row) => row.stage !== 'complete').length;
  const overdue = rows.reduce((total, row) => total + row.progress.overdue, 0);
  const conflicts = rows.reduce((total, row) => total + row.progress.conflictsPendingReview, 0);
  const signoff = rows.filter((row) => row.reportStatus === 'in_signoff').length;

  const filtered =
    filters.q !== '' || filters.stage !== '' || filters.myRole !== '' || filters.overdue;

  const columns: DataTableColumn<EvaluationSummaryRow>[] = [
    {
      id: 'reference',
      header: t('evaluation.list.col.reference'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.tender.reference} />
          <span className="tiq-cell-sub">{row.tender.title}</span>
          {row.lot !== null && <span className="tiq-cell-sub">{lotLabel(row.lot)}</span>}
        </>
      ),
    },
    {
      id: 'stage',
      header: t('evaluation.list.col.stage'),
      sortable: true,
      cell: (row) => <StageChip stage={row.stage} />,
    },
    {
      id: 'role',
      header: t('evaluation.list.col.role'),
      cell: (row) => t(`evaluation.role.${row.myRole}`),
    },
    {
      id: 'chair',
      header: t('evaluation.list.col.chair'),
      cell: (row) => row.chair.fullName,
    },
    {
      id: 'progress',
      header: t('evaluation.list.col.progress'),
      cell: (row) => (
        <>
          <ProgressMeter
            done={row.progress.submitted}
            total={row.progress.total}
            label={t('evaluation.list.progressLabel', { reference: row.tender.reference })}
          />
          {row.progress.incomplete > 0 && (
            <span className="tiq-cell-sub tiq-text-warning">
              {t('evaluation.list.incomplete', { count: row.progress.incomplete })}
            </span>
          )}
          {row.progress.conflictsPendingReview > 0 && (
            <span className="tiq-cell-sub tiq-text-danger">
              {t('evaluation.list.conflicts', { count: row.progress.conflictsPendingReview })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'priceGate',
      header: t('evaluation.list.col.priceGate'),
      cell: (row) => <PriceGateChip gate={row.priceGate} size="sm" />,
    },
    {
      id: 'moderation',
      header: t('evaluation.list.col.moderation'),
      cell: (row) =>
        row.moderationStatus === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <StatusChip enum="moderation_sessions.status" value={row.moderationStatus} size="sm" />
        ),
    },
    {
      id: 'report',
      header: t('evaluation.list.col.report'),
      cell: (row) =>
        row.reportStatus === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <StatusChip enum="evaluation_reports.status" value={row.reportStatus} size="sm" />
        ),
    },
    {
      id: 'nextDueAt',
      header: t('evaluation.list.col.nextDue'),
      sortable: true,
      cell: (row) =>
        row.nextDueAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <OfficialDeadline deadline={row.nextDueAt} showLocal={false} />
            {row.progress.overdue > 0 && (
              <span className="tiq-cell-sub tiq-text-danger">
                {t('evaluation.list.overdue', { count: row.progress.overdue })}
              </span>
            )}
          </>
        ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('evaluation.list.title')}
        subtitle={t('evaluation.list.intro')}
        actions={
          canSeeAssignments ? (
            <ButtonLink to={evaluationPaths.assignments} icon="clipboardCheck">
              {t('evaluation.list.myAssignments')}
            </ButtonLink>
          ) : undefined
        }
      />
      <FilterBar label={t('evaluation.list.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('evaluation.common.search')}
          placeholder={t('evaluation.list.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('evaluation.list.filter.stage')}
          placeholder={t('evaluation.list.filter.allStages')}
          value={filters.stage}
          options={EVALUATION_STAGES.map((value) => ({
            value,
            label: t(`evaluation.stage.${value}`),
          }))}
          onChange={(stage) => setFilters({ stage, page: 1 })}
        />
        <Select
          label={t('evaluation.list.filter.role')}
          placeholder={t('evaluation.list.filter.allRoles')}
          value={filters.myRole}
          options={EVALUATION_ROLES.map((value) => ({
            value,
            label: t(`evaluation.role.${value}`),
          }))}
          onChange={(myRole) => setFilters({ myRole, page: 1 })}
        />
        <Checkbox
          label={t('evaluation.list.filter.overdue')}
          checked={filters.overdue}
          onChange={(overdueOnly) => setFilters({ overdue: overdueOnly, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('evaluation.list.kpi.inProgress')}
          icon="scale"
          value={loadingKpi ? '…' : formatCount(inProgress)}
          hint={t('evaluation.list.kpi.inProgressHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('evaluation.list.kpi.overdue')}
          icon="clock"
          tone="danger"
          value={loadingKpi ? '…' : formatCount(overdue)}
          hint={t('evaluation.list.kpi.overdueHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('evaluation.list.kpi.conflicts')}
          icon="alertTriangle"
          tone="warning"
          value={loadingKpi ? '…' : formatCount(conflicts)}
          hint={t('evaluation.list.kpi.conflictsHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('evaluation.list.kpi.signoff')}
          icon="fileSignature"
          tone="info"
          value={loadingKpi ? '…' : formatCount(signoff)}
          hint={t('evaluation.list.kpi.signoffHint')}
          restricted={kpiRestricted}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('evaluation.list.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => `${row.tender.tenderId}:${row.lot?.lotId ?? 0}`}
          rowLabel={(row) => `${row.tender.reference} ${row.tender.title}`}
          onRowClick={(row) =>
            void navigate(evaluationPaths.overview(row.tender.tenderId, row.lot?.lotId))
          }
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={filtered ? t('evaluation.list.emptyFiltered') : t('evaluation.list.empty')}
              description={filtered ? undefined : t('evaluation.list.emptyHint')}
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
