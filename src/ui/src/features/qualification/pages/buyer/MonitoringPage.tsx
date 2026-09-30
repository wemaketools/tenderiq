/**
 * BUY-35 — Qualification decisions and monitoring (FR-06, BR-24, BR-25, BR-48; AC-07, AC-09): the status of every
 * supplier × program (including not assessed and derived expiry), decisions with approved scope, dates, limits,
 * conditions and reasons, reassessment triggers with their active-event impacts, screening flags, and the
 * eligibility gate check ("Registered — not qualified for WTR-PUMP"). Decisions pending approval open from here;
 * suspension, renewal, withdrawal, notification and reassessment happen on the decision (always a new decision).
 */
import { useNavigate } from 'react-router';

import {
  DECISION_SORT_FIELDS,
  STATUS_SORT_FIELDS,
  TRIGGER_SORT_FIELDS,
  qualificationEndpoints as api,
} from '@contracts/qualification';
import type { Decision, StatusRow, Trigger } from '@contracts/qualification';
import {
  INTEGRITY_SCREENINGS_CHECK_TYPE,
  INTEGRITY_SCREENINGS_RESULT,
  QUALIFICATION_DECISIONS_OUTCOME,
  REASSESSMENT_TRIGGERS_STATUS,
  REASSESSMENT_TRIGGERS_TRIGGER_TYPE,
  V_QUALIFICATION_STATUS_EFFECTIVE_STATUS,
} from '@contracts/enums';

import { useApiQuery } from '../../../../api/hooks';
import { useScreenFilters } from '../../../../app/hooks';
import { usePermission } from '../../../../auth/permissions';
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
  KpiCard,
  KpiGrid,
  OrDash,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
  Tabs,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatCount, formatDateTime } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { EligibilityCheck } from '../../components/EligibilityCheck';
import { ScreeningsTable } from '../../components/ScreeningsTable';
import { EffectiveStatusChip, ExpiryChip, OutcomeChip } from '../../components/shared';
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
import { categoryLabel, dateOrDash, gateText, scopeText, cellStack } from '../../lib/text';

type TabId = 'statuses' | 'decisions' | 'triggers' | 'screenings' | 'eligibility';
const TABS: readonly TabId[] = ['statuses', 'decisions', 'triggers', 'screenings', 'eligibility'];

const DEFAULTS = {
  tab: 'statuses',
  q: '',
  programId: '',
  categoryId: '',
  effectiveStatus: '',
  expiringBefore: '',
  withOpenTriggers: false,
  statusSort: 'supplierName',
  statusDir: 'asc',
  statusPage: 1,
  outcome: '',
  includeSuperseded: false,
  decidedFrom: '',
  decidedTo: '',
  decisionSort: 'decidedAt',
  decisionDir: 'desc',
  decisionPage: 1,
  triggerStatus: 'open',
  triggerType: '',
  withImpacts: false,
  detectedFrom: '',
  detectedTo: '',
  triggerSort: 'detectedAt',
  triggerDir: 'desc',
  triggerPage: 1,
  screeningResult: '',
  checkType: '',
  unreviewed: true,
  screeningPage: 1,
  pageSize: 25,
};

export default function MonitoringPage() {
  const navigate = useNavigate();
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('BUY-35', DEFAULTS);
  const [, setQueueFilters] = useScreenFilters('BUY-33', { status: '', page: 1 });
  const canDecide = usePermission('qualification.decide');
  const tab: TabId = (TABS as readonly string[]).includes(filters.tab)
    ? (filters.tab as TabId)
    : 'statuses';

  const summary = useApiQuery(api.getQualificationSummary, {});
  const options = useApiQuery(api.getQualificationOptions, {});
  const programs = useApiQuery(api.listPrograms, { query: { pageSize: 100, sort: 'name' } });

  const statuses = useApiQuery(
    api.listStatuses,
    tab === 'statuses' || tab === 'eligibility'
      ? {
          query: compact({
            q: filters.q.trim(),
            effectiveStatus: oneOf(
              filters.effectiveStatus,
              V_QUALIFICATION_STATUS_EFFECTIVE_STATUS,
            ),
            programId: idOf(filters.programId),
            categoryId: idOf(filters.categoryId),
            expiringBefore: dateOf(filters.expiringBefore),
            withOpenTriggers: flagOf(filters.withOpenTriggers),
            sort: sortOf(filters.statusSort, STATUS_SORT_FIELDS, 'supplierName'),
            dir: directionOf(filters.statusDir),
            page: tab === 'eligibility' ? 1 : filters.statusPage,
            pageSize: tab === 'eligibility' ? 100 : filters.pageSize,
          }),
        }
      : null,
  );
  const decisions = useApiQuery(
    api.listDecisions,
    tab === 'decisions'
      ? {
          query: compact({
            q: filters.q.trim(),
            programId: idOf(filters.programId),
            outcome: oneOf(filters.outcome, QUALIFICATION_DECISIONS_OUTCOME),
            includeSuperseded: flagOf(filters.includeSuperseded),
            decidedFrom: dateOf(filters.decidedFrom),
            decidedTo: dateOf(filters.decidedTo),
            sort: sortOf(filters.decisionSort, DECISION_SORT_FIELDS, 'decidedAt'),
            dir: directionOf(filters.decisionDir),
            page: filters.decisionPage,
            pageSize: filters.pageSize,
          }),
        }
      : null,
  );
  const triggers = useApiQuery(
    api.listTriggers,
    tab === 'triggers'
      ? {
          query: compact({
            q: filters.q.trim(),
            programId: idOf(filters.programId),
            status: oneOf(filters.triggerStatus, REASSESSMENT_TRIGGERS_STATUS),
            triggerType: oneOf(filters.triggerType, REASSESSMENT_TRIGGERS_TRIGGER_TYPE),
            withImpacts: flagOf(filters.withImpacts),
            detectedFrom: dateOf(filters.detectedFrom),
            detectedTo: dateOf(filters.detectedTo),
            sort: sortOf(filters.triggerSort, TRIGGER_SORT_FIELDS, 'detectedAt'),
            dir: directionOf(filters.triggerDir),
            page: filters.triggerPage,
            pageSize: filters.pageSize,
          }),
        }
      : null,
  );

  const kpi = (value: number | undefined): string =>
    value === undefined ? '…' : formatCount(value);
  const pending = summary.data?.byStatus.find((item) => item.status === 'decision_pending')?.count;
  const kpiRestricted = summary.error?.kind === 'forbidden';

  const programOptions = (programs.data?.items ?? []).map((program) => ({
    value: String(program.id),
    label: program.name,
  }));
  const openQueue = (): void => {
    setQueueFilters({ status: 'decision_pending', page: 1 });
    void navigate(buyerQualificationPaths.queue);
  };
  const filtered =
    filters.q !== '' ||
    filters.programId !== '' ||
    filters.categoryId !== '' ||
    filters.effectiveStatus !== '' ||
    filters.expiringBefore !== '' ||
    filters.withOpenTriggers ||
    filters.outcome !== '' ||
    filters.includeSuperseded ||
    filters.decidedFrom !== '' ||
    filters.decidedTo !== '' ||
    filters.triggerStatus !== 'open' ||
    filters.triggerType !== '' ||
    filters.withImpacts ||
    filters.detectedFrom !== '' ||
    filters.detectedTo !== '' ||
    filters.screeningResult !== '' ||
    filters.checkType !== '' ||
    !filters.unreviewed;

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('qualification.monitoring.title')}
        subtitle={t('qualification.monitoring.intro')}
        primaryAction={
          canDecide ? (
            <Button variant="primary" icon="gavel" onClick={openQueue}>
              {t('qualification.monitoring.pendingDecisions', { count: pending ?? 0 })}
            </Button>
          ) : undefined
        }
        actions={
          <ButtonLink to={buyerQualificationPaths.queue} icon="inbox">
            {t('qualification.monitoring.toQueue')}
          </ButtonLink>
        }
      />
      {tab !== 'eligibility' && (
        <FilterBar
          label={t('qualification.monitoring.filters')}
          onClear={clearFilters}
          canClear={filtered}
        >
          <SearchField
            label={t('qualification.common.search')}
            placeholder={t('qualification.monitoring.searchPlaceholder')}
            value={filters.q}
            onChange={(q) => setFilters({ q, statusPage: 1, decisionPage: 1, triggerPage: 1 })}
          />
          {tab !== 'screenings' && (
            <Select
              label={t('qualification.queue.filter.program')}
              placeholder={t('qualification.common.allPrograms')}
              value={filters.programId}
              onChange={(programId) =>
                setFilters({ programId, statusPage: 1, decisionPage: 1, triggerPage: 1 })
              }
              options={programOptions}
            />
          )}
          {tab === 'statuses' && (
            <>
              <Select
                label={t('qualification.queue.filter.category')}
                placeholder={t('qualification.common.allCategories')}
                value={filters.categoryId}
                onChange={(categoryId) => setFilters({ categoryId, statusPage: 1 })}
                options={(options.data?.categories ?? []).map((category) => ({
                  value: String(category.categoryId),
                  label: categoryLabel(category),
                }))}
              />
              <Select
                label={t('qualification.monitoring.filter.status')}
                placeholder={t('qualification.common.allStatuses')}
                value={filters.effectiveStatus}
                onChange={(effectiveStatus) => setFilters({ effectiveStatus, statusPage: 1 })}
                options={V_QUALIFICATION_STATUS_EFFECTIVE_STATUS.map((value) => ({
                  value,
                  label: tEnum('v_qualification_status.effective_status', value),
                }))}
              />
              <DateInput
                label={t('qualification.monitoring.filter.expiringBefore')}
                value={filters.expiringBefore}
                onChange={(expiringBefore) => setFilters({ expiringBefore, statusPage: 1 })}
              />
              <Checkbox
                label={t('qualification.monitoring.filter.withOpenTriggers')}
                checked={filters.withOpenTriggers}
                onChange={(withOpenTriggers) => setFilters({ withOpenTriggers, statusPage: 1 })}
              />
            </>
          )}
          {tab === 'decisions' && (
            <>
              <Select
                label={t('qualification.monitoring.filter.outcome')}
                placeholder={t('qualification.common.allOutcomes')}
                value={filters.outcome}
                onChange={(outcome) => setFilters({ outcome, decisionPage: 1 })}
                options={QUALIFICATION_DECISIONS_OUTCOME.map((value) => ({
                  value,
                  label: tEnum('qualification_decisions.outcome', value),
                }))}
              />
              <DateInput
                label={t('qualification.monitoring.filter.decidedFrom')}
                value={filters.decidedFrom}
                onChange={(decidedFrom) => setFilters({ decidedFrom, decisionPage: 1 })}
              />
              <DateInput
                label={t('qualification.monitoring.filter.decidedTo')}
                value={filters.decidedTo}
                onChange={(decidedTo) => setFilters({ decidedTo, decisionPage: 1 })}
              />
              <Checkbox
                label={t('qualification.monitoring.filter.includeSuperseded')}
                checked={filters.includeSuperseded}
                onChange={(includeSuperseded) => setFilters({ includeSuperseded, decisionPage: 1 })}
              />
            </>
          )}
          {tab === 'triggers' && (
            <>
              <Select
                label={t('qualification.monitoring.filter.triggerStatus')}
                placeholder={t('qualification.common.allStatuses')}
                value={filters.triggerStatus}
                onChange={(triggerStatus) => setFilters({ triggerStatus, triggerPage: 1 })}
                options={REASSESSMENT_TRIGGERS_STATUS.map((value) => ({
                  value,
                  label: tEnum('reassessment_triggers.status', value),
                }))}
              />
              <Select
                label={t('qualification.monitoring.filter.triggerType')}
                placeholder={t('qualification.common.allTypes')}
                value={filters.triggerType}
                onChange={(triggerType) => setFilters({ triggerType, triggerPage: 1 })}
                options={REASSESSMENT_TRIGGERS_TRIGGER_TYPE.map((value) => ({
                  value,
                  label: tEnum('reassessment_triggers.trigger_type', value),
                }))}
              />
              <DateInput
                label={t('qualification.monitoring.filter.detectedFrom')}
                value={filters.detectedFrom}
                onChange={(detectedFrom) => setFilters({ detectedFrom, triggerPage: 1 })}
              />
              <DateInput
                label={t('qualification.monitoring.filter.detectedTo')}
                value={filters.detectedTo}
                onChange={(detectedTo) => setFilters({ detectedTo, triggerPage: 1 })}
              />
              <Checkbox
                label={t('qualification.monitoring.filter.withImpacts')}
                checked={filters.withImpacts}
                onChange={(withImpacts) => setFilters({ withImpacts, triggerPage: 1 })}
              />
            </>
          )}
          {tab === 'screenings' && (
            <>
              <Select
                label={t('qualification.screening.result')}
                placeholder={t('qualification.common.allResults')}
                value={filters.screeningResult}
                onChange={(screeningResult) => setFilters({ screeningResult, screeningPage: 1 })}
                options={INTEGRITY_SCREENINGS_RESULT.map((value) => ({
                  value,
                  label: tEnum('integrity_screenings.result', value),
                }))}
              />
              <Select
                label={t('qualification.screening.check')}
                placeholder={t('qualification.common.allTypes')}
                value={filters.checkType}
                onChange={(checkType) => setFilters({ checkType, screeningPage: 1 })}
                options={INTEGRITY_SCREENINGS_CHECK_TYPE.map((value) => ({
                  value,
                  label: tEnum('integrity_screenings.check_type', value),
                }))}
              />
              <Checkbox
                label={t('qualification.monitoring.filter.unreviewed')}
                checked={filters.unreviewed}
                onChange={(unreviewed) => setFilters({ unreviewed, screeningPage: 1 })}
              />
            </>
          )}
        </FilterBar>
      )}
      <KpiGrid>
        <KpiCard
          label={t('qualification.monitoring.kpi.pending')}
          icon="gavel"
          tone="accent"
          value={kpi(pending)}
          hint={t('qualification.monitoring.kpi.pendingHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('qualification.monitoring.kpi.expiring')}
          icon="hourglass"
          tone="warning"
          value={kpi(summary.data?.decisionsExpiringIn90Days)}
          hint={t('qualification.monitoring.kpi.expiringHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('qualification.monitoring.kpi.expired')}
          icon="alertCircle"
          tone="danger"
          value={kpi(summary.data?.expiredDecisions)}
          hint={t('qualification.monitoring.kpi.expiredHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('qualification.monitoring.kpi.triggers')}
          icon="activity"
          tone="danger"
          value={kpi(summary.data?.openTriggers)}
          hint={t('qualification.monitoring.kpi.triggersHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('qualification.monitoring.kpi.screenings')}
          icon="flag"
          tone="info"
          value={kpi(summary.data?.unreviewedScreeningFlags)}
          hint={t('qualification.monitoring.kpi.screeningsHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('qualification.monitoring.kpi.reconsiderations')}
          icon="history"
          tone="warning"
          value={kpi(summary.data?.openReconsiderations)}
          hint={t('qualification.monitoring.kpi.reconsiderationsHint')}
          restricted={kpiRestricted}
        />
      </KpiGrid>
      <Tabs
        label={t('qualification.monitoring.tabsLabel')}
        selected={tab}
        onSelect={(id) => setFilters({ tab: id })}
        tabs={[
          { id: 'statuses', label: t('qualification.monitoring.tab.statuses') },
          {
            id: 'decisions',
            label: t('qualification.monitoring.tab.decisions'),
            count: summary.data?.openReconsiderations,
          },
          {
            id: 'triggers',
            label: t('qualification.monitoring.tab.triggers'),
            count: summary.data?.openTriggers,
          },
          {
            id: 'screenings',
            label: t('qualification.monitoring.tab.screenings'),
            count: summary.data?.unreviewedScreeningFlags,
          },
          { id: 'eligibility', label: t('qualification.monitoring.tab.eligibility') },
        ]}
      >
        {tab === 'statuses' && (
          <Card flush>
            <DataTable
              caption={t('qualification.monitoring.statusesCaption')}
              columns={statusColumns()}
              rows={statuses.data?.items}
              rowKey={(row) => `${row.supplier.supplierTenantId}-${row.program.programId}`}
              rowLabel={(row) => `${row.supplier.name} ${row.program.programName}`}
              onRowClick={(row) => {
                if (row.decisionId !== null)
                  void navigate(buyerQualificationPaths.decision(row.decisionId));
              }}
              loading={statuses.isFetching}
              error={statuses.error}
              onRetry={statuses.reload}
              restricted={statuses.error?.kind === 'forbidden'}
              sort={tableSort(filters.statusSort, filters.statusDir)}
              onSortChange={(sort) =>
                setFilters({ statusSort: sort.key, statusDir: sort.dir, statusPage: 1 })
              }
              empty={<EmptyState compact title={t('qualification.monitoring.statusesEmpty')} />}
              pagination={
                statuses.data === undefined
                  ? undefined
                  : {
                      page: statuses.data.page,
                      pageSize: statuses.data.pageSize,
                      total: statuses.data.total,
                      onPageChange: (statusPage) => setFilters({ statusPage }),
                      onPageSizeChange: (pageSize) => setFilters({ pageSize, statusPage: 1 }),
                    }
              }
            />
          </Card>
        )}
        {tab === 'decisions' && (
          <Card flush>
            <DataTable
              caption={t('qualification.monitoring.decisionsCaption')}
              columns={decisionColumns(timeZone)}
              rows={decisions.data?.items}
              rowKey={(row) => String(row.id)}
              rowLabel={(row) => `${row.applicationReference} ${row.supplier.name}`}
              onRowClick={(row) => void navigate(buyerQualificationPaths.decision(row.id))}
              loading={decisions.isFetching}
              error={decisions.error}
              onRetry={decisions.reload}
              restricted={decisions.error?.kind === 'forbidden'}
              sort={tableSort(filters.decisionSort, filters.decisionDir)}
              onSortChange={(sort) =>
                setFilters({ decisionSort: sort.key, decisionDir: sort.dir, decisionPage: 1 })
              }
              empty={<EmptyState compact title={t('qualification.monitoring.decisionsEmpty')} />}
              pagination={
                decisions.data === undefined
                  ? undefined
                  : {
                      page: decisions.data.page,
                      pageSize: decisions.data.pageSize,
                      total: decisions.data.total,
                      onPageChange: (decisionPage) => setFilters({ decisionPage }),
                      onPageSizeChange: (pageSize) => setFilters({ pageSize, decisionPage: 1 }),
                    }
              }
            />
          </Card>
        )}
        {tab === 'triggers' && (
          <Card flush>
            <DataTable
              caption={t('qualification.monitoring.triggersCaption')}
              columns={triggerColumns(timeZone)}
              rows={triggers.data?.items}
              rowKey={(row) => String(row.id)}
              rowLabel={(row) => `${row.supplier.name} ${row.summary}`}
              onRowClick={(row) => void navigate(buyerQualificationPaths.trigger(row.id))}
              loading={triggers.isFetching}
              error={triggers.error}
              onRetry={triggers.reload}
              restricted={triggers.error?.kind === 'forbidden'}
              sort={tableSort(filters.triggerSort, filters.triggerDir)}
              onSortChange={(sort) =>
                setFilters({ triggerSort: sort.key, triggerDir: sort.dir, triggerPage: 1 })
              }
              empty={<EmptyState compact title={t('qualification.monitoring.triggersEmpty')} />}
              pagination={
                triggers.data === undefined
                  ? undefined
                  : {
                      page: triggers.data.page,
                      pageSize: triggers.data.pageSize,
                      total: triggers.data.total,
                      onPageChange: (triggerPage) => setFilters({ triggerPage }),
                      onPageSizeChange: (pageSize) => setFilters({ pageSize, triggerPage: 1 }),
                    }
              }
            />
          </Card>
        )}
        {tab === 'screenings' && (
          <ScreeningsTable
            timeZone={timeZone}
            query={compact({
              q: filters.q.trim(),
              result: oneOf(filters.screeningResult, INTEGRITY_SCREENINGS_RESULT),
              checkType: oneOf(filters.checkType, INTEGRITY_SCREENINGS_CHECK_TYPE),
              unreviewed: flagOf(filters.unreviewed),
              page: filters.screeningPage,
              pageSize: filters.pageSize,
            })}
            onPageChange={(screeningPage) => setFilters({ screeningPage })}
          />
        )}
        {tab === 'eligibility' && (
          <EligibilityCheck
            suppliers={uniqueSuppliers(statuses.data?.items ?? [])}
            categories={options.data?.categories ?? []}
            currencies={options.data?.currencies ?? []}
          />
        )}
      </Tabs>
    </div>
  );
}

function uniqueSuppliers(rows: readonly StatusRow[]): StatusRow['supplier'][] {
  const seen = new Map<number, StatusRow['supplier']>();
  for (const row of rows) seen.set(row.supplier.supplierTenantId, row.supplier);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function statusColumns(): DataTableColumn<StatusRow>[] {
  return [
    {
      id: 'supplierName',
      header: t('qualification.monitoring.col.supplier'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.supplier.name}</span>
          <span className="tiq-cell-sub">{row.supplier.legalName}</span>
        </>
      ),
    },
    {
      id: 'programName',
      header: t('qualification.monitoring.col.program'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.program.programName}</span>
          <span className="tiq-cell-sub">{row.programCategory.code}</span>
        </>
      ),
    },
    {
      id: 'effectiveStatus',
      header: t('qualification.monitoring.col.status'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-stack" style={cellStack}>
          <EffectiveStatusChip status={row.effectiveStatus} size="sm" />
          {row.effectiveStatus !== 'qualified' &&
            row.effectiveStatus !== 'qualified_with_conditions' && (
              <span className="tiq-cell-sub">
                {t('qualification.common.registeredNotQualified', {
                  category: row.programCategory.code,
                })}
              </span>
            )}
        </span>
      ),
    },
    {
      id: 'scope',
      header: t('qualification.monitoring.col.scope'),
      cell: (row) => (
        <OrDash>
          {row.scopeCategory === null ? null : scopeText(row.scopeCategory, row.scopeMaxValue)}
        </OrDash>
      ),
    },
    {
      id: 'effectiveTo',
      header: t('qualification.monitoring.col.dates'),
      sortable: true,
      cell: (row) =>
        row.effectiveFrom === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <span className="tiq-stack" style={cellStack}>
            <span>
              {t('qualification.common.dateRange', {
                from: dateOrDash(row.effectiveFrom) ?? '',
                to: dateOrDash(row.effectiveTo) ?? t('qualification.terms.openEnded'),
              })}
            </span>
            {row.reassessmentDate !== null && (
              <span className="tiq-cell-sub">
                {t('qualification.monitoring.reassessBy', {
                  date: dateOrDash(row.reassessmentDate) ?? '',
                })}
              </span>
            )}
            <ExpiryChip days={row.expiresInDays} />
          </span>
        ),
    },
    {
      id: 'conditions',
      header: t('qualification.monitoring.col.conditions'),
      cell: (row) =>
        row.conditions === null && (row.blockedGate === null || row.blockedGate === 'none') ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <span>{row.conditions}</span>
            <span className="tiq-cell-sub">{gateText(row.blockedGate)}</span>
          </>
        ),
    },
    {
      id: 'activity',
      header: t('qualification.monitoring.col.activity'),
      cell: (row) => (
        <span className="tiq-stack" style={cellStack}>
          {row.openTriggerCount > 0 && (
            <Chip tone="warning" size="sm" icon="activity">
              {t('qualification.monitoring.openTriggers', { count: row.openTriggerCount })}
            </Chip>
          )}
          {row.applicationInProgress !== null && (
            <span className="tiq-inline">
              <Reference
                value={row.applicationInProgress.reference}
                to={buyerQualificationPaths.application(row.applicationInProgress.applicationId)}
              />
              <StatusChip
                enum="qualification_applications.status"
                value={row.applicationInProgress.status}
                size="sm"
              />
            </span>
          )}
          {row.openTriggerCount === 0 && row.applicationInProgress === null && (
            <OrDash>{null}</OrDash>
          )}
        </span>
      ),
    },
  ];
}

function decisionColumns(timeZone: string): DataTableColumn<Decision>[] {
  return [
    {
      id: 'reference',
      header: t('qualification.monitoring.col.decision'),
      cell: (row) => (
        <>
          <Reference
            value={t('qualification.decision.decisionNo', { id: row.id })}
            to={buyerQualificationPaths.decision(row.id)}
          />
          <span className="tiq-cell-sub">{row.applicationReference}</span>
        </>
      ),
    },
    {
      id: 'supplierName',
      header: t('qualification.monitoring.col.supplier'),
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
      id: 'outcome',
      header: t('qualification.monitoring.col.outcome'),
      cell: (row) => (
        <span className="tiq-stack" style={cellStack}>
          <OutcomeChip outcome={row.outcome} />
          {row.effectiveStatus !== row.outcome && (
            <EffectiveStatusChip status={row.effectiveStatus} size="sm" />
          )}
          {row.supersededById !== null && (
            <Chip tone="neutral" size="sm">
              {t('qualification.decision.superseded')}
            </Chip>
          )}
          {row.openReconsideration && (
            <Chip tone="warning" size="sm" icon="history">
              {t('qualification.monitoring.reconsiderationOpen')}
            </Chip>
          )}
          {row.evidenceUpdateCount > 0 && (
            <Chip tone="info" size="sm" icon="uploadCloud">
              {t('qualification.monitoring.evidenceUpdates', { count: row.evidenceUpdateCount })}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'scope',
      header: t('qualification.monitoring.col.scope'),
      cell: (row) => (
        <>
          <span>{scopeText(row.scopeCategory, row.scopeMaxValue, row.scopeGeography)}</span>
          <span className="tiq-cell-sub">{gateText(row.blockedGate)}</span>
        </>
      ),
    },
    {
      id: 'effectiveFrom',
      header: t('qualification.monitoring.col.effective'),
      sortable: true,
      cell: (row) =>
        t('qualification.common.dateRange', {
          from: dateOrDash(row.effectiveFrom) ?? '',
          to: dateOrDash(row.effectiveTo) ?? t('qualification.terms.openEnded'),
        }),
    },
    {
      id: 'effectiveTo',
      header: t('qualification.monitoring.col.expiry'),
      sortable: true,
      cell: (row) => <OrDash>{dateOrDash(row.effectiveTo)}</OrDash>,
    },
    {
      id: 'decidedAt',
      header: t('qualification.monitoring.col.decided'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{formatDateTime(row.decidedAt, timeZone)}</span>
          <span className="tiq-cell-sub">
            {row.approver?.fullName ?? row.reviewer?.fullName ?? ''}
          </span>
        </>
      ),
    },
  ];
}

function triggerColumns(timeZone: string): DataTableColumn<Trigger>[] {
  return [
    {
      id: 'type',
      header: t('qualification.monitoring.col.trigger'),
      cell: (row) => (
        <>
          <Reference
            value={t('qualification.trigger.triggerNo', { id: row.id })}
            to={buyerQualificationPaths.trigger(row.id)}
          />
          <span className="tiq-cell-sub">
            {tEnum('reassessment_triggers.trigger_type', row.triggerType)}
          </span>
        </>
      ),
    },
    {
      id: 'supplierName',
      header: t('qualification.monitoring.col.supplier'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.supplier.name}</span>
          <span className="tiq-cell-sub">{row.program?.programName ?? ''}</span>
        </>
      ),
    },
    {
      id: 'summary',
      header: t('qualification.monitoring.col.summary'),
      cell: (row) => (
        <>
          <span>{row.summary}</span>
          <span className="tiq-cell-sub">{row.sourceLabel}</span>
        </>
      ),
    },
    {
      id: 'lapsesOn',
      header: t('qualification.monitoring.col.lapses'),
      sortable: true,
      cell: (row) => <OrDash>{dateOrDash(row.lapsesOn)}</OrDash>,
    },
    {
      id: 'impacts',
      header: t('qualification.monitoring.col.impacts'),
      cell: (row) =>
        row.impactedBids.length + row.impactedContracts.length === 0 ? (
          <span className="tiq-text-muted">{t('qualification.monitoring.noImpacts')}</span>
        ) : (
          <span className="tiq-stack" style={cellStack}>
            <span>
              {t('qualification.monitoring.impactBids', { count: row.impactedBids.length })}
            </span>
            <span className="tiq-cell-sub">
              {t('qualification.monitoring.impactContracts', {
                count: row.impactedContracts.length,
              })}
            </span>
          </span>
        ),
    },
    {
      id: 'detectedAt',
      header: t('qualification.monitoring.col.detected'),
      sortable: true,
      cell: (row) => formatDateTime(row.detectedAt, timeZone),
    },
    {
      id: 'status',
      header: t('qualification.monitoring.col.triggerStatus'),
      sortable: true,
      cell: (row) => (
        <StatusChip enum="reassessment_triggers.status" value={row.status} size="sm" />
      ),
    },
  ];
}
