/**
 * SUP-20 — Qualification applications (FR-02, FR-06, BR-03; AC-07): the supplier's registration next to its
 * qualification status per buyer and program ("Registered — not qualified for WTR-PUMP"), expiring evidence, its
 * applications with review status and open requests for information, and the programs it can apply to with their
 * categories, thresholds and questions. Decisions and renewals are on SUP-24.
 */

import {
  SUPPLIER_APPLICATION_SORT_FIELDS,
  SUPPLIER_PROGRAM_SORT_FIELDS,
  qualificationEndpoints as api,
} from '@contracts/qualification';
import type {
  SupplierApplicationRow,
  SupplierOverview,
  SupplierProgramRow,
  SupplierStatusRow,
} from '@contracts/qualification';
import {
  QUALIFICATION_APPLICATIONS_STATUS,
  V_QUALIFICATION_STATUS_EFFECTIVE_STATUS,
} from '@contracts/enums';

import { useApiQuery } from '../../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../../app/hooks';
import { useCanCall, usePermission } from '../../../../auth/permissions';
import {
  Banner,
  ButtonLink,
  Card,
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
  QueryView,
  Reference,
  SearchField,
  Select,
  StatusChip,
  Tabs,
  TextField,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatCount, formatDateTime } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { EffectiveStatusChip } from '../../components/shared';
import { useOfficialTimeZone } from '../../lib/hooks';
import { compact, dateOf, directionOf, idOf, oneOf, sortOf, tableSort } from '../../lib/lists';
import { supplierQualificationPaths } from '../../lib/paths';
import { categoryLabel, dateOrDash, gateText, scopeText, cellStack } from '../../lib/text';

const QUALIFIED = new Set(['qualified', 'qualified_with_conditions']);

const DEFAULTS = {
  tab: 'applications',
  q: '',
  status: '',
  buyerTenantId: '',
  updatedFrom: '',
  updatedTo: '',
  appSort: 'updatedAt',
  appDir: 'desc',
  appPage: 1,
  categoryCode: '',
  myStatus: '',
  programSort: 'name',
  programDir: 'asc',
  programPage: 1,
  pageSize: 25,
};

export default function SupplierQualificationPage() {
  const overview = useApiQuery(api.getSupplierOverview, {});
  const canApply = usePermission('supplier.qualification.apply');
  return (
    <div className="tiq-page">
      <PageHeader
        title={t('qualification.supplier.title')}
        subtitle={t('qualification.supplier.intro')}
        actions={
          <ButtonLink to={supplierQualificationPaths.decisions} icon="gavel">
            {t('qualification.supplier.toDecisions')}
          </ButtonLink>
        }
      />
      <QueryView query={overview}>{(data) => <OverviewSection overview={data} />}</QueryView>
      {canApply && <WorkSection buyers={buyersOf(overview.data)} />}
    </div>
  );
}

function buyersOf(overview: SupplierOverview | undefined): { value: string; label: string }[] {
  const seen = new Map<number, string>();
  for (const row of overview?.statuses ?? []) seen.set(row.buyer.buyerTenantId, row.buyer.name);
  return [...seen.entries()].map(([id, name]) => ({ value: String(id), label: name }));
}

function OverviewSection({ overview }: { readonly overview: SupplierOverview }) {
  const qualifiedCount = overview.statuses.filter((row) =>
    QUALIFIED.has(row.effectiveStatus),
  ).length;
  const inProgress = overview.statuses.filter((row) => row.applicationInProgress !== null).length;
  const columns: DataTableColumn<SupplierStatusRow>[] = [
    {
      id: 'buyer',
      header: t('qualification.supplier.col.buyer'),
      cell: (row) => <strong>{row.buyer.name}</strong>,
    },
    {
      id: 'program',
      header: t('qualification.supplier.col.program'),
      cell: (row) => (
        <>
          <span>{row.program.programName}</span>
          <span className="tiq-cell-sub">
            {row.coveredCategories.map((category) => category.code).join(', ')}
          </span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('qualification.supplier.col.status'),
      cell: (row) => (
        <span className="tiq-stack" style={cellStack}>
          <EffectiveStatusChip status={row.effectiveStatus} size="sm" />
          {!QUALIFIED.has(row.effectiveStatus) && (
            <strong className="tiq-text-warning">
              {t('qualification.common.registeredNotQualified', {
                category: row.coveredCategories.map((category) => category.code).join(', '),
              })}
            </strong>
          )}
        </span>
      ),
    },
    {
      id: 'scope',
      header: t('qualification.supplier.col.scope'),
      cell: (row) => (
        <>
          <OrDash>
            {row.scopeCategory === null ? null : scopeText(row.scopeCategory, row.scopeMaxValue)}
          </OrDash>
          {row.blockedGate !== null && row.blockedGate !== 'none' && (
            <span className="tiq-cell-sub tiq-text-warning">{gateText(row.blockedGate)}</span>
          )}
        </>
      ),
    },
    {
      id: 'expires',
      header: t('qualification.supplier.col.expires'),
      cell: (row) => <OrDash>{dateOrDash(row.effectiveTo)}</OrDash>,
    },
    {
      id: 'application',
      header: t('qualification.supplier.col.application'),
      cell: (row) =>
        row.applicationInProgress === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <span className="tiq-inline">
            <Reference
              value={row.applicationInProgress.reference ?? t('qualification.supplier.draft')}
              to={supplierQualificationPaths.application(row.applicationInProgress.applicationId)}
            />
            <StatusChip
              enum="qualification_applications.status"
              value={row.applicationInProgress.status}
              size="sm"
            />
          </span>
        ),
    },
  ];
  return (
    <>
      <Banner
        tone="info"
        title={t('qualification.supplier.registrationTitle', { name: overview.supplier.name })}
      >
        {t('qualification.supplier.registration', {
          registration: tEnum('tenants.status', overview.registrationStatus),
          verification: tEnum('tenants.verification_status', overview.verificationStatus),
        })}
      </Banner>
      <KpiGrid>
        <KpiCard
          label={t('qualification.supplier.kpi.qualified')}
          icon="shieldCheck"
          tone="success"
          value={formatCount(qualifiedCount)}
          hint={t('qualification.supplier.kpi.qualifiedHint', { count: overview.statuses.length })}
        />
        <KpiCard
          label={t('qualification.supplier.kpi.notQualified')}
          icon="alertTriangle"
          tone="warning"
          value={formatCount(overview.statuses.length - qualifiedCount)}
          hint={t('qualification.supplier.kpi.notQualifiedHint')}
        />
        <KpiCard
          label={t('qualification.supplier.kpi.inProgress')}
          icon="clipboard"
          tone="info"
          value={formatCount(inProgress)}
          hint={t('qualification.supplier.kpi.inProgressHint')}
        />
        <KpiCard
          label={t('qualification.supplier.kpi.requests')}
          icon="messageQuestion"
          tone="danger"
          value={formatCount(overview.openInfoRequests)}
          hint={t('qualification.supplier.kpi.requestsHint')}
        />
      </KpiGrid>
      <Card
        flush
        title={t('qualification.supplier.statusTitle')}
        subtitle={t('qualification.supplier.statusHint')}
      >
        <DataTable
          caption={t('qualification.supplier.statusTitle')}
          columns={columns}
          rows={overview.statuses}
          rowKey={(row) => `${row.buyer.buyerTenantId}-${row.program.programId}`}
          empty={<EmptyState compact title={t('qualification.supplier.noStatuses')} />}
        />
      </Card>
      {overview.expiringEvidence.length > 0 && (
        <Card
          title={t('qualification.supplier.expiringTitle')}
          subtitle={t('qualification.supplier.expiringHint')}
        >
          <div role="list" className="tiq-stack">
            {overview.expiringEvidence.map((item) => (
              <div role="listitem" key={item.evidenceItemId} className="tiq-inline">
                <Chip tone="warning" size="sm" icon="hourglass">
                  {t('qualification.evidence.expiresOn', {
                    date: dateOrDash(item.expiresAt) ?? '',
                  })}
                </Chip>
                <span>{item.title}</span>
                <span className="tiq-text-muted">
                  {tEnum('evidence_items.evidence_type', item.evidenceType)}
                  {item.citedByDecisionIds.length > 0 &&
                    ` · ${t('qualification.supplier.citedBy', { count: item.citedByDecisionIds.length })}`}
                </span>
                {item.citedByDecisionIds.map((decisionId) => (
                  <Reference
                    key={decisionId}
                    value={t('qualification.decision.decisionNo', { id: decisionId })}
                    to={supplierQualificationPaths.decision(decisionId)}
                  />
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function WorkSection({ buyers }: { readonly buyers: readonly { value: string; label: string }[] }) {
  const timeZone = useOfficialTimeZone();
  const tenant = useActiveTenant();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-20', DEFAULTS);
  const canApplications = useCanCall(api.listSupplierApplications);
  const canPrograms = useCanCall(api.listSupplierPrograms);
  // A list the membership cannot read is left out with its tab (DD-49); the selection falls back to the other one.
  const tab: 'applications' | 'programs' | null =
    (filters.tab === 'programs' || !canApplications) && canPrograms
      ? 'programs'
      : canApplications
        ? 'applications'
        : null;

  const applications = useApiQuery(
    api.listSupplierApplications,
    tab === 'applications'
      ? {
          query: compact({
            q: filters.q.trim(),
            status: oneOf(filters.status, QUALIFICATION_APPLICATIONS_STATUS),
            buyerTenantId: idOf(filters.buyerTenantId),
            updatedFrom: dateOf(filters.updatedFrom),
            updatedTo: dateOf(filters.updatedTo),
            sort: sortOf(filters.appSort, SUPPLIER_APPLICATION_SORT_FIELDS, 'updatedAt'),
            dir: directionOf(filters.appDir),
            page: filters.appPage,
            pageSize: filters.pageSize,
          }),
        }
      : null,
  );
  const programs = useApiQuery(
    api.listSupplierPrograms,
    tab === 'programs'
      ? {
          query: compact({
            q: filters.q.trim(),
            buyerTenantId: idOf(filters.buyerTenantId),
            categoryCode: filters.categoryCode.trim(),
            myStatus: oneOf(filters.myStatus, V_QUALIFICATION_STATUS_EFFECTIVE_STATUS),
            sort: sortOf(filters.programSort, SUPPLIER_PROGRAM_SORT_FIELDS, 'name'),
            dir: directionOf(filters.programDir),
            page: filters.programPage,
            pageSize: filters.pageSize,
          }),
        }
      : null,
  );
  const filtered =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.buyerTenantId !== '' ||
    filters.updatedFrom !== '' ||
    filters.updatedTo !== '' ||
    filters.categoryCode !== '' ||
    filters.myStatus !== '';

  const appColumns: DataTableColumn<SupplierApplicationRow>[] = [
    {
      id: 'reference',
      header: t('qualification.supplier.col.application'),
      sortable: true,
      cell: (row) => (
        <>
          <Reference
            value={row.reference ?? t('qualification.supplier.draft')}
            to={supplierQualificationPaths.application(row.id)}
          />
          {row.renewalOfDecisionId !== null && (
            <span className="tiq-cell-sub">{t('qualification.queue.renewal')}</span>
          )}
        </>
      ),
    },
    {
      id: 'buyer',
      header: t('qualification.supplier.col.buyer'),
      cell: (row) => (
        <>
          <span>{row.buyer.name}</span>
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
      id: 'scope',
      header: t('qualification.supplier.col.scope'),
      cell: (row) => scopeText(row.scopeCategory, row.scopeMaxValue),
    },
    {
      id: 'completeness',
      header: t('qualification.queue.col.completeness'),
      cell: (row) => (
        <>
          <span className="tiq-num">
            {t('qualification.queue.answered', {
              answered: row.completeness.answered,
              total: row.completeness.criteriaTotal,
            })}
          </span>
          {row.completeness.mandatoryEvidenceMissing + row.completeness.mandatoryUnanswered > 0 && (
            <span className="tiq-cell-sub tiq-text-danger">
              {t('qualification.supplier.gaps', {
                count:
                  row.completeness.mandatoryEvidenceMissing + row.completeness.mandatoryUnanswered,
              })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'requests',
      header: t('qualification.supplier.col.requests'),
      cell: (row) =>
        row.openInfoRequestCount === 0 || row.nextDueAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <span className="tiq-stack" style={cellStack}>
            <span>
              {t('qualification.queue.openRequests', { count: row.openInfoRequestCount })}
            </span>
            <OfficialDeadline deadline={row.nextDueAt} showLocal={false} />
          </span>
        ),
    },
    {
      id: 'status',
      header: t('qualification.supplier.col.reviewStatus'),
      sortable: true,
      cell: (row) => (
        <StatusChip enum="qualification_applications.status" value={row.status} size="sm" />
      ),
    },
    {
      id: 'updatedAt',
      header: t('qualification.supplier.col.updated'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{formatDateTime(row.updatedAt, timeZone)}</span>
          {row.submittedAt !== null && (
            <span className="tiq-cell-sub">
              {t('qualification.queue.submittedOn', {
                date: formatDateTime(row.submittedAt, timeZone),
              })}
            </span>
          )}
        </>
      ),
    },
  ];

  const programColumns: DataTableColumn<SupplierProgramRow>[] = [
    {
      id: 'name',
      header: t('qualification.supplier.col.program'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.name}</span>
          <span className="tiq-cell-sub">
            {t('qualification.common.versionNo', { no: row.currentVersion.versionNo })}
          </span>
        </>
      ),
    },
    {
      id: 'buyerName',
      header: t('qualification.supplier.col.buyer'),
      sortable: true,
      cell: (row) => row.buyer.name,
    },
    {
      id: 'categories',
      header: t('qualification.supplier.col.categories'),
      cell: (row) => (
        <>
          <span>{categoryLabel(row.category)}</span>
          <span className="tiq-cell-sub">
            {row.coveredCategories.map((category) => category.code).join(', ')}
          </span>
        </>
      ),
    },
    {
      id: 'thresholds',
      header: t('qualification.supplier.col.thresholds'),
      cell: (row) => (
        <>
          <span>{scopeText(row.category, row.maxContractValue, row.geography)}</span>
          <span className="tiq-cell-sub">
            {t('qualification.supplier.questions', { count: row.criteriaCount })} ·{' '}
            {t('qualification.programs.months', { count: row.validityMonths })}
          </span>
        </>
      ),
    },
    {
      id: 'myStatus',
      header: t('qualification.supplier.col.myStatus'),
      cell: (row) => (
        <span className="tiq-stack" style={cellStack}>
          <EffectiveStatusChip status={row.myStatus} size="sm" />
          {row.myApplicationInProgress !== null && (
            <StatusChip
              enum="qualification_applications.status"
              value={row.myApplicationInProgress.status}
              size="sm"
            />
          )}
        </span>
      ),
    },
  ];

  if (tab === null) return null;
  return (
    <Tabs
      label={t('qualification.supplier.tabsLabel', { name: tenant?.name ?? '' })}
      selected={tab}
      onSelect={(id) => setFilters({ tab: id })}
      tabs={[
        ...(canApplications
          ? [{ id: 'applications', label: t('qualification.supplier.tab.applications') }]
          : []),
        ...(canPrograms
          ? [{ id: 'programs', label: t('qualification.supplier.tab.programs') }]
          : []),
      ]}
    >
      <div className="tiq-stack">
        <FilterBar
          label={t('qualification.supplier.filters')}
          onClear={clearFilters}
          canClear={filtered}
        >
          <SearchField
            label={t('qualification.common.search')}
            placeholder={t('qualification.supplier.searchPlaceholder')}
            value={filters.q}
            onChange={(q) => setFilters({ q, appPage: 1, programPage: 1 })}
          />
          <Select
            label={t('qualification.supplier.col.buyer')}
            placeholder={t('qualification.common.allBuyers')}
            value={filters.buyerTenantId}
            onChange={(buyerTenantId) => setFilters({ buyerTenantId, appPage: 1, programPage: 1 })}
            options={buyers}
          />
          {tab === 'applications' ? (
            <>
              <Select
                label={t('qualification.supplier.col.reviewStatus')}
                placeholder={t('qualification.common.allStatuses')}
                value={filters.status}
                onChange={(status) => setFilters({ status, appPage: 1 })}
                options={QUALIFICATION_APPLICATIONS_STATUS.map((value) => ({
                  value,
                  label: tEnum('qualification_applications.status', value),
                }))}
              />
              <DateInput
                label={t('qualification.programs.filter.updatedFrom')}
                value={filters.updatedFrom}
                onChange={(updatedFrom) => setFilters({ updatedFrom, appPage: 1 })}
              />
              <DateInput
                label={t('qualification.programs.filter.updatedTo')}
                value={filters.updatedTo}
                onChange={(updatedTo) => setFilters({ updatedTo, appPage: 1 })}
              />
            </>
          ) : (
            <>
              <TextField
                label={t('qualification.supplier.categoryCode')}
                placeholder={t('qualification.supplier.categoryCodePlaceholder')}
                value={filters.categoryCode}
                onChange={(categoryCode) => setFilters({ categoryCode, programPage: 1 })}
              />
              <Select
                label={t('qualification.supplier.col.myStatus')}
                placeholder={t('qualification.common.allStatuses')}
                value={filters.myStatus}
                onChange={(myStatus) => setFilters({ myStatus, programPage: 1 })}
                options={V_QUALIFICATION_STATUS_EFFECTIVE_STATUS.map((value) => ({
                  value,
                  label: tEnum('v_qualification_status.effective_status', value),
                }))}
              />
            </>
          )}
        </FilterBar>
        {tab === 'applications'
          ? applications.error?.kind !== 'forbidden' && (
              <Card flush>
                <DataTable
                  caption={t('qualification.supplier.applicationsCaption')}
                  columns={appColumns}
                  rows={applications.data?.items}
                  rowKey={(row) => String(row.id)}
                  rowLabel={(row) =>
                    `${row.reference ?? t('qualification.supplier.draft')} ${row.program.programName}`
                  }
                  rowHref={(row) => supplierQualificationPaths.application(row.id)}
                  loading={applications.isFetching}
                  error={applications.error}
                  onRetry={applications.reload}
                  sort={tableSort(filters.appSort, filters.appDir)}
                  onSortChange={(sort) =>
                    setFilters({ appSort: sort.key, appDir: sort.dir, appPage: 1 })
                  }
                  empty={
                    <EmptyState
                      compact
                      title={
                        filtered
                          ? t('qualification.supplier.applicationsEmptyFiltered')
                          : t('qualification.supplier.applicationsEmpty')
                      }
                      description={
                        filtered ? undefined : t('qualification.supplier.applicationsEmptyHint')
                      }
                    />
                  }
                  pagination={
                    applications.data === undefined
                      ? undefined
                      : {
                          page: applications.data.page,
                          pageSize: applications.data.pageSize,
                          total: applications.data.total,
                          onPageChange: (appPage) => setFilters({ appPage }),
                          onPageSizeChange: (pageSize) => setFilters({ pageSize, appPage: 1 }),
                        }
                  }
                />
              </Card>
            )
          : programs.error?.kind !== 'forbidden' && (
              <Card flush>
                <DataTable
                  caption={t('qualification.supplier.programsCaption')}
                  columns={programColumns}
                  rows={programs.data?.items}
                  rowKey={(row) => String(row.id)}
                  rowLabel={(row) => row.name}
                  rowHref={(row) => supplierQualificationPaths.program(row.id)}
                  loading={programs.isFetching}
                  error={programs.error}
                  onRetry={programs.reload}
                  sort={tableSort(filters.programSort, filters.programDir)}
                  onSortChange={(sort) =>
                    setFilters({ programSort: sort.key, programDir: sort.dir, programPage: 1 })
                  }
                  empty={<EmptyState compact title={t('qualification.supplier.programsEmpty')} />}
                  pagination={
                    programs.data === undefined
                      ? undefined
                      : {
                          page: programs.data.page,
                          pageSize: programs.data.pageSize,
                          total: programs.data.total,
                          onPageChange: (programPage) => setFilters({ programPage }),
                          onPageSizeChange: (pageSize) => setFilters({ pageSize, programPage: 1 }),
                        }
                  }
                />
              </Card>
            )}
      </div>
    </Tabs>
  );
}
