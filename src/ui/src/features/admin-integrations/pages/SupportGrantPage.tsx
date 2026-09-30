/**
 * Support access grant (customer side): the case, business need, permitted records, requested duration, limits and
 * what support did under the grant. Actions: authorize until a chosen expiry (at most 14 days, optionally narrowed to
 * metadata only), deny with a reason, or revoke an active grant at once. Support never impersonates a member.
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { MAX_SUPPORT_GRANT_DAYS, operationsEndpoints } from '@contracts/operations';
import type { CustomerSupportGrant } from '@contracts/operations';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  ConfirmActionDialog,
  DateTimeInput,
  DetailList,
  PageHeader,
  QueryView,
  StatusChip,
  useToast,
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { ActivityHistory } from '../../ops/components/shared';
import { fieldErrorOnly } from '../../ops/lib/errors';
import { ServiceLayout } from '../components/ServiceLayout';
import { servicePaths } from '../lib/paths';
import { grantWindow } from '../../ops/lib/grants';
import { ActionError } from '../../ops/components/ActionError';

export default function SupportGrantPage() {
  const { grantId } = useParams();
  const grant = useApiQuery(operationsEndpoints.getCustomerSupportGrant, {
    params: { grantId: Number(grantId) },
  });
  return (
    <ServiceLayout>
      {grant.data === undefined && (
        <PageHeader
          title={t('admin-integrations.grant.title')}
          back={{ to: servicePaths.supportAccess, label: t('admin-integrations.support.title') }}
        />
      )}
      <QueryView query={grant}>{(data) => <GrantView grant={data} />}</QueryView>
    </ServiceLayout>
  );
}

function GrantView({ grant }: { readonly grant: CustomerSupportGrant }) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [dialog, setDialog] = useState<'authorize' | 'deny' | 'revoke' | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [missing, setMissing] = useState(false);
  const authorize = useApiMutation(operationsEndpoints.authorizeSupportGrant);
  const deny = useApiMutation(operationsEndpoints.denySupportGrant);
  const revoke = useApiMutation(operationsEndpoints.revokeSupportGrant);
  const scope = `${grant.caseReference} · ${grant.operator.fullName}`;
  const requested = grant.status === 'requested';
  const active = grant.status === 'active' || grant.status === 'authorized';

  const close = (): void => {
    setDialog(null);
    setMissing(false);
    authorize.reset();
    deny.reset();
    revoke.reset();
  };

  return (
    <>
      <PageHeader
        title={`${grant.caseReference} ${grant.caseSubject}`}
        back={{ to: servicePaths.supportAccess, label: t('admin-integrations.support.title') }}
        meta={
          <>
            <StatusChip enum="support_access_grants.status" value={grant.status} />
            <StatusChip enum="support_access_grants.scope" value={grant.scope} />
            <span>
              {t('ops.customer.nextAction')}:{' '}
              {requested
                ? t('admin-integrations.grant.next.decide')
                : active
                  ? t('admin-integrations.grant.next.monitor')
                  : t('admin-integrations.grant.next.none')}
            </span>
          </>
        }
        actions={
          requested ? (
            <Button variant="danger-soft" icon="xCircle" onClick={() => setDialog('deny')}>
              {t('admin-integrations.grant.deny')}
            </Button>
          ) : undefined
        }
        primaryAction={
          requested ? (
            <Button variant="primary" icon="key" onClick={() => setDialog('authorize')}>
              {t('admin-integrations.grant.authorize')}
            </Button>
          ) : active ? (
            <Button variant="danger" icon="ban" onClick={() => setDialog('revoke')}>
              {t('admin-integrations.grant.revoke')}
            </Button>
          ) : undefined
        }
      />
      <Banner tone="info" title={t('admin-integrations.grant.limitsTitle')}>
        <ul>
          {grant.limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </Banner>
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('admin-integrations.grant.request')}>
          <DetailList
            stacked
            items={[
              { key: 'need', label: t('ops.grants.col.need'), value: grant.businessNeed },
              {
                key: 'operator',
                label: t('ops.grants.col.operator'),
                value: grant.operator.fullName,
              },
              {
                key: 'records',
                label: t('ops.grants.col.scope'),
                value: (
                  <>
                    <StatusChip enum="support_access_grants.scope" value={grant.scope} size="sm" />
                    {grant.recordRefs.length > 0 && (
                      <div className="tiq-mono">{grant.recordRefs.join(', ')}</div>
                    )}
                  </>
                ),
              },
              {
                key: 'days',
                label: t('admin-integrations.grant.requestedDuration'),
                value: t('admin-integrations.support.days', { count: grant.requestedDays }),
              },
              {
                key: 'requested',
                label: t('admin-integrations.support.col.requested'),
                value: formatDateTime(grant.requestedAt, timeZone),
              },
            ]}
          />
        </Card>
        <Card title={t('admin-integrations.grant.decision')}>
          <DetailList
            stacked
            items={[
              {
                key: 'window',
                label: t('ops.grants.col.window'),
                value: grantWindow(grant, timeZone),
              },
              {
                key: 'authorizedBy',
                label: t('admin-integrations.grant.authorizedBy'),
                value: grant.authorizedBy?.fullName ?? null,
              },
              {
                key: 'revoked',
                label: t('admin-integrations.grant.revokedAt'),
                value: grant.revokedAt === null ? null : formatDateTime(grant.revokedAt, timeZone),
              },
              {
                key: 'reason',
                label: t('admin-integrations.grant.statusReason'),
                value: grant.statusReason,
              },
            ]}
          />
        </Card>
      </div>
      <Card
        title={t('admin-integrations.grant.activity')}
        subtitle={t('admin-integrations.grant.activityHint')}
      >
        <ActivityHistory
          entries={grant.activity}
          timeZone={timeZone}
          label={t('admin-integrations.grant.activity')}
        />
      </Card>

      <ConfirmActionDialog
        open={dialog === 'authorize'}
        title={t('admin-integrations.grant.authorizeTitle')}
        scope={scope}
        consequence={t('admin-integrations.grant.authorizeConsequence')}
        confirmLabel={t('admin-integrations.grant.authorize')}
        acknowledgement={t('admin-integrations.grant.authorizeAck')}
        pending={authorize.pending}
        error={fieldErrorOnly(authorize.error)}
        onCancel={close}
        onConfirm={async () => {
          if (expiresAt === null) {
            setMissing(true);
            return;
          }
          try {
            await authorize.mutate({
              params: { grantId: grant.id },
              body: {
                expiresAt,
                acknowledgement: true,
                ...(narrow ? { scope: 'metadata_only' as const } : {}),
              },
            });
            toast.show(t('admin-integrations.grant.authorized'), 'success');
            invalidateApiQueries('buyer.operations.supportAccess.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <DateTimeInput
          label={t('admin-integrations.grant.expiresAt')}
          hint={t('admin-integrations.grant.expiresHint', {
            days: MAX_SUPPORT_GRANT_DAYS,
            requested: grant.requestedDays,
          })}
          timeZone={timeZone}
          required
          value={expiresAt}
          onChange={setExpiresAt}
          error={
            missing && expiresAt === null
              ? t('ops.common.required')
              : authorize.error?.fieldErrors.find((item) => item.field === 'expiresAt')?.message
          }
        />
        {grant.scope === 'specific_records' && (
          <Checkbox
            label={t('admin-integrations.grant.narrow')}
            hint={t('admin-integrations.grant.narrowHint')}
            checked={narrow}
            onChange={setNarrow}
          />
        )}
        <ActionError error={authorize.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'deny'}
        title={t('admin-integrations.grant.denyTitle')}
        scope={scope}
        consequence={t('admin-integrations.grant.denyConsequence')}
        confirmLabel={t('admin-integrations.grant.deny')}
        tone="danger"
        reason={{ label: t('ops.common.reason'), required: true }}
        pending={deny.pending}
        error={fieldErrorOnly(deny.error)}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          try {
            await deny.mutate({ params: { grantId: grant.id }, body: { reason } });
            toast.show(t('admin-integrations.grant.denied'), 'success');
            invalidateApiQueries('buyer.operations.supportAccess.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <ActionError error={deny.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'revoke'}
        title={t('admin-integrations.grant.revokeTitle')}
        scope={scope}
        consequence={t('admin-integrations.grant.revokeConsequence')}
        confirmLabel={t('admin-integrations.grant.revoke')}
        tone="danger"
        reason={{ label: t('ops.common.reason'), required: true }}
        pending={revoke.pending}
        error={fieldErrorOnly(revoke.error)}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          try {
            await revoke.mutate({ params: { grantId: grant.id }, body: { reason } });
            toast.show(t('admin-integrations.grant.revoked'), 'success');
            invalidateApiQueries('buyer.operations.supportAccess.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <ActionError error={revoke.error} />
      </ConfirmActionDialog>
    </>
  );
}
