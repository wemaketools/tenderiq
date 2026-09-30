/**
 * OPS-05 incident: scope and severity, affected customers and events, start and recovery times, the customer notice,
 * recovery status, the timing evidence (timeline) and each responsible buyer's decision. Actions: post a status
 * update (with a revised customer notice), record an affected customer or event. The operator never records a
 * deadline decision for the buyer (PRD §19, §20).
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { operationsEndpoints } from '@contracts/operations';
import type { IncidentDetail, IncidentImpact } from '@contracts/operations';
import { SERVICE_INCIDENTS_STATUS, enumLabel } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  DateTimeInput,
  DetailList,
  EmptyState,
  PageHeader,
  QueryView,
  Reference,
  Select,
  StatusChip,
  TextArea,
  TextField,
  useToast,
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { ActivityHistory } from '../components/shared';
import { fieldErrorOnly } from '../lib/errors';
import { opsPaths } from '../lib/paths';
import { INCIDENTS_MANAGE } from '../lib/permissions';
import { ActionError } from '../components/ActionError';
import { OpsChip } from '../components/OpsChip';

export default function IncidentPage() {
  const { incidentId } = useParams();
  const id = Number(incidentId);
  const incident = useApiQuery(operationsEndpoints.getIncident, { params: { incidentId: id } });
  return (
    <div className="tiq-page">
      {incident.data === undefined && (
        <PageHeader
          title={t('ops.incident.title')}
          back={{ to: opsPaths.incidents, label: t('ops.incidents.title') }}
        />
      )}
      <QueryView query={incident}>{(data) => <IncidentView incident={data} />}</QueryView>
    </div>
  );
}

function IncidentView({ incident }: { readonly incident: IncidentDetail }) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(INCIDENTS_MANAGE);
  const resolved = incident.status === 'resolved';
  const [dialog, setDialog] = useState<'update' | 'impact' | null>(null);
  const [status, setStatus] = useState<string>(incident.status);
  const [notice, setNotice] = useState(incident.customerNotice ?? '');
  const [resolvedAt, setResolvedAt] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [tenderRef, setTenderRef] = useState('');
  const [impactNote, setImpactNote] = useState('');
  const [missing, setMissing] = useState(false);
  const postUpdate = useApiMutation(operationsEndpoints.updateIncident);
  const addImpact = useApiMutation(operationsEndpoints.addIncidentImpact);
  const customers = useApiQuery(
    operationsEndpoints.listCustomers,
    dialog === 'impact' ? { query: { pageSize: 100, sort: 'name' } } : null,
  );
  const scope = `${incident.reference} ${incident.title}`;
  const pending = incident.impacts.filter((impact) => impact.buyerDecisionNote === null);

  const close = (): void => {
    setDialog(null);
    setMissing(false);
    postUpdate.reset();
    addImpact.reset();
  };

  return (
    <>
      <PageHeader
        title={`${incident.reference} ${incident.title}`}
        back={{ to: opsPaths.incidents, label: t('ops.incidents.title') }}
        meta={
          <>
            <OpsChip kind="severity" value={incident.severity} />
            <StatusChip enum="service_incidents.status" value={incident.status} />
            <span>
              {t('ops.customer.nextAction')}:{' '}
              {!resolved
                ? t('ops.incident.next.recover')
                : pending.length > 0
                  ? t('ops.incident.next.decisions', { count: pending.length })
                  : t('ops.incident.next.none')}
            </span>
          </>
        }
        actions={
          canManage ? (
            <Button icon="plus" onClick={() => setDialog('impact')}>
              {t('ops.incident.addImpact')}
            </Button>
          ) : undefined
        }
        primaryAction={
          canManage && !resolved ? (
            <Button variant="primary" icon="megaphone" onClick={() => setDialog('update')}>
              {t('ops.incident.postUpdate')}
            </Button>
          ) : undefined
        }
      />
      <Banner tone="info" title={t('ops.incidents.ruleTitle')}>
        <p>{incident.decisionRule}</p>
      </Banner>

      <div className="tiq-grid tiq-grid--2">
        <Card title={t('ops.incident.scope')}>
          <p>{incident.description}</p>
          <DetailList
            items={[
              {
                key: 'started',
                label: t('ops.incidents.col.started'),
                value: formatDateTime(incident.startedAt, timeZone),
              },
              {
                key: 'resolved',
                label: t('ops.incidents.col.resolved'),
                value:
                  incident.resolvedAt === null
                    ? t('ops.incidents.ongoing')
                    : formatDateTime(incident.resolvedAt, timeZone),
              },
              {
                key: 'impact',
                label: t('ops.incidents.col.impact'),
                value: t('ops.incidents.impactValue', {
                  customers: incident.affectedCustomers,
                  events: incident.affectedEvents,
                }),
              },
            ]}
          />
        </Card>
        <Card title={t('ops.incident.notice')} subtitle={t('ops.incident.noticeHint')}>
          {incident.customerNotice === null ? (
            <p className="tiq-text-muted">{t('ops.incident.noNotice')}</p>
          ) : (
            <p>{incident.customerNotice}</p>
          )}
        </Card>
      </div>

      <Card flush title={t('ops.incident.impacts')} subtitle={t('ops.incident.impactsHint')}>
        <DataTable<IncidentImpact>
          caption={t('ops.incident.impacts')}
          rows={incident.impacts}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('ops.incident.noImpacts')} />}
          columns={[
            {
              id: 'customer',
              header: t('ops.incident.col.customer'),
              cell: (row) => row.customer.name,
            },
            {
              id: 'event',
              header: t('ops.incident.col.event'),
              cell: (row) =>
                row.tenderReference === null ? (
                  <span className="tiq-text-muted">{t('ops.incident.noEvent')}</span>
                ) : (
                  <Reference value={row.tenderReference} />
                ),
            },
            { id: 'impact', header: t('ops.incident.col.impact'), cell: (row) => row.impactNote },
            {
              id: 'decision',
              header: t('ops.incident.col.decision'),
              cell: (row) =>
                row.buyerDecisionNote === null ? (
                  <span className="tiq-text-warning">{t('ops.incident.decisionPending')}</span>
                ) : (
                  row.buyerDecisionNote
                ),
            },
          ]}
        />
      </Card>

      <Card title={t('ops.incident.timeline')} subtitle={t('ops.incident.timelineHint')}>
        <ActivityHistory
          entries={incident.timeline}
          timeZone={timeZone}
          label={t('ops.incident.timeline')}
        />
      </Card>

      <ConfirmActionDialog
        open={dialog === 'update'}
        title={t('ops.incident.updateTitle')}
        scope={scope}
        consequence={t('ops.incident.updateConsequence')}
        confirmLabel={t('ops.incident.postUpdate')}
        reason={{ label: t('ops.incident.updateNote'), required: true }}
        pending={postUpdate.pending}
        error={fieldErrorOnly(postUpdate.error)}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          if (status === 'resolved' && resolvedAt === null) {
            setMissing(true);
            return;
          }
          try {
            await postUpdate.mutate({
              params: { incidentId: incident.id },
              body: {
                status: status as (typeof SERVICE_INCIDENTS_STATUS)[number],
                note: reason,
                ...(notice !== (incident.customerNotice ?? '') && notice.trim() !== ''
                  ? { customerNotice: notice }
                  : {}),
                ...(status === 'resolved' && resolvedAt !== null ? { resolvedAt } : {}),
              },
            });
            toast.show(t('ops.incident.updated'), 'success');
            invalidateApiQueries('ops.operations.incidents.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <Select
          label={t('ops.incidents.col.status')}
          required
          value={status}
          onChange={setStatus}
          options={SERVICE_INCIDENTS_STATUS.map((value) => ({
            value,
            label: enumLabel('service_incidents.status', value),
          }))}
        />
        {status === 'resolved' && (
          <DateTimeInput
            label={t('ops.incidents.col.resolved')}
            timeZone={timeZone}
            required
            value={resolvedAt}
            onChange={setResolvedAt}
            error={missing && resolvedAt === null ? t('ops.common.required') : undefined}
          />
        )}
        <TextArea
          label={t('ops.incidents.field.notice')}
          hint={t('ops.incidents.field.noticeHint')}
          rows={3}
          value={notice}
          onChange={setNotice}
        />
        <ActionError error={postUpdate.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'impact'}
        title={t('ops.incident.impactTitle')}
        scope={scope}
        consequence={t('ops.incident.impactConsequence')}
        confirmLabel={t('ops.incident.addImpact')}
        pending={addImpact.pending}
        error={fieldErrorOnly(addImpact.error)}
        onCancel={close}
        onConfirm={async () => {
          if (customerId === '' || impactNote.trim() === '') {
            setMissing(true);
            return;
          }
          try {
            await addImpact.mutate({
              params: { incidentId: incident.id },
              body: {
                customerTenantId: Number(customerId),
                impactNote: impactNote.trim(),
                ...(tenderRef.trim() === '' ? {} : { tenderReference: tenderRef.trim() }),
              },
            });
            toast.show(t('ops.incident.impactAdded'), 'success');
            invalidateApiQueries('ops.operations.incidents.');
            setCustomerId('');
            setTenderRef('');
            setImpactNote('');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <Select
          label={t('ops.incident.col.customer')}
          required
          placeholder={t('ops.common.choose')}
          value={customerId}
          onChange={setCustomerId}
          options={(customers.data?.items ?? []).map((row) => ({
            value: String(row.tenantId),
            label: row.name,
          }))}
          error={missing && customerId === '' ? t('ops.common.required') : undefined}
        />
        <TextField
          label={t('ops.incident.col.event')}
          hint={t('ops.incident.eventHint')}
          value={tenderRef}
          onChange={setTenderRef}
        />
        <TextArea
          label={t('ops.incident.col.impact')}
          required
          rows={3}
          value={impactNote}
          onChange={setImpactNote}
          error={missing && impactNote.trim() === '' ? t('ops.common.required') : undefined}
        />
        <ActionError error={addImpact.error} />
      </ConfirmActionDialog>
    </>
  );
}
