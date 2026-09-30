/**
 * ADM-09 — Qualification programs (FR-06, PRD §7.3, §17): the register of versioned programs with their category
 * scope, current and draft criteria versions, validity, owner, open applications and qualified suppliers. Program
 * managers establish new programs; everyone who applies the criteria can read them.
 */
import { useNavigate } from 'react-router';

import { PROGRAM_SORT_FIELDS, qualificationEndpoints as api } from '@contracts/qualification';
import type { ProgramRow } from '@contracts/qualification';
import { QUALIFICATION_PROGRAMS_STATUS } from '@contracts/enums';

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
  SearchField,
  Select,
  StatusChip,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatCount, formatInstantDate, formatMoney } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { useOfficialTimeZone } from '../../lib/hooks';
import { compact, dateOf, directionOf, idOf, oneOf, sortOf, tableSort } from '../../lib/lists';
import { buyerQualificationPaths } from '../../lib/paths';
import { categoryLabel, cellStack } from '../../lib/text';

const DEFAULTS = {
  q: '',
  status: '',
  categoryId: '',
  ownerUserId: '',
  updatedFrom: '',
  updatedTo: '',
  sort: 'name',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

export default function ProgramsPage() {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const canManage = usePermission('qualification.program.manage');
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-09', DEFAULTS);
  const query = useApiQuery(api.listPrograms, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, QUALIFICATION_PROGRAMS_STATUS),
      categoryId: idOf(filters.categoryId),
      ownerUserId: idOf(filters.ownerUserId),
      updatedFrom: dateOf(filters.updatedFrom),
      updatedTo: dateOf(filters.updatedTo),
      sort: sortOf(filters.sort, PROGRAM_SORT_FIELDS, 'name'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(api.listPrograms, { query: { pageSize: 100 } });
  const options = useApiQuery(api.getQualificationOptions, {});

  const all = overview.data?.items ?? [];
  const kpi = (value: number): string => (overview.data === undefined ? '…' : formatCount(value));
  const filtered =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.categoryId !== '' ||
    filters.ownerUserId !== '' ||
    filters.updatedFrom !== '' ||
    filters.updatedTo !== '';

  const columns: DataTableColumn<ProgramRow>[] = [
    {
      id: 'name',
      header: t('qualification.programs.col.name'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.name}</span>
          <span className="tiq-cell-sub">{row.owner.fullName}</span>
        </>
      ),
    },
    {
      id: 'scope',
      header: t('qualification.programs.col.scope'),
      cell: (row) => (
        <>
          <span>{categoryLabel(row.category)}</span>
          <span className="tiq-cell-sub">
            {[
              t('qualification.programs.covers', { count: row.coveredCategories.length }),
              row.maxContractValue === null
                ? t('qualification.common.noValueLimit')
                : t('qualification.common.upTo', { value: formatMoney(row.maxContractValue) }),
              row.geography,
            ]
              .filter((part): part is string => part !== null && part !== '')
              .join(' · ')}
          </span>
        </>
      ),
    },
    {
      id: 'version',
      header: t('qualification.programs.col.version'),
      cell: (row) => (
        <span className="tiq-stack" style={cellStack}>
          {row.currentVersion === null ? (
            <span className="tiq-text-muted">{t('qualification.programs.noCurrent')}</span>
          ) : (
            <span>
              {t('qualification.programs.versionApproved', {
                no: row.currentVersion.versionNo,
                date: formatInstantDate(row.currentVersion.approvedAt, timeZone),
              })}
            </span>
          )}
          {row.draftVersionNo !== null && (
            <Chip tone="info" size="sm" icon="edit">
              {t('qualification.programs.draftVersion', { no: row.draftVersionNo })}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'criteria',
      header: t('qualification.programs.col.criteria'),
      numeric: true,
      cell: (row) => formatCount(row.criteriaCount),
    },
    {
      id: 'validity',
      header: t('qualification.programs.col.validity'),
      cell: (row) => (
        <>
          <span>{t('qualification.programs.months', { count: row.validityMonths })}</span>
          <span className="tiq-cell-sub">
            {t('qualification.programs.notice', { count: row.renewalNoticeDays })}
          </span>
        </>
      ),
    },
    {
      id: 'openApplicationCount',
      header: t('qualification.programs.col.applications'),
      sortable: true,
      numeric: true,
      cell: (row) => formatCount(row.openApplicationCount),
    },
    {
      id: 'qualified',
      header: t('qualification.programs.col.qualified'),
      numeric: true,
      cell: (row) => formatCount(row.qualifiedSupplierCount),
    },
    {
      id: 'status',
      header: t('qualification.programs.col.status'),
      sortable: true,
      cell: (row) => (
        <StatusChip enum="qualification_programs.status" value={row.status} size="sm" />
      ),
    },
    {
      id: 'updatedAt',
      header: t('qualification.programs.col.updated'),
      sortable: true,
      cell: (row) => <OrDash>{formatInstantDate(row.updatedAt, timeZone)}</OrDash>,
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('qualification.programs.title')}
        subtitle={t('qualification.programs.intro')}
        primaryAction={
          canManage ? (
            <ButtonLink to={buyerQualificationPaths.newProgram} variant="primary" icon="plus">
              {t('qualification.programs.new')}
            </ButtonLink>
          ) : undefined
        }
      />
      <FilterBar
        label={t('qualification.programs.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('qualification.common.search')}
          placeholder={t('qualification.programs.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('qualification.programs.filter.status')}
          placeholder={t('qualification.common.allStatuses')}
          value={filters.status}
          onChange={(status) => setFilters({ status, page: 1 })}
          options={QUALIFICATION_PROGRAMS_STATUS.map((value) => ({
            value,
            label: tEnum('qualification_programs.status', value),
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
          label={t('qualification.programs.filter.owner')}
          placeholder={t('qualification.common.allOwners')}
          value={filters.ownerUserId}
          onChange={(ownerUserId) => setFilters({ ownerUserId, page: 1 })}
          options={(options.data?.programOwners ?? []).map((person) => ({
            value: String(person.userId),
            label: person.fullName,
          }))}
        />
        <DateInput
          label={t('qualification.programs.filter.updatedFrom')}
          value={filters.updatedFrom}
          onChange={(updatedFrom) => setFilters({ updatedFrom, page: 1 })}
        />
        <DateInput
          label={t('qualification.programs.filter.updatedTo')}
          value={filters.updatedTo}
          onChange={(updatedTo) => setFilters({ updatedTo, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('qualification.programs.kpi.active')}
          icon="shieldCheck"
          value={kpi(all.filter((row) => row.status === 'active').length)}
          hint={t('qualification.programs.kpi.activeHint')}
        />
        <KpiCard
          label={t('qualification.programs.kpi.drafts')}
          icon="edit"
          tone="info"
          value={kpi(all.filter((row) => row.draftVersionNo !== null).length)}
          hint={t('qualification.programs.kpi.draftsHint')}
        />
        <KpiCard
          label={t('qualification.programs.kpi.applications')}
          icon="inbox"
          tone="warning"
          value={kpi(all.reduce((total, row) => total + row.openApplicationCount, 0))}
          hint={t('qualification.programs.kpi.applicationsHint')}
        />
        <KpiCard
          label={t('qualification.programs.kpi.qualified')}
          icon="userCheck"
          tone="success"
          value={kpi(all.reduce((total, row) => total + row.qualifiedSupplierCount, 0))}
          hint={t('qualification.programs.kpi.qualifiedHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('qualification.programs.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => row.name}
          onRowClick={(row) => void navigate(buyerQualificationPaths.program(row.id))}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          restricted={query.error?.kind === 'forbidden'}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered
                  ? t('qualification.programs.emptyFiltered')
                  : t('qualification.programs.empty')
              }
              description={filtered ? undefined : t('qualification.programs.emptyHint')}
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
