/**
 * ADM-15 exception (AC-33): an external publication or signature service reported a failure. The record stays
 * visibly unconfirmed while the exception is open; the exception is assigned, investigated and reconciled (with the
 * external confirmation reference), settled through the documented manual fallback, or closed.
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { EXCEPTION_RESOLUTIONS, operationsEndpoints } from '@contracts/operations';
import type { IntegrationExceptionDetail } from '@contracts/operations';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  ConfirmActionDialog,
  DetailList,
  PageHeader,
  QueryView,
  RadioGroup,
  Select,
  StatusChip,
  TextField,
  useToast,
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { ActivityHistory } from '../../ops/components/shared';
import { fieldErrorOnly } from '../../ops/lib/errors';
import { personName } from '../../ops/lib/labels';
import { usePeopleOptions } from '../components/people';
import { ServiceLayout } from '../components/ServiceLayout';
import { servicePaths } from '../lib/paths';
import { ActionError } from '../../ops/components/ActionError';

export default function ExceptionPage() {
  const { exceptionId } = useParams();
  const exception = useApiQuery(operationsEndpoints.getIntegrationException, {
    params: { exceptionId: Number(exceptionId) },
  });
  return (
    <ServiceLayout>
      {exception.data === undefined && (
        <PageHeader
          title={t('admin-integrations.exception.title')}
          back={{ to: servicePaths.exceptions, label: t('admin-integrations.exceptions.title') }}
        />
      )}
      <QueryView query={exception}>{(data) => <ExceptionView exception={data} />}</QueryView>
    </ServiceLayout>
  );
}

function ExceptionView({ exception }: { readonly exception: IntegrationExceptionDetail }) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const people = usePeopleOptions();
  const [dialog, setDialog] = useState<'assign' | 'investigate' | 'resolve' | null>(null);
  const [owner, setOwner] = useState(String(exception.owner?.userId ?? ''));
  const [outcome, setOutcome] = useState<string>('reconciled');
  const [externalReference, setExternalReference] = useState('');
  const [missing, setMissing] = useState(false);
  const assign = useApiMutation(operationsEndpoints.assignIntegrationException);
  const investigate = useApiMutation(operationsEndpoints.investigateIntegrationException);
  const resolve = useApiMutation(operationsEndpoints.resolveIntegrationException);
  const open = exception.status === 'open' || exception.status === 'investigating';
  const scope = `${exception.recordLabel} · ${exception.connectionName}`;
  const needsReference = exception.recordType === 'publication' && outcome === 'reconciled';

  const close = (): void => {
    setDialog(null);
    setMissing(false);
    assign.reset();
    investigate.reset();
    resolve.reset();
  };

  const nextAction = (): string => {
    if (!open) return t('admin-integrations.exception.next.done');
    if (exception.owner === null) return t('admin-integrations.exception.next.assign');
    if (exception.status === 'open') return t('admin-integrations.exception.next.investigate');
    return t('admin-integrations.exception.next.resolve');
  };

  return (
    <>
      <PageHeader
        title={exception.recordLabel}
        subtitle={exception.description}
        back={{ to: servicePaths.exceptions, label: t('admin-integrations.exceptions.title') }}
        meta={
          <>
            <StatusChip enum="integration_exceptions.status" value={exception.status} />
            <StatusChip enum="integration_connections.system_type" value={exception.systemType} />
            <span>
              {t('ops.customer.nextAction')}: {nextAction()}
            </span>
          </>
        }
        actions={
          open ? (
            <>
              {exception.capabilities.canAssign && (
                <Button icon="userPlus" onClick={() => setDialog('assign')}>
                  {t('admin-integrations.exception.assign')}
                </Button>
              )}
              {exception.status === 'open' && exception.capabilities.canResolve && (
                <Button icon="search" onClick={() => setDialog('investigate')}>
                  {t('admin-integrations.exception.investigate')}
                </Button>
              )}
              {exception.recordLink !== null && (
                <ButtonLink icon="arrowRight" to={exception.recordLink}>
                  {t('admin-integrations.exception.openRecord')}
                </ButtonLink>
              )}
            </>
          ) : exception.recordLink !== null ? (
            <ButtonLink icon="arrowRight" to={exception.recordLink}>
              {t('admin-integrations.exception.openRecord')}
            </ButtonLink>
          ) : undefined
        }
        primaryAction={
          open && exception.capabilities.canResolve ? (
            <Button variant="primary" icon="checkCircle" onClick={() => setDialog('resolve')}>
              {t('admin-integrations.exception.resolve')}
            </Button>
          ) : undefined
        }
      />
      {open && exception.unconfirmedEffect !== null && (
        <Banner tone="error" title={t('admin-integrations.exception.unconfirmedTitle')}>
          <p>{exception.unconfirmedEffect}</p>
        </Banner>
      )}
      {!open && exception.resolution !== null && (
        <Banner tone="success" title={t('admin-integrations.exception.resolvedTitle')}>
          <p>{exception.resolution}</p>
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('admin-integrations.exception.details')}>
          <DetailList
            stacked
            items={[
              {
                key: 'connection',
                label: t('admin-integrations.exceptions.col.connection'),
                value: exception.connectionName,
              },
              {
                key: 'type',
                label: t('admin-integrations.exceptions.recordType'),
                value: t(`admin-integrations.recordType.${exception.recordType}`),
              },
              {
                key: 'owner',
                label: t('admin-integrations.exceptions.col.owner'),
                value: personName(exception.owner),
              },
              {
                key: 'opened',
                label: t('admin-integrations.exceptions.col.opened'),
                value: formatDateTime(exception.openedAt, timeZone),
              },
              {
                key: 'resolved',
                label: t('admin-integrations.exception.resolvedAt'),
                value:
                  exception.resolvedAt === null
                    ? null
                    : formatDateTime(exception.resolvedAt, timeZone),
              },
            ]}
          />
        </Card>
        <Card
          title={t('admin-integrations.detail.fallback')}
          subtitle={t('admin-integrations.detail.fallbackHint')}
        >
          {exception.manualFallback === null ? (
            <p className="tiq-text-warning">{t('admin-integrations.detail.fallbackMissing')}</p>
          ) : (
            <p>{exception.manualFallback}</p>
          )}
        </Card>
      </div>
      <Card title={t('admin-integrations.exception.history')}>
        <ActivityHistory
          entries={exception.history}
          timeZone={timeZone}
          label={t('admin-integrations.exception.history')}
        />
      </Card>

      <ConfirmActionDialog
        open={dialog === 'assign'}
        title={t('admin-integrations.exception.assignTitle')}
        scope={scope}
        consequence={t('admin-integrations.exception.assignConsequence')}
        confirmLabel={t('admin-integrations.exception.assign')}
        pending={assign.pending}
        error={fieldErrorOnly(assign.error)}
        onCancel={close}
        onConfirm={async () => {
          if (owner === '') {
            setMissing(true);
            return;
          }
          try {
            await assign.mutate({
              params: { exceptionId: exception.id },
              body: { ownerUserId: Number(owner) },
            });
            toast.show(t('admin-integrations.exception.assigned'), 'success');
            invalidateApiQueries('buyer.operations.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <Select
          label={t('admin-integrations.exceptions.col.owner')}
          required
          placeholder={t('ops.common.choose')}
          value={owner}
          onChange={setOwner}
          options={people}
          error={missing && owner === '' ? t('ops.common.required') : undefined}
        />
        <ActionError error={assign.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'investigate'}
        title={t('admin-integrations.exception.investigateTitle')}
        scope={scope}
        consequence={t('admin-integrations.exception.investigateConsequence')}
        confirmLabel={t('admin-integrations.exception.investigate')}
        reason={{ label: t('admin-integrations.exception.note'), required: false }}
        pending={investigate.pending}
        error={fieldErrorOnly(investigate.error)}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          try {
            await investigate.mutate({
              params: { exceptionId: exception.id },
              body: reason === '' ? {} : { note: reason },
            });
            toast.show(t('admin-integrations.exception.investigating'), 'success');
            invalidateApiQueries('buyer.operations.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <ActionError error={investigate.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'resolve'}
        title={t('admin-integrations.exception.resolveTitle')}
        scope={scope}
        consequence={t(`admin-integrations.exception.resolveConsequence.${outcome}`)}
        confirmLabel={t('admin-integrations.exception.resolve')}
        reason={{ label: t('admin-integrations.exception.resolution'), required: true }}
        pending={resolve.pending}
        error={fieldErrorOnly(resolve.error)}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          if (needsReference && externalReference.trim() === '') {
            setMissing(true);
            return;
          }
          try {
            await resolve.mutate({
              params: { exceptionId: exception.id },
              body: {
                outcome: outcome as (typeof EXCEPTION_RESOLUTIONS)[number],
                resolution: reason,
                ...(externalReference.trim() === ''
                  ? {}
                  : { externalReference: externalReference.trim() }),
              },
            });
            toast.show(t('admin-integrations.exception.resolved'), 'success');
            invalidateApiQueries('buyer.operations.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <RadioGroup
          label={t('admin-integrations.exception.outcome')}
          required
          value={outcome}
          onChange={setOutcome}
          options={EXCEPTION_RESOLUTIONS.map((value) => ({
            value,
            label: t(`admin-integrations.exception.outcomes.${value}`),
            hint: t(`admin-integrations.exception.outcomeHints.${value}`),
          }))}
        />
        <TextField
          label={t('admin-integrations.exception.externalReference')}
          hint={t('admin-integrations.exception.externalReferenceHint')}
          required={needsReference}
          value={externalReference}
          onChange={setExternalReference}
          error={
            missing && needsReference && externalReference.trim() === ''
              ? t('ops.errors.EXTERNAL_CONFIRMATION_REQUIRED')
              : undefined
          }
        />
        <ActionError error={resolve.error} />
      </ConfirmActionDialog>
    </>
  );
}
