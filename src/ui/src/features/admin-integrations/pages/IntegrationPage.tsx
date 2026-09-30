/**
 * ADM-15 connection detail: purpose, business owner, exchanged information, record ownership, permitted recipients,
 * timeliness, manual fallback, responsible contacts, confirmations and recent exceptions. Actions: edit, enable /
 * suspend / retire (enabling needs a documented fallback; retiring needs no open exception), and confirm that the
 * exchange still agrees with the official records.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { INTEGRATION_CONNECTIONS_STATUS, enumLabel } from '@contracts/enums';
import { operationsEndpoints } from '@contracts/operations';
import type { IntegrationContact, IntegrationDetail } from '@contracts/operations';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  PageHeader,
  QueryView,
  Select,
  StatusChip,
  Timeline,
  useToast,
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { fieldErrorOnly } from '../../ops/lib/errors';
import { ExceptionsTable } from '../components/ExceptionsTable';
import { IntegrationFormDialog } from '../components/IntegrationForm';
import { ServiceLayout } from '../components/ServiceLayout';
import { servicePaths } from '../lib/paths';
import { ActionError } from '../../ops/components/ActionError';

export default function IntegrationPage() {
  const { connectionId } = useParams();
  const integration = useApiQuery(operationsEndpoints.getIntegration, {
    params: { connectionId: Number(connectionId) },
  });
  return (
    <ServiceLayout>
      {integration.data === undefined && (
        <PageHeader
          title={t('admin-integrations.detail.title')}
          back={{ to: servicePaths.integrations, label: t('admin-integrations.list.title') }}
        />
      )}
      <QueryView query={integration}>{(data) => <IntegrationView integration={data} />}</QueryView>
    </ServiceLayout>
  );
}

function IntegrationView({ integration }: { readonly integration: IntegrationDetail }) {
  const navigate = useNavigate();
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [dialog, setDialog] = useState<'edit' | 'status' | 'confirm' | null>(null);
  const [target, setTarget] = useState('');
  const [missing, setMissing] = useState(false);
  const changeStatus = useApiMutation(operationsEndpoints.changeIntegrationStatus);
  const confirm = useApiMutation(operationsEndpoints.confirmIntegration);
  const retired = integration.status === 'retired';
  const scope = `${integration.name} (${enumLabel('integration_connections.system_type', integration.systemType)})`;

  const close = (): void => {
    setDialog(null);
    setTarget('');
    setMissing(false);
    changeStatus.reset();
    confirm.reset();
  };

  const nextAction = (): string => {
    if (retired) return t('admin-integrations.detail.next.retired');
    if (integration.openExceptions > 0)
      return t('admin-integrations.detail.next.exceptions', { count: integration.openExceptions });
    if (!integration.hasManualFallback) return t('admin-integrations.detail.next.fallback');
    if (integration.status === 'planned') return t('admin-integrations.detail.next.enable');
    return t('admin-integrations.detail.next.confirm');
  };

  return (
    <>
      <PageHeader
        title={integration.name}
        subtitle={integration.purpose}
        back={{ to: servicePaths.integrations, label: t('admin-integrations.list.title') }}
        meta={
          <>
            <StatusChip enum="integration_connections.status" value={integration.status} />
            <StatusChip enum="integration_connections.system_type" value={integration.systemType} />
            <span>
              {t('ops.customer.nextAction')}: {nextAction()}
            </span>
          </>
        }
        actions={
          retired ? undefined : (
            <>
              <Button icon="edit" onClick={() => setDialog('edit')}>
                {t('admin-integrations.detail.edit')}
              </Button>
              <Button icon="sliders" onClick={() => setDialog('status')}>
                {t('admin-integrations.detail.changeStatus')}
              </Button>
            </>
          )
        }
        primaryAction={
          integration.status === 'active' ? (
            <Button variant="primary" icon="checkCircle" onClick={() => setDialog('confirm')}>
              {t('admin-integrations.detail.confirm')}
            </Button>
          ) : undefined
        }
      />
      {!integration.hasManualFallback && (
        <Banner tone="warning" title={t('admin-integrations.detail.noFallbackTitle')}>
          <p>{t('admin-integrations.detail.noFallback')}</p>
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('admin-integrations.detail.agreement')}>
          <DetailList
            stacked
            items={[
              {
                key: 'owner',
                label: t('admin-integrations.col.owner'),
                value: integration.businessOwner.fullName,
              },
              {
                key: 'scope',
                label: t('admin-integrations.detail.scope'),
                value: integration.informationScope,
              },
              {
                key: 'ownership',
                label: t('admin-integrations.detail.ownership'),
                value: integration.recordOwnership,
              },
              {
                key: 'recipients',
                label: t('admin-integrations.detail.recipients'),
                value: integration.permittedRecipients,
              },
              {
                key: 'timeliness',
                label: t('admin-integrations.detail.timeliness'),
                value: integration.expectedTimeliness,
              },
              {
                key: 'created',
                label: t('admin-integrations.detail.created'),
                value: formatDateTime(integration.createdAt, timeZone),
              },
            ]}
          />
        </Card>
        <Card
          title={t('admin-integrations.detail.fallback')}
          subtitle={t('admin-integrations.detail.fallbackHint')}
        >
          {integration.manualFallback === null ? (
            <p className="tiq-text-warning">{t('admin-integrations.detail.fallbackMissing')}</p>
          ) : (
            <p>{integration.manualFallback}</p>
          )}
        </Card>
      </div>

      <div className="tiq-grid tiq-grid--2">
        <Card flush title={t('admin-integrations.detail.contacts')}>
          <DataTable<IntegrationContact>
            caption={t('admin-integrations.detail.contacts')}
            rows={integration.contacts}
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
                cell: (row) => row.email ?? t('ops.common.none'),
              },
            ]}
          />
        </Card>
        <Card
          title={t('admin-integrations.detail.confirmations')}
          subtitle={t('admin-integrations.detail.confirmationsHint')}
        >
          {integration.confirmations.length === 0 ? (
            <EmptyState
              compact
              icon="checkCircle"
              title={t('admin-integrations.list.neverConfirmed')}
            />
          ) : (
            <Timeline
              label={t('admin-integrations.detail.confirmations')}
              items={integration.confirmations.map((entry) => ({
                id: entry.id,
                tone: 'success',
                icon: 'checkCircle',
                title: entry.confirmedBy.fullName,
                meta: formatDateTime(entry.confirmedAt, timeZone),
                detail: entry.note ?? undefined,
              }))}
            />
          )}
        </Card>
      </div>

      <Card
        flush
        title={t('admin-integrations.detail.recentExceptions')}
        subtitle={t('admin-integrations.detail.exceptionsHint')}
      >
        <ExceptionsTable
          rows={integration.recentExceptions}
          timeZone={timeZone}
          caption={t('admin-integrations.detail.recentExceptions')}
          onOpen={(row) => navigate(servicePaths.exception(row.id))}
        />
      </Card>

      {dialog === 'edit' && (
        <IntegrationFormDialog
          existing={integration}
          onClose={close}
          onSaved={() => {
            toast.show(t('admin-integrations.form.saved'), 'success');
            invalidateApiQueries('buyer.operations.integrations.');
            close();
          }}
        />
      )}

      <ConfirmActionDialog
        open={dialog === 'status'}
        title={t('admin-integrations.detail.statusTitle')}
        scope={scope}
        consequence={
          target === ''
            ? t('ops.customer.status.chooseFirst')
            : t(`admin-integrations.detail.statusConsequence.${target}`)
        }
        confirmLabel={t('admin-integrations.detail.changeStatus')}
        tone={target === 'retired' || target === 'suspended' ? 'danger' : 'primary'}
        reason={{ label: t('ops.common.reason'), required: true }}
        pending={changeStatus.pending}
        error={fieldErrorOnly(changeStatus.error)}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          if (target === '') {
            setMissing(true);
            return;
          }
          try {
            await changeStatus.mutate({
              params: { connectionId: integration.id },
              body: { status: target as (typeof INTEGRATION_CONNECTIONS_STATUS)[number], reason },
            });
            toast.show(t('admin-integrations.detail.statusChanged'), 'success');
            invalidateApiQueries('buyer.operations.integrations.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <Select
          label={t('admin-integrations.detail.newStatus')}
          required
          placeholder={t('ops.common.choose')}
          value={target}
          onChange={setTarget}
          options={INTEGRATION_CONNECTIONS_STATUS.filter(
            (status) => status !== integration.status,
          ).map((status) => ({
            value: status,
            label: enumLabel('integration_connections.status', status),
          }))}
          error={missing && target === '' ? t('ops.common.required') : undefined}
        />
        <ActionError error={changeStatus.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'confirm'}
        title={t('admin-integrations.detail.confirmTitle')}
        scope={scope}
        consequence={t('admin-integrations.detail.confirmConsequence')}
        confirmLabel={t('admin-integrations.detail.confirm')}
        reason={{ label: t('admin-integrations.detail.confirmNote'), required: false }}
        pending={confirm.pending}
        error={fieldErrorOnly(confirm.error)}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          try {
            await confirm.mutate({
              params: { connectionId: integration.id },
              body: reason === '' ? {} : { note: reason },
            });
            toast.show(t('admin-integrations.detail.confirmed'), 'success');
            invalidateApiQueries('buyer.operations.integrations.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        {integration.openExceptions > 0 && (
          <Banner tone="warning" title={t('admin-integrations.detail.openExceptionsTitle')}>
            <p>
              {t('admin-integrations.detail.openExceptions', { count: integration.openExceptions })}
            </p>
          </Banner>
        )}
        <ActionError error={confirm.error} />
      </ConfirmActionDialog>
    </>
  );
}
