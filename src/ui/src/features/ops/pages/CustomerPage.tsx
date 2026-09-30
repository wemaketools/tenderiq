/**
 * OPS-01 customer detail (and the entry to OPS-02): identity, service owner, onboarding stage, plan, account status,
 * designated administrators, aggregate usage (counts only) and the live events and contracts that constrain an
 * account change. Actions: change the service owner, change the account status (a customer with live obligations
 * needs an agreed continuity plan, BR-47), open onboarding, and start or open the offboarding plan.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { CUSTOMER_STATUS_TARGETS, operationsEndpoints } from '@contracts/operations';
import type { CustomerDetail } from '@contracts/operations';
import { enumLabel } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  ConfirmActionDialog,
  DateInput,
  DetailList,
  KpiCard,
  KpiGrid,
  PageHeader,
  QueryView,
  Select,
  StatusChip,
  useToast,
} from '../../../components/ui';
import { formatCount, formatDateTime, formatInstantDate } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { LiveObligations } from '../components/shared';
import { fieldErrorOnly } from '../lib/errors';
import { personName } from '../lib/labels';
import { opsPaths } from '../lib/paths';
import { CUSTOMERS_MANAGE, SUBSCRIPTIONS_READ } from '../lib/permissions';
import { useOperatorStaffOptions } from '../lib/staff';
import { ActionError } from '../components/ActionError';
import { OpsChip } from '../components/OpsChip';

type DialogKind = 'status' | 'owner' | 'offboarding' | null;

export default function CustomerPage() {
  const { customerTenantId } = useParams();
  const id = Number(customerTenantId);
  const customer = useApiQuery(operationsEndpoints.getCustomer, {
    params: { customerTenantId: id },
  });
  return (
    <div className="tiq-page">
      <QueryView query={customer}>{(data) => <CustomerView customer={data} />}</QueryView>
      {customer.data === undefined && (
        <PageHeader
          title={t('ops.customer.title')}
          back={{ to: opsPaths.customers, label: t('ops.customers.title') }}
        />
      )}
    </div>
  );
}

function CustomerView({ customer }: { readonly customer: CustomerDetail }) {
  const navigate = useNavigate();
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(CUSTOMERS_MANAGE);
  const canSeeSubscription = usePermission(SUBSCRIPTIONS_READ);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [targetStatus, setTargetStatus] = useState('');
  const [ownerId, setOwnerId] = useState(String(customer.serviceOwner?.userId ?? ''));
  const [endDate, setEndDate] = useState('');
  const [missing, setMissing] = useState(false);
  const staff = useOperatorStaffOptions();
  const changeStatus = useApiMutation(operationsEndpoints.changeCustomerStatus);
  const updateOwner = useApiMutation(operationsEndpoints.updateCustomer);
  const createPlan = useApiMutation(operationsEndpoints.createOffboardingPlan);
  const isBuyer = customer.kind === 'buyer';
  const scope = `${customer.name} (${customer.slug})`;

  const close = (): void => {
    setDialog(null);
    setTargetStatus('');
    setMissing(false);
    changeStatus.reset();
    updateOwner.reset();
    createPlan.reset();
  };

  const nextAction = (): string => {
    const leaving =
      customer.status === 'offboarding' ||
      customer.onboardingStage === 'offboarding' ||
      customer.onboardingStage === 'closed';
    if (customer.administrators.length === 0) return t('ops.customer.next.administrator');
    if (leaving) {
      return customer.offboardingPlanId === null
        ? t('ops.customer.next.plan')
        : t('ops.customer.next.exit');
    }
    if (isBuyer && customer.onboardingStage !== null && customer.onboardingStage !== 'live')
      return t('ops.customer.next.onboarding');
    return t('ops.customer.next.none');
  };

  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={customer.legalName}
        back={{ to: opsPaths.customers, label: t('ops.customers.title') }}
        meta={
          <>
            <StatusChip enum="tenants.status" value={customer.status} />
            {customer.onboardingStage !== null && (
              <StatusChip enum="tenants.onboarding_stage" value={customer.onboardingStage} />
            )}
            {customer.planCode !== null && <OpsChip kind="plan" value={customer.planCode} />}
            <span>
              {t('ops.customer.nextAction')}: {nextAction()}
            </span>
          </>
        }
        actions={
          canManage ? (
            <>
              <Button icon="user" onClick={() => setDialog('owner')}>
                {t('ops.customer.changeOwner')}
              </Button>
              <Button icon="sliders" onClick={() => setDialog('status')}>
                {t('ops.customer.changeStatus')}
              </Button>
            </>
          ) : undefined
        }
      />
      <Banner tone="info" title={t('ops.customers.noContentTitle')}>
        <p>{customer.contentAccessNote}</p>
      </Banner>

      <KpiGrid>
        <KpiCard
          label={t('ops.customer.kpi.users')}
          icon="users"
          value={formatCount(customer.usage.activeUsers)}
          hint={t('ops.customer.kpi.usersHint')}
        />
        <KpiCard
          label={t('ops.customer.kpi.events')}
          icon="fileText"
          tone="info"
          value={formatCount(customer.usage.publishedEventsYtd)}
          hint={t('ops.customer.kpi.eventsHint', { live: customer.usage.liveEvents })}
        />
        <KpiCard
          label={t('ops.customer.kpi.contracts')}
          icon="fileSignature"
          tone="success"
          value={formatCount(customer.usage.activeContracts)}
          hint={t('ops.customer.kpi.contractsHint')}
        />
        <KpiCard
          label={t('ops.customer.kpi.support')}
          icon="lifeBuoy"
          tone="warning"
          value={formatCount(customer.openSupportCases)}
          hint={t('ops.customer.kpi.supportHint', { grants: customer.activeSupportGrants })}
          to={opsPaths.support}
        />
      </KpiGrid>

      <div className="tiq-grid tiq-grid--2">
        <Card title={t('ops.customer.identity')}>
          <DetailList
            items={[
              {
                key: 'legal',
                label: t('ops.customers.field.legalName'),
                value: customer.legalName,
              },
              {
                key: 'trading',
                label: t('ops.customers.field.tradingName'),
                value: customer.tradingName,
              },
              {
                key: 'kind',
                label: t('ops.customers.col.kind'),
                value: t(`ops.customers.kind.${customer.kind}`),
              },
              { key: 'country', label: t('ops.customers.field.country'), value: customer.country },
              {
                key: 'registration',
                label: t('ops.customers.field.registrationNumber'),
                value: customer.registrationNumber,
              },
              {
                key: 'tz',
                label: t('ops.customers.field.timeZone'),
                value: customer.officialTimeZone,
              },
              {
                key: 'currency',
                label: t('ops.customers.field.currency'),
                value: customer.defaultCurrency,
              },
              {
                key: 'languages',
                label: t('ops.customer.languages'),
                value: customer.workingLanguages.join(', '),
              },
              {
                key: 'created',
                label: t('ops.customers.col.created'),
                value: formatInstantDate(customer.createdAt, timeZone),
              },
            ]}
          />
        </Card>
        <Card
          title={t('ops.customer.relationship')}
          actions={
            <div className="tiq-inline">
              {isBuyer && (
                <ButtonLink size="sm" icon="listChecks" to={opsPaths.onboarding(customer.tenantId)}>
                  {t('ops.customer.openOnboarding')}
                </ButtonLink>
              )}
              {canSeeSubscription && customer.subscriptionId !== null && (
                <ButtonLink
                  size="sm"
                  icon="receipt"
                  to={opsPaths.subscription(customer.subscriptionId)}
                >
                  {t('ops.customer.openSubscription')}
                </ButtonLink>
              )}
            </div>
          }
        >
          <DetailList
            items={[
              {
                key: 'owner',
                label: t('ops.customers.col.serviceOwner'),
                value: personName(customer.serviceOwner),
              },
              {
                key: 'admins',
                label: t('ops.customers.col.administrators'),
                value:
                  customer.administrators.length === 0
                    ? t('ops.customers.noAdministrator')
                    : customer.administrators.map((admin) => admin.fullName).join(', '),
              },
              {
                key: 'plan',
                label: t('ops.customers.col.plan'),
                value:
                  customer.planCode === null ? (
                    t('ops.customers.freeParticipation')
                  ) : (
                    <OpsChip kind="plan" value={customer.planCode} size="sm" />
                  ),
              },
              {
                key: 'subscription',
                label: t('ops.customer.subscriptionStatus'),
                value:
                  customer.subscriptionStatus === null ? null : (
                    <StatusChip
                      enum="subscriptions.status"
                      value={customer.subscriptionStatus}
                      size="sm"
                    />
                  ),
              },
              {
                key: 'storage',
                label: t('ops.customer.storage'),
                value: t('ops.customer.storageValue', { gb: customer.usage.storageUsedGb }),
              },
              {
                key: 'activity',
                label: t('ops.customer.lastActivity'),
                value:
                  customer.usage.lastActivityAt === null
                    ? null
                    : formatDateTime(customer.usage.lastActivityAt, timeZone),
              },
            ]}
          />
        </Card>
      </div>

      {isBuyer && (
        <Card
          title={t('ops.customer.continuity')}
          subtitle={t('ops.customer.continuityHint')}
          actions={
            customer.offboardingPlanId !== null ? (
              <ButtonLink
                size="sm"
                icon="arrowRight"
                to={opsPaths.offboardingPlan(customer.offboardingPlanId)}
              >
                {t('ops.customer.openPlan')}
              </ButtonLink>
            ) : canManage ? (
              <Button size="sm" icon="plus" onClick={() => setDialog('offboarding')}>
                {t('ops.customer.startPlan')}
              </Button>
            ) : undefined
          }
        >
          <LiveObligations events={customer.liveEvents} contracts={customer.liveContracts} />
        </Card>
      )}

      <ConfirmActionDialog
        open={dialog === 'status'}
        title={t('ops.customer.status.title')}
        scope={scope}
        consequence={
          targetStatus === ''
            ? t('ops.customer.status.chooseFirst')
            : t(`ops.customer.status.consequence.${targetStatus}`)
        }
        confirmLabel={t('ops.customer.status.confirm')}
        tone={targetStatus === 'suspended' || targetStatus === 'closed' ? 'danger' : 'primary'}
        reason={{ label: t('ops.common.reason'), required: true }}
        pending={changeStatus.pending}
        error={fieldErrorOnly(changeStatus.error)}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          if (targetStatus === '') {
            setMissing(true);
            return;
          }
          try {
            const result = await changeStatus.mutate({
              params: { customerTenantId: customer.tenantId },
              body: { status: targetStatus as (typeof CUSTOMER_STATUS_TARGETS)[number], reason },
            });
            toast.show(result.consequence, 'success');
            invalidateApiQueries('ops.operations.customers.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <Select
          label={t('ops.customer.status.target')}
          required
          placeholder={t('ops.common.choose')}
          value={targetStatus}
          onChange={setTargetStatus}
          error={missing && targetStatus === '' ? t('ops.common.required') : undefined}
          options={CUSTOMER_STATUS_TARGETS.filter((status) => status !== customer.status).map(
            (status) => ({ value: status, label: enumLabel('tenants.status', status) }),
          )}
        />
        {(customer.liveEvents.length > 0 || customer.liveContracts.length > 0) && (
          <Banner tone="warning" title={t('ops.customer.status.liveTitle')}>
            <p>
              {t('ops.customer.status.live', {
                events: customer.liveEvents.length,
                contracts: customer.liveContracts.length,
              })}
            </p>
          </Banner>
        )}
        <ActionError error={changeStatus.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'owner'}
        title={t('ops.customer.owner.title')}
        scope={scope}
        consequence={t('ops.customer.owner.consequence')}
        confirmLabel={t('ops.customer.owner.confirm')}
        pending={updateOwner.pending}
        error={fieldErrorOnly(updateOwner.error)}
        onCancel={close}
        onConfirm={async () => {
          if (ownerId === '') {
            setMissing(true);
            return;
          }
          try {
            await updateOwner.mutate({
              params: { customerTenantId: customer.tenantId },
              body: { serviceOwnerUserId: Number(ownerId) },
            });
            toast.show(t('ops.customer.owner.done'), 'success');
            invalidateApiQueries('ops.operations.customers.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <Select
          label={t('ops.customers.field.serviceOwner')}
          required
          placeholder={t('ops.common.choose')}
          value={ownerId}
          onChange={setOwnerId}
          error={missing && ownerId === '' ? t('ops.common.required') : undefined}
          options={staff}
        />
        <ActionError error={updateOwner.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'offboarding'}
        title={t('ops.customer.plan.title')}
        scope={scope}
        consequence={t('ops.customer.plan.consequence')}
        confirmLabel={t('ops.customer.plan.confirm')}
        reason={{ label: t('ops.customer.plan.reason'), required: true }}
        pending={createPlan.pending}
        error={fieldErrorOnly(createPlan.error)}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          try {
            const plan = await createPlan.mutate({
              params: { customerTenantId: customer.tenantId },
              body: { reason, serviceEndDate: endDate },
            });
            invalidateApiQueries('ops.operations.');
            close();
            navigate(opsPaths.offboardingPlan(plan.id));
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <DateInput
          label={t('ops.customer.plan.endDate')}
          hint={t('ops.customer.plan.endDateHint')}
          required
          value={endDate}
          onChange={setEndDate}
          error={
            createPlan.error?.fieldErrors.find((item) => item.field === 'serviceEndDate')?.message
          }
        />
        <ActionError error={createPlan.error} />
      </ConfirmActionDialog>
    </>
  );
}
