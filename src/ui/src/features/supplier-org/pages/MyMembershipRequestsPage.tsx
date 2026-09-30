/**
 * SUP-02 / COM-02 — the signed-in person's own requests to join supplier organizations. A request made from a
 * duplicate-check match names no organization until the organization approves it. Pending requests can be withdrawn.
 */
import { useState } from 'react';

import { SUPPLIER_MEMBERSHIP_REQUESTS_STATUS } from '@contracts/enums';
import { suppliersEndpoints } from '@contracts/suppliers';
import type { MyMembershipRequest } from '@contracts/suppliers';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useScreenFilters } from '../../../app/hooks';
import {
  Button,
  ButtonLink,
  Card,
  ConfirmActionDialog,
  DataTable,
  EmptyState,
  FilterBar,
  OrDash,
  PageHeader,
  Select,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { browserTimeZone, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { withSupplierMessage } from '../lib/errors';
import { compact, directionOf, oneOf, sortOf, tableSort } from '../lib/lists';
import { supplierOrgPaths } from '../lib/paths';

const SORTS = ['createdAt', 'status'] as const;
const DEFAULTS = { status: '', sort: 'createdAt', dir: 'desc', page: 1, pageSize: 25 };

export default function MyMembershipRequestsPage() {
  const toast = useToast();
  const zone = browserTimeZone();
  const [filters, setFilters, clearFilters] = useScreenFilters('SUP-02-mine', DEFAULTS);
  const [withdrawing, setWithdrawing] = useState<MyMembershipRequest | null>(null);
  const [updated, setUpdated] = useState<Readonly<Record<number, MyMembershipRequest>>>({});
  const withdraw = useApiMutation(suppliersEndpoints.withdrawMyMembershipRequest);

  const query = useApiQuery(suppliersEndpoints.myMembershipRequests, {
    query: compact({
      status: oneOf(filters.status, SUPPLIER_MEMBERSHIP_REQUESTS_STATUS),
      sort: sortOf(filters.sort, SORTS, 'createdAt'),
      dir: directionOf(filters.dir),
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  });
  const rows = query.data?.items.map((row) => updated[row.id] ?? row);
  const filtered = filters.status !== '';

  const columns: DataTableColumn<MyMembershipRequest>[] = [
    {
      id: 'organization',
      header: t('supplier-org.mine.col.organization'),
      cell: (row) =>
        row.organizationName === null ? (
          <span className="tiq-text-muted">{t('supplier-org.mine.undisclosed')}</span>
        ) : (
          row.organizationName
        ),
    },
    {
      id: 'message',
      header: t('supplier-org.mine.col.message'),
      cell: (row) => <span className="tiq-cell-sub">{row.message}</span>,
    },
    {
      id: 'status',
      header: t('supplier-org.mine.col.status'),
      sortable: true,
      cell: (row) => <StatusChip enum="supplier_membership_requests.status" value={row.status} />,
    },
    {
      id: 'createdAt',
      header: t('supplier-org.mine.col.created'),
      sortable: true,
      cell: (row) => formatDateTime(row.createdAt, zone),
    },
    {
      id: 'decision',
      header: t('supplier-org.mine.col.decision'),
      cell: (row) =>
        row.decidedAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <span>{formatDateTime(row.decidedAt, zone)}</span>
            {row.decisionNote !== null && <span className="tiq-cell-sub">{row.decisionNote}</span>}
          </>
        ),
    },
    {
      id: 'actions',
      header: t('supplier-org.mine.col.actions'),
      cell: (row) =>
        row.status === 'pending' ? (
          <Button size="sm" onClick={() => setWithdrawing(row)}>
            {t('supplier-org.mine.withdraw')}
          </Button>
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('supplier-org.mine.title')}
        subtitle={t('supplier-org.mine.intro')}
        primaryAction={
          <ButtonLink to={supplierOrgPaths.register} variant="primary" icon="plus">
            {t('supplier-org.mine.newRequest')}
          </ButtonLink>
        }
      />
      <FilterBar onClear={clearFilters} canClear={filtered} label={t('supplier-org.mine.filters')}>
        <Select
          label={t('supplier-org.mine.filterStatus')}
          placeholder={t('supplier-org.common.allStatuses')}
          value={filters.status}
          options={SUPPLIER_MEMBERSHIP_REQUESTS_STATUS.map((value) => ({
            value,
            label: tEnum('supplier_membership_requests.status', value),
          }))}
          onChange={(status) => setFilters({ status, page: 1 })}
        />
      </FilterBar>
      <Card flush>
        <DataTable
          caption={t('supplier-org.mine.caption')}
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
              title={filtered ? t('supplier-org.mine.emptyFiltered') : t('supplier-org.mine.empty')}
              description={filtered ? undefined : t('supplier-org.mine.emptyHint')}
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
      <ConfirmActionDialog
        open={withdrawing !== null}
        title={t('supplier-org.mine.withdrawTitle')}
        organization={{
          name: withdrawing?.organizationName ?? t('supplier-org.mine.undisclosed'),
          capacity: t('supplier-org.mine.requesterCapacity'),
        }}
        scope={t('supplier-org.mine.withdrawScope', {
          date: withdrawing === null ? '' : formatDateTime(withdrawing.createdAt, zone),
        })}
        consequence={t('supplier-org.mine.withdrawResult')}
        confirmLabel={t('supplier-org.mine.withdraw')}
        tone="danger"
        pending={withdraw.pending}
        error={withSupplierMessage(withdraw.error)}
        onCancel={() => {
          withdraw.reset();
          setWithdrawing(null);
        }}
        onConfirm={async () => {
          if (withdrawing === null) return;
          try {
            const result = await withdraw.mutate({ params: { requestId: withdrawing.id } });
            setUpdated((current) => ({ ...current, [result.id]: result }));
            setWithdrawing(null);
            toast.show(t('supplier-org.mine.withdrawn'), 'success');
            invalidateApiQueries('me.suppliers.membershipRequests.');
          } catch {
            // The dialog shows the error.
          }
        }}
      />
    </div>
  );
}
