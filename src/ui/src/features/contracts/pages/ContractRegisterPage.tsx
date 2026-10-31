/**
 * CON-01 — Contract register (docs/plan/design1 §5 "Contracts"): the next actionable dates above a lean register,
 * with the parties, owner, scope, value, remaining ceiling, term, status and renewal dates of every contract, the
 * existing filters (search, status, owner, manager, renewal window, decision, award difference, term) behind a
 * disclosure, owner assignment, and the upcoming decision each contract needs (FR-18, FR-19). Totals respect
 * currency boundaries (never summed across currencies) and come from the API summary.
 */
import { useId } from 'react';
import { Link } from 'react-router';

import { CONTRACT_SORT_FIELDS, contractsEndpoints } from '@contracts/contracts';
import type { ContractNextDecision, ContractRow } from '@contracts/contracts';
import { CONTRACTS_STATUS } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useAppSelector, useScreenFilters } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Attention,
  Chip,
  DataTable,
  DateBadge,
  DateInput,
  EmptyState,
  FilterBar,
  FilterDisclosure,
  Icon,
  IconButton,
  IconTile,
  MoneyText,
  OfficialDeadline,
  OrDash,
  PageHeader,
  Reference,
  SearchField,
  Section,
  Select,
  Stat,
  StatusChip,
  Tabs,
  Toolbar,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { EMPTY_VALUE, formatCalendarDate, formatCount, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import { AssignOwnersDialog } from '../components/AssignOwnersDialog';
import { NextDecision } from '../components/shared';
import { useAssigneeOptions } from '../lib/assignees';
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

/** The "Renewals" view of the segmented control: the existing renewal-window filter at 90 days. */
const RENEWALS_VIEW_DAYS = '90';

/** How many upcoming decisions the "Coming up" row shows. */
const UPCOMING_LIMIT = 3;

type View = 'all' | 'mine' | 'renewals';

/** The lead columns keep room for a title and its lines; below tablet width the table scrolls inside its region. */
const CONTRACT_COLUMN_WIDTH = '20rem';
const SUPPLIER_COLUMN_WIDTH = '14rem';

/** The notice window of the next undecided option: when it opens (or that it is open) and, unless the next-decision
 * column already shows it, the official notice deadline (AC-32). */
function RenewalWindowLine({ row }: { readonly row: ContractRow }) {
  const window = row.nextRenewalWindow;
  if (window === null) {
    return null;
  }
  const showDeadline =
    row.nextRenewalDeadline !== null && row.nextDecision?.kind !== 'renewal_notice';
  return (
    <>
      <span className="tiq-cell-sub">
        {window.state === 'not_open' && window.windowStart !== null
          ? t('contracts.register.windowOpens', { date: formatCalendarDate(window.windowStart) })
          : t(`contracts.renewals.window.${window.state}`)}
        {window.state === 'not_open' && window.daysUntilOpens !== null && (
          <> · {t('contracts.renewals.inDays', { count: window.daysUntilOpens })}</>
        )}
      </span>
      {showDeadline && row.nextRenewalDeadline !== null && (
        <span className="tiq-cell-sub">
          {t('contracts.register.noticeDeadline')}{' '}
          <OfficialDeadline deadline={row.nextRenewalDeadline} showLocal={false} />
        </span>
      )}
    </>
  );
}

interface UpcomingDecision {
  readonly row: ContractRow;
  readonly decision: ContractNextDecision & {
    readonly dueAt: NonNullable<ContractNextDecision['dueAt']>;
  };
}

/** The dated next decisions of the loaded rows, soonest first. */
function upcomingOf(rows: readonly ContractRow[]): UpcomingDecision[] {
  const dated: UpcomingDecision[] = [];
  for (const row of rows) {
    const decision = row.nextDecision;
    if (decision === null || decision.dueAt === null) continue;
    dated.push({ row, decision: { ...decision, dueAt: decision.dueAt } });
  }
  return dated
    .sort((a, b) => a.decision.dueAt.at.localeCompare(b.decision.dueAt.at))
    .slice(0, UPCOMING_LIMIT);
}

function ComingUp({
  rows,
  loaded,
}: {
  readonly rows: readonly ContractRow[];
  readonly loaded: boolean;
}) {
  const now = useNow();
  const items = upcomingOf(rows);
  return (
    <Section title={t('contracts.register.comingUp')} headingLevel={2}>
      {!loaded ? (
        <p className="tiq-text-muted">{t('ui.loading')}</p>
      ) : items.length === 0 ? (
        <p className="tiq-text-muted">{t('contracts.register.comingUpEmpty')}</p>
      ) : (
        <ul className="tiq-upcoming" aria-label={t('contracts.register.comingUp')}>
          {items.map(({ row, decision }) => {
            const overdue = new Date(decision.dueAt.at).getTime() < now;
            return (
              <li key={`${row.id}-${decision.kind}`} className="tiq-upcoming-item">
                <DateBadge at={decision.dueAt.at} timeZone={decision.dueAt.timeZone} size="lg" />
                <div className="tiq-upcoming-body">
                  <span
                    className={
                      overdue ? 'tiq-upcoming-kind tiq-upcoming-kind--warning' : 'tiq-upcoming-kind'
                    }
                  >
                    <Icon name={overdue ? 'alertCircle' : 'calendar'} />
                    {overdue
                      ? t('contracts.register.comingUpOverdue')
                      : t(`contracts.decision.${decision.kind}`)}
                  </span>
                  <span className="tiq-upcoming-title">
                    <Link to={contractPaths.overview(row.id)}>{row.title}</Link>
                  </span>
                  <span className="tiq-upcoming-note">
                    {overdue && <>{t(`contracts.decision.${decision.kind}`)} · </>}
                    <OfficialDeadline deadline={decision.dueAt} showLocal={false} />
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {loaded && items.length > 0 && (
        <p className="tiq-text-muted tiq-contracts-upcoming-note">
          {t('contracts.register.comingUpScope')}
        </p>
      )}
    </Section>
  );
}

export default function ContractRegisterPage() {
  const canAssign = usePermission(CONTRACT_MANAGE_OR_PREPARE);
  const userId = useAppSelector((state) => state.session.user?.id ?? null);
  const [filters, setFilters, clearFilters] = useScreenFilters('CON-01', DEFAULTS);
  const assign = useDialog<'assign', ContractRow>();
  const owners = useAssigneeOptions('owner');
  const managers = useAssigneeOptions('contract_manager');
  const panelLabelId = useId();

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
  const advancedActive = [
    filters.status,
    filters.manager,
    filters.decision,
    filters.differs,
    filters.termEndFrom,
    filters.termEndTo,
  ].filter((value) => value !== '').length;
  const filtered =
    filters.q !== '' || filters.owner !== '' || filters.renewalWithin !== '' || advancedActive > 0;

  const mine = userId !== null && filters.owner === String(userId);
  const view: View = mine
    ? 'mine'
    : filters.renewalWithin === RENEWALS_VIEW_DAYS && filters.owner === ''
      ? 'renewals'
      : 'all';
  const selectView = (id: string): void => {
    if (id === 'mine' && userId !== null) {
      setFilters({ owner: String(userId), renewalWithin: '', page: 1 });
    } else if (id === 'renewals') {
      setFilters({ owner: '', renewalWithin: RENEWALS_VIEW_DAYS, page: 1 });
    } else {
      setFilters({ owner: '', renewalWithin: '', page: 1 });
    }
  };

  const columns: DataTableColumn<ContractRow>[] = [
    {
      id: 'reference',
      header: t('contracts.register.col.contract'),
      sortable: true,
      width: CONTRACT_COLUMN_WIDTH,
      cell: (row) => (
        <span className="tiq-cell-lead">
          <IconTile icon="fileSignature" size="sm" tone="neutral" />
          <span>
            <span className="tiq-cell-title">
              <Link to={contractPaths.overview(row.id)}>{row.title}</Link>
            </span>
            <span className="tiq-cell-sub">
              <Reference value={row.reference} />
            </span>
            {row.scopeSummary !== '' && (
              <span className="tiq-cell-sub">
                {t('contracts.register.scope', { scope: row.scopeSummary })}
              </span>
            )}
            {(row.status !== 'active' || row.differsFromAward || row.overdueObligations > 0) && (
              <span className="tiq-cell-sub tiq-inline">
                {row.status !== 'active' && (
                  <StatusChip enum="contracts.status" value={row.status} size="sm" />
                )}
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
            )}
            {row.status === 'active' && (
              <span className="tiq-visually-hidden">{tEnum('contracts.status', row.status)}</span>
            )}
          </span>
        </span>
      ),
    },
    {
      id: 'supplier',
      header: t('contracts.register.col.supplier'),
      sortable: true,
      width: SUPPLIER_COLUMN_WIDTH,
      cell: (row) => (
        <>
          <span>{row.supplier.name}</span>
          <span className="tiq-cell-sub">{row.legalEntity.name}</span>
          <span className="tiq-cell-sub">
            {row.owner === null
              ? t('contracts.register.noOwner')
              : t('contracts.register.owner', { name: row.owner.fullName })}
            {' · '}
            {row.contractManager === null
              ? t('contracts.register.noManager')
              : t('contracts.register.manager', { name: row.contractManager.fullName })}
          </span>
        </>
      ),
    },
    {
      id: 'value',
      header: t('contracts.register.col.value'),
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
      header: t('contracts.register.col.termEnds'),
      sortable: true,
      cell: (row) => (
        <>
          <span className="tiq-contracts-nowrap">
            {row.termEnd === null ? <OrDash>{null}</OrDash> : formatCalendarDate(row.termEnd)}
          </span>
          {row.termStart !== null && (
            <span className="tiq-cell-sub tiq-contracts-nowrap">
              {t('contracts.register.termFrom', { date: formatCalendarDate(row.termStart) })}
            </span>
          )}
          <RenewalWindowLine row={row} />
        </>
      ),
    },
    {
      id: 'nextDecision',
      header: t('contracts.register.col.nextStep'),
      sortable: true,
      cell: (row) => <NextDecision decision={row.nextDecision} compact />,
    },
    ...(canAssign
      ? [
          {
            id: 'actions',
            header: t('contracts.register.col.actions'),
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

  const total = query.data?.total;

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('contracts.register.title')}
        headline={t('contracts.register.headline')}
        subtitle={
          total === undefined
            ? t('contracts.register.ledeLoading')
            : t('contracts.register.lede', { count: total })
        }
      />

      <ComingUp rows={query.data?.items ?? []} loaded={query.data !== undefined} />

      <Tabs
        variant="segmented"
        label={t('contracts.register.views')}
        selected={view}
        onSelect={selectView}
        tabs={[
          { id: 'all', label: t('contracts.register.view.all') },
          { id: 'mine', label: t('contracts.register.view.mine'), disabled: userId === null },
          { id: 'renewals', label: t('contracts.register.view.renewals') },
        ]}
      >
        <FilterDisclosure
          activeCount={advancedActive}
          render={(toggle, panel) => (
            <>
              <Toolbar
                label={t('contracts.register.filters')}
                end={
                  <>
                    <Select
                      label={t('contracts.register.filter.owner')}
                      placeholder={t('contracts.register.allOwners')}
                      value={filters.owner}
                      options={owners.options}
                      onChange={(owner) => setFilters({ owner, page: 1 })}
                    />
                    {toggle}
                  </>
                }
              >
                <div className="tiq-toolbar-search">
                  <SearchField
                    label={t('contracts.common.search')}
                    placeholder={t('contracts.register.searchPlaceholder')}
                    value={filters.q}
                    onChange={(q) => setFilters({ q, page: 1 })}
                    hideLabel
                    full
                  />
                </div>
              </Toolbar>
              {panel}
            </>
          )}
        >
          <FilterBar
            variant="panel"
            label={t('contracts.register.advancedFilters')}
            onClear={clearFilters}
            canClear={filtered}
          >
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
        </FilterDisclosure>

        <DataTable
          variant="plain"
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
              icon="fileSignature"
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
        {total !== undefined && (
          <p className="tiq-register-foot">
            <span>{t('contracts.register.total', { count: total })}</span>
          </p>
        )}

        {summary !== undefined && query.data !== undefined && query.data.items.length > 0 && (
          <div
            className="tiq-contracts-summary"
            role="group"
            aria-labelledby={panelLabelId}
            data-testid="contracts-summary"
          >
            <span id={panelLabelId} className="tiq-visually-hidden">
              {t('contracts.register.summaryLabel')}
            </span>
            <div className="tiq-contracts-summary-stats">
              {summary.currentValueByCurrency.map((money) => (
                <Stat
                  key={money.currency}
                  value={formatMoney(money, { compact: true })}
                  unit={t('contracts.register.committed')}
                  caption={t('contracts.register.committedCaption', {
                    currency: money.currency,
                  })}
                />
              ))}
              <dl className="tiq-contracts-summary-counts">
                <div>
                  <dt>{t('contracts.register.kpi.active')}</dt>
                  <dd>{formatCount(activeCount)}</dd>
                </div>
                <div>
                  <dt>{t('contracts.register.kpi.decisions')}</dt>
                  <dd>{formatCount(summary.upcomingDecisions)}</dd>
                </div>
                <div>
                  <dt>{t('contracts.register.kpi.renewals')}</dt>
                  <dd>{formatCount(summary.renewalsWithin90Days)}</dd>
                </div>
              </dl>
            </div>
            {summary.overdueObligations > 0 && (
              <Attention icon="alertCircle">
                {t('contracts.register.overdueAttention', { count: summary.overdueObligations })}
              </Attention>
            )}
          </div>
        )}
      </Tabs>

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
