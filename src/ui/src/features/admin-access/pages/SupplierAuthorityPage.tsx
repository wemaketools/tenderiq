/**
 * SUP-04 — Supplier authority (AC-03): for every member, what they may do on responses (prepare, price, approve,
 * submit), where submission authority comes from (explicitly assigned for the organization or one tender, never
 * implied by bid management or contribution), signing limits and delegated authority. The administrator grants or
 * withdraws submission authority and sets signing limits; nobody raises their own authority.
 */
import { useState } from 'react';

import { orgAdminEndpoints } from '@contracts/org-admin';
import type { SupplierAuthorityRow } from '@contracts/org-admin';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateTimeInput,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  MoneyInput,
  MoneyText,
  PageHeader,
  RadioGroup,
  SearchField,
  Select,
  StatusChip,
  formErrors,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatInstantDate } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import { AccessLayout } from '../components/AccessLayout';
import { AccessStatusChip, PersonCell } from '../components/AccessBits';
import { ScopeInput } from '../components/Pickers';
import { dialogError } from '../lib/errors';
import { useOfficialTimeZone } from '../lib/hooks';
import {
  booleanFilter,
  compact,
  directionOf,
  isFiltered,
  pagingOf,
  sortOf,
  tableSort,
} from '../lib/lists';
import { ORGANIZATION_SCOPE } from '../lib/scope';
import type { ScopeValue } from '../lib/scope';

const DEFAULTS = {
  q: '',
  canSubmit: '',
  canApprove: '',
  sort: 'member',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

function SubmissionDialog({
  row,
  onClose,
  onDone,
}: {
  readonly row: SupplierAuthorityRow;
  readonly onClose: () => void;
  readonly onDone: (row: SupplierAuthorityRow) => void;
}) {
  const [granted, setGranted] = useState(row.canSubmit ? 'false' : 'true');
  const [scope, setScope] = useState<ScopeValue>(ORGANIZATION_SCOPE);
  const [checked, setChecked] = useState(false);
  const set = useApiMutation(orgAdminEndpoints.setSubmissionAuthority);
  const grant = granted === 'true';
  const scopeMissing = scope.scopeType === 'tender' && scope.scopeId === null;
  return (
    <ConfirmActionDialog
      open
      tone={grant ? 'primary' : 'danger'}
      title={t('admin-access.authority.submissionTitle', { name: row.member.fullName })}
      scope={row.member.fullName}
      consequence={
        grant
          ? t('admin-access.authority.grantConsequence')
          : t('admin-access.authority.withdrawConsequence')
      }
      confirmLabel={
        grant ? t('admin-access.authority.grant') : t('admin-access.authority.withdraw')
      }
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={set.pending}
      error={dialogError(set.error, ['scope'])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setChecked(true);
        if (scopeMissing) return;
        try {
          onDone(
            await set.mutate({
              params: { userId: row.member.userId },
              body: { granted: grant, scope, reason },
            }),
          );
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      <RadioGroup
        label={t('admin-access.authority.submission')}
        value={granted}
        onChange={setGranted}
        options={[
          {
            value: 'true',
            label: t('admin-access.authority.grant'),
            hint: t('admin-access.authority.grantHint'),
          },
          {
            value: 'false',
            label: t('admin-access.authority.withdraw'),
            hint: t('admin-access.authority.withdrawHint'),
          },
        ]}
      />
      <ScopeInput
        value={scope}
        onChange={setScope}
        types={['organization', 'tender']}
        error={
          checked && scopeMissing
            ? t('admin-access.scope.required')
            : formErrors(set.error, ['scope']).forField('scope')
        }
      />
    </ConfirmActionDialog>
  );
}

function SigningLimitDialog({
  row,
  onClose,
  onDone,
}: {
  readonly row: SupplierAuthorityRow;
  readonly onClose: () => void;
  readonly onDone: (row: SupplierAuthorityRow) => void;
}) {
  const tenant = useActiveTenant();
  const timeZone = useOfficialTimeZone();
  const now = useNow();
  const currency = tenant?.defaultCurrency ?? 'BWP';
  const [amount, setAmount] = useState({
    amount: row.signingLimit?.maxAmount?.amount ?? '',
    currency: row.signingLimit?.maxAmount?.currency ?? currency,
  });
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(() =>
    new Date(now).toISOString(),
  );
  const [effectiveTo, setEffectiveTo] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const set = useApiMutation(orgAdminEndpoints.setSigningLimit);
  const server = formErrors(set.error, ['maxAmount', 'effectiveFrom', 'effectiveTo']);
  const inverted =
    effectiveFrom !== null &&
    effectiveTo !== null &&
    Date.parse(effectiveTo) <= Date.parse(effectiveFrom);
  const missingAmount = amount.amount.trim() === '';
  return (
    <ConfirmActionDialog
      open
      title={t('admin-access.authority.limitTitle', { name: row.member.fullName })}
      scope={row.member.fullName}
      consequence={t('admin-access.authority.limitConsequence')}
      confirmLabel={t('admin-access.authority.setLimit')}
      reason={{ label: t('admin-access.common.reason'), required: true }}
      pending={set.pending}
      error={dialogError(set.error, ['maxAmount', 'effectiveFrom', 'effectiveTo'])}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setChecked(true);
        if (missingAmount || effectiveFrom === null || inverted) return;
        try {
          onDone(
            await set.mutate({
              params: { userId: row.member.userId },
              body: {
                maxAmount: { amount: amount.amount, currency: amount.currency },
                effectiveFrom,
                effectiveTo,
                reason,
              },
            }),
          );
        } catch {
          // Shown in the dialog.
        }
      }}
    >
      {!row.canSubmit && !row.canApprove && (
        <Banner tone="warning" title={t('admin-access.authority.limitNeedsSignatory')} />
      )}
      <MoneyInput
        label={t('admin-access.authority.signingLimit')}
        value={amount}
        onChange={setAmount}
        currencies={[currency]}
        error={
          checked && missingAmount
            ? t('admin-access.authority.amountRequired')
            : server.forField('maxAmount')
        }
        required
      />
      <DateTimeInput
        label={t('admin-access.authority.effectiveFrom')}
        value={effectiveFrom}
        onChange={setEffectiveFrom}
        timeZone={timeZone}
        error={server.forField('effectiveFrom')}
        required
      />
      <DateTimeInput
        label={t('admin-access.authority.effectiveTo')}
        hint={t('admin-access.authority.effectiveToHint')}
        value={effectiveTo}
        onChange={setEffectiveTo}
        timeZone={timeZone}
        error={inverted ? t('admin-access.common.endAfterStart') : server.forField('effectiveTo')}
      />
    </ConfirmActionDialog>
  );
}

function Capability({ yes, label }: { readonly yes: boolean; readonly label: string }) {
  return yes ? (
    <Chip tone="success" size="sm" icon="check">
      {label}
    </Chip>
  ) : (
    <Chip tone="neutral-outlined" size="sm">
      {label}
    </Chip>
  );
}

export default function SupplierAuthorityPage() {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-04:authority', DEFAULTS);
  const [open, setOpen] = useState<{
    kind: 'submission' | 'limit';
    row: SupplierAuthorityRow;
  } | null>(null);
  const [results, setResults] = useState<Readonly<Record<number, SupplierAuthorityRow>>>({});
  const query = useApiQuery(orgAdminEndpoints.listSupplierAuthority, {
    query: compact({
      q: filters.q.trim(),
      canSubmit: booleanFilter(filters.canSubmit),
      canApprove: booleanFilter(filters.canApprove),
      sort: sortOf(filters.sort, ['member', 'capacity'] as const, 'member'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(orgAdminEndpoints.listSupplierAuthority, {
    query: { pageSize: 100 },
  });
  const all = overview.data?.items ?? [];
  const count = (rows: readonly SupplierAuthorityRow[]): string =>
    overview.data === undefined ? '…' : formatCount(rows.length);
  const rows = (query.data?.items ?? []).map((row) => results[row.member.userId] ?? row);
  const filtered = isFiltered(filters);
  const done = (row: SupplierAuthorityRow, message: string): void => {
    setResults({ ...results, [row.member.userId]: row });
    setOpen(null);
    toast.show(message, 'success');
  };
  const yesNo = [
    { value: 'true', label: t('admin-access.common.yes') },
    { value: 'false', label: t('admin-access.common.no') },
  ];

  const columns: DataTableColumn<SupplierAuthorityRow>[] = [
    {
      id: 'member',
      header: t('admin-access.users.col.name'),
      sortable: true,
      cell: (row) => (
        <>
          <PersonCell name={row.member.fullName} sub={row.capacity} />
          {row.membershipStatus !== 'active' && (
            <StatusChip enum="memberships.status" value={row.membershipStatus} size="sm" />
          )}
        </>
      ),
    },
    {
      id: 'capabilities',
      header: t('admin-access.authority.col.capabilities'),
      cell: (row) => (
        <span className="tiq-inline">
          <Capability yes={row.canPrepare} label={t('admin-access.authority.prepare')} />
          <Capability yes={row.canPrice} label={t('admin-access.authority.price')} />
          <Capability yes={row.canApprove} label={t('admin-access.authority.approve')} />
        </span>
      ),
    },
    {
      id: 'submission',
      header: t('admin-access.authority.col.submission'),
      cell: (row) => (
        <>
          {row.canSubmit ? (
            <Chip tone="success" size="sm" icon="send">
              {t('admin-access.authority.submit')}
            </Chip>
          ) : (
            <Chip tone="neutral-outlined" size="sm">
              {t('admin-access.authority.noSubmit')}
            </Chip>
          )}
          <span className="tiq-cell-sub">
            {t(`admin-access.authority.source.${row.submissionSource}`)}
            {row.submissionTenders.length > 0 &&
              `: ${row.submissionTenders.map((tender) => tender.reference).join(', ')}`}
          </span>
        </>
      ),
    },
    {
      id: 'limit',
      header: t('admin-access.authority.col.limit'),
      cell: (row) =>
        row.signingLimit === null ? (
          '—'
        ) : (
          <>
            {row.signingLimit.maxAmount === null ? (
              t('admin-access.common.unlimited')
            ) : (
              <MoneyText value={row.signingLimit.maxAmount} />
            )}
            <span className="tiq-cell-sub tiq-inline">
              <AccessStatusChip status={row.signingLimit.status} />
              {row.signingLimit.effectiveTo !== null &&
                t('admin-access.common.until', {
                  date: formatInstantDate(row.signingLimit.effectiveTo, timeZone),
                })}
            </span>
          </>
        ),
    },
    {
      id: 'work',
      header: t('admin-access.authority.col.work'),
      numeric: true,
      cell: (row) => (
        <>
          <span>{t('admin-access.authority.assignments', { count: row.activeAssignments })}</span>
          {row.delegationsReceived > 0 && (
            <span className="tiq-cell-sub">
              {t('admin-access.users.delegations', { count: row.delegationsReceived })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'actions',
      header: t('admin-access.common.actions'),
      cell: (row) => {
        if (row.blockedBy === 'inactive') return '—';
        if (row.blockedBy === 'self') {
          return <span className="tiq-cell-sub">{t('admin-access.authority.selfNote')}</span>;
        }
        const canSetLimit = row.availableActions.includes('setSigningLimit');
        return (
          <>
            <div className="tiq-row-actions">
              {row.availableActions.includes('changeSubmission') && (
                <Button size="sm" onClick={() => setOpen({ kind: 'submission', row })}>
                  {t('admin-access.authority.changeSubmission')}
                </Button>
              )}
              <Button
                size="sm"
                disabled={!canSetLimit}
                aria-describedby={
                  canSetLimit ? undefined : `authority-limit-note-${row.member.userId}`
                }
                onClick={() => setOpen({ kind: 'limit', row })}
              >
                {t('admin-access.authority.limitAction')}
              </Button>
            </div>
            {!canSetLimit && (
              <span id={`authority-limit-note-${row.member.userId}`} className="tiq-cell-sub">
                {t('admin-access.authority.limitNeedsSubmission')}
              </span>
            )}
          </>
        );
      },
    },
  ];

  return (
    <AccessLayout>
      <PageHeader
        title={t('admin-access.authority.title')}
        subtitle={t('admin-access.authority.intro')}
      />
      <Banner tone="info" title={t('admin-access.authority.ruleTitle')}>
        <p>{t('admin-access.authority.ruleBody')}</p>
      </Banner>
      <FilterBar
        label={t('admin-access.authority.filters')}
        onClear={clearFilters}
        canClear={filtered}
      >
        <SearchField
          label={t('admin-access.common.search')}
          placeholder={t('admin-access.users.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('admin-access.authority.filter.submit')}
          placeholder={t('admin-access.common.all')}
          value={filters.canSubmit}
          options={yesNo}
          onChange={(canSubmit) => setFilters({ canSubmit, page: 1 })}
        />
        <Select
          label={t('admin-access.authority.filter.approve')}
          placeholder={t('admin-access.common.all')}
          value={filters.canApprove}
          options={yesNo}
          onChange={(canApprove) => setFilters({ canApprove, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('admin-access.authority.kpi.submit')}
          icon="send"
          tone="success"
          value={count(all.filter((row) => row.canSubmit))}
          hint={t('admin-access.authority.kpi.submitHint')}
          restricted={overview.error?.kind === 'forbidden'}
        />
        <KpiCard
          label={t('admin-access.authority.kpi.approve')}
          icon="checkCircle"
          tone="info"
          value={count(all.filter((row) => row.canApprove))}
          hint={t('admin-access.authority.kpi.approveHint')}
          restricted={overview.error?.kind === 'forbidden'}
        />
        <KpiCard
          label={t('admin-access.authority.kpi.limits')}
          icon="coins"
          value={count(all.filter((row) => row.signingLimit !== null))}
          hint={t('admin-access.authority.kpi.limitsHint')}
          restricted={overview.error?.kind === 'forbidden'}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('admin-access.authority.caption')}
          columns={columns}
          rows={query.data === undefined ? undefined : rows}
          rowKey={(row) => String(row.member.userId)}
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
                  ? t('admin-access.authority.emptyFiltered')
                  : t('admin-access.authority.empty')
              }
            />
          }
          pagination={pagingOf(query.data, setFilters)}
        />
      </Card>
      {open?.kind === 'submission' && (
        <SubmissionDialog
          row={open.row}
          onClose={() => setOpen(null)}
          onDone={(row) => done(row, t('admin-access.authority.submissionSaved'))}
        />
      )}
      {open?.kind === 'limit' && (
        <SigningLimitDialog
          row={open.row}
          onClose={() => setOpen(null)}
          onDone={(row) => done(row, t('admin-access.authority.limitSaved'))}
        />
      )}
    </AccessLayout>
  );
}
