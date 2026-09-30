/**
 * The obligation register of a contract (CON-05 all commitments, CON-06 milestones and deliverables): filters, counts,
 * owners, official due dates, overdue flags, evidence and the latest decision, with assign / evidence / escalate
 * actions for contract managers.
 */
import { useNavigate } from 'react-router';

import { OBLIGATION_SORT_FIELDS, contractsEndpoints } from '@contracts/contracts';
import type { ObligationRow } from '@contracts/contracts';
import { OBLIGATIONS_KIND, OBLIGATIONS_PARTY, OBLIGATIONS_STATUS } from '@contracts/enums';
import type { ObligationsKind } from '@contracts/enums';

import { useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Button,
  Card,
  Chip,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  MoneyText,
  OfficialDeadline,
  OrDash,
  OverdueChip,
  SearchField,
  Select,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useContractCommand, useDialog } from '../lib/hooks';
import { compact, directionOf, idOf, oneOf, pick, tableSort } from '../lib/lists';
import { contractPaths } from '../lib/paths';
import { useAssigneeOptions } from '../lib/assignees';
import { EvidenceDialog } from './EvidenceDialog';
import {
  AssignObligationDialog,
  CreateObligationDialog,
  EscalateDialog,
} from './ObligationDialogs';

export interface ObligationsPanelProps {
  readonly screen: 'CON-05' | 'CON-06';
  readonly contractId: number;
  readonly contractReference: string;
  readonly timeZone: string;
  readonly currency: string;
  readonly canManage: boolean;
  /** Kinds shown when no kind filter is chosen (CON-06: milestones and deliverables). */
  readonly kinds: readonly ObligationsKind[];
  /** The create dialog is opened by the page's primary action. */
  readonly creating: boolean;
  readonly onCreateClose: () => void;
}

const DEFAULTS = {
  q: '',
  kind: '',
  party: '',
  status: '',
  owner: '',
  overdue: '',
  survives: '',
  dueFrom: '',
  dueTo: '',
  sort: 'dueAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

type DialogKind = 'assign' | 'evidence' | 'escalate';

export function ObligationsPanel({
  screen,
  contractId,
  contractReference,
  timeZone,
  currency,
  canManage,
  kinds,
  creating,
  onCreateClose,
}: ObligationsPanelProps) {
  const navigate = useNavigate();
  const [filters, setFilters, clearFilters] = useScreenFilters(`${screen}-obligations`, DEFAULTS);
  const owners = useAssigneeOptions('obligation_owner');
  const dialog = useDialog<DialogKind, ObligationRow>();
  const kindFilter = oneOf(filters.kind, OBLIGATIONS_KIND) ?? [...kinds];
  const query = useApiQuery(contractsEndpoints.obligations, {
    params: { contractId },
    query: compact({
      q: filters.q.trim(),
      kind: kindFilter,
      party: pick(filters.party, OBLIGATIONS_PARTY),
      status: oneOf(filters.status, OBLIGATIONS_STATUS),
      ownerUserId: idOf(filters.owner),
      overdue: filters.overdue === 'yes' ? true : undefined,
      survivesCloseout: filters.survives === 'yes' ? true : undefined,
      dueFrom: filters.dueFrom,
      dueTo: filters.dueTo,
      sort: pick(filters.sort, OBLIGATION_SORT_FIELDS),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const evidence = useContractCommand(
    contractsEndpoints.submitObligationEvidence,
    (result) => result.message,
  );
  const counts = query.data?.counts;
  const filtered =
    filters.q !== '' ||
    filters.kind !== '' ||
    filters.party !== '' ||
    filters.status !== '' ||
    filters.owner !== '' ||
    filters.overdue !== '' ||
    filters.survives !== '' ||
    filters.dueFrom !== '' ||
    filters.dueTo !== '';
  const kindOptions = (kinds.length === OBLIGATIONS_KIND.length ? OBLIGATIONS_KIND : kinds).map(
    (value) => ({ value, label: tEnum('obligations.kind', value) }),
  );

  const columns: DataTableColumn<ObligationRow>[] = [
    {
      id: 'title',
      header: t('contracts.obligations.col.title'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.title}</span>
          <span className="tiq-cell-sub">
            {tEnum('obligations.kind', row.kind)}
            {row.recurrence !== null ? ` · ${row.recurrence}` : ''}
          </span>
        </>
      ),
    },
    {
      id: 'party',
      header: t('contracts.obligations.col.party'),
      cell: (row) => (
        <>
          <span>{tEnum('obligations.party', row.party)}</span>
          {row.supplierContact !== null && (
            <span className="tiq-cell-sub">{row.supplierContact}</span>
          )}
        </>
      ),
    },
    {
      id: 'owner',
      header: t('contracts.obligations.col.owner'),
      cell: (row) => <OrDash>{row.owner?.fullName}</OrDash>,
    },
    {
      id: 'dueAt',
      header: t('contracts.obligations.col.due'),
      sortable: true,
      cell: (row) =>
        row.dueAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <span className="tiq-stack">
            <OfficialDeadline deadline={row.dueAt} showLocal={false} />
            {row.isOverdue && <OverdueChip />}
          </span>
        ),
    },
    {
      id: 'status',
      header: t('contracts.obligations.col.status'),
      sortable: true,
      cell: (row) => (
        <span className="tiq-inline">
          <StatusChip enum="obligations.status" value={row.status} size="sm" />
          {row.survivesCloseout && (
            <Chip tone="info" size="sm">
              {t('contracts.obligations.survives')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'amount',
      header: t('contracts.obligations.col.payment'),
      numeric: true,
      cell: (row) =>
        row.isPaymentMilestone ? (
          <>
            <MoneyText value={row.amount} />
            <span className="tiq-cell-sub">{t('contracts.obligations.paymentMilestone')}</span>
          </>
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
    {
      id: 'evidence',
      header: t('contracts.obligations.col.evidence'),
      cell: (row) => (
        <>
          <span>{t('contracts.obligations.evidenceCount', { count: row.evidenceCount })}</span>
          {row.latestDecision !== null && (
            <span className="tiq-cell-sub">
              {t('contracts.obligations.latestDecision', {
                decision: tEnum('acceptance_decisions.decision', row.latestDecision.decision),
                date: formatInstantDate(row.latestDecision.decidedAt, timeZone),
              })}
            </span>
          )}
        </>
      ),
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: t('contracts.register.col.actions'),
            cell: (row: ObligationRow) => (
              <span className="tiq-inline">
                <Button
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    dialog.show('assign', row);
                  }}
                  aria-label={t('contracts.obligations.assignFor', { title: row.title })}
                >
                  {t('contracts.obligations.assign')}
                </Button>
                {row.party === 'buyer' &&
                  ['planned', 'due', 'overdue', 'rejected'].includes(row.status) && (
                    <Button
                      size="sm"
                      icon="upload"
                      onClick={(event) => {
                        event.stopPropagation();
                        evidence.reset();
                        dialog.show('evidence', row);
                      }}
                      aria-label={t('contracts.obligations.evidenceFor', { title: row.title })}
                    >
                      {t('contracts.obligations.submitEvidence')}
                    </Button>
                  )}
                {row.isOverdue && (
                  <Button
                    size="sm"
                    variant="danger-soft"
                    icon="alertTriangle"
                    onClick={(event) => {
                      event.stopPropagation();
                      dialog.show('escalate', row);
                    }}
                    aria-label={t('contracts.obligations.escalateFor', { title: row.title })}
                  >
                    {t('contracts.obligations.escalate')}
                  </Button>
                )}
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="tiq-stack">
      <FilterBar
        label={t('contracts.obligations.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('contracts.common.search')}
          placeholder={t('contracts.obligations.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('contracts.obligations.filter.kind')}
          placeholder={t('contracts.common.all')}
          value={filters.kind}
          options={kindOptions}
          onChange={(kind) => setFilters({ kind, page: 1 })}
        />
        <Select
          label={t('contracts.obligations.filter.party')}
          placeholder={t('contracts.common.all')}
          value={filters.party}
          options={OBLIGATIONS_PARTY.map((value) => ({
            value,
            label: tEnum('obligations.party', value),
          }))}
          onChange={(party) => setFilters({ party, page: 1 })}
        />
        <Select
          label={t('contracts.obligations.filter.status')}
          placeholder={t('contracts.common.all')}
          value={filters.status}
          options={OBLIGATIONS_STATUS.map((value) => ({
            value,
            label: tEnum('obligations.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('contracts.obligations.filter.owner')}
          placeholder={t('contracts.common.all')}
          value={filters.owner}
          options={owners.options}
          onChange={(owner) => setFilters({ owner, page: 1 })}
        />
        <Select
          label={t('contracts.obligations.filter.overdue')}
          placeholder={t('contracts.common.all')}
          value={filters.overdue}
          options={[{ value: 'yes', label: t('contracts.obligations.overdueOnly') }]}
          onChange={(overdue) => setFilters({ overdue, page: 1 })}
        />
        <Select
          label={t('contracts.obligations.filter.survives')}
          placeholder={t('contracts.common.all')}
          value={filters.survives}
          options={[{ value: 'yes', label: t('contracts.obligations.survivesOnly') }]}
          onChange={(survives) => setFilters({ survives, page: 1 })}
        />
        <DateInput
          label={t('contracts.obligations.filter.dueFrom')}
          value={filters.dueFrom}
          onChange={(dueFrom) => setFilters({ dueFrom, page: 1 })}
        />
        <DateInput
          label={t('contracts.obligations.filter.dueTo')}
          value={filters.dueTo}
          onChange={(dueTo) => setFilters({ dueTo, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('contracts.obligations.kpi.open')}
          icon="listChecks"
          value={counts === undefined ? '…' : formatCount(counts.open)}
          hint={t('contracts.obligations.kpi.openHint', { total: counts?.total ?? 0 })}
        />
        <KpiCard
          label={t('contracts.obligations.kpi.overdue')}
          icon="alertTriangle"
          tone="danger"
          value={counts === undefined ? '…' : formatCount(counts.overdue)}
          hint={t('contracts.obligations.kpi.overdueHint')}
        />
        <KpiCard
          label={t('contracts.obligations.kpi.review')}
          icon="clipboardCheck"
          tone="warning"
          value={counts === undefined ? '…' : formatCount(counts.awaitingReview)}
          hint={t('contracts.obligations.kpi.reviewHint')}
        />
        <KpiCard
          label={t('contracts.obligations.kpi.rejected')}
          icon="xCircle"
          tone="danger"
          value={counts === undefined ? '…' : formatCount(counts.rejected)}
          hint={t('contracts.obligations.kpi.rejectedHint')}
        />
        <KpiCard
          label={t('contracts.obligations.kpi.surviving')}
          icon="shield"
          tone="info"
          value={counts === undefined ? '…' : formatCount(counts.surviving)}
          hint={t('contracts.obligations.kpi.survivingHint')}
        />
      </KpiGrid>
      <Card flush title={t(`contracts.obligations.cardTitle.${screen}`)}>
        <DataTable
          caption={t(`contracts.obligations.cardTitle.${screen}`)}
          columns={columns}
          rows={query.data?.items}
          rowKey={(row) => String(row.id)}
          rowLabel={(row) => row.title}
          onRowClick={(row) => void navigate(contractPaths.obligation(contractId, row.id))}
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
                  ? t('contracts.obligations.emptyFiltered')
                  : t('contracts.obligations.empty')
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
      {creating && (
        <CreateObligationDialog
          contractId={contractId}
          contractReference={contractReference}
          currency={currency}
          timeZone={timeZone}
          defaultKind={kinds[0] ?? 'obligation'}
          dependencies={query.data?.items ?? []}
          onClose={onCreateClose}
        />
      )}
      {dialog.open === 'assign' && dialog.target !== null && (
        <AssignObligationDialog
          contractId={contractId}
          contractReference={contractReference}
          obligation={dialog.target}
          onClose={dialog.close}
        />
      )}
      {dialog.open === 'escalate' && dialog.target !== null && (
        <EscalateDialog
          contractId={contractId}
          contractReference={contractReference}
          obligation={dialog.target}
          onClose={dialog.close}
        />
      )}
      {dialog.open === 'evidence' && dialog.target !== null && (
        <EvidenceDialog
          open
          audience="buyer"
          obligation={dialog.target}
          contractReference={contractReference}
          pending={evidence.pending}
          error={evidence.error}
          onClose={dialog.close}
          onSubmit={async (body) => {
            const target = dialog.target;
            if (target === null) return false;
            const result = await evidence.run({
              params: { contractId, obligationId: target.id },
              body,
            });
            return result !== null;
          }}
        />
      )}
    </div>
  );
}
