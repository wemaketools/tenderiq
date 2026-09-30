/**
 * CON-01 — Contract register: parties, owner, scope, value, remaining ceiling, term, status and renewal dates, with
 * filters, owner assignment and the upcoming decisions each contract needs (FR-18, FR-19).
 */

import { CONTRACT_SORT_FIELDS, contractsEndpoints } from '@contracts/contracts';
import type { ContractRow } from '@contracts/contracts';
import { CONTRACTS_STATUS } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Card,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  IconButton,
  KpiCard,
  KpiGrid,
  MoneyText,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Reference,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { EMPTY_VALUE, formatCalendarDate, formatCount, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AssignOwnersDialog } from '../components/AssignOwnersDialog';
import { useAssigneeOptions } from '../lib/assignees';
import { NextDecision } from '../components/shared';
import { useDialog } from '../lib/hooks';
import { compact, directionOf, idOf, oneOf, pick, tableSort } from '../lib/lists';
import { contractPaths } from '../lib/paths';
import { CONTRACT_MANAGE_OR_PREPARE } from '../lib/permissions';

const DEFAULTS = {
  q: '',
  status: '',
  owner: '',
  manager: '',
  renewalWithin: '',
  decision: '',
  differs: '',
  termEndFrom: '',
  termEndTo: '',
  sort: 'reference',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

const RENEWAL_WINDOWS = ['30', '60', '90', '180'] as const;

/** The contract column keeps enough room for the reference and title so the actions column stays visible at 1440. */
const CONTRACT_COLUMN_WIDTH = '10rem';

/** Term dates stay on one line each ("From 1 Feb 2025", "To 31 Jan 2026"). */
const NO_WRAP = { whiteSpace: 'nowrap' } as const;

/** The term as two short lines (start, then end) so the column stays narrow. */
function TermCell({ row }: { readonly row: ContractRow }) {
  if (row.termStart === null && row.termEnd === null) {
    return <OrDash>{null}</OrDash>;
  }
  return (
    <>
      <span style={NO_WRAP}>
        {t('contracts.register.termFrom', {
          date: row.termStart === null ? EMPTY_VALUE : formatCalendarDate(row.termStart),
        })}
      </span>
      <span className="tiq-cell-sub" style={NO_WRAP}>
        {t('contracts.register.termTo', {
          date: row.termEnd === null ? EMPTY_VALUE : formatCalendarDate(row.termEnd),
        })}
      </span>
    </>
  );
}

/**
 * The notice window of the next undecided option: when it opens (or that it is open) and, unless the next-decision
 * column already shows it, the official notice deadline (AC-32).
 */
function RenewalWindowCell({ row }: { readonly row: ContractRow }) {
  const window = row.nextRenewalWindow;
  if (window === null) {
    return <OrDash>{null}</OrDash>;
  }
  const showDeadline =
    row.nextRenewalDeadline !== null && row.nextDecision?.kind !== 'renewal_notice';
  return (
    <>
      <span>
        {window.state === 'not_open' && window.windowStart !== null
          ? t('contracts.register.windowOpens', { date: formatCalendarDate(window.windowStart) })
          : t(`contracts.renewals.window.${window.state}`)}
      </span>
      {window.state === 'not_open' && window.daysUntilOpens !== null && (
        <span className="tiq-cell-sub">
          {t('contracts.renewals.inDays', { count: window.daysUntilOpens })}
        </span>
      )}
      {showDeadline && row.nextRenewalDeadline !== null && (
        <span className="tiq-cell-sub">
          {t('contracts.register.noticeDeadline')}{' '}
          <OfficialDeadline deadline={row.nextRenewalDeadline} showLocal={false} />
        </span>
      )}
    </>
  );
}

export default function ContractRegisterPage() {
  const canAssign = usePermission(CONTRACT_MANAGE_OR_PREPARE);
  const [filters, setFilters, clearFilters] = useScreenFilters('CON-01', DEFAULTS);
  const assign = useDialog<'assign', ContractRow>();
  const owners = useAssigneeOptions('owner');
  const managers = useAssigneeOptions('contract_manager');

  const query = useApiQuery(contractsEndpoints.list, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, CONTRACTS_STATUS),
      ownerUserId: idOf(filters.owner),
      contractManagerUserId: idOf(filters.manager),
      renewalWithinDays: idOf(filters.renewalWithin),
      upcomingDecision: filters.decision === 'yes' ? true : undefined,
      differsFromAward: filters.differs === 'yes' ? true : undefined,
      termEndFrom: filters.termEndFrom,
      termEndTo: filters.termEndTo,
      sort: pick(filters.sort, CONTRACT_SORT_FIELDS),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });

  const summary = query.data?.summary;
  const activeCount = summary?.byStatus.find((item) => item.status === 'active')?.count ?? 0;
  const loadingValue = '…';
  const filtered =
    filters.q !== '' ||
    filters.status !== '' ||
    filters.owner !== '' ||
    filters.manager !== '' ||
    filters.renewalWithin !== '' ||
    filters.decision !== '' ||
    filters.differs !== '' ||
    filters.termEndFrom !== '' ||
    filters.termEndTo !== '';

  const columns: DataTableColumn<ContractRow>[] = [
    {
      id: 'reference',
      header: t('contracts.register.col.contract'),
      sortable: true,
      width: CONTRACT_COLUMN_WIDTH,
      cell: (row) => (
        <>
          <Reference value={row.reference} to={contractPaths.overview(row.id)} />
          <span className="tiq-cell-sub">{row.title}</span>
          {row.scopeSummary !== '' && (
            <span className="tiq-cell-sub tiq-text-muted">
              {t('contracts.register.scope', { scope: row.scopeSummary })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'supplier',
      header: t('contracts.register.col.partiesOwner'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.supplier.name}</span>
          <span className="tiq-cell-sub">{row.legalEntity.name}</span>
          <span className="tiq-cell-sub">
            {row.owner === null
              ? t('contracts.register.noOwner')
              : t('contracts.register.owner', { name: row.owner.fullName })}
          </span>
          <span className="tiq-cell-sub">
            {row.contractManager === null
              ? t('contracts.register.noManager')
              : t('contracts.register.manager', { name: row.contractManager.fullName })}
          </span>
        </>
      ),
    },
    {
      id: 'value',
      header: t('contracts.register.col.valueCeiling'),
      sortable: true,
      numeric: true,
      cell: (row) => (
        <>
          <MoneyText value={row.currentValue} />
          {row.currentValue.amount !== row.value.amount && (
            <span className="tiq-cell-sub">
              {t('contracts.register.original', { value: formatMoney(row.value) })}
            </span>
          )}
          <span className="tiq-cell-sub">
            {t('contracts.register.remaining', {
              value:
                row.remainingCeiling === null ? EMPTY_VALUE : formatMoney(row.remainingCeiling),
            })}
          </span>
        </>
      ),
    },
    {
      id: 'termEnd',
      header: t('contracts.register.col.term'),
      sortable: true,
      cell: (row) => <TermCell row={row} />,
    },
    {
      id: 'status',
      header: t('contracts.register.col.status'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-stack tiq-stack--start">
          <StatusChip enum="contracts.status" value={row.status} size="sm" />
          {row.differsFromAward && (
            <Chip tone="warning" size="sm">
              {t('contracts.workspace.differs')}
            </Chip>
          )}
          {row.overdueObligations > 0 && (
            <Chip tone="danger" size="sm" outlined>
              {t('contracts.register.overdue', { count: row.overdueObligations })}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'renewal',
      header: t('contracts.register.col.renewal'),
      cell: (row) => <RenewalWindowCell row={row} />,
    },
    {
      id: 'nextDecision',
      header: t('contracts.register.col.decision'),
      sortable: true,
      cell: (row) => <NextDecision decision={row.nextDecision} compact />,
    },
    ...(canAssign
      ? [
          {
            id: 'actions',
            header: t('contracts.register.col.actions'),
            accessibleHeader: t('contracts.register.col.actions'),
            cell: (row: ContractRow) => (
              <IconButton
                size="sm"
                icon="userPlus"
                disabled={row.status === 'closed'}
                label={t('contracts.register.assignFor', { reference: row.reference })}
                onClick={(event) => {
                  event.stopPropagation();
                  assign.show('assign', row);
                }}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="tiq-page">
      <PageHeader title={t('contracts.register.title')} subtitle={t('contracts.register.intro')} />
      <FilterBar label={t('contracts.register.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('contracts.common.search')}
          placeholder={t('contracts.register.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('contracts.register.filter.status')}
          placeholder={t('contracts.common.all')}
          value={filters.status}
          options={CONTRACTS_STATUS.map((value) => ({
            value,
            label: tEnum('contracts.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('contracts.register.filter.owner')}
          placeholder={t('contracts.common.all')}
          value={filters.owner}
          options={owners.options}
          onChange={(owner) => setFilters({ owner, page: 1 })}
        />
        <Select
          label={t('contracts.register.filter.manager')}
          placeholder={t('contracts.common.all')}
          value={filters.manager}
          options={managers.options}
          onChange={(manager) => setFilters({ manager, page: 1 })}
        />
        <Select
          label={t('contracts.register.filter.renewal')}
          placeholder={t('contracts.common.any')}
          value={filters.renewalWithin}
          options={RENEWAL_WINDOWS.map((days) => ({
            value: days,
            label: t('contracts.register.withinDays', { days }),
          }))}
          onChange={(renewalWithin) => setFilters({ renewalWithin, page: 1 })}
        />
        <Select
          label={t('contracts.register.filter.decision')}
          placeholder={t('contracts.common.all')}
          value={filters.decision}
          options={[{ value: 'yes', label: t('contracts.register.needsDecision') }]}
          onChange={(decision) => setFilters({ decision, page: 1 })}
        />
        <Select
          label={t('contracts.register.filter.differs')}
          placeholder={t('contracts.common.all')}
          value={filters.differs}
          options={[{ value: 'yes', label: t('contracts.register.differsOnly') }]}
          onChange={(differs) => setFilters({ differs, page: 1 })}
        />
        <DateInput
          label={t('contracts.register.filter.termEndFrom')}
          value={filters.termEndFrom}
          onChange={(termEndFrom) => setFilters({ termEndFrom, page: 1 })}
        />
        <DateInput
          label={t('contracts.register.filter.termEndTo')}
          value={filters.termEndTo}
          onChange={(termEndTo) => setFilters({ termEndTo, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('contracts.register.kpi.active')}
          icon="fileSignature"
          value={summary === undefined ? loadingValue : formatCount(activeCount)}
          hint={t('contracts.register.kpi.activeHint')}
        />
        <KpiCard
          label={t('contracts.register.kpi.decisions')}
          icon="flag"
          tone="warning"
          value={summary === undefined ? loadingValue : formatCount(summary.upcomingDecisions)}
          hint={t('contracts.register.kpi.decisionsHint')}
        />
        <KpiCard
          label={t('contracts.register.kpi.renewals')}
          icon="repeat"
          tone="info"
          value={summary === undefined ? loadingValue : formatCount(summary.renewalsWithin90Days)}
          hint={t('contracts.register.kpi.renewalsHint')}
        />
        <KpiCard
          label={t('contracts.register.kpi.overdue')}
          icon="alertTriangle"
          tone="danger"
          value={summary === undefined ? loadingValue : formatCount(summary.overdueObligations)}
          hint={t('contracts.register.kpi.overdueHint')}
        />
        <KpiCard
          label={t('contracts.register.kpi.value')}
          icon="coins"
          tone="success"
          value={
            summary === undefined
              ? loadingValue
              : summary.currentValueByCurrency.length === 0
                ? null
                : summary.currentValueByCurrency
                    .map((money) => formatMoney(money, { compact: true }))
                    .join(' · ')
          }
          hint={t('contracts.register.kpi.valueHint')}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('contracts.register.caption')}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => `${row.reference} ${row.title}`}
          rowHref={(row) => contractPaths.overview(row.id)}
          loading={query.isFetching}
          error={query.error}
          onRetry={query.reload}
          sort={tableSort(filters.sort, filters.dir)}
          onSortChange={(sort) => setFilters({ sort: sort.key, dir: sort.dir, page: 1 })}
          empty={
            <EmptyState
              compact
              title={
                filtered ? t('contracts.register.emptyFiltered') : t('contracts.register.empty')
              }
              description={filtered ? undefined : t('contracts.register.emptyHint')}
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
      {assign.target !== null && (
        <AssignOwnersDialog
          key={assign.target.id}
          contract={assign.target}
          open={assign.open === 'assign'}
          onClose={assign.close}
        />
      )}
    </div>
  );
}
