/**
 * OPS-03 subscription detail: plan, status, subscription dates, agreed limits with usage, optional services, the
 * service actions raised by usage limits, invoices and disputes. Actions: change the plan, status, renewal and
 * commercial contact; change an entitlement limit; resolve a service action. A commercial change never changes
 * competition results or supplier eligibility, and a usage limit never blocks a supplier's submission.
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { PLAN_CODES, operationsEndpoints } from '@contracts/operations';
import type {
  EntitlementUsage,
  PlanCode,
  ServiceAction,
  SubscriptionDetail,
} from '@contracts/operations';
import { enumOptions } from '@contracts/enums';
import type { SubscriptionsStatus } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  ConfirmActionDialog,
  DateTimeInput,
  DetailList,
  NumberInput,
  PageHeader,
  QueryView,
  Select,
  StatusChip,
  TextArea,
  TextField,
  useToast,
} from '../../../components/ui';
import { formatInstantDate } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { EntitlementsTable, InvoicesTable, ServiceActionsTable } from '../components/commercial';
import { fieldErrorOnly } from '../lib/errors';
import { opsOptions } from '../lib/labels';
import { opsPaths } from '../lib/paths';
import { SUBSCRIPTIONS_MANAGE } from '../lib/permissions';
import { ActionError } from '../components/ActionError';
import { OpsChip } from '../components/OpsChip';

export default function SubscriptionPage() {
  const { subscriptionId } = useParams();
  const id = Number(subscriptionId);
  const subscription = useApiQuery(operationsEndpoints.getSubscription, {
    params: { subscriptionId: id },
  });
  return (
    <div className="tiq-page">
      {subscription.data === undefined && (
        <PageHeader
          title={t('ops.subscription.title')}
          back={{ to: opsPaths.subscriptions, label: t('ops.plans.title') }}
        />
      )}
      <QueryView query={subscription}>
        {(data) => <SubscriptionView subscription={data} />}
      </QueryView>
    </div>
  );
}

function SubscriptionView({ subscription }: { readonly subscription: SubscriptionDetail }) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(SUBSCRIPTIONS_MANAGE);
  const [editing, setEditing] = useState(false);
  const [plan, setPlan] = useState<string>(subscription.planCode);
  const [status, setStatus] = useState<string>(subscription.status);
  const [renewsAt, setRenewsAt] = useState<string | null>(subscription.renewsAt);
  const [contact, setContact] = useState(subscription.commercialContact ?? '');
  const [notes, setNotes] = useState(subscription.notes ?? '');
  const [entitlement, setEntitlement] = useState<EntitlementUsage | null>(null);
  const [limit, setLimit] = useState('');
  const [action, setAction] = useState<ServiceAction | null>(null);
  const update = useApiMutation(operationsEndpoints.updateSubscription);
  const changeLimit = useApiMutation(operationsEndpoints.updateEntitlement);
  const resolve = useApiMutation(operationsEndpoints.resolveServiceAction);
  const scope = t('ops.subscription.scope', { name: subscription.customer.name });
  const openActions = subscription.serviceActions.filter((row) => row.status !== 'resolved');

  return (
    <>
      <PageHeader
        title={t('ops.subscription.titleFor', { name: subscription.customer.name })}
        back={{ to: opsPaths.subscriptions, label: t('ops.plans.title') }}
        meta={
          <>
            <OpsChip kind="plan" value={subscription.planCode} />
            <StatusChip enum="subscriptions.status" value={subscription.status} />
            <span>
              {t('ops.customer.nextAction')}:{' '}
              {openActions.length > 0
                ? t('ops.subscription.next.actions', { count: openActions.length })
                : t('ops.subscription.next.none')}
            </span>
          </>
        }
        actions={
          <ButtonLink size="sm" to={opsPaths.customer(subscription.customer.tenantId)}>
            {t('ops.plan.openCustomer')}
          </ButtonLink>
        }
        primaryAction={
          canManage ? (
            <Button
              variant="primary"
              icon="edit"
              onClick={() => {
                update.reset();
                setEditing(true);
              }}
            >
              {t('ops.subscription.edit')}
            </Button>
          ) : undefined
        }
      />
      <Banner tone="info" title={t('ops.subscription.ruleTitle')}>
        <p>{subscription.entitlementRule}</p>
      </Banner>

      <Card title={t('ops.subscription.arrangement')}>
        <DetailList
          items={[
            {
              key: 'plan',
              label: t('ops.plans.col.plan'),
              value: <OpsChip kind="plan" value={subscription.planCode} size="sm" />,
            },
            {
              key: 'status',
              label: t('ops.plans.col.status'),
              value: (
                <StatusChip enum="subscriptions.status" value={subscription.status} size="sm" />
              ),
            },
            {
              key: 'starts',
              label: t('ops.plans.col.starts'),
              value: formatInstantDate(subscription.startsAt, timeZone),
            },
            {
              key: 'renews',
              label: t('ops.plans.col.renews'),
              value:
                subscription.renewsAt === null
                  ? null
                  : formatInstantDate(subscription.renewsAt, timeZone),
            },
            {
              key: 'contact',
              label: t('ops.plans.col.contact'),
              value: subscription.commercialContact,
            },
            {
              key: 'contactEmail',
              label: t('ops.plans.col.contactEmail'),
              value: subscription.commercialContactEmail,
            },
            {
              key: 'optional',
              label: t('ops.plans.optional'),
              value:
                subscription.optionalServices.length === 0
                  ? null
                  : subscription.optionalServices.join(', '),
            },
            { key: 'notes', label: t('ops.subscription.notes'), value: subscription.notes },
          ]}
        />
      </Card>

      <Card
        flush
        title={t('ops.commercial.entitlements')}
        subtitle={t('ops.subscription.entitlementsHint')}
      >
        <EntitlementsTable
          rows={subscription.entitlements}
          action={
            canManage
              ? (row) => (
                  <Button
                    size="sm"
                    aria-label={t('ops.subscription.changeLimitFor', { label: row.label })}
                    onClick={() => {
                      changeLimit.reset();
                      setLimit(row.limitValue === null ? '' : String(row.limitValue));
                      setEntitlement(row);
                    }}
                  >
                    {t('ops.subscription.changeLimit')}
                  </Button>
                )
              : undefined
          }
        />
      </Card>

      <Card
        flush
        title={t('ops.commercial.serviceActions')}
        subtitle={t('ops.commercial.neverBlocksRule')}
      >
        <ServiceActionsTable
          rows={subscription.serviceActions}
          timeZone={timeZone}
          action={
            canManage
              ? (row) =>
                  row.status === 'resolved' ? null : (
                    <Button
                      size="sm"
                      onClick={() => {
                        resolve.reset();
                        setAction(row);
                      }}
                    >
                      {t('ops.subscription.resolve')}
                    </Button>
                  )
              : undefined
          }
        />
      </Card>

      <Card
        flush
        title={t('ops.commercial.invoices')}
        subtitle={t('ops.subscription.invoicesHint')}
      >
        <InvoicesTable rows={subscription.invoices} />
      </Card>

      <ConfirmActionDialog
        open={editing}
        title={t('ops.subscription.editTitle')}
        scope={scope}
        consequence={t('ops.subscription.editConsequence')}
        confirmLabel={t('ops.subscription.editConfirm')}
        reason={{ label: t('ops.common.reason'), required: true }}
        pending={update.pending}
        error={fieldErrorOnly(update.error)}
        onCancel={() => setEditing(false)}
        onConfirm={async ({ reason }) => {
          try {
            await update.mutate({
              params: { subscriptionId: subscription.id },
              body: {
                reason,
                ...(plan !== subscription.planCode ? { planCode: plan as PlanCode } : {}),
                ...(status !== subscription.status
                  ? { status: status as SubscriptionsStatus }
                  : {}),
                ...(renewsAt !== subscription.renewsAt ? { renewsAt } : {}),
                ...(contact !== (subscription.commercialContact ?? '')
                  ? { commercialContact: contact }
                  : {}),
                ...(notes !== (subscription.notes ?? '') ? { notes } : {}),
              },
            });
            toast.show(t('ops.subscription.saved'), 'success');
            invalidateApiQueries('ops.operations.subscriptions.');
            setEditing(false);
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <div className="tiq-form-grid">
          <Select
            label={t('ops.plans.col.plan')}
            value={plan}
            onChange={setPlan}
            options={opsOptions('plan', PLAN_CODES)}
          />
          <Select
            label={t('ops.plans.col.status')}
            value={status}
            onChange={setStatus}
            options={enumOptions('subscriptions.status')}
          />
          <DateTimeInput
            label={t('ops.plans.col.renews')}
            timeZone={timeZone}
            value={renewsAt}
            onChange={setRenewsAt}
          />
          <TextField label={t('ops.plans.col.contact')} value={contact} onChange={setContact} />
          <TextArea
            fieldClassName="tiq-form-full"
            label={t('ops.subscription.notes')}
            value={notes}
            onChange={setNotes}
            rows={2}
          />
        </div>
        <ActionError error={update.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={entitlement !== null}
        title={t('ops.subscription.limitTitle', { label: entitlement?.label ?? '' })}
        scope={`${scope} · ${entitlement?.label ?? ''}`}
        consequence={t('ops.subscription.limitConsequence')}
        confirmLabel={t('ops.subscription.limitConfirm')}
        reason={{ label: t('ops.common.reason'), required: true }}
        pending={changeLimit.pending}
        error={fieldErrorOnly(changeLimit.error)}
        onCancel={() => setEntitlement(null)}
        onConfirm={async ({ reason }) => {
          if (entitlement === null) return;
          try {
            const result = await changeLimit.mutate({
              params: { subscriptionId: subscription.id, featureCode: entitlement.featureCode },
              body: { limitValue: limit === '' ? null : Number(limit), reason },
            });
            toast.show(
              result.serviceAction === null
                ? t('ops.subscription.limitSaved')
                : t('ops.subscription.limitSavedAction'),
              'success',
            );
            invalidateApiQueries('ops.operations.subscriptions.');
            setEntitlement(null);
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <NumberInput
          label={t('ops.commercial.col.limit')}
          hint={t('ops.subscription.limitHint', {
            usage: entitlement?.usageValue ?? 0,
            unit: entitlement?.unit ?? '',
          })}
          value={limit}
          onChange={setLimit}
          suffix={entitlement?.unit}
          error={
            changeLimit.error?.fieldErrors.find((item) => item.field === 'limitValue')?.message
          }
        />
        <ActionError error={changeLimit.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={action !== null}
        title={t('ops.subscription.resolveTitle')}
        scope={action?.description ?? ''}
        consequence={t('ops.subscription.resolveConsequence')}
        confirmLabel={t('ops.subscription.resolve')}
        reason={{ label: t('ops.subscription.resolution'), required: true }}
        pending={resolve.pending}
        error={fieldErrorOnly(resolve.error)}
        onCancel={() => setAction(null)}
        onConfirm={async ({ reason }) => {
          if (action === null) return;
          try {
            await resolve.mutate({ params: { actionId: action.id }, body: { resolution: reason } });
            toast.show(t('ops.subscription.resolved'), 'success');
            invalidateApiQueries('ops.operations.subscriptions.');
            setAction(null);
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <ActionError error={resolve.error} />
      </ConfirmActionDialog>
    </>
  );
}
