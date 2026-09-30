/**
 * OPS-02 offboarding (continuity and exit) plan, AC-36: a customer leaves with a live tender and contract. The plan
 * names every live event and contract, supplier access, retention responsibilities, the export package and the
 * disposal timetable. Readiness separates blocking conditions from warnings; the plan moves draft → agreed (by the
 * customer, ADM-17) → in progress → completed only when nothing blocks. Saving the plan text is distinct from the
 * customer's agreement and from completion.
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { UpdateOffboardingPlanBody, operationsEndpoints } from '@contracts/operations';
import type { OffboardingPlanDetail } from '@contracts/operations';
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
  PageHeader,
  QueryView,
  Select,
  StatusChip,
  TextArea,
  UnsavedChangesGuard,
  isReady,
  useToast,
} from '../../../components/ui';
import { formatCalendarDate, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { LiveObligations, ReadinessPanel } from '../components/shared';
import { fieldErrorOnly } from '../lib/errors';
import { useValidatedForm } from '../lib/forms';
import { personName } from '../lib/labels';
import { opsPaths } from '../lib/paths';
import { CUSTOMERS_MANAGE } from '../lib/permissions';
import { useOperatorStaffOptions } from '../lib/staff';
import { ActionError } from '../components/ActionError';

const FIELDS = [
  'serviceEndDate',
  'continuityPlan',
  'supplierAccessPlan',
  'retentionResponsibilities',
  'disposalTimetable',
  'ownerUserId',
] as const;

export default function OffboardingPlanPage() {
  const { planId } = useParams();
  const id = Number(planId);
  const plan = useApiQuery(operationsEndpoints.getOffboardingPlan, { params: { planId: id } });
  return (
    <div className="tiq-page">
      {plan.data === undefined && (
        <PageHeader
          title={t('ops.plan.title')}
          back={{ to: opsPaths.offboarding, label: t('ops.offboarding.title') }}
        />
      )}
      <QueryView query={plan}>
        {(data) => <PlanWorkspace key={data.updatedAt} plan={data} />}
      </QueryView>
    </div>
  );
}

function draftOf(plan: OffboardingPlanDetail) {
  return {
    serviceEndDate: plan.serviceEndDate ?? '',
    continuityPlan: plan.continuityPlan ?? '',
    supplierAccessPlan: plan.supplierAccessPlan ?? '',
    retentionResponsibilities: plan.retentionResponsibilities ?? '',
    disposalTimetable: plan.disposalTimetable ?? '',
    ownerUserId: plan.owner === null ? '' : String(plan.owner.userId),
  };
}

function PlanWorkspace({ plan }: { readonly plan: OffboardingPlanDetail }) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(CUSTOMERS_MANAGE);
  const staff = useOperatorStaffOptions();
  const initial = draftOf(plan);
  const [draft, setDraft] = useState(initial);
  const [transitioning, setTransitioning] = useState(false);
  const save = useApiMutation(operationsEndpoints.updateOffboardingPlan);
  const transition = useApiMutation(operationsEndpoints.transitionOffboardingPlan);
  const locked = plan.status === 'completed' || !canManage;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const body = {
    ...(draft.serviceEndDate === '' ? {} : { serviceEndDate: draft.serviceEndDate }),
    continuityPlan: draft.continuityPlan,
    supplierAccessPlan: draft.supplierAccessPlan,
    retentionResponsibilities: draft.retentionResponsibilities,
    disposalTimetable: draft.disposalTimetable,
    ...(draft.ownerUserId === '' ? {} : { ownerUserId: Number(draft.ownerUserId) }),
  };
  const form = useValidatedForm(UpdateOffboardingPlanBody, body, save.error, FIELDS);
  const set = (field: keyof typeof initial) => (value: string) =>
    setDraft((previous) => ({ ...previous, [field]: value }));
  const scope = t('ops.plan.scope', { name: plan.customer.name });
  const ready = isReady(plan.readiness);
  const blockingCount = plan.readiness.filter((check) => check.status === 'blocking').length;

  const submit = async (): Promise<void> => {
    const parsed = form.check();
    if (parsed === null) return;
    try {
      await save.mutate({ params: { planId: plan.id }, body: parsed });
      toast.show(t('ops.plan.saved'), 'success');
      invalidateApiQueries('ops.operations.offboarding.');
    } catch {
      // Shown below the form.
    }
  };

  const nextAction = (): string => {
    if (plan.nextStatus === null) return t('ops.plan.next.done');
    if (plan.status === 'draft' && plan.agreedByCustomerAt === null)
      return t('ops.plan.next.agreement');
    if (!ready) return t('ops.plan.next.blocking', { count: blockingCount });
    return t('ops.plan.next.move', {
      status: enumLabel('offboarding_plans.status', plan.nextStatus),
    });
  };

  return (
    <>
      <UnsavedChangesGuard when={dirty && !save.pending} />
      <PageHeader
        title={t('ops.plan.titleFor', { name: plan.customer.name })}
        subtitle={plan.reason}
        back={{ to: opsPaths.offboarding, label: t('ops.offboarding.title') }}
        meta={
          <>
            <StatusChip enum="offboarding_plans.status" value={plan.status} />
            <StatusChip enum="tenants.status" value={plan.customer.status} />
            <span>
              {t('ops.offboarding.col.serviceEnd')}: {formatCalendarDate(plan.serviceEndDate)}
            </span>
            <span>
              {t('ops.customer.nextAction')}: {nextAction()}
            </span>
          </>
        }
        actions={
          <ButtonLink size="sm" to={opsPaths.customer(plan.customer.tenantId)}>
            {t('ops.plan.openCustomer')}
          </ButtonLink>
        }
        primaryAction={
          canManage && plan.nextStatus !== null ? (
            <Button
              variant="primary"
              icon="arrowRight"
              onClick={() => {
                transition.reset();
                setTransitioning(true);
              }}
            >
              {t('ops.plan.move', {
                status: enumLabel('offboarding_plans.status', plan.nextStatus),
              })}
            </Button>
          ) : undefined
        }
      />

      <Banner tone="info" title={t('ops.plan.ruleTitle')}>
        <p>{t('ops.plan.rule')}</p>
      </Banner>

      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('ops.plan.readiness')}>
          <ReadinessPanel checks={plan.readiness} label={t('ops.plan.readiness')} />
        </Card>
        <Card title={t('ops.plan.summary')}>
          <DetailList
            stacked
            items={[
              {
                key: 'owner',
                label: t('ops.offboarding.col.owner'),
                value: personName(plan.owner),
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
                key: 'created',
                label: t('ops.plan.created'),
                value: formatDateTime(plan.createdAt, timeZone),
              },
              {
                key: 'updated',
                label: t('ops.offboarding.col.updated'),
                value: formatDateTime(plan.updatedAt, timeZone),
              },
            ]}
          />
        </Card>
      </div>

      <Card title={t('ops.plan.obligations')} subtitle={t('ops.plan.obligationsHint')}>
        <LiveObligations events={plan.liveEvents} contracts={plan.liveContracts} />
      </Card>

      <Card title={t('ops.plan.export')} subtitle={t('ops.plan.exportHint')}>
        {plan.exportRequest === null ? (
          <p className="tiq-text-warning">{t('ops.plan.noExport')}</p>
        ) : (
          <>
            <DetailList
              items={[
                {
                  key: 'status',
                  label: t('ops.plan.exportStatus'),
                  value: (
                    <StatusChip enum="exports.status" value={plan.exportRequest.status} size="sm" />
                  ),
                },
                {
                  key: 'format',
                  label: t('ops.plan.exportFormat'),
                  value: plan.exportRequest.format.toUpperCase(),
                },
                {
                  key: 'requested',
                  label: t('ops.plan.exportRequested'),
                  value: `${formatDateTime(plan.exportRequest.requestedAt, timeZone)} · ${plan.exportRequest.requestedBy.fullName}`,
                },
                {
                  key: 'completed',
                  label: t('ops.plan.exportCompleted'),
                  value:
                    plan.exportRequest.completedAt === null
                      ? null
                      : formatDateTime(plan.exportRequest.completedAt, timeZone),
                },
              ]}
            />
            <div className="tiq-grid tiq-grid--2">
              <div>
                <h3 className="tiq-card-title">{t('ops.plan.contents')}</h3>
                <ul>
                  {plan.exportRequest.contents.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="tiq-card-title">{t('ops.plan.omissions')}</h3>
                <ul>
                  {plan.exportRequest.omissions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </Card>

      <Card
        title={t('ops.plan.arrangements')}
        subtitle={locked ? t('ops.plan.lockedHint') : t('ops.plan.arrangementsHint')}
        footer={
          locked ? undefined : (
            <div className="tiq-inline">
              <Button
                variant="primary"
                icon="check"
                loading={save.pending}
                disabled={!dirty}
                onClick={() => void submit()}
              >
                {t('ops.plan.save')}
              </Button>
              <span className="tiq-text-muted">
                {dirty ? t('ops.common.unsaved') : t('ops.plan.savedState')}
              </span>
            </div>
          )
        }
      >
        <div className="tiq-form-grid">
          <DateInput
            label={t('ops.offboarding.col.serviceEnd')}
            value={draft.serviceEndDate}
            onChange={set('serviceEndDate')}
            disabled={locked}
            error={form.errorFor('serviceEndDate')}
          />
          <Select
            label={t('ops.offboarding.col.owner')}
            placeholder={t('ops.common.unassigned')}
            value={draft.ownerUserId}
            onChange={set('ownerUserId')}
            options={staff}
            disabled={locked}
            error={form.errorFor('ownerUserId')}
          />
          <TextArea
            fieldClassName="tiq-form-full"
            label={t('ops.plan.continuity')}
            hint={t('ops.plan.continuityHint')}
            value={draft.continuityPlan}
            onChange={set('continuityPlan')}
            disabled={locked}
            rows={4}
            error={form.errorFor('continuityPlan')}
          />
          <TextArea
            fieldClassName="tiq-form-full"
            label={t('ops.plan.supplierAccess')}
            hint={t('ops.plan.supplierAccessHint')}
            value={draft.supplierAccessPlan}
            onChange={set('supplierAccessPlan')}
            disabled={locked}
            rows={3}
            error={form.errorFor('supplierAccessPlan')}
          />
          <TextArea
            fieldClassName="tiq-form-full"
            label={t('ops.plan.retention')}
            value={draft.retentionResponsibilities}
            onChange={set('retentionResponsibilities')}
            disabled={locked}
            rows={3}
            error={form.errorFor('retentionResponsibilities')}
          />
          <TextArea
            fieldClassName="tiq-form-full"
            label={t('ops.plan.disposal')}
            value={draft.disposalTimetable}
            onChange={set('disposalTimetable')}
            disabled={locked}
            rows={3}
            error={form.errorFor('disposalTimetable')}
          />
        </div>
        <ActionError error={save.error} fields={FIELDS} />
      </Card>

      <ConfirmActionDialog
        open={transitioning}
        title={t('ops.plan.moveTitle')}
        scope={scope}
        consequence={
          plan.nextStatus === null ? '' : t(`ops.plan.moveConsequence.${plan.nextStatus}`)
        }
        confirmLabel={t('ops.plan.moveConfirm')}
        tone={plan.nextStatus === 'completed' ? 'danger' : 'primary'}
        reason={{ label: t('ops.plan.moveNote'), required: false }}
        pending={transition.pending}
        error={fieldErrorOnly(transition.error)}
        onCancel={() => setTransitioning(false)}
        onConfirm={async ({ reason }) => {
          if (plan.nextStatus === null) return;
          try {
            await transition.mutate({
              params: { planId: plan.id },
              body: { toStatus: plan.nextStatus, ...(reason === '' ? {} : { note: reason }) },
            });
            toast.show(t('ops.plan.moved'), 'success');
            invalidateApiQueries('ops.operations.');
            setTransitioning(false);
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        {!ready && (
          <Banner tone="warning" title={t('ops.plan.blockingTitle')}>
            <p>{t('ops.plan.blockingText', { count: blockingCount })}</p>
          </Banner>
        )}
        {dirty && (
          <Banner tone="warning" title={t('ops.common.unsaved')}>
            <p>{t('ops.plan.saveFirst')}</p>
          </Banner>
        )}
        <ActionError error={transition.error} />
      </ConfirmActionDialog>
    </>
  );
}
