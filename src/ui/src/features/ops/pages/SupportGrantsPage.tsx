/**
 * OPS-04 temporary access: every support access grant with its purpose, customer authorization, permitted records,
 * duration and status. Action: end an active grant early (the customer can also revoke it). Grants are read-only,
 * customer-authorized and time-limited; they are never impersonation.
 */
import { useState } from 'react';

import { operationsEndpoints } from '@contracts/operations';
import type { SupportGrant } from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type { SupportAccessGrantsStatus } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant, useScreenFilters } from '../../../app/hooks';
import { useCanCall, usePermission } from '../../../auth/permissions';
import {
  Button,
  ButtonLink,
  Card,
  ConfirmActionDialog,
  FilterBar,
  PageHeader,
  Select,
  useToast,
} from '../../../components/ui';
import { t } from '../../../lib/i18n';
import { GrantsTable } from '../components/GrantsTable';
import { SupportTabs } from '../components/SupportTabs';
import { fieldErrorOnly } from '../lib/errors';
import { opsPaths } from '../lib/paths';
import { SUPPORT_MANAGE } from '../lib/permissions';
import { grantWindow } from '../lib/grants';
import { useOperatorStaffOptions } from '../lib/staff';
import { ActionError } from '../components/ActionError';

const DEFAULTS = {
  status: '',
  customer: '',
  operator: '',
  page: 1,
  sort: 'requestedAt',
  dir: 'desc',
};

export default function SupportGrantsPage() {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(SUPPORT_MANAGE);
  const [filters, setFilters, clearFilters] = useScreenFilters('OPS-04-grants', DEFAULTS);
  const [ending, setEnding] = useState<SupportGrant | null>(null);
  const end = useApiMutation(operationsEndpoints.endSupportGrant);
  const staff = useOperatorStaffOptions();
  /** The customer filter is offered only to members who may list customers (DD-49). */
  const canListCustomers = useCanCall(operationsEndpoints.listCustomers);
  const customers = useApiQuery(
    operationsEndpoints.listCustomers,
    canListCustomers ? { query: { pageSize: 100, sort: 'name' } } : null,
  );
  const grants = useApiQuery(operationsEndpoints.listSupportGrants, {
    query: {
      page: filters.page,
      pageSize: 25,
      sort: filters.sort as 'requestedAt' | 'expiresAt' | 'status',
      dir: filters.dir as 'asc' | 'desc',
      ...(filters.status === '' ? {} : { status: [filters.status as SupportAccessGrantsStatus] }),
      ...(filters.customer === '' ? {} : { customerTenantId: Number(filters.customer) }),
      ...(filters.operator === '' ? {} : { operatorUserId: Number(filters.operator) }),
    },
  });
  const update = (values: Partial<typeof DEFAULTS>): void => setFilters({ page: 1, ...values });

  return (
    <div className="tiq-page">
      <PageHeader title={t('ops.grants.title')} subtitle={t('ops.grants.subtitle')} />
      <SupportTabs />
      <FilterBar
        onClear={clearFilters}
        canClear={filters.status !== '' || filters.customer !== '' || filters.operator !== ''}
      >
        <Select
          label={t('ops.grants.col.status')}
          placeholder={t('ops.common.all')}
          value={filters.status}
          onChange={(value) => update({ status: value })}
          options={enumOptions('support_access_grants.status')}
        />
        {canListCustomers && (
          <Select
            label={t('ops.grants.col.customer')}
            placeholder={t('ops.common.all')}
            value={filters.customer}
            onChange={(value) => update({ customer: value })}
            options={(customers.data?.items ?? []).map((row) => ({
              value: String(row.tenantId),
              label: row.name,
            }))}
          />
        )}
        <Select
          label={t('ops.grants.col.operator')}
          placeholder={t('ops.common.all')}
          value={filters.operator}
          onChange={(value) => update({ operator: value })}
          options={staff}
        />
        <Select
          label={t('ops.common.sortBy')}
          value={`${filters.sort}:${filters.dir}`}
          onChange={(value) => {
            const [sort, dir] = value.split(':');
            setFilters({ sort: sort ?? 'requestedAt', dir: dir ?? 'desc', page: 1 });
          }}
          options={[
            { value: 'requestedAt:desc', label: t('ops.grants.sort.requested') },
            { value: 'expiresAt:asc', label: t('ops.grants.sort.expires') },
            { value: 'status:asc', label: t('ops.grants.sort.status') },
          ]}
        />
      </FilterBar>
      <Card flush title={t('ops.grants.register')} subtitle={t('ops.grants.registerHint')}>
        <GrantsTable
          rows={grants.data?.items}
          loading={grants.isFetching}
          error={grants.error}
          onRetry={grants.reload}
          pagination={
            grants.data === undefined
              ? undefined
              : {
                  page: grants.data.page,
                  pageSize: grants.data.pageSize,
                  total: grants.data.total,
                  onPageChange: (page) => setFilters({ page }),
                }
          }
          timeZone={timeZone}
          caption={t('ops.grants.register')}
          showCase
          caseLink={opsPaths.supportCase}
          action={(row) => (
            <div className="tiq-inline">
              <ButtonLink size="sm" to={opsPaths.supportCase(row.caseId)}>
                {t('ops.grants.openCase')}
              </ButtonLink>
              {canManage && row.status === 'active' && (
                <Button
                  size="sm"
                  variant="danger-soft"
                  onClick={() => {
                    end.reset();
                    setEnding(row);
                  }}
                >
                  {t('ops.grants.end')}
                </Button>
              )}
            </div>
          )}
        />
      </Card>
      <ConfirmActionDialog
        open={ending !== null}
        title={t('ops.grants.endTitle')}
        scope={ending === null ? '' : `${ending.customer.name} · ${grantWindow(ending, timeZone)}`}
        consequence={t('ops.grants.endConsequence')}
        confirmLabel={t('ops.grants.end')}
        tone="danger"
        reason={{ label: t('ops.common.reason'), required: true }}
        pending={end.pending}
        error={fieldErrorOnly(end.error)}
        onCancel={() => setEnding(null)}
        onConfirm={async ({ reason }) => {
          if (ending === null) return;
          try {
            await end.mutate({ params: { grantId: ending.id }, body: { reason } });
            toast.show(t('ops.grants.ended'), 'success');
            invalidateApiQueries('ops.operations.');
            setEnding(null);
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <ActionError error={end.error} />
      </ConfirmActionDialog>
    </div>
  );
}
