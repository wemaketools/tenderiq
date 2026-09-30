/**
 * SUP-18 (assessment invitations) — The supplier's own demonstration, interview, presentation, sample, site
 * inspection and reference invitations: purpose, agenda, instructions, the announced assessment basis, appointment,
 * preparation time and response history. Actions: confirm or decline participation within the allowed scope. An
 * appointment never reopens or replaces the submitted bid.
 */
import { useState } from 'react';

import { ASSESSMENT_INVITES_STATUS } from '@contracts/enums';
import { selectionEndpoints } from '@contracts/selection';
import type { SupplierAssessmentInvite } from '@contracts/selection';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { useScreenFilters } from '../../../../app/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  Dialog,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  OrDash,
  PageHeader,
  SearchField,
  Select,
  StatusChip,
  useToast,
} from '../../../../components/ui';
import type { DataTableColumn } from '../../../../components/ui';
import { formatCount, formatDateTime, formatOfficialTime } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { withSelectionMessage } from '../../lib/errors';
import { attempt, compact, directionOf, idOf, oneOf, sortOf, tableSort } from '../../lib/lists';
import { SUPPLIER_INVITES_RESPOND } from '../../lib/permissions';

const SORTS = ['scheduledAt', 'invitedAt', 'status'] as const;
/** An appointment whose session the buyer cancelled: nothing to attend or answer, whatever the invite status. */
function isCancelled(row: SupplierAssessmentInvite): boolean {
  return row.sessionStatus === 'cancelled';
}

/** The invite status, or the session's cancellation in its place (SUP-18). */
function InviteStatus({ row }: { readonly row: SupplierAssessmentInvite }) {
  return isCancelled(row) ? (
    <span data-testid="session-cancelled">
      <StatusChip enum="assessment_sessions.status" value="cancelled" />
      <span className="tiq-cell-sub">{t('selection.supplierInvites.sessionCancelled')}</span>
    </span>
  ) : (
    <StatusChip enum="assessment_invites.status" value={row.status} />
  );
}

const DEFAULTS = {
  q: '',
  status: '',
  tender: '',
  sort: 'scheduledAt',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

type Response = 'confirmed' | 'declined';

export default function SupplierInvitesPage() {
  const toast = useToast();
  const canRespond = usePermission(SUPPLIER_INVITES_RESPOND);
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-18-INVITES', DEFAULTS);
  const [selected, setSelected] = useState<SupplierAssessmentInvite | null>(null);
  const [responding, setResponding] = useState<Response | null>(null);
  const [answered, setAnswered] = useState<Readonly<Record<number, SupplierAssessmentInvite>>>({});
  const respond = useApiMutation(selectionEndpoints.respondToInvite);

  const query = useApiQuery(selectionEndpoints.listSupplierInvites, {
    query: compact({
      q: filters.q.trim(),
      status: oneOf(filters.status, ASSESSMENT_INVITES_STATUS),
      tenderId: idOf(filters.tender),
      sort: sortOf(filters.sort, SORTS, 'scheduledAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const overview = useApiQuery(selectionEndpoints.listSupplierInvites, {
    query: { pageSize: 100 },
  });
  const all = (overview.data?.items ?? []).map((row) => answered[row.inviteId] ?? row);
  const loadingValue = overview.data === undefined ? '…' : null;
  const kpiRestricted = overview.error?.kind === 'forbidden';
  const tenders = new Map(
    all.map((row) => [row.tender.tenderId, `${row.tender.reference} ${row.tender.title}`]),
  );
  const rows = query.data?.items.map((row) => answered[row.inviteId] ?? row);
  const current = selected === null ? null : (answered[selected.inviteId] ?? selected);
  const filtered = filters.q !== '' || filters.status !== '' || filters.tender !== '';
  // Cancelled sessions are neither awaiting a response nor appointments to attend.
  const count = (status: SupplierAssessmentInvite['status']): string =>
    loadingValue ??
    formatCount(all.filter((row) => row.status === status && !isCancelled(row)).length);

  const columns: DataTableColumn<SupplierAssessmentInvite>[] = [
    {
      id: 'session',
      header: t('selection.supplierInvites.col.session'),
      cell: (row) => (
        <>
          <span>{tEnum('assessment_sessions.session_type', row.sessionType)}</span>
          <span className="tiq-cell-sub">{row.purpose}</span>
        </>
      ),
    },
    {
      id: 'tender',
      header: t('selection.common.tender'),
      cell: (row) => (
        <>
          <span className="tiq-ref">{row.tender.reference}</span>
          <span className="tiq-cell-sub">{row.buyer.name}</span>
        </>
      ),
    },
    {
      id: 'basis',
      header: t('selection.assessments.col.basis'),
      cell: (row) => tEnum('assessment_sessions.assessment_basis', row.assessmentBasis),
    },
    {
      id: 'scheduledAt',
      header: t('selection.supplierInvites.col.appointment'),
      sortable: true,
      cell: (row) =>
        row.scheduledAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <span>{formatOfficialTime(row.scheduledAt, row.tender.officialTimeZone)}</span>
            <span className="tiq-cell-sub">
              {t('selection.supplierInvites.preparation', { count: row.preparationDays })}
            </span>
          </>
        ),
    },
    {
      id: 'invitedAt',
      header: t('selection.supplierInvites.col.invited'),
      sortable: true,
      cell: (row) => formatDateTime(row.invitedAt, row.tender.officialTimeZone),
    },
    {
      id: 'status',
      header: t('selection.common.status'),
      sortable: true,
      cell: (row) => (
        <>
          <InviteStatus row={row} />
          {row.supplierConfirmedBy !== null && !isCancelled(row) && (
            <span className="tiq-cell-sub">{row.supplierConfirmedBy.fullName}</span>
          )}
        </>
      ),
    },
  ];

  const submitResponse = async (response: Response, note: string): Promise<void> => {
    if (current === null) return;
    const result = await attempt(
      respond.mutate({
        params: { inviteId: current.inviteId },
        body: { response, note: note === '' ? null : note },
      }),
    );
    if (result === undefined) return;
    setAnswered((map) => ({ ...map, [result.inviteId]: result }));
    toast.show(
      response === 'confirmed'
        ? t('selection.supplierInvites.confirmedToast')
        : t('selection.supplierInvites.declinedToast'),
      'success',
    );
    setResponding(null);
  };

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('selection.supplierInvites.title')}
        subtitle={t('selection.supplierInvites.intro')}
      />
      <Banner tone="info" title={t('selection.supplierInvites.scopeNote')} />
      <FilterBar label={t('selection.common.filters')} onClear={clearFilters} canClear={filtered}>
        <SearchField
          label={t('selection.common.search')}
          placeholder={t('selection.supplierInvites.searchPlaceholder')}
          value={filters.q}
          onChange={(q) => setFilters({ q, page: 1 })}
        />
        <Select
          label={t('selection.common.tender')}
          placeholder={t('selection.common.allTenders')}
          value={filters.tender}
          options={[...tenders].map(([value, label]) => ({ value: String(value), label }))}
          onChange={(tender) => setFilters({ tender, page: 1 })}
        />
        <Select
          label={t('selection.common.status')}
          placeholder={t('selection.common.allStatuses')}
          value={filters.status}
          options={ASSESSMENT_INVITES_STATUS.map((value) => ({
            value,
            label: tEnum('assessment_invites.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
      </FilterBar>
      <KpiGrid>
        <KpiCard
          label={t('selection.supplierInvites.kpi.awaiting')}
          icon="hourglass"
          tone="warning"
          value={count('invited')}
          hint={t('selection.supplierInvites.kpi.awaitingHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.supplierInvites.kpi.confirmed')}
          icon="calendar"
          value={count('confirmed')}
          hint={t('selection.supplierInvites.kpi.confirmedHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.supplierInvites.kpi.attended')}
          icon="checkCircle"
          tone="success"
          value={count('attended')}
          hint={t('selection.supplierInvites.kpi.attendedHint')}
          restricted={kpiRestricted}
        />
        <KpiCard
          label={t('selection.supplierInvites.kpi.declined')}
          icon="xCircle"
          tone="info"
          value={count('declined')}
          hint={t('selection.supplierInvites.kpi.declinedHint')}
          restricted={kpiRestricted}
        />
      </KpiGrid>
      <Card flush>
        <DataTable
          caption={t('selection.supplierInvites.caption')}
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.inviteId)}
          rowLabel={(row) =>
            `${tEnum('assessment_sessions.session_type', row.sessionType)} ${row.tender.reference}`
          }
          onRowClick={setSelected}
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
                  ? t('selection.common.emptyFiltered')
                  : t('selection.supplierInvites.empty')
              }
              description={filtered ? undefined : t('selection.supplierInvites.emptyHint')}
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
      {current !== null && responding === null && (
        <Dialog
          open
          size="lg"
          title={`${tEnum('assessment_sessions.session_type', current.sessionType)} · ${current.tender.reference}`}
          onClose={() => setSelected(null)}
          footer={
            <>
              <Button onClick={() => setSelected(null)}>{t('selection.common.close')}</Button>
              {canRespond && current.respondGate.allowed && (
                <>
                  <Button variant="danger-soft" onClick={() => setResponding('declined')}>
                    {t('selection.supplierInvites.decline')}
                  </Button>
                  <Button variant="primary" onClick={() => setResponding('confirmed')}>
                    {t('selection.supplierInvites.confirm')}
                  </Button>
                </>
              )}
            </>
          }
        >
          <div className="tiq-stack">
            {!current.respondGate.allowed && (
              <Banner tone="warning" title={t('selection.supplierInvites.cannotRespond')}>
                <ul>
                  {current.respondGate.blockers.map((blocker) => (
                    <li key={blocker.code}>{blocker.message}</li>
                  ))}
                </ul>
              </Banner>
            )}
            <DetailList
              items={[
                { label: t('selection.supplierInvites.buyer'), value: current.buyer.name },
                {
                  label: t('selection.common.tender'),
                  value: `${current.tender.reference} ${current.tender.title}`,
                },
                {
                  label: t('selection.supplierInvites.col.appointment'),
                  value:
                    current.scheduledAt === null
                      ? null
                      : formatOfficialTime(current.scheduledAt, current.tender.officialTimeZone),
                },
                {
                  label: t('selection.sessionForm.preparationDays'),
                  value: t('selection.session.days', { count: current.preparationDays }),
                },
                {
                  label: t('selection.assessments.col.basis'),
                  value: tEnum('assessment_sessions.assessment_basis', current.assessmentBasis),
                },
                {
                  label: t('selection.supplierInvites.sessionStatus'),
                  value: tEnum('assessment_sessions.status', current.sessionStatus),
                },
                {
                  label: t('selection.common.status'),
                  value: <InviteStatus row={current} />,
                },
                {
                  label: t('selection.supplierInvites.respondedBy'),
                  value:
                    current.supplierConfirmedAt === null
                      ? null
                      : `${current.supplierConfirmedBy?.fullName ?? ''} · ${formatDateTime(
                          current.supplierConfirmedAt,
                          current.tender.officialTimeZone,
                        )}`,
                },
              ]}
            />
            <DetailList
              stacked
              items={[
                { label: t('selection.sessionForm.purpose'), value: current.purpose },
                { label: t('selection.sessionForm.agenda'), value: current.agenda },
                { label: t('selection.sessionForm.instructions'), value: current.instructions },
              ]}
            />
          </div>
        </Dialog>
      )}
      {current !== null && responding !== null && (
        <ConfirmActionDialog
          open
          tone={responding === 'declined' ? 'danger' : 'primary'}
          title={
            responding === 'confirmed'
              ? t('selection.supplierInvites.confirmTitle')
              : t('selection.supplierInvites.declineTitle')
          }
          scope={`${tEnum('assessment_sessions.session_type', current.sessionType)} · ${current.tender.reference} · ${current.buyer.name}`}
          consequence={
            responding === 'confirmed'
              ? t('selection.supplierInvites.confirmConsequence')
              : t('selection.supplierInvites.declineConsequence')
          }
          confirmLabel={
            responding === 'confirmed'
              ? t('selection.supplierInvites.confirm')
              : t('selection.supplierInvites.decline')
          }
          reason={{
            label: t('selection.supplierInvites.note'),
            required: responding === 'declined',
          }}
          pending={respond.pending}
          error={withSelectionMessage(respond.error)}
          onCancel={() => {
            respond.reset();
            setResponding(null);
          }}
          onConfirm={({ reason }) => submitResponse(responding, reason)}
        />
      )}
    </div>
  );
}
