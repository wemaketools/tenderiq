/**
 * EVA-01 — Evaluator assignments: the caller's assigned events (the chair can switch to the whole committee), with
 * the bids and criteria in scope, due dates in the official time zone, declarations (confidentiality undertaking and
 * conflict declaration, BR-08) and completion. Missing work is counted as "not scored", never as zero (AC-18). The row
 * action is the next permitted step: accept, wait for the conflict review, score, submit or correct.
 */
import { useNavigate } from 'react-router';

import { EVALUATION_ASSIGNMENTS_STATUS } from '@contracts/enums';
import { ASSIGNMENT_SORT_FIELDS, listAssignments, listEvaluations } from '@contracts/evaluation';
import type { AssignmentRow } from '@contracts/evaluation';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
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
  OverdueChip,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ProgressMeter } from '../components/ProgressMeter';
import { lotLabel } from '../lib/labels';
import { compact, directionOf, oneOf, parseId, sortFieldOf, tableSort } from '../lib/lists';
import { evaluationPaths } from '../lib/paths';
import { EVALUATION_OVERVIEW_PERMISSIONS } from '../lib/permissions';

const DEFAULTS = {
  scope: 'mine',
  q: '',
  status: '',
  tenderId: '',
  kind: '',
  overdue: false,
  dueFrom: '',
  dueTo: '',
  sort: 'dueAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

/** Where the next action of an assignment leads. */
function nextActionTarget(row: AssignmentRow): string {
  if (row.nextAction === 'score' || row.nextAction === 'submit' || row.nextAction === 'correct') {
    return evaluationPaths.assessment(row.assignmentId);
  }
  if (row.nextAction === 'commercial_comparison') {
    return evaluationPaths.commercial(row.tender.tenderId, row.lot?.lotId);
  }
  return evaluationPaths.assignment(row.assignmentId);
}

function DeclarationsCell({ row }: { readonly row: AssignmentRow }) {
  const { declarations } = row;
  return (
    <span className="tiq-stack">
      <span className="tiq-inline">
        <Chip
          tone={declarations.undertakingAccepted ? 'success' : 'warning'}
          size="sm"
          icon={declarations.undertakingAccepted ? 'checkCircle' : 'alertTriangle'}
        >
          {declarations.undertakingAccepted
            ? t('evaluation.assignments.undertakingSigned')
            : t('evaluation.assignments.undertakingMissing')}
        </Chip>
      </span>
      <span className="tiq-inline">
        {!declarations.conflictDeclared ? (
          <Chip tone="warning" size="sm">
            {t('evaluation.assignments.conflictNotDeclared')}
          </Chip>
        ) : declarations.hasConflict === true && declarations.conflictDisposition !== null ? (
          <StatusChip
            enum="conflict_declarations.disposition"
            value={declarations.conflictDisposition}
            size="sm"
          />
        ) : (
          <Chip tone="success" size="sm">
            {t('evaluation.assignments.noConflict')}
          </Chip>
        )}
      </span>
    </span>
  );
}

export default function AssignmentsPage() {
  const navigate = useNavigate();
  const isChair = usePermission('evaluation.chair');
  const canOverview = usePermission(EVALUATION_OVERVIEW_PERMISSIONS);
  const [filters, setFilters, clearFilters] = useScreenFilters('EVA-01', DEFAULTS);
  const scope = isChair && filters.scope === 'all' ? 'all' : 'mine';
  const kind =
    filters.kind === 'commercial' ? true : filters.kind === 'technical' ? false : undefined;

  const query = useApiQuery(listAssignments, {
    query: compact({
      scope,
      q: filters.q.trim(),
      status: oneOf(filters.status, EVALUATION_ASSIGNMENTS_STATUS),
      tenderId: parseId(filters.tenderId) ?? undefined,
      isCommercial: kind,
      overdue: filters.overdue ? true : undefined,
      dueFrom: filters.dueFrom,
      dueTo: filters.dueTo,
      sort: sortFieldOf(filters.sort, ASSIGNMENT_SORT_FIELDS, 'dueAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const evaluations = useApiQuery(
    listEvaluations,
    canOverview ? { query: { pageSize: 100 } } : null,
  );
  // Every tender of the caller's assignments, recused and reassigned ones included (EVA-01), whatever filter applies.
  const everyAssignment = useApiQuery(listAssignments, { query: { scope, pageSize: 100 } });
  const tenderOptions = [
    ...new Map(
      [
        ...(everyAssignment.data?.items ?? []).map((row) => row.tender),
        ...(query.data?.items ?? []).map((row) => row.tender),
        ...(evaluations.data?.items ?? []).map((row) => row.tender),
      ].map((tender) => [
        tender.tenderId,
        { value: String(tender.tenderId), label: `${tender.reference} ${tender.title}` },
      ]),
    ).values(),
  ].sort((a, b) => a.label.localeCompare(b.label));

  const summary = query.data?.summary;
  const kpiRestricted = query.error?.kind === 'forbidden';
  const kpi = (value: number | undefined): string =>
    value === undefined ? '…' : formatCount(value);
  const filtered =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.tenderId !== '' ||
    filters.kind !== '' ||
    filters.overdue ||
    filters.dueFrom !== '' ||
    filters.dueTo !== '';

  const columns: DataTableColumn<AssignmentRow>[] = [
    {
      id: 'reference',
      header: t('evaluation.assignments.col.event'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.tender.reference} />
          <span className="tiq-cell-sub">{row.tender.title}</span>
          {row.lot !== null && <span className="tiq-cell-sub">{lotLabel(row.lot)}</span>}
        </>
      ),
    },
    ...(scope === 'all'
      ? [
          {
            id: 'evaluator',
            header: t('evaluation.assignments.col.evaluator'),
            sortable: true,
            cell: (row: AssignmentRow) => (
              <>
                <span>{row.evaluator.fullName}</span>
                <span className="tiq-cell-sub">{row.evaluator.capacity}</span>
              </>
            ),
          },
        ]
      : []),
    {
      id: 'scope',
      header: t('evaluation.assignments.col.scope'),
      cell: (row) => (
        <>
          <span>
            {row.bidId === null
              ? t('evaluation.assignments.allBids', { count: row.bidCount })
              : t('evaluation.assignments.oneBid')}
          </span>
          <span className="tiq-cell-sub">
            {row.isCommercial
              ? t('evaluation.assignments.commercialScope')
              : t('evaluation.assignments.criteria', { count: row.criterionCount })}
          </span>
        </>
      ),
    },
    {
      id: 'dueAt',
      header: t('evaluation.assignments.col.due'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-stack">
          <OfficialDeadline deadline={row.dueAt} showLocal={false} />
          {row.isOverdue && (
            <span>
              <OverdueChip />
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'declarations',
      header: t('evaluation.assignments.col.declarations'),
      cell: (row) => <DeclarationsCell row={row} />,
    },
    {
      id: 'completion',
      header: t('evaluation.assignments.col.completion'),
      cell: (row) =>
        row.isCommercial ? (
          <span className="tiq-text-muted">{t('evaluation.assignments.commercialCompletion')}</span>
        ) : (
          <>
            <ProgressMeter
              done={row.completion.scored}
              total={row.completion.total}
              label={t('evaluation.assignments.completionLabel', {
                reference: row.tender.reference,
              })}
            />
            {row.completion.notScored > 0 && (
              <span className="tiq-cell-sub tiq-text-warning">
                {t('evaluation.assignments.notScored', { count: row.completion.notScored })}
              </span>
            )}
          </>
        ),
    },
    {
      id: 'status',
      header: t('evaluation.assignments.col.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="evaluation_assignments.status" value={row.status} />,
    },
    {
      id: 'next',
      header: t('evaluation.assignments.col.next'),
      cell: (row) =>
        row.nextAction === 'none' ? (
          <span className="tiq-text-muted">{t('evaluation.nextAction.none')}</span>
        ) : row.nextAction === 'await_conflict_review' ? (
          <span className="tiq-text-warning">
            {t('evaluation.nextAction.await_conflict_review')}
          </span>
        ) : (
          <ButtonLink
            to={nextActionTarget(row)}
            size="sm"
            variant={row.nextAction === 'accept' ? 'primary' : 'secondary'}
          >
            {t(`evaluation.nextAction.${row.nextAction}`)}
          </ButtonLink>
        ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('evaluation.assignments.title')}
        subtitle={t('evaluation.assignments.intro')}
        actions={
          canOverview ? (
            <ButtonLink to={evaluationPaths.list} icon="scale">
              {t('evaluation.assignments.allEvaluations')}
            </ButtonLink>
          ) : undefined
        }
      />
      <FilterBar
        label={t('evaluation.assignments.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        {isChair && (
          <Select
            label={t('evaluation.assignments.filter.scope')}
            value={scope}
            options={[
              { value: 'mine', label: t('evaluation.assignments.scope.mine') },
              { value: 'all', label: t('evaluation.assignments.scope.all') },
            ]}
            onChange={(value) => setFilters({ scope: value, page: 1 })}
          />
        )}
        <SearchField
          label={t('evaluation.common.search')}
          placeholder={t('evaluation.assignments.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('evaluation.assignments.filter.status')}
          placeholder={t('evaluation.common.allStatuses')}
          value={filters.status}
          options={EVALUATION_ASSIGNMENTS_STATUS.map((value) => ({
            value,
            label: tEnum('evaluation_assignments.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        {canOverview && (
          <Select
            label={t('evaluation.assignments.filter.tender')}
            placeholder={t('evaluation.assignments.filter.allTenders')}
            value={filters.tenderId}
            options={tenderOptions}
            onChange={(tenderId) => setFilters({ tenderId, page: 1 })}
          />
        )}
        <Select
          label={t('evaluation.assignments.filter.kind')}
          placeholder={t('evaluation.assignments.filter.allKinds')}
          value={filters.kind}
          options={[
            { value: 'technical', label: t('evaluation.assignments.kind.technical') },
            { value: 'commercial', label: t('evaluation.assignments.kind.commercial') },
          ]}
          onChange={(value) => setFilters({ kind: value, page: 1 })}
        />
        <DateInput
          label={t('evaluation.assignments.filter.dueFrom')}
          value={filters.dueFrom}
          onChange={(dueFrom) => setFilters({ dueFrom, page: 1 })}
        />
        <DateInput
          label={t('evaluation.assignments.filter.dueTo')}
          value={filters.dueTo}
          onChange={(dueTo) => setFilters({ dueTo, page: 1 })}
        />
        <Checkbox
          label={t('evaluation.assignments.filter.overdue')}
          checked={filters.overdue}
          onChange={(overdueOnly) => setFilters({ overdue: overdueOnly, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('evaluation.assignments.kpi.pending')}
          icon="clipboard"
          tone="warning"
          value={kpi(summary?.declarationsPending)}
          hint={t('evaluation.assignments.kpi.pendingHint', {
            count: summary?.notStarted ?? 0,
          })}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('evaluation.assignments.kpi.inProgress')}
          icon="edit"
          tone="info"
          value={kpi(summary === undefined ? undefined : summary.inProgress + summary.returned)}
          hint={t('evaluation.assignments.kpi.inProgressHint', { count: summary?.returned ?? 0 })}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('evaluation.assignments.kpi.submitted')}
          icon="checkCircle"
          tone="success"
          value={kpi(summary?.submitted)}
          hint={t('evaluation.assignments.kpi.submittedHint', { total: summary?.total ?? 0 })}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('evaluation.assignments.kpi.overdue')}
          icon="clock"
          tone="danger"
          value={kpi(summary?.overdue)}
          hint={t('evaluation.assignments.kpi.overdueHint')}
          restricted={kpiRestricted}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('evaluation.assignments.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.assignmentId)}
          rowLabel={(row) =>
            t('evaluation.assignments.rowLabel', {
              reference: row.tender.reference,
              evaluator: row.evaluator.fullName,
            })
          }
          onRowClick={(row) => void navigate(evaluationPaths.assignment(row.assignmentId))}
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
                  ? t('evaluation.assignments.emptyFiltered')
                  : t('evaluation.assignments.empty')
              }
              description={filtered ? undefined : t('evaluation.assignments.emptyHint')}
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
