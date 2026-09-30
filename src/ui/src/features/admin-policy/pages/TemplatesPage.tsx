/**
 * ADM-08 — Template and content library: tender packages, questionnaires, criteria sets, clauses, letters,
 * checklists and contract templates, each with its owner, intended procedure and category, audience, approval
 * status, effective date, review date and versions. Retired templates cannot be selected for new work (PRD §17.3).
 */
import { useNavigate } from 'react-router';

import {
  TEMPLATES_AUDIENCE,
  TEMPLATES_KIND,
  TEMPLATES_STATUS,
  TENDERS_PROCEDURE_WRITE,
} from '@contracts/enums';
import { getTemplateAuthoringOptions, listTemplates } from '@contracts/policy';
import type { TemplateSummary } from '@contracts/policy';

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
  OrDash,
  OverdueChip,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { PolicyLayout } from '../components/PolicyLayout';
import { useOfficialTimeZone } from '../lib/hooks';
import { compact, directionOf, oneOf, tableSort } from '../lib/lists';
import { policyPaths } from '../lib/paths';

const SORT_FIELDS = ['name', 'kind', 'status', 'reviewDate', 'effectiveFrom', 'updatedAt'] as const;
type SortField = (typeof SORT_FIELDS)[number];

const DEFAULTS = {
  q: '',
  kind: '',
  status: '',
  audience: '',
  procedure: '',
  owner: '',
  category: '',
  overdue: false,
  reviewFrom: '',
  reviewTo: '',
  sort: 'name',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

function sortField(value: string): SortField {
  return (SORT_FIELDS as readonly string[]).includes(value) ? (value as SortField) : 'name';
}

function positiveId(value: string): number | undefined {
  return /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const canManage = usePermission('org.templates.manage');
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-08', DEFAULTS);
  const options = useApiQuery(getTemplateAuthoringOptions, {});
  const query = useApiQuery(listTemplates, {
    query: compact({
      q: filters.q.trim(),
      kind: oneOf(filters.kind, TEMPLATES_KIND),
      status: oneOf(filters.status, TEMPLATES_STATUS),
      audience: oneOf(filters.audience, TEMPLATES_AUDIENCE),
      procedure: oneOf(filters.procedure, TENDERS_PROCEDURE_WRITE),
      ownerUserId: positiveId(filters.owner),
      categoryId: positiveId(filters.category),
      reviewOverdue: filters.overdue ? true : undefined,
      reviewFrom: filters.reviewFrom,
      reviewTo: filters.reviewTo,
      sort: sortField(filters.sort),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(listTemplates, { query: { pageSize: 100 } });
  const all = overview.data?.items ?? [];
  const loadingKpi = overview.data === undefined;
  const kpiRestricted = overview.error?.kind === 'forbidden';
  const filtered =
    filters.overdue ||
    [
      filters.q,
      filters.kind,
      filters.status,
      filters.audience,
      filters.procedure,
      filters.owner,
      filters.category,
      filters.reviewFrom,
      filters.reviewTo,
    ].some((value) => value !== '');

  const columns: DataTableColumn<TemplateSummary>[] = [
    {
      id: 'name',
      header: t('admin-policy.templates.col.name'),
      sortable: true,
      width: '24%',
      cell: (row) => (
        <>
          <span>{row.name}</span>
          <span className="tiq-cell-sub">{tEnum('templates.kind', row.kind)}</span>
        </>
      ),
    },
    {
      id: 'applies',
      header: t('admin-policy.templates.col.applies'),
      width: '18%',
      cell: (row) => (
        <>
          <span>
            {row.procedure === null
              ? t('admin-policy.templateForm.anyProcedure')
              : tEnum('tenders.procedure', row.procedure)}
          </span>
          <span className="tiq-cell-sub">
            {row.category === null ? t('admin-policy.templateForm.anyCategory') : row.category.name}
          </span>
          <span className="tiq-cell-sub">{tEnum('templates.audience', row.audience)}</span>
        </>
      ),
    },
    {
      id: 'owner',
      header: t('admin-policy.templates.col.owner'),
      cell: (row) => row.owner.fullName,
    },
    {
      id: 'status',
      header: t('admin-policy.templates.col.status'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-inline">
          <StatusChip enum="templates.status" value={row.status} />
          {!row.selectable && row.status !== 'retired' && (
            <Chip tone="neutral" size="sm">
              {t('admin-policy.templates.notSelectable')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'version',
      header: t('admin-policy.templates.col.version'),
      sortable: true,
      sortKey: 'effectiveFrom',
      cell: (row) => (
        <>
          <OrDash>
            {row.currentVersionNo === null
              ? null
              : t('admin-policy.common.versionNo', { no: row.currentVersionNo })}
          </OrDash>
          {row.effectiveFrom !== null && (
            <span className="tiq-cell-sub">
              {t('admin-policy.profiles.effectiveFrom', {
                date: formatInstantDate(row.effectiveFrom, timeZone),
              })}
            </span>
          )}
          {row.pendingVersionNo !== null && (
            <span className="tiq-cell-sub">
              {t('admin-policy.templates.pendingRevision', { no: row.pendingVersionNo })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'reviewDate',
      header: t('admin-policy.templates.col.review'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-inline">
          <span className={row.reviewOverdue ? 'tiq-text-danger' : undefined}>
            <OrDash>{row.reviewDate === null ? null : formatCalendarDate(row.reviewDate)}</OrDash>
          </span>
          {row.reviewOverdue && <OverdueChip />}
        </span>
      ),
    },
    {
      id: 'usage',
      header: t('admin-policy.templates.col.usage'),
      numeric: true,
      cell: (row) => formatCount(row.usageCount),
    },
  ];

  return (
    <PolicyLayout>
      <PageHeader
        title={t('admin-policy.templates.title')}
        subtitle={t('admin-policy.templates.intro')}
        primaryAction={
          canManage ? (
            <ButtonLink to={policyPaths.newTemplate} variant="primary" icon="plus">
              {t('admin-policy.templates.new')}
            </ButtonLink>
          ) : undefined
        }
      />
      <FilterBar
        label={t('admin-policy.templates.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-policy.common.search')}
          placeholder={t('admin-policy.templates.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-policy.templates.filter.kind')}
          placeholder={t('admin-policy.templates.filter.allKinds')}
          value={filters.kind}
          options={TEMPLATES_KIND.map((value) => ({
            value,
            label: tEnum('templates.kind', value),
          }))}
          onChange={(kind) => setFilters({ kind, page: 1 })}
        />
        <Select
          label={t('admin-policy.templates.filter.status')}
          placeholder={t('admin-policy.common.allStatuses')}
          value={filters.status}
          options={TEMPLATES_STATUS.map((value) => ({
            value,
            label: tEnum('templates.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('admin-policy.templates.filter.owner')}
          placeholder={t('admin-policy.templates.filter.allOwners')}
          value={filters.owner}
          options={(options.data?.owners ?? []).map((owner) => ({
            value: String(owner.userId),
            label: owner.fullName,
          }))}
          onChange={(owner) => setFilters({ owner, page: 1 })}
        />
        <Select
          label={t('admin-policy.templates.filter.audience')}
          placeholder={t('admin-policy.fields.filter.allAudiences')}
          value={filters.audience}
          options={TEMPLATES_AUDIENCE.map((value) => ({
            value,
            label: tEnum('templates.audience', value),
          }))}
          onChange={(audience) => setFilters({ audience, page: 1 })}
        />
        <Select
          label={t('admin-policy.templates.filter.procedure')}
          placeholder={t('admin-policy.common.allProcedures')}
          value={filters.procedure}
          options={TENDERS_PROCEDURE_WRITE.map((value) => ({
            value,
            label: tEnum('tenders.procedure', value),
          }))}
          onChange={(procedure) => setFilters({ procedure, page: 1 })}
        />
        <Select
          label={t('admin-policy.templates.filter.category')}
          placeholder={t('admin-policy.templates.filter.allCategories')}
          value={filters.category}
          options={(options.data?.categories ?? []).map((category) => ({
            value: String(category.categoryId),
            label: category.name,
          }))}
          onChange={(category) => setFilters({ category, page: 1 })}
        />
        <DateInput
          label={t('admin-policy.templates.filter.reviewFrom')}
          value={filters.reviewFrom}
          onChange={(reviewFrom) => setFilters({ reviewFrom, page: 1 })}
        />
        <DateInput
          label={t('admin-policy.templates.filter.reviewTo')}
          value={filters.reviewTo}
          onChange={(reviewTo) => setFilters({ reviewTo, page: 1 })}
        />
        <Checkbox
          label={t('admin-policy.templates.filter.overdue')}
          checked={filters.overdue}
          onChange={(overdue) => setFilters({ overdue, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('admin-policy.templates.kpi.selectable')}
          icon="checkCircle"
          tone="success"
          restricted={kpiRestricted}
          value={loadingKpi ? '…' : formatCount(all.filter((row) => row.selectable).length)}
          hint={t('admin-policy.templates.kpi.selectableHint')}
        />
        <KpiCard
          label={t('admin-policy.templates.kpi.review')}
          icon="clipboardCheck"
          tone="warning"
          restricted={kpiRestricted}
          value={
            loadingKpi
              ? '…'
              : formatCount(
                  all.filter((row) => row.status === 'in_review' || row.pendingVersionNo !== null)
                    .length,
                )
          }
          hint={t('admin-policy.templates.kpi.reviewHint')}
        />
        <KpiCard
          label={t('admin-policy.templates.kpi.overdue')}
          icon="alertTriangle"
          tone="danger"
          restricted={kpiRestricted}
          value={loadingKpi ? '…' : formatCount(all.filter((row) => row.reviewOverdue).length)}
          hint={t('admin-policy.templates.kpi.overdueHint')}
        />
        <KpiCard
          label={t('admin-policy.templates.kpi.retired')}
          icon="archive"
          tone="info"
          restricted={kpiRestricted}
          value={
            loadingKpi ? '…' : formatCount(all.filter((row) => row.status === 'retired').length)
          }
          hint={t('admin-policy.templates.kpi.retiredHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('admin-policy.templates.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => row.name}
          onRowClick={(row) => void navigate(policyPaths.template(row.id))}
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
                  ? t('admin-policy.templates.emptyFiltered')
                  : t('admin-policy.templates.empty')
              }
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
    </PolicyLayout>
  );
}
