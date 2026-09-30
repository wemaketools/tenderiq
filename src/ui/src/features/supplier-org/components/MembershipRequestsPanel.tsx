/**
 * SUP-02 / SUP-04 — requests to join this supplier organization, decided by a supplier administrator. Approving
 * names the capacity the person will act in; rejecting explains why. Membership approval is not identity
 * verification and not qualification (FR-02).
 */
import { useState } from 'react';

import { SUPPLIER_MEMBERSHIP_REQUESTS_STATUS } from '@contracts/enums';
import type { FieldError } from '@contracts/common';
import { DecideMembershipRequestBody, suppliersEndpoints } from '@contracts/suppliers';
import type { MembershipRequestRow } from '@contracts/suppliers';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  OrDash,
  RadioGroup,
  Select,
  StatusChip,
  TextArea,
  TextField,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { withSupplierMessage } from '../lib/errors';
import { useOfficialTimeZone } from '../lib/hooks';
import { compact, dateOf, directionOf, oneOf, sortOf, tableSort } from '../lib/lists';
import { errorLookup, validateWith } from '../lib/validation';

const SORTS = ['createdAt', 'status'] as const;
const DEFAULTS = {
  status: 'pending',
  createdFrom: '',
  createdTo: '',
  sort: 'createdAt',
  dir: 'desc',
  page: 1,
  pageSize: 10,
};

export function MembershipRequestsPanel() {
  const zone = useOfficialTimeZone();
  const toast = useToast();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-02-requests', DEFAULTS);
  const [deciding, setDeciding] = useState<MembershipRequestRow | null>(null);
  const [decided, setDecided] = useState<Readonly<Record<number, MembershipRequestRow>>>({});
  const query = useApiQuery(suppliersEndpoints.listMembershipRequests, {
    query: compact({
      status: oneOf(filters.status, SUPPLIER_MEMBERSHIP_REQUESTS_STATUS),
      createdFrom: dateOf(filters.createdFrom),
      createdTo: dateOf(filters.createdTo),
      sort: sortOf(filters.sort, SORTS, 'createdAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const rows = query.data?.items.map((row) => decided[row.id] ?? row);
  const filtered =
    filters.status !== 'pending' || filters.createdFrom !== '' || filters.createdTo !== '';

  const columns: DataTableColumn<MembershipRequestRow>[] = [
    {
      id: 'requester',
      header: t('supplier-org.requests.col.requester'),
      cell: (row) => (
        <>
          <span>{row.requester.fullName}</span>
          <span className="tiq-cell-sub">{row.requester.email}</span>
        </>
      ),
    },
    {
      id: 'message',
      header: t('supplier-org.requests.col.message'),
      cell: (row) => <span className="tiq-cell-sub">{row.message}</span>,
    },
    {
      id: 'createdAt',
      header: t('supplier-org.requests.col.created'),
      sortable: true,
      cell: (row) => formatDateTime(row.createdAt, zone),
    },
    {
      id: 'status',
      header: t('supplier-org.requests.col.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="supplier_membership_requests.status" value={row.status} />,
    },
    {
      id: 'decision',
      header: t('supplier-org.requests.col.decision'),
      cell: (row) =>
        row.decidedAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <span>
              {row.decidedBy?.fullName ?? ''} · {formatDateTime(row.decidedAt, zone)}
            </span>
            {row.decisionNote !== null && <span className="tiq-cell-sub">{row.decisionNote}</span>}
          </>
        ),
    },
    {
      id: 'actions',
      header: t('supplier-org.requests.col.actions'),
      cell: (row) =>
        row.status === 'pending' ? (
          <Button size="sm" onClick={() => setDeciding(row)}>
            {t('supplier-org.requests.decide')}
          </Button>
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
  ];

  return (
    <div className="tiq-stack">
      <FilterBar
        onClear={clearFilters}
        canClear={filtered}
        label={t('supplier-org.requests.filters')}
      >
        <Select
          label={t('supplier-org.requests.filterStatus')}
          placeholder={t('supplier-org.common.allStatuses')}
          value={filters.status}
          options={SUPPLIER_MEMBERSHIP_REQUESTS_STATUS.map((value) => ({
            value,
            label: tEnum('supplier_membership_requests.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <DateInput
          label={t('supplier-org.common.createdFrom')}
          value={filters.createdFrom}
          onChange={(createdFrom) => setFilters({ createdFrom, page: 1 })}
        />
        <DateInput
          label={t('supplier-org.common.createdTo')}
          value={filters.createdTo}
          onChange={(createdTo) => setFilters({ createdTo, page: 1 })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('supplier-org.requests.caption')}
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.id)}
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
                  ? t('supplier-org.requests.emptyFiltered')
                  : t('supplier-org.requests.empty')
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
      {deciding !== null && (
        <DecideMembershipDialog
          key={deciding.id}
          request={deciding}
          onClose={() => setDeciding(null)}
          onDecided={(row) => {
            setDecided((current) => ({ ...current, [row.id]: row }));
            setDeciding(null);
            toast.show(
              t('supplier-org.requests.decided', {
                name: row.requester.fullName,
                status: tEnum('supplier_membership_requests.status', row.status),
              }),
              'success',
            );
            invalidateApiQueries('supplier.suppliers.membershipRequests.');
          }}
        />
      )}
    </div>
  );
}

function DecideMembershipDialog({
  request,
  onClose,
  onDecided,
}: {
  readonly request: MembershipRequestRow;
  readonly onClose: () => void;
  readonly onDecided: (row: MembershipRequestRow) => void;
}) {
  const decide = useApiMutation(suppliersEndpoints.decideMembershipRequest);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [capacity, setCapacity] = useState('');
  const [note, setNote] = useState('');
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const errors = errorLookup(clientErrors, decide.error, ['capacity', 'decisionNote', 'decision']);

  const body = {
    decision,
    ...(capacity.trim() === '' ? {} : { capacity: capacity.trim() }),
    ...(note.trim() === '' ? {} : { decisionNote: note.trim() }),
  };
  const invalid = validateWith(DecideMembershipRequestBody, body).length > 0;

  return (
    <ConfirmActionDialog
      open
      title={t('supplier-org.requests.decideTitle', { name: request.requester.fullName })}
      scope={t('supplier-org.requests.decideScope', {
        name: request.requester.fullName,
        email: request.requester.email,
      })}
      consequence={
        decision === 'approved'
          ? t('supplier-org.requests.approveResult')
          : t('supplier-org.requests.rejectResult')
      }
      confirmLabel={
        decision === 'approved'
          ? t('supplier-org.requests.approve')
          : t('supplier-org.requests.reject')
      }
      tone={decision === 'approved' ? 'primary' : 'danger'}
      pending={decide.pending}
      error={withSupplierMessage(decide.error)}
      onCancel={() => {
        decide.reset();
        onClose();
      }}
      onConfirm={async () => {
        const found = validateWith(DecideMembershipRequestBody, body);
        setClientErrors(found);
        if (found.length > 0) return;
        try {
          const row = await decide.mutate({ params: { requestId: request.id }, body });
          onDecided(row);
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      <div className="tiq-stack">
        <p className="tiq-cell-sub">{request.message}</p>
        <RadioGroup
          label={t('supplier-org.requests.decision')}
          inline
          value={decision}
          onChange={(value) => setDecision(value === 'rejected' ? 'rejected' : 'approved')}
          options={[
            { value: 'approved', label: t('supplier-org.requests.approve') },
            { value: 'rejected', label: t('supplier-org.requests.reject') },
          ]}
        />
        {decision === 'approved' && (
          <TextField
            label={t('supplier-org.requests.capacity')}
            hint={t('supplier-org.requests.capacityHint')}
            required
            value={capacity}
            onChange={setCapacity}
            error={errors.forField('capacity')}
          />
        )}
        <TextArea
          label={t('supplier-org.requests.note')}
          hint={
            decision === 'rejected'
              ? t('supplier-org.requests.noteRequired')
              : t('supplier-org.requests.noteOptional')
          }
          required={decision === 'rejected'}
          rows={3}
          value={note}
          onChange={setNote}
          error={errors.forField('decisionNote')}
        />
        {invalid && clientErrors.length === 0 && (
          <p className="tiq-text-muted">{t('supplier-org.requests.completeFields')}</p>
        )}
      </div>
    </ConfirmActionDialog>
  );
}
