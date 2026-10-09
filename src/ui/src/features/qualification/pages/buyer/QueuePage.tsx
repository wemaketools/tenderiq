/**
 * BUY-33 — Qualification review queue (FR-06, PRD §12.1): submitted applications (never drafts) with category,
 * risk, completeness, assessors, deadlines and renewal status. Reviewers assign and prioritize reviews and request
 * missing material or specialist (financial) assessment.
 */
import { useState } from 'react';

import {
  BUYER_APPLICATION_SORT_FIELDS,
  qualificationEndpoints as api,
} from '@contracts/qualification';
import type { BuyerApplicationRow, BuyerApplicationStatus } from '@contracts/qualification';
import {
  QUALIFICATION_APPLICATIONS_RISK_LEVEL,
  QUALIFICATION_APPLICATIONS_STATUS,
  TASKS_PRIORITY,
} from '@contracts/enums';

import { invalidateApiQueries, useApiQuery } from '../../../../api/hooks';
import { useScreenFilters } from '../../../../app/hooks';
import { useCanCall, usePermission } from '../../../../auth/permissions';
import {
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  IconButton,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  OrDash,
  OverdueChip,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
  useToast,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatCount, formatDateTime, formatMoney } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { AssignDialog } from '../../components/AssignDialog';
import { RequestInfoDialog } from '../../components/RequestInfoDialog';
import { ExpiryChip } from '../../components/shared';
import { categoryLabel, cellStack } from '../../lib/text';
import { useOfficialTimeZone } from '../../lib/hooks';
import {
  compact,
  dateOf,
  directionOf,
  flagOf,
  idOf,
  oneOf,
  sortOf,
  tableSort,
} from '../../lib/lists';
import { buyerQualificationPaths } from '../../lib/paths';

const BUYER_STATUSES = QUALIFICATION_APPLICATIONS_STATUS.filter(
  (value): value is BuyerApplicationStatus => value !== 'draft',
);
/** The statuses that still need work in the queue. */
const OPEN_STATUSES: readonly BuyerApplicationStatus[] = [
  'submitted',
  'under_review',
  'more_info_required',
  'decision_pending',
];

const DEFAULTS = {
  q: '',
  status: '',
  programId: '',
  categoryId: '',
  riskLevel: '',
  priority: '',
  assessorUserId: '',
  unassigned: false,
  renewal: false,
  overdue: false,
  submittedFrom: '',
  submittedTo: '',
  dueFrom: '',
  dueTo: '',
  sort: 'dueAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

type Dialog =
  | { readonly kind: 'assign'; readonly row: BuyerApplicationRow }
  | { readonly kind: 'info'; readonly row: BuyerApplicationRow };

export default function QueuePage() {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const canAssign = usePermission('qualification.review');
  const canRequest = usePermission(['qualification.review', 'qualification.financial_review']);
  const canManagePrograms = usePermission('qualification.program.manage');
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-33', DEFAULTS);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [updated, setUpdated] = useState<ReadonlyMap<number, BuyerApplicationRow>>(new Map());

  const statusFilter = oneOf(filters.status, BUYER_STATUSES);
  const query = useApiQuery(api.listApplications, {
    query: compact({
      q: filters.q.trim(),
      status: statusFilter ?? (filters.status === '' ? [...OPEN_STATUSES] : undefined),
      programId: idOf(filters.programId),
      categoryId: idOf(filters.categoryId),
      riskLevel: oneOf(filters.riskLevel, QUALIFICATION_APPLICATIONS_RISK_LEVEL),
      priority: oneOf(filters.priority, TASKS_PRIORITY),
      assessorUserId: idOf(filters.assessorUserId),
      unassigned: flagOf(filters.unassigned),
      renewal: flagOf(filters.renewal),
      overdue: flagOf(filters.overdue),
      submittedFrom: dateOf(filters.submittedFrom),
      submittedTo: dateOf(filters.submittedTo),
      dueFrom: dateOf(filters.dueFrom),
      dueTo: dateOf(filters.dueTo),
      sort: sortOf(filters.sort, BUYER_APPLICATION_SORT_FIELDS, 'dueAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const canSummary = useCanCall(api.getQualificationSummary);
  const summary = useApiQuery(api.getQualificationSummary, canSummary ? {} : null);
  const options = useApiQuery(api.getQualificationOptions, {});
  const programs = useApiQuery(api.listPrograms, { query: { pageSize: 100, sort: 'name' } });

  const counts = new Map(summary.data?.byStatus.map((item) => [item.status, item.count]) ?? []);
  const inQueue = OPEN_STATUSES.reduce((total, status) => total + (counts.get(status) ?? 0), 0);
  const kpi = (value: number | undefined): string =>
    value === undefined ? '…' : formatCount(value);
  // Tiles the membership cannot load are left out, and so is the grid (DD-49).
  const kpiHidden = !canSummary || summary.error?.kind === 'forbidden';

  const filtered =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.programId !== '' ||
    filters.categoryId !== '' ||
    filters.riskLevel !== '' ||
    filters.priority !== '' ||
    filters.assessorUserId !== '' ||
    filters.unassigned ||
    filters.renewal ||
    filters.overdue ||
    filters.submittedFrom !== '' ||
    filters.submittedTo !== '' ||
    filters.dueFrom !== '' ||
    filters.dueTo !== '';

  const rows = query.data?.items.map((row) => updated.get(row.id) ?? row);

  const columns: DataTableColumn<BuyerApplicationRow>[] = [
    {
      id: 'reference',
      header: t('qualification.queue.col.application'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference value={row.reference} to={buyerQualificationPaths.application(row.id)} />
          <span className="tiq-cell-sub">
            {t('qualification.queue.submittedOn', {
              date: formatDateTime(row.submittedAt, timeZone),
            })}
          </span>
          {row.renewalOfDecisionId === null ? (
            <span className="tiq-cell-sub">{t('qualification.queue.newApplication')}</span>
          ) : (
            <span className="tiq-inline">
              <Chip tone="info" size="sm" icon="repeat">
                {t('qualification.queue.renewal')}
              </Chip>
              <ExpiryChip days={row.currentDecisionExpiresInDays} />
            </span>
          )}
        </>
      ),
    },
    {
      id: 'supplierName',
      header: t('qualification.queue.col.supplier'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.supplier.name}</span>
          <span className="tiq-cell-sub">
            {t('qualification.common.programVersion', {
              name: row.program.programName,
              no: row.program.versionNo,
            })}
          </span>
        </>
      ),
    },
    {
      id: 'category',
      header: t('qualification.queue.col.category'),
      cell: (row) => (
        <>
          <span title={row.scopeCategory.name}>{row.scopeCategory.code}</span>
          <span className="tiq-cell-sub">
            {row.scopeMaxValue === null
              ? t('qualification.common.noValueLimit')
              : t('qualification.common.upTo', { value: formatMoney(row.scopeMaxValue) })}
          </span>
        </>
      ),
    },
    {
      id: 'riskLevel',
      header: t('qualification.queue.col.risk'),
      sortable: true,
      cell: (row) => (
        <>
          {row.riskLevel === null ? (
            <Chip tone="neutral" size="sm">
              {t('qualification.queue.riskNotSet')}
            </Chip>
          ) : (
            <StatusChip
              enum="qualification_applications.risk_level"
              value={row.riskLevel}
              size="sm"
            />
          )}
          <span className="tiq-cell-sub">
            {t('qualification.queue.priority', { priority: tEnum('tasks.priority', row.priority) })}
          </span>
        </>
      ),
    },
    {
      id: 'completeness',
      header: t('qualification.queue.col.completeness'),
      cell: (row) => <CompletenessCell row={row} />,
    },
    {
      id: 'assessor',
      header: t('qualification.queue.col.assessors'),
      cell: (row) => (
        <>
          <span>{row.assessor?.fullName ?? t('qualification.queue.unassigned')}</span>
          <span className="tiq-cell-sub">
            {row.financialReviewer === null
              ? t('qualification.queue.noFinancialReviewer')
              : t('qualification.queue.financialReviewer', {
                  name: row.financialReviewer.fullName,
                })}
          </span>
        </>
      ),
    },
    {
      id: 'dueAt',
      header: t('qualification.queue.col.due'),
      sortable: true,
      cell: (row) =>
        row.dueAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <span className="tiq-stack" style={cellStack}>
            <OfficialDeadline deadline={row.dueAt} showLocal={false} />
            {row.overdue && <OverdueChip />}
          </span>
        ),
    },
    {
      id: 'status',
      header: t('qualification.queue.col.status'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-stack" style={cellStack}>
          <StatusChip enum="qualification_applications.status" value={row.status} size="sm" />
          {row.openInfoRequestCount > 0 && (
            <span className="tiq-cell-sub">
              {t('qualification.queue.openRequests', { count: row.openInfoRequestCount })}
            </span>
          )}
          {row.screeningFlagCount > 0 && (
            <Chip tone="warning" size="sm" icon="flag">
              {t('qualification.queue.screeningFlags', { count: row.screeningFlagCount })}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('qualification.queue.col.actions'),
      accessibleHeader: t('qualification.queue.col.actions'),
      cell: (row) => {
        const open = row.status !== 'decided' && row.status !== 'withdrawn';
        return (
          <span className="tiq-inline">
            {canAssign && open && (
              <IconButton
                size="sm"
                icon="userPlus"
                label={
                  row.assessor === null
                    ? t('qualification.queue.assign')
                    : t('qualification.queue.reassign')
                }
                onClick={() => setDialog({ kind: 'assign', row })}
              />
            )}
            {canRequest &&
              (row.status === 'under_review' || row.status === 'more_info_required') && (
                <IconButton
                  size="sm"
                  icon="messageQuestion"
                  label={t('qualification.queue.requestInfo')}
                  onClick={() => setDialog({ kind: 'info', row })}
                />
              )}
          </span>
        );
      },
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('qualification.queue.title')}
        subtitle={t('qualification.queue.intro')}
        actions={
          <>
            <ButtonLink to={buyerQualificationPaths.monitoring} icon="activity">
              {t('qualification.queue.toMonitoring')}
            </ButtonLink>
            {canManagePrograms && (
              <ButtonLink to={buyerQualificationPaths.programs} icon="sliders">
                {t('qualification.queue.toPrograms')}
              </ButtonLink>
            )}
          </>
        }
      />
      <FilterBar
        label={t('qualification.queue.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('qualification.common.search')}
          placeholder={t('qualification.queue.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('qualification.queue.filter.program')}
          placeholder={t('qualification.common.allPrograms')}
          value={filters.programId}
          onChange={(programId) => setFilters({ programId, page: 1 })}
          options={(programs.data?.items ?? []).map((program) => ({
            value: String(program.id),
            label: program.name,
          }))}
        />
        <Select
          label={t('qualification.queue.filter.category')}
          placeholder={t('qualification.common.allCategories')}
          value={filters.categoryId}
          onChange={(categoryId) => setFilters({ categoryId, page: 1 })}
          options={(options.data?.categories ?? []).map((category) => ({
            value: String(category.categoryId),
            label: categoryLabel(category),
          }))}
        />
        <Select
          label={t('qualification.queue.filter.risk')}
          placeholder={t('qualification.common.allRisks')}
          value={filters.riskLevel}
          onChange={(riskLevel) => setFilters({ riskLevel, page: 1 })}
          options={QUALIFICATION_APPLICATIONS_RISK_LEVEL.map((value) => ({
            value,
            label: tEnum('qualification_applications.risk_level', value),
          }))}
        />
        <Select
          label={t('qualification.queue.filter.priority')}
          placeholder={t('qualification.common.allPriorities')}
          value={filters.priority}
          onChange={(priority) => setFilters({ priority, page: 1 })}
          options={TASKS_PRIORITY.map((value) => ({
            value,
            label: tEnum('tasks.priority', value),
          }))}
        />
        <Select
          label={t('qualification.queue.filter.assessor')}
          placeholder={t('qualification.common.allAssessors')}
          value={filters.assessorUserId}
          onChange={(assessorUserId) => setFilters({ assessorUserId, page: 1 })}
          options={(options.data?.assessors ?? []).map((person) => ({
            value: String(person.userId),
            label: person.fullName,
          }))}
        />
        <DateInput
          label={t('qualification.queue.filter.submittedFrom')}
          value={filters.submittedFrom}
          onChange={(submittedFrom) => setFilters({ submittedFrom, page: 1 })}
        />
        <DateInput
          label={t('qualification.queue.filter.submittedTo')}
          value={filters.submittedTo}
          onChange={(submittedTo) => setFilters({ submittedTo, page: 1 })}
        />
        <DateInput
          label={t('qualification.queue.filter.dueFrom')}
          value={filters.dueFrom}
          onChange={(dueFrom) => setFilters({ dueFrom, page: 1 })}
        />
        <DateInput
          label={t('qualification.queue.filter.dueTo')}
          value={filters.dueTo}
          onChange={(dueTo) => setFilters({ dueTo, page: 1 })}
        />
        <Checkbox
          label={t('qualification.queue.filter.unassigned')}
          checked={filters.unassigned}
          onChange={(unassigned) => setFilters({ unassigned, page: 1 })}
        />
        <Checkbox
          label={t('qualification.queue.filter.renewal')}
          checked={filters.renewal}
          onChange={(renewal) => setFilters({ renewal, page: 1 })}
        />
        <Checkbox
          label={t('qualification.queue.filter.overdue')}
          checked={filters.overdue}
          onChange={(overdue) => setFilters({ overdue, page: 1 })}
        />
      </FilterBar>
      <div className="tiq-inline" role="group" aria-label={t('qualification.queue.statusChips')}>
        <Button
          size="sm"
          variant={filters.status === '' ? 'primary' : 'ghost'}
          aria-pressed={filters.status === ''}
          onClick={() => setFilters({ status: '', page: 1 })}
        >
          {t('qualification.queue.chipOpen', { count: summary.data === undefined ? 0 : inQueue })}
        </Button>
        {BUYER_STATUSES.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={filters.status === status ? 'primary' : 'ghost'}
            aria-pressed={filters.status === status}
            onClick={() => setFilters({ status, page: 1 })}
          >
            {`${tEnum('qualification_applications.status', status)} (${formatCount(counts.get(status) ?? 0)})`}
          </Button>
        ))}
      </div>
      <KpiGrid>
        <KpiCard
          label={t('qualification.queue.kpi.inQueue')}
          icon="inbox"
          value={kpi(summary.data === undefined ? undefined : inQueue)}
          hint={t('qualification.queue.kpi.inQueueHint')}
          restricted={kpiHidden}
        />
        <KpiCard
          label={t('qualification.queue.kpi.unassigned')}
          icon="userPlus"
          tone="warning"
          value={kpi(summary.data?.unassigned)}
          hint={t('qualification.queue.kpi.unassignedHint')}
          restricted={kpiHidden}
        />
        <KpiCard
          label={t('qualification.queue.kpi.overdue')}
          icon="clock"
          tone="danger"
          value={kpi(summary.data?.overdue)}
          hint={t('qualification.queue.kpi.overdueHint')}
          restricted={kpiHidden}
        />
        <KpiCard
          label={t('qualification.queue.kpi.highRisk')}
          icon="alertTriangle"
          tone="danger"
          value={kpi(summary.data?.highRisk)}
          hint={t('qualification.queue.kpi.highRiskHint')}
          restricted={kpiHidden}
        />
        <KpiCard
          label={t('qualification.queue.kpi.renewals')}
          icon="repeat"
          tone="accent"
          value={kpi(summary.data?.renewalsInQueue)}
          hint={t('qualification.queue.kpi.renewalsHint')}
          restricted={kpiHidden}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('qualification.queue.caption')}
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => `${row.reference} ${row.supplier.name}`}
          rowHref={(row) => buyerQualificationPaths.application(row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          restricted={query.error?.kind === 'forbidden'}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              icon="clipboardCheck"
              title={
                filtered ? t('qualification.queue.emptyFiltered') : t('qualification.queue.empty')
              }
              description={filtered ? undefined : t('qualification.queue.emptyHint')}
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
      {dialog?.kind === 'assign' && (
        <AssignDialog
          application={dialog.row}
          options={options.data}
          onClose={() => setDialog(null)}
          onAssigned={(row) => {
            setUpdated((previous) => new Map(previous).set(row.id, row));
            setDialog(null);
            invalidateApiQueries('buyer.qualification.summary');
            toast.show(
              t('qualification.assign.done', {
                reference: row.reference,
                name: row.assessor?.fullName ?? '',
              }),
              'success',
            );
          }}
        />
      )}
      {dialog?.kind === 'info' && (
        <RequestInfoDialog
          applicationId={dialog.row.id}
          reference={dialog.row.reference}
          supplierName={dialog.row.supplier.name}
          timeZone={dialog.row.dueAt?.timeZone ?? timeZone}
          criteria={[]}
          onClose={() => setDialog(null)}
          onRequested={(result) => {
            setDialog(null);
            toast.show(
              t('qualification.requestInfo.done', {
                reference: dialog.row.reference,
                status: tEnum('qualification_applications.status', result.applicationStatus),
              }),
              'success',
            );
          }}
        />
      )}
    </div>
  );
}

function CompletenessCell({ row }: { readonly row: BuyerApplicationRow }) {
  const c = row.completeness;
  const gaps = c.mandatoryUnanswered + c.mandatoryEvidenceMissing + c.naWithoutReason;
  return (
    <>
      <span className="tiq-num">
        {t('qualification.queue.answered', { answered: c.answered, total: c.criteriaTotal })}
      </span>
      {gaps === 0 && c.expiredEvidence === 0 ? (
        <span className="tiq-cell-sub tiq-text-success">{t('qualification.queue.complete')}</span>
      ) : (
        <span className="tiq-cell-sub tiq-text-danger">
          {[
            c.mandatoryEvidenceMissing > 0
              ? t('qualification.queue.evidenceMissing', { count: c.mandatoryEvidenceMissing })
              : null,
            c.mandatoryUnanswered > 0
              ? t('qualification.queue.unanswered', { count: c.mandatoryUnanswered })
              : null,
            c.naWithoutReason > 0
              ? t('qualification.queue.naWithoutReason', { count: c.naWithoutReason })
              : null,
            c.expiredEvidence > 0
              ? t('qualification.queue.expiredEvidence', { count: c.expiredEvidence })
              : null,
          ]
            .filter((part): part is string => part !== null)
            .join(' · ')}
        </span>
      )}
    </>
  );
}
