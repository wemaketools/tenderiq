/**
 * ADM-17 Subscription and organization offboarding. Required information: entitlements, contacts, renewal, usage,
 * active-event obligations, export requests and the closure plan. Principal actions: review the service arrangement
 * and coordinate closure without abandoning live procurements (request offboarding, agree the continuity plan,
 * request the exit export). AC-36.
 */
import { useState } from 'react';

import { EXPORTS_FORMAT } from '@contracts/enums';
import { RequestOffboardingBody, operationsEndpoints } from '@contracts/operations';
import type { BuyerSubscriptionView, ExitExport, ServiceContact } from '@contracts/operations';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  DateInput,
  DetailList,
  EmptyState,
  PageHeader,
  QueryView,
  Select,
  StatusChip,
  TextField,
  useToast,
} from '../../../components/ui';
import {
  EMPTY_VALUE,
  formatCalendarDate,
  formatDateTime,
  formatInstantDate,
} from '../../../lib/format';
import { t } from '../../../lib/i18n';
import {
  EntitlementsTable,
  InvoicesTable,
  ServiceActionsTable,
} from '../../ops/components/commercial';
import { LiveObligations, ReadinessPanel } from '../../ops/components/shared';
import { fieldErrorOnly } from '../../ops/lib/errors';
import { localErrors } from '../../ops/lib/forms';
import { personName } from '../../ops/lib/labels';
import { ServiceLayout } from '../components/ServiceLayout';
import { SUBSCRIPTION_MANAGE } from '../lib/permissions';
import { ActionError } from '../../ops/components/ActionError';
import { OpsChip } from '../../ops/components/OpsChip';

/** The offboarding request fields entered in the dialog (the reason and acknowledgement are the dialog's own). */
const OffboardingDetails = RequestOffboardingBody.omit({ reason: true, acknowledgement: true });

export default function SubscriptionPage() {
  const subscription = useApiQuery(operationsEndpoints.getBuyerSubscription, {});
  return (
    <ServiceLayout>
      {subscription.data === undefined && (
        <PageHeader title={t('admin-integrations.subscription.title')} />
      )}
      <QueryView query={subscription}>{(data) => <SubscriptionView view={data} />}</QueryView>
    </ServiceLayout>
  );
}

type DialogKind = 'offboard' | 'agree' | 'export' | null;

function SubscriptionView({ view }: { readonly view: BuyerSubscriptionView }) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(SUBSCRIPTION_MANAGE);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [endDate, setEndDate] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [format, setFormat] = useState('xlsx');
  const [tried, setTried] = useState(false);
  const offboard = useApiMutation(operationsEndpoints.requestOffboarding);
  const agree = useApiMutation(operationsEndpoints.agreeOffboardingPlan);
  const requestExport = useApiMutation(operationsEndpoints.requestExitExport);
  const plan = view.offboardingPlan;
  const organization = tenant?.name ?? '';
  const serverField = (field: string): string | undefined =>
    offboard.error?.fieldErrors.find((item) => item.field === field)?.message;
  const offboardDraft = { requestedEndDate: endDate, contactName, contactEmail };
  const local = tried ? localErrors(OffboardingDetails, offboardDraft) : {};

  const close = (): void => {
    setDialog(null);
    setTried(false);
    offboard.reset();
    agree.reset();
    requestExport.reset();
  };

  const nextAction = (): string => {
    if (plan === null) return t('admin-integrations.subscription.next.none');
    if (plan.agreedByCustomerAt === null) return t('admin-integrations.subscription.next.agree');
    if (view.exportRequests.length === 0) return t('admin-integrations.subscription.next.export');
    return t('admin-integrations.subscription.next.continue');
  };

  return (
    <>
      <PageHeader
        title={t('admin-integrations.subscription.title')}
        subtitle={t('admin-integrations.subscription.subtitle')}
        meta={
          <>
            <OpsChip kind="plan" value={view.planCode} />
            <StatusChip enum="subscriptions.status" value={view.status} />
            {plan !== null && <StatusChip enum="offboarding_plans.status" value={plan.status} />}
            <span>
              {t('ops.customer.nextAction')}: {nextAction()}
            </span>
          </>
        }
        actions={
          canManage ? (
            <>
              {view.capabilities.canRequestExport && (
                <Button icon="download" onClick={() => setDialog('export')}>
                  {t('admin-integrations.subscription.requestExport')}
                </Button>
              )}
              {view.capabilities.canRequestOffboarding && (
                <Button icon="logOut" variant="danger-soft" onClick={() => setDialog('offboard')}>
                  {t('admin-integrations.subscription.requestOffboarding')}
                </Button>
              )}
            </>
          ) : undefined
        }
        primaryAction={
          canManage && view.capabilities.canAgreePlan ? (
            <Button variant="primary" icon="handshake" onClick={() => setDialog('agree')}>
              {t('admin-integrations.subscription.agreePlan')}
            </Button>
          ) : undefined
        }
      />
      <Banner tone="info" title={t('admin-integrations.subscription.ruleTitle')}>
        <p>{view.usageLimitRule}</p>
      </Banner>

      <div className="tiq-grid tiq-grid--2">
        <Card title={t('admin-integrations.subscription.arrangement')}>
          <DetailList
            items={[
              { key: 'plan', label: t('ops.plans.col.plan'), value: view.planName },
              {
                key: 'status',
                label: t('ops.plans.col.status'),
                value: <StatusChip enum="subscriptions.status" value={view.status} size="sm" />,
              },
              {
                key: 'starts',
                label: t('ops.plans.col.starts'),
                value: formatInstantDate(view.startsAt, timeZone),
              },
              {
                key: 'renews',
                label: t('admin-integrations.subscription.renewal'),
                value: view.renewsAt === null ? null : formatInstantDate(view.renewsAt, timeZone),
              },
              {
                key: 'optional',
                label: t('ops.plans.optional'),
                value: view.optionalServices.length === 0 ? null : view.optionalServices.join(', '),
              },
            ]}
          />
        </Card>
        <Card flush title={t('admin-integrations.subscription.contacts')}>
          <DataTable<ServiceContact>
            caption={t('admin-integrations.subscription.contacts')}
            rows={view.contacts}
            rowKey={(row) => `${row.role}:${row.name}`}
            empty={<EmptyState compact title={t('admin-integrations.detail.noContacts')} />}
            columns={[
              {
                id: 'role',
                header: t('admin-integrations.detail.col.role'),
                cell: (row) => row.role,
              },
              {
                id: 'name',
                header: t('admin-integrations.detail.col.name'),
                cell: (row) => row.name,
              },
              {
                id: 'email',
                header: t('admin-integrations.detail.col.email'),
                cell: (row) => row.email ?? EMPTY_VALUE,
              },
            ]}
          />
        </Card>
      </div>

      <Card
        flush
        title={t('ops.commercial.entitlements')}
        subtitle={t('admin-integrations.subscription.entitlementsHint')}
      >
        <EntitlementsTable rows={view.entitlements} />
      </Card>
      <Card
        flush
        title={t('ops.commercial.serviceActions')}
        subtitle={t('ops.commercial.neverBlocksRule')}
      >
        <ServiceActionsTable rows={view.serviceActions} timeZone={timeZone} />
      </Card>
      <Card flush title={t('ops.commercial.invoices')}>
        <InvoicesTable rows={view.invoices} />
      </Card>

      <Card
        title={t('admin-integrations.subscription.obligations')}
        subtitle={t('admin-integrations.subscription.obligationsHint')}
      >
        <LiveObligations events={view.liveEvents} contracts={view.liveContracts} />
      </Card>

      <Card
        title={t('admin-integrations.subscription.closurePlan')}
        subtitle={t('admin-integrations.subscription.closureHint')}
      >
        {plan === null ? (
          <EmptyState
            compact
            icon="logOut"
            title={t('admin-integrations.subscription.noPlan')}
            description={t('admin-integrations.subscription.noPlanHint')}
          />
        ) : (
          <div className="tiq-stack">
            <DetailList
              items={[
                {
                  key: 'status',
                  label: t('ops.offboarding.col.status'),
                  value: (
                    <StatusChip enum="offboarding_plans.status" value={plan.status} size="sm" />
                  ),
                },
                {
                  key: 'end',
                  label: t('ops.offboarding.col.serviceEnd'),
                  value: formatCalendarDate(plan.serviceEndDate),
                },
                {
                  key: 'agreed',
                  label: t('ops.offboarding.col.agreed'),
                  value:
                    plan.agreedByCustomerAt === null
                      ? t('ops.offboarding.notAgreed')
                      : formatDateTime(plan.agreedByCustomerAt, timeZone),
                },
                {
                  key: 'owner',
                  label: t('admin-integrations.subscription.planOwner'),
                  value: personName(plan.owner),
                },
                {
                  key: 'reason',
                  label: t('admin-integrations.subscription.reason'),
                  value: plan.reason,
                },
              ]}
            />
            <DetailList
              stacked
              items={[
                { key: 'continuity', label: t('ops.plan.continuity'), value: plan.continuityPlan },
                {
                  key: 'supplier',
                  label: t('ops.plan.supplierAccess'),
                  value: plan.supplierAccessPlan,
                },
                {
                  key: 'retention',
                  label: t('ops.plan.retention'),
                  value: plan.retentionResponsibilities,
                },
                { key: 'disposal', label: t('ops.plan.disposal'), value: plan.disposalTimetable },
              ]}
            />
            <ReadinessPanel checks={plan.readiness} label={t('ops.plan.readiness')} />
          </div>
        )}
      </Card>

      <Card
        flush
        title={t('admin-integrations.subscription.exports')}
        subtitle={t('ops.plan.exportHint')}
      >
        <DataTable<ExitExport>
          caption={t('admin-integrations.subscription.exports')}
          rows={view.exportRequests}
          rowKey={(row) => String(row.id)}
          empty={
            <EmptyState
              compact
              icon="download"
              title={t('admin-integrations.subscription.noExports')}
            />
          }
          columns={[
            {
              id: 'requested',
              header: t('ops.plan.exportRequested'),
              cell: (row) =>
                `${formatDateTime(row.requestedAt, timeZone)} · ${row.requestedBy.fullName}`,
            },
            {
              id: 'format',
              header: t('ops.plan.exportFormat'),
              cell: (row) => row.format.toUpperCase(),
            },
            {
              id: 'status',
              header: t('ops.plan.exportStatus'),
              cell: (row) => <StatusChip enum="exports.status" value={row.status} size="sm" />,
            },
            {
              id: 'contents',
              header: t('ops.plan.contents'),
              cell: (row) => <span className="tiq-cell-sub">{row.contents.join('; ')}</span>,
            },
            {
              id: 'omissions',
              header: t('ops.plan.omissions'),
              cell: (row) => <span className="tiq-cell-sub">{row.omissions.join('; ')}</span>,
            },
            {
              id: 'completed',
              header: t('ops.plan.exportCompleted'),
              cell: (row) =>
                row.completedAt === null
                  ? t('admin-integrations.subscription.preparing')
                  : formatDateTime(row.completedAt, timeZone),
            },
          ]}
        />
      </Card>

      <ConfirmActionDialog
        open={dialog === 'offboard'}
        title={t('admin-integrations.subscription.offboardTitle')}
        scope={organization}
        consequence={t('admin-integrations.subscription.offboardConsequence')}
        confirmLabel={t('admin-integrations.subscription.requestOffboarding')}
        tone="danger"
        reason={{ label: t('admin-integrations.subscription.reason'), required: true }}
        acknowledgement={t('admin-integrations.subscription.offboardAck')}
        pending={offboard.pending}
        error={fieldErrorOnly(offboard.error)}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          setTried(true);
          const parsed = RequestOffboardingBody.safeParse({
            ...offboardDraft,
            reason,
            acknowledgement: true,
          });
          if (!parsed.success) return;
          try {
            await offboard.mutate({ body: parsed.data });
            toast.show(t('admin-integrations.subscription.offboardDone'), 'success');
            invalidateApiQueries('buyer.operations.subscription.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        {(view.liveEvents.length > 0 || view.liveContracts.length > 0) && (
          <Banner tone="warning" title={t('ops.customer.status.liveTitle')}>
            <p>
              {t('admin-integrations.subscription.liveWarning', {
                events: view.liveEvents.length,
                contracts: view.liveContracts.length,
              })}
            </p>
          </Banner>
        )}
        <DateInput
          label={t('admin-integrations.subscription.endDate')}
          required
          value={endDate}
          onChange={setEndDate}
          error={serverField('requestedEndDate') ?? local.requestedEndDate}
        />
        <TextField
          label={t('admin-integrations.subscription.contactName')}
          required
          value={contactName}
          onChange={setContactName}
          error={serverField('contactName') ?? local.contactName}
        />
        <TextField
          label={t('admin-integrations.subscription.contactEmail')}
          type="email"
          required
          value={contactEmail}
          onChange={setContactEmail}
          error={serverField('contactEmail') ?? local.contactEmail}
        />
        <ActionError error={offboard.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'agree'}
        title={t('admin-integrations.subscription.agreeTitle')}
        scope={organization}
        consequence={t('admin-integrations.subscription.agreeConsequence')}
        confirmLabel={t('admin-integrations.subscription.agreePlan')}
        acknowledgement={t('admin-integrations.subscription.agreeAck')}
        pending={agree.pending}
        error={fieldErrorOnly(agree.error)}
        onCancel={close}
        onConfirm={async () => {
          try {
            await agree.mutate({ body: { acknowledgement: true } });
            toast.show(t('admin-integrations.subscription.agreed'), 'success');
            invalidateApiQueries('buyer.operations.subscription.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        {plan !== null && (
          <ReadinessPanel checks={plan.readiness} label={t('ops.plan.readiness')} />
        )}
        <ActionError error={agree.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'export'}
        title={t('admin-integrations.subscription.exportTitle')}
        scope={organization}
        consequence={t('admin-integrations.subscription.exportConsequence')}
        confirmLabel={t('admin-integrations.subscription.requestExport')}
        pending={requestExport.pending}
        error={fieldErrorOnly(requestExport.error)}
        onCancel={close}
        onConfirm={async () => {
          try {
            await requestExport.mutate({
              body: { format: format as (typeof EXPORTS_FORMAT)[number] },
            });
            toast.show(t('admin-integrations.subscription.exportRequested'), 'success');
            invalidateApiQueries('buyer.operations.subscription.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <Select
          label={t('ops.plan.exportFormat')}
          required
          value={format}
          onChange={setFormat}
          options={EXPORTS_FORMAT.map((value) => ({ value, label: value.toUpperCase() }))}
        />
        <ActionError error={requestExport.error} />
      </ConfirmActionDialog>
    </>
  );
}
