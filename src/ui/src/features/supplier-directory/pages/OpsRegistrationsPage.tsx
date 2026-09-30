/**
 * Operator — supplier registration queue (DD-27): pending registrations with the registrant, verification e-mail
 * status, possible-duplicate flag and last activity. The operator asks for missing identity evidence (SUP-02 "resolve
 * missing evidence"), verifies the legal identity against the registry (identity verification is not qualification)
 * or closes abandoned registrations. Registered but unverified organizations (AC-07) stay in the queue.
 */
import { useState } from 'react';

import type { FieldError } from '@contracts/common';
import {
  EVIDENCE_ITEMS_EVIDENCE_TYPE,
  INVITATIONS_STATUS,
  TENANTS_STATUS,
  TENANTS_VERIFICATION_STATUS,
} from '@contracts/enums';
import type { EvidenceItemsEvidenceType } from '@contracts/enums';
import {
  RequestVerificationEvidenceBody,
  VerifyIdentityBody,
  suppliersEndpoints,
} from '@contracts/suppliers';
import type { OpsRegistrationRow } from '@contracts/suppliers';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Banner,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DateInput,
  EmptyState,
  FilterBar,
  IconButton,
  KpiCard,
  KpiGrid,
  Menu,
  MultiSelect,
  OrDash,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
  TextArea,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatCount, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { CategoryChips } from '../../supplier-org/components/SupplierBits';
import { withSupplierMessage } from '../../supplier-org/lib/errors';
import { useOfficialTimeZone } from '../../supplier-org/lib/hooks';
import {
  booleanOf,
  compact,
  dateOf,
  directionOf,
  oneOf,
  sortOf,
  tableSort,
} from '../../supplier-org/lib/lists';
import { errorLookup, validateWith } from '../../supplier-org/lib/validation';
import { OpsReviewTabs } from '../components/OpsReviewTabs';

const SORTS = ['createdAt', 'legalName', 'lastActivityAt'] as const;
const DEFAULTS = {
  q: '',
  status: 'pending',
  verificationStatus: '',
  emailStatus: '',
  possibleDuplicate: '',
  createdFrom: '',
  createdTo: '',
  sort: 'lastActivityAt',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};

type Action = {
  readonly kind: 'verify' | 'close' | 'requestEvidence';
  readonly row: OpsRegistrationRow;
} | null;

export default function OpsRegistrationsPage() {
  const zone = useOfficialTimeZone();
  const toast = useToast();
  const [filters, setFilters, clearFilters] = useScreenFilters('OPS-01-registrations', DEFAULTS);
  const [action, setAction] = useState<Action>(null);
  const [updated, setUpdated] = useState<Readonly<Record<number, OpsRegistrationRow>>>({});
  const [outcome, setOutcome] = useState<string | null>(null);
  const verify = useApiMutation(suppliersEndpoints.verifyIdentity);
  const close = useApiMutation(suppliersEndpoints.closeRegistration);

  const query = useApiQuery(suppliersEndpoints.listRegistrations, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, TENANTS_STATUS),
      verificationStatus: oneOf(filters.verificationStatus, TENANTS_VERIFICATION_STATUS),
      verificationEmailStatus: oneOf(filters.emailStatus, INVITATIONS_STATUS),
      possibleDuplicate: booleanOf(filters.possibleDuplicate),
      createdFrom: dateOf(filters.createdFrom),
      createdTo: dateOf(filters.createdTo),
      sort: sortOf(filters.sort, SORTS, 'lastActivityAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(suppliersEndpoints.listRegistrations, {
    query: { status: ['pending'], pageSize: 100 },
  });
  const pending = overview.data?.items ?? [];
  const rows = query.data?.items.map((row) => updated[row.tenantId] ?? row);
  const filtered =
    filters.q !== '' ||
    filters.status !== 'pending' ||
    filters.verificationStatus !== '' ||
    filters.emailStatus !== '' ||
    filters.possibleDuplicate !== '' ||
    filters.createdFrom !== '' ||
    filters.createdTo !== '';

  const columns: DataTableColumn<OpsRegistrationRow>[] = [
    {
      id: 'legalName',
      header: t('supplier-directory.registrations.col.organization'),
      sortable: true,
      cell: (row) => (
        <>
          <span>{row.legalName}</span>
          <span className="tiq-cell-sub">
            {[row.registrationNumber, row.country].filter((part) => part !== null).join(' · ')}
          </span>
          {row.possibleDuplicate && (
            <Chip tone="warning" size="sm" icon="flag">
              {t('supplier-directory.registrations.possibleDuplicate')}
            </Chip>
          )}
        </>
      ),
    },
    {
      id: 'registrant',
      header: t('supplier-directory.registrations.col.registrant'),
      cell: (row) => (
        <>
          <span>{row.registrant.fullName}</span>
          <span className="tiq-cell-sub">{row.registrant.email}</span>
        </>
      ),
    },
    {
      id: 'categories',
      header: t('supplier-directory.list.col.categories'),
      cell: (row) => <CategoryChips categories={row.categories} />,
    },
    {
      id: 'status',
      header: t('supplier-directory.registrations.col.status'),
      cell: (row) => (
        <span className="tiq-stack">
          <StatusChip enum="tenants.status" value={row.status} />
          <StatusChip enum="tenants.verification_status" value={row.verificationStatus} size="sm" />
          {row.evidenceRequest !== null && (
            <>
              <Chip
                tone={row.evidenceRequest.status === 'answered' ? 'info' : 'warning'}
                size="sm"
                icon={row.evidenceRequest.status === 'answered' ? 'inbox' : 'hourglass'}
              >
                {t(
                  `supplier-directory.registrations.evidenceRequest.${row.evidenceRequest.status}`,
                )}
              </Chip>
              <span className="tiq-cell-sub">
                {row.evidenceRequest.evidenceTypes
                  .map((type) => tEnum('evidence_items.evidence_type', type))
                  .join(', ')}
                {row.evidenceRequest.dueDate !== null &&
                  ` · ${t('supplier-directory.registrations.evidenceRequest.due', {
                    date: formatCalendarDate(row.evidenceRequest.dueDate),
                  })}`}
              </span>
            </>
          )}
        </span>
      ),
    },
    {
      id: 'email',
      header: t('supplier-directory.registrations.col.email'),
      cell: (row) => (
        <span className="tiq-stack">
          <StatusChip enum="invitations.status" value={row.verificationEmailStatus} />
          <span className="tiq-cell-sub">
            {t('supplier-directory.registrations.sent', { count: row.verificationEmailSentCount })}
          </span>
        </span>
      ),
    },
    {
      id: 'createdAt',
      header: t('supplier-directory.registrations.col.created'),
      sortable: true,
      cell: (row) => formatDateTime(row.createdAt, zone),
    },
    {
      id: 'lastActivityAt',
      header: t('supplier-directory.registrations.col.lastActivity'),
      sortable: true,
      cell: (row) => formatDateTime(row.lastActivityAt, zone),
    },
    {
      id: 'actions',
      header: t('supplier-directory.list.col.actions'),
      cell: (row) =>
        row.status !== 'closed' &&
        (row.status === 'pending' || row.verificationStatus !== 'identity_verified') ? (
          <Menu
            label={t('supplier-directory.list.actionsFor', { name: row.legalName })}
            entries={[
              ...(row.verificationStatus !== 'identity_verified' &&
              row.evidenceRequest?.status !== 'open'
                ? [
                    {
                      id: 'requestEvidence',
                      label: t('supplier-directory.registrations.requestEvidence'),
                      icon: 'fileText' as const,
                      onSelect: () => setAction({ kind: 'requestEvidence', row }),
                    },
                  ]
                : []),
              ...(row.verificationStatus !== 'identity_verified'
                ? [
                    {
                      id: 'verify',
                      label: t('supplier-directory.registrations.verify'),
                      icon: 'shieldCheck' as const,
                      onSelect: () => setAction({ kind: 'verify', row }),
                    },
                  ]
                : []),
              ...(row.status === 'pending'
                ? [
                    {
                      id: 'close',
                      label: t('supplier-directory.registrations.close'),
                      icon: 'archive' as const,
                      danger: true,
                      onSelect: () => setAction({ kind: 'close', row }),
                    },
                  ]
                : []),
            ]}
            trigger={(props) => (
              <IconButton
                {...props}
                icon="moreHorizontal"
                variant="ghost"
                size="sm"
                label={t('supplier-directory.list.actionsFor', { name: row.legalName })}
              />
            )}
          />
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
  ];

  const finish = (row: OpsRegistrationRow, message: string): void => {
    setUpdated((current) => ({ ...current, [row.tenantId]: row }));
    setAction(null);
    setOutcome(message);
    toast.show(message, 'success');
  };

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('supplier-directory.registrations.title')}
        subtitle={t('supplier-directory.registrations.intro')}
      />
      <OpsReviewTabs />
      <FilterBar
        onClear={clearFilters}
        canClear={filtered}
        label={t('supplier-directory.registrations.filters')}
      >
        <Select
          label={t('supplier-directory.registrations.filter.status')}
          placeholder={t('supplier-org.common.allStatuses')}
          value={filters.status}
          options={TENANTS_STATUS.map((value) => ({
            value,
            label: tEnum('tenants.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
        <Select
          label={t('supplier-directory.registrations.filter.verification')}
          placeholder={t('supplier-org.common.all')}
          value={filters.verificationStatus}
          options={TENANTS_VERIFICATION_STATUS.map((value) => ({
            value,
            label: tEnum('tenants.verification_status', value),
          }))}
          onChange={(verificationStatus) => setFilters({ verificationStatus, page: 1 })}
        />
        <Select
          label={t('supplier-directory.registrations.filter.email')}
          placeholder={t('supplier-org.common.all')}
          value={filters.emailStatus}
          options={INVITATIONS_STATUS.map((value) => ({
            value,
            label: tEnum('invitations.status', value),
          }))}
          onChange={(emailStatus) => setFilters({ emailStatus, page: 1 })}
        />
        <Select
          label={t('supplier-directory.registrations.filter.duplicate')}
          placeholder={t('supplier-org.common.all')}
          value={filters.possibleDuplicate}
          options={[
            { value: 'yes', label: t('supplier-directory.registrations.filter.duplicateYes') },
            { value: 'no', label: t('supplier-directory.registrations.filter.duplicateNo') },
          ]}
          onChange={(possibleDuplicate) => setFilters({ possibleDuplicate, page: 1 })}
        />
        <DateInput
          label={t('supplier-directory.registrations.filter.createdFrom')}
          value={filters.createdFrom}
          onChange={(createdFrom) => setFilters({ createdFrom, page: 1 })}
        />
        <DateInput
          label={t('supplier-directory.registrations.filter.createdTo')}
          value={filters.createdTo}
          onChange={(createdTo) => setFilters({ createdTo, page: 1 })}
        />
        <SearchField
          label={t('supplier-org.common.search')}
          placeholder={t('supplier-directory.registrations.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('supplier-directory.registrations.kpi.pending')}
          icon="inbox"
          value={overview.data === undefined ? '…' : formatCount(overview.data.total)}
          hint={t('supplier-directory.registrations.kpi.pendingHint')}
        />
        <KpiCard
          label={t('supplier-directory.registrations.kpi.unverified')}
          icon="mail"
          tone="warning"
          value={
            overview.data === undefined
              ? '…'
              : formatCount(pending.filter((row) => row.verificationStatus === 'unverified').length)
          }
          hint={t('supplier-directory.registrations.kpi.unverifiedHint')}
        />
        <KpiCard
          label={t('supplier-directory.registrations.kpi.failed')}
          icon="alertTriangle"
          tone="danger"
          value={
            overview.data === undefined
              ? '…'
              : formatCount(
                  pending.filter((row) => row.verificationEmailStatus === 'send_failed').length,
                )
          }
          hint={t('supplier-directory.registrations.kpi.failedHint')}
        />
        <KpiCard
          label={t('supplier-directory.registrations.kpi.duplicates')}
          icon="flag"
          tone="info"
          value={
            overview.data === undefined
              ? '…'
              : formatCount(pending.filter((row) => row.possibleDuplicate).length)
          }
          hint={t('supplier-directory.registrations.kpi.duplicatesHint')}
        />
      </KpiGrid>
      {outcome !== null && (
        <Banner tone="success" title={t('supplier-directory.list.doneTitle')}>
          <p>{outcome}</p>
        </Banner>
      )}
      <Card flush>
        <DataTable
          caption={t('supplier-directory.registrations.caption')}
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.tenantId)}
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
                  ? t('supplier-directory.registrations.emptyFiltered')
                  : t('supplier-directory.registrations.empty')
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
      {action?.kind === 'requestEvidence' && (
        <RequestEvidenceDialog
          row={action.row}
          onClose={() => setAction(null)}
          onDone={(row) =>
            finish(
              row,
              t('supplier-directory.registrations.evidenceRequested', { name: row.legalName }),
            )
          }
        />
      )}
      {action?.kind === 'verify' && (
        <ConfirmActionDialog
          open
          title={t('supplier-directory.registrations.verifyTitle')}
          scope={t('supplier-directory.registrations.scope', {
            name: action.row.legalName,
            number: action.row.registrationNumber ?? '—',
          })}
          consequence={t('supplier-directory.registrations.verifyResult')}
          confirmLabel={t('supplier-directory.registrations.verify')}
          reason={{
            label: t('supplier-directory.registrations.evidenceNote'),
            hint: t('supplier-directory.registrations.evidenceNoteHint'),
            required: true,
          }}
          pending={verify.pending}
          error={withSupplierMessage(verify.error)}
          onCancel={() => {
            verify.reset();
            setAction(null);
          }}
          onConfirm={async ({ reason }) => {
            if (validateWith(VerifyIdentityBody, { evidenceNote: reason }).length > 0) return;
            try {
              const row = await verify.mutate({
                params: { supplierTenantId: action.row.tenantId },
                body: { evidenceNote: reason },
              });
              finish(row, t('supplier-directory.registrations.verified', { name: row.legalName }));
            } catch {
              // The dialog shows the error.
            }
          }}
        />
      )}
      {action?.kind === 'close' && (
        <ConfirmActionDialog
          open
          tone="danger"
          title={t('supplier-directory.registrations.closeTitle')}
          scope={t('supplier-directory.registrations.scope', {
            name: action.row.legalName,
            number: action.row.registrationNumber ?? '—',
          })}
          consequence={t('supplier-directory.registrations.closeResult')}
          confirmLabel={t('supplier-directory.registrations.close')}
          reason={{ label: t('supplier-directory.registrations.closeReason'), required: true }}
          pending={close.pending}
          error={withSupplierMessage(close.error)}
          onCancel={() => {
            close.reset();
            setAction(null);
          }}
          onConfirm={async ({ reason }) => {
            try {
              const row = await close.mutate({
                params: { supplierTenantId: action.row.tenantId },
                body: { reason },
              });
              finish(row, t('supplier-directory.registrations.closed', { name: row.legalName }));
            } catch {
              // The dialog shows the error.
            }
          }}
        />
      )}
    </div>
  );
}

function RequestEvidenceDialog({
  row,
  onClose,
  onDone,
}: {
  readonly row: OpsRegistrationRow;
  readonly onClose: () => void;
  readonly onDone: (row: OpsRegistrationRow) => void;
}) {
  const request = useApiMutation(suppliersEndpoints.requestVerificationEvidence);
  const [types, setTypes] = useState<string[]>(['registration']);
  const [reason, setReason] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const errors = errorLookup(clientErrors, request.error, ['reason', 'evidenceTypes', 'dueDate']);
  return (
    <ConfirmActionDialog
      open
      title={t('supplier-directory.registrations.requestEvidenceTitle')}
      scope={t('supplier-directory.registrations.scope', {
        name: row.legalName,
        number: row.registrationNumber ?? '—',
      })}
      consequence={t('supplier-directory.registrations.requestEvidenceResult', {
        email: row.registrant.email,
      })}
      confirmLabel={t('supplier-directory.registrations.requestEvidence')}
      pending={request.pending}
      error={withSupplierMessage(request.error)}
      onCancel={() => {
        request.reset();
        onClose();
      }}
      onConfirm={async () => {
        const body = {
          reason: reason.trim(),
          evidenceTypes: types as EvidenceItemsEvidenceType[],
          dueDate: dueDate === '' ? null : dueDate,
        };
        const found = validateWith(RequestVerificationEvidenceBody, body);
        setClientErrors(found);
        if (found.length > 0) return;
        try {
          const result = await request.mutate({ params: { supplierTenantId: row.tenantId }, body });
          onDone(result);
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      <div className="tiq-stack">
        <MultiSelect
          label={t('supplier-directory.registrations.evidenceTypes')}
          required
          value={types}
          onChange={setTypes}
          options={EVIDENCE_ITEMS_EVIDENCE_TYPE.map((value) => ({
            value,
            label: tEnum('evidence_items.evidence_type', value),
          }))}
          error={errors.forField('evidenceTypes')}
        />
        <TextArea
          label={t('supplier-directory.registrations.evidenceReason')}
          hint={t('supplier-directory.registrations.evidenceReasonHint')}
          required
          value={reason}
          onChange={setReason}
          error={errors.forField('reason')}
        />
        <DateInput
          label={t('supplier-directory.registrations.evidenceDue')}
          value={dueDate}
          onChange={setDueDate}
          error={errors.forField('dueDate')}
        />
      </div>
    </ConfirmActionDialog>
  );
}
