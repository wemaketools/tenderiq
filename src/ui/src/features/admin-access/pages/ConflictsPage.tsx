/**
 * ADM-04 — Conflict-declaration review queue (PRD §5.4, AC-02, DD-25): declarations with the declarant, capacity,
 * the record and supplier concerned, the nature, the disposition and whether restricted access is blocked. The
 * reviewer also sees when a declarant belongs to supplier organizations (dual membership), without exposing
 * unrelated personal information to anyone else.
 */

import {
  CONFLICT_DECLARATIONS_DISPOSITION,
  CONFLICT_DECLARATIONS_NATURE,
  CONFLICT_DECLARATIONS_SUBJECT_TYPE,
} from '@contracts/enums';
import { CONFLICT_SORTS, orgAdminEndpoints } from '@contracts/org-admin';
import type { ConflictDeclarationRow } from '@contracts/org-admin';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Card,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AccessLayout } from '../components/AccessLayout';
import { PersonCell } from '../components/AccessBits';
import { useOfficialTimeZone } from '../lib/hooks';
import {
  booleanFilter,
  compact,
  directionOf,
  isFiltered,
  oneOf,
  pagingOf,
  sortOf,
  tableSort,
} from '../lib/lists';
import { buyerAccessPaths } from '../lib/paths';

const DEFAULTS = {
  q: '',
  disposition: 'pending_review',
  subjectType: '',
  nature: '',
  hasConflict: '',
  dualMembership: '',
  declaredFrom: '',
  declaredTo: '',
  sort: 'declaredAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

export default function ConflictsPage() {
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('ADM-04:conflicts', DEFAULTS);
  const query = useApiQuery(orgAdminEndpoints.listConflictDeclarations, {
    query: compact({
      q: filters.q.trim(),
      disposition: oneOf(filters.disposition, CONFLICT_DECLARATIONS_DISPOSITION),
      subjectType: oneOf(filters.subjectType, CONFLICT_DECLARATIONS_SUBJECT_TYPE),
      nature: oneOf(filters.nature, CONFLICT_DECLARATIONS_NATURE),
      hasConflict: booleanFilter(filters.hasConflict),
      dualMembership: booleanFilter(filters.dualMembership),
      declaredFrom: filters.declaredFrom,
      declaredTo: filters.declaredTo,
      sort: sortOf(filters.sort, CONFLICT_SORTS, 'declaredAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(orgAdminEndpoints.listConflictDeclarations, {
    query: { pageSize: 100 },
  });
  const all = overview.data?.items ?? [];
  const count = (rows: readonly ConflictDeclarationRow[]): string =>
    overview.data === undefined ? '…' : formatCount(rows.length);
  const filtered = isFiltered(filters);

  const columns: DataTableColumn<ConflictDeclarationRow>[] = [
    {
      id: 'declarant',
      header: t('admin-access.conflicts.col.declarant'),
      sortable: true,
      cell: (row) => (
        <>
          <PersonCell name={row.declarant.fullName} sub={row.capacity} />
          {row.holdsSupplierMemberships && (
            <Chip tone="warning" size="sm" icon="briefcase">
              {t('admin-access.conflicts.dual')}
            </Chip>
          )}
        </>
      ),
    },
    {
      id: 'subject',
      header: t('admin-access.conflicts.col.subject'),
      cell: (row) => (
        <>
          <span>
            {row.subject.reference !== null && (
              <span className="tiq-ref">{row.subject.reference} </span>
            )}
            {row.subject.title}
          </span>
          <span className="tiq-cell-sub">
            {tEnum('conflict_declarations.subject_type', row.subject.subjectType)}
            {row.supplierName !== null && ` · ${row.supplierName}`}
          </span>
        </>
      ),
    },
    {
      id: 'nature',
      header: t('admin-access.conflicts.col.nature'),
      cell: (row) =>
        row.hasConflict ? (
          row.nature === null ? (
            t('admin-access.conflicts.declared')
          ) : (
            tEnum('conflict_declarations.nature', row.nature)
          )
        ) : (
          <span className="tiq-text-muted">{t('admin-access.conflicts.noConflict')}</span>
        ),
    },
    {
      id: 'declaredAt',
      header: t('admin-access.conflicts.col.declared'),
      sortable: true,
      cell: (row) => formatInstantDate(row.declaredAt, timeZone),
    },
    {
      id: 'disposition',
      header: t('admin-access.conflicts.col.disposition'),
      sortable: true,
      cell: (row) => (
        <>
          <StatusChip enum="conflict_declarations.disposition" value={row.disposition} size="sm" />
          {row.reviewedBy !== null && (
            <span className="tiq-cell-sub">
              {t('admin-access.conflicts.reviewedBy', {
                name: row.reviewedBy.fullName,
                date: row.reviewedAt === null ? '' : formatInstantDate(row.reviewedAt, timeZone),
              })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'access',
      header: t('admin-access.conflicts.col.access'),
      cell: (row) =>
        row.accessBlocked ? (
          <Chip tone="danger" size="sm" icon="lock">
            {t('admin-access.conflicts.blocked')}
          </Chip>
        ) : (
          <Chip tone="success" size="sm">
            {t('admin-access.conflicts.open')}
          </Chip>
        ),
    },
  ];

  const yesNo = [
    { value: 'true', label: t('admin-access.common.yes') },
    { value: 'false', label: t('admin-access.common.no') },
  ];

  return (
    <AccessLayout>
      <PageHeader
        title={t('admin-access.conflicts.title')}
        subtitle={t('admin-access.conflicts.intro')}
      />
      <FilterBar
        label={t('admin-access.conflicts.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t('admin-access.conflicts.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-access.conflicts.col.disposition')}
          placeholder={t('admin-access.common.allStatuses')}
          value={filters.disposition}
          options={CONFLICT_DECLARATIONS_DISPOSITION.map((value) => ({
            value,
            label: tEnum('conflict_declarations.disposition', value),
          }))}
          onChange={(disposition) => setFilters({ disposition, page: 1 })}
        />
        <Select
          label={t('admin-access.conflicts.filter.subject')}
          placeholder={t('admin-access.common.all')}
          value={filters.subjectType}
          options={CONFLICT_DECLARATIONS_SUBJECT_TYPE.map((value) => ({
            value,
            label: tEnum('conflict_declarations.subject_type', value),
          }))}
          onChange={(subjectType) => setFilters({ subjectType, page: 1 })}
        />
        <Select
          label={t('admin-access.conflicts.col.nature')}
          placeholder={t('admin-access.common.all')}
          value={filters.nature}
          options={CONFLICT_DECLARATIONS_NATURE.map((value) => ({
            value,
            label: tEnum('conflict_declarations.nature', value),
          }))}
          onChange={(nature) => setFilters({ nature, page: 1 })}
        />
        <Select
          label={t('admin-access.conflicts.filter.hasConflict')}
          placeholder={t('admin-access.common.all')}
          value={filters.hasConflict}
          options={yesNo}
          onChange={(hasConflict) => setFilters({ hasConflict, page: 1 })}
        />
        <Select
          label={t('admin-access.conflicts.filter.dual')}
          placeholder={t('admin-access.common.all')}
          value={filters.dualMembership}
          options={yesNo}
          onChange={(dualMembership) => setFilters({ dualMembership, page: 1 })}
        />
        <DateInput
          label={t('admin-access.conflicts.filter.from')}
          value={filters.declaredFrom}
          onChange={(declaredFrom) => setFilters({ declaredFrom, page: 1 })}
        />
        <DateInput
          label={t('admin-access.conflicts.filter.to')}
          value={filters.declaredTo}
          onChange={(declaredTo) => setFilters({ declaredTo, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('admin-access.conflicts.kpi.pending')}
          icon="hourglass"
          tone="warning"
          value={count(all.filter((row) => row.disposition === 'pending_review'))}
          hint={t('admin-access.conflicts.kpi.pendingHint')}
          restricted={overview.error?.kind === 'forbidden'}
        />
        <KpiCard
          label={t('admin-access.conflicts.kpi.dual')}
          icon="briefcase"
          tone="info"
          value={count(all.filter((row) => row.holdsSupplierMemberships))}
          hint={t('admin-access.conflicts.kpi.dualHint')}
          restricted={overview.error?.kind === 'forbidden'}
        />
        <KpiCard
          label={t('admin-access.conflicts.kpi.blocked')}
          icon="lock"
          tone="danger"
          value={count(all.filter((row) => row.accessBlocked))}
          hint={t('admin-access.conflicts.kpi.blockedHint')}
          restricted={overview.error?.kind === 'forbidden'}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('admin-access.conflicts.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.declarationId)}
          rowLabel={(row) => `${row.declarant.fullName} ${row.subject.title}`}
          rowHref={(row) => buyerAccessPaths.conflict(row.declarationId)}
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
                  ? t('admin-access.conflicts.emptyFiltered')
                  : t('admin-access.conflicts.empty')
              }
            />
          }
          pagination={pagingOf(query.data, setFilters)}
        />
      </Card>
    </AccessLayout>
  );
}
