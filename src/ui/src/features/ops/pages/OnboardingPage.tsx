/**
 * OPS-02 Customer onboarding. Required information: agreed setup, ownership checks, adoption tasks, unresolved
 * issues, active events and export/retention obligations. Principal actions: coordinate authorized account changes
 * (update checklist items, advance the onboarding stage when no blocking item is open) and continuity arrangements
 * (the offboarding plan).
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import {
  ONBOARDING_ITEM_AREAS,
  ONBOARDING_ITEM_STATUSES,
  operationsEndpoints,
} from '@contracts/operations';
import type { OnboardingItem, OnboardingView } from '@contracts/operations';
import { enumLabel } from '@contracts/enums';
import type { TenantsOnboardingStage } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  ConfirmActionDialog,
  DataTable,
  EmptyState,
  PageHeader,
  QueryView,
  Select,
  StatusChip,
  Stepper,
  TextArea,
  isReady,
  useToast,
} from '../../../components/ui';
import type { StepState } from '../../../components/ui';
import { formatCalendarDate, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { LiveObligations, ReadinessPanel } from '../components/shared';
import { fieldErrorOnly } from '../lib/errors';
import { opsOptions, personName } from '../lib/labels';
import { opsPaths } from '../lib/paths';
import { CUSTOMERS_MANAGE } from '../lib/permissions';
import { ActionError } from '../components/ActionError';
import { OpsChip } from '../components/OpsChip';

const JOURNEY: readonly TenantsOnboardingStage[] = ['setup', 'configuring', 'pilot', 'live'];

export default function OnboardingPage() {
  const { customerTenantId } = useParams();
  const id = Number(customerTenantId);
  const onboarding = useApiQuery(operationsEndpoints.getOnboarding, {
    params: { customerTenantId: id },
  });
  return (
    <div className="tiq-page">
      {onboarding.data === undefined && (
        <PageHeader
          title={t('ops.onboarding.title')}
          back={{ to: opsPaths.customer(id), label: t('ops.customer.title') }}
        />
      )}
      <QueryView query={onboarding}>
        {(data) => <OnboardingWorkspace view={data} customerTenantId={id} />}
      </QueryView>
    </div>
  );
}

function stepState(stage: TenantsOnboardingStage, current: TenantsOnboardingStage): StepState {
  const index = JOURNEY.indexOf(stage);
  const currentIndex = JOURNEY.indexOf(current);
  if (currentIndex === -1) return 'complete';
  if (index < currentIndex) return 'complete';
  if (index === currentIndex) return 'current';
  return 'upcoming';
}

function OnboardingWorkspace({
  view,
  customerTenantId,
}: {
  readonly view: OnboardingView;
  readonly customerTenantId: number;
}) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(CUSTOMERS_MANAGE);
  const customer = useApiQuery(operationsEndpoints.getCustomer, { params: { customerTenantId } });
  const [editing, setEditing] = useState<OnboardingItem | null>(null);
  const [itemStatus, setItemStatus] = useState('');
  const [note, setNote] = useState('');
  const [advancing, setAdvancing] = useState(false);
  const [area, setArea] = useState('');
  const updateItem = useApiMutation(operationsEndpoints.updateOnboardingItem);
  const advance = useApiMutation(operationsEndpoints.advanceOnboarding);
  const scope = `${view.customer.name} (${view.customer.slug})`;
  const ready = isReady(view.readiness);
  const openBlocking = view.items.filter(
    (item) => item.blocking && item.status !== 'done' && item.status !== 'not_applicable',
  );
  const rows = view.items.filter((item) => area === '' || item.area === area);

  const startEdit = (item: OnboardingItem): void => {
    setEditing(item);
    setItemStatus(item.status);
    setNote(item.note ?? '');
    updateItem.reset();
  };

  return (
    <>
      <PageHeader
        title={t('ops.onboarding.titleFor', { name: view.customer.name })}
        subtitle={t('ops.onboarding.subtitle')}
        back={{ to: opsPaths.customer(customerTenantId), label: view.customer.name }}
        meta={
          <>
            <StatusChip enum="tenants.status" value={view.customer.status} />
            <StatusChip enum="tenants.onboarding_stage" value={view.stage} />
            <span>
              {t('ops.customers.col.serviceOwner')}: {personName(view.serviceOwner)}
            </span>
            <span>
              {t('ops.customer.nextAction')}:{' '}
              {view.nextStage === null
                ? t('ops.onboarding.next.none')
                : openBlocking.length > 0
                  ? t('ops.onboarding.next.items', { count: openBlocking.length })
                  : t('ops.onboarding.next.advance', {
                      stage: enumLabel('tenants.onboarding_stage', view.nextStage),
                    })}
            </span>
          </>
        }
        primaryAction={
          canManage && view.nextStage !== null ? (
            <Button
              variant="primary"
              icon="arrowRight"
              onClick={() => {
                advance.reset();
                setAdvancing(true);
              }}
            >
              {t('ops.onboarding.advance', {
                stage: enumLabel('tenants.onboarding_stage', view.nextStage),
              })}
            </Button>
          ) : undefined
        }
      />

      <Card>
        <Stepper
          label={t('ops.onboarding.journey')}
          steps={JOURNEY.map((stage) => ({
            id: stage,
            label: enumLabel('tenants.onboarding_stage', stage),
            description: t(`ops.onboarding.stageHint.${stage}`),
            state: stepState(stage, view.stage),
          }))}
        />
      </Card>

      <div className="tiq-grid tiq-grid--sidebar">
        <Card
          flush
          title={t('ops.onboarding.checklist')}
          subtitle={t('ops.onboarding.checklistHint')}
          actions={
            <Select
              label={t('ops.onboarding.area')}
              placeholder={t('ops.common.all')}
              value={area}
              onChange={setArea}
              options={opsOptions('itemArea', ONBOARDING_ITEM_AREAS)}
            />
          }
        >
          <DataTable<OnboardingItem>
            caption={t('ops.onboarding.checklist')}
            rows={rows}
            rowKey={(row) => String(row.id)}
            empty={<EmptyState compact title={t('ops.onboarding.noItems')} />}
            columns={[
              {
                id: 'item',
                header: t('ops.onboarding.col.item'),
                width: '34%',
                cell: (row) => (
                  <>
                    <strong>{row.title}</strong>
                    {row.detail !== null && <div className="tiq-cell-sub">{row.detail}</div>}
                    {row.note !== null && (
                      <div className="tiq-cell-sub">
                        {t('ops.onboarding.note')}: {row.note}
                      </div>
                    )}
                  </>
                ),
              },
              {
                id: 'area',
                header: t('ops.onboarding.col.area'),
                cell: (row) => <OpsChip kind="itemArea" value={row.area} size="sm" />,
              },
              {
                id: 'owner',
                header: t('ops.onboarding.col.owner'),
                cell: (row) => personName(row.owner),
              },
              {
                id: 'due',
                header: t('ops.onboarding.col.due'),
                cell: (row) => formatCalendarDate(row.dueDate),
              },
              {
                id: 'status',
                header: t('ops.onboarding.col.status'),
                cell: (row) => (
                  <div className="tiq-stack">
                    <span>
                      <OpsChip kind="itemStatus" value={row.status} size="sm" />
                    </span>
                    {row.blocking && row.status !== 'done' && row.status !== 'not_applicable' && (
                      <span className="tiq-cell-sub tiq-text-danger">
                        {t('ops.onboarding.blocking')}
                      </span>
                    )}
                    {row.resolvedAt !== null && (
                      <span className="tiq-cell-sub">
                        {formatDateTime(row.resolvedAt, timeZone)}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                id: 'actions',
                header: t('ops.common.actions'),
                cell: (row) =>
                  canManage ? (
                    <Button
                      size="sm"
                      onClick={() => startEdit(row)}
                      aria-label={t('ops.onboarding.updateItemFor', { title: row.title })}
                    >
                      {t('ops.onboarding.updateItem')}
                    </Button>
                  ) : null,
              },
            ]}
          />
        </Card>
        <Card title={t('ops.onboarding.readiness')}>
          <ReadinessPanel checks={view.readiness} label={t('ops.onboarding.readiness')} />
          <p className="tiq-text-muted">
            {ready ? t('ops.onboarding.readyNote') : t('ops.onboarding.notReadyNote')}
          </p>
        </Card>
      </div>

      <Card
        title={t('ops.onboarding.obligations')}
        subtitle={t('ops.onboarding.obligationsHint')}
        actions={
          customer.data?.offboardingPlanId !== null &&
          customer.data?.offboardingPlanId !== undefined ? (
            <ButtonLink size="sm" to={opsPaths.offboardingPlan(customer.data.offboardingPlanId)}>
              {t('ops.customer.openPlan')}
            </ButtonLink>
          ) : undefined
        }
      >
        <QueryView query={customer}>
          {(data) => <LiveObligations events={data.liveEvents} contracts={data.liveContracts} />}
        </QueryView>
      </Card>

      <ConfirmActionDialog
        open={editing !== null}
        title={t('ops.onboarding.itemDialog', { title: editing?.title ?? '' })}
        scope={`${scope} · ${editing?.title ?? ''}`}
        consequence={t('ops.onboarding.itemConsequence')}
        confirmLabel={t('ops.onboarding.saveItem')}
        pending={updateItem.pending}
        error={fieldErrorOnly(updateItem.error)}
        onCancel={() => setEditing(null)}
        onConfirm={async () => {
          if (editing === null) return;
          try {
            await updateItem.mutate({
              params: { customerTenantId, itemId: editing.id },
              body: {
                status: itemStatus as (typeof ONBOARDING_ITEM_STATUSES)[number],
                ...(note.trim() === '' ? {} : { note: note.trim() }),
              },
            });
            toast.show(t('ops.onboarding.itemSaved'), 'success');
            invalidateApiQueries('ops.operations.onboarding.');
            setEditing(null);
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <Select
          label={t('ops.onboarding.col.status')}
          required
          value={itemStatus}
          onChange={setItemStatus}
          options={opsOptions('itemStatus', ONBOARDING_ITEM_STATUSES)}
        />
        <TextArea
          label={t('ops.onboarding.note')}
          hint={t('ops.onboarding.noteHint')}
          value={note}
          onChange={setNote}
          rows={3}
          error={updateItem.error?.fieldErrors.find((item) => item.field === 'note')?.message}
        />
        <ActionError error={updateItem.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={advancing}
        title={t('ops.onboarding.advanceTitle')}
        scope={scope}
        consequence={t('ops.onboarding.advanceConsequence', {
          from: enumLabel('tenants.onboarding_stage', view.stage),
          to: view.nextStage === null ? '' : enumLabel('tenants.onboarding_stage', view.nextStage),
        })}
        confirmLabel={t('ops.onboarding.advanceConfirm')}
        reason={{ label: t('ops.onboarding.advanceNote'), required: false }}
        pending={advance.pending}
        error={fieldErrorOnly(advance.error)}
        onCancel={() => setAdvancing(false)}
        onConfirm={async ({ reason }) => {
          if (view.nextStage === null) return;
          try {
            await advance.mutate({
              params: { customerTenantId },
              body: { toStage: view.nextStage, ...(reason === '' ? {} : { note: reason }) },
            });
            toast.show(t('ops.onboarding.advanced'), 'success');
            invalidateApiQueries('ops.operations.');
            setAdvancing(false);
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        {openBlocking.length > 0 && (
          <Banner tone="warning" title={t('ops.onboarding.blockingTitle')}>
            <ul>
              {openBlocking.map((item) => (
                <li key={item.id}>{item.title}</li>
              ))}
            </ul>
          </Banner>
        )}
        <ActionError error={advance.error} />
      </ConfirmActionDialog>
    </>
  );
}
