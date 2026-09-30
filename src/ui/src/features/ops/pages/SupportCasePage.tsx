/**
 * OPS-04 support case: purpose (category), customer, messages, customer authorization and grants (permitted
 * records, duration), actions and resolution, with the support activity history. Actions: assign, reply (or add an
 * internal note), request temporary access, end access, route a procurement-merits case to the responsible buyer,
 * and move the case (in progress, awaiting customer, resolved, closed). No business impersonation: support never
 * submits, scores, approves or signs, and never decides deadlines or awards.
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import {
  BID_SUBMISSION_IN_TEXT,
  SUPPORT_CASE_STATUS_TARGETS,
  operationsEndpoints,
} from '@contracts/operations';
import type { SupportCaseDetail, SupportGrant } from '@contracts/operations';
import { enumLabel } from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  ConfirmActionDialog,
  DetailList,
  PageHeader,
  QueryView,
  Select,
  StatusChip,
  TextArea,
  useToast,
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { GrantsTable } from '../components/GrantsTable';
import { RequestGrantDialog } from '../components/RequestGrantDialog';
import { ActivityHistory, MessageThread } from '../components/shared';
import { fieldErrorOnly } from '../lib/errors';
import { personName } from '../lib/labels';
import { opsPaths } from '../lib/paths';
import { SUPPORT_MANAGE } from '../lib/permissions';
import { grantWindow } from '../lib/grants';
import { useOperatorStaffOptions } from '../lib/staff';
import { ActionError } from '../components/ActionError';

export default function SupportCasePage() {
  const { caseId } = useParams();
  const id = Number(caseId);
  const supportCase = useApiQuery(operationsEndpoints.getSupportCase, { params: { caseId: id } });
  return (
    <div className="tiq-page">
      {supportCase.data === undefined && (
        <PageHeader
          title={t('ops.case.title')}
          back={{ to: opsPaths.support, label: t('ops.support.title') }}
        />
      )}
      <QueryView query={supportCase}>{(data) => <CaseWorkspace supportCase={data} />}</QueryView>
    </div>
  );
}

type DialogKind = 'assign' | 'status' | 'route' | 'grant' | null;

function CaseWorkspace({ supportCase }: { readonly supportCase: SupportCaseDetail }) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canManage = usePermission(SUPPORT_MANAGE);
  const staff = useOperatorStaffOptions();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [assignee, setAssignee] = useState(String(supportCase.assignedOperator?.userId ?? ''));
  const [target, setTarget] = useState('');
  const [resolution, setResolution] = useState(supportCase.resolution ?? '');
  const [buyerId, setBuyerId] = useState('');
  const [missing, setMissing] = useState(false);
  const [message, setMessage] = useState('');
  const [internal, setInternal] = useState(false);
  const [ending, setEnding] = useState<SupportGrant | null>(null);
  const assign = useApiMutation(operationsEndpoints.assignSupportCase);
  const transition = useApiMutation(operationsEndpoints.transitionSupportCase);
  const route = useApiMutation(operationsEndpoints.routeSupportCaseToBuyer);
  const send = useApiMutation(operationsEndpoints.addSupportCaseMessage);
  const end = useApiMutation(operationsEndpoints.endSupportGrant);
  const buyers = useApiQuery(
    operationsEndpoints.listCustomers,
    dialog === 'route' ? { query: { kind: ['buyer'], pageSize: 100, sort: 'name' } } : null,
  );
  const closed = supportCase.status === 'closed';
  const scope = `${supportCase.reference} · ${supportCase.customer.name}`;
  const looksLikeBid = BID_SUBMISSION_IN_TEXT.test(message);

  const close = (): void => {
    setDialog(null);
    setMissing(false);
    assign.reset();
    transition.reset();
    route.reset();
  };

  const nextAction = (): string => {
    if (closed) return t('ops.case.next.closed');
    if (supportCase.assignedOperator === null) return t('ops.case.next.assign');
    if (supportCase.status === 'routed_to_buyer') return t('ops.case.next.routed');
    if (supportCase.grants.some((grant) => grant.status === 'requested'))
      return t('ops.case.next.awaitingAuthorization');
    if (supportCase.status === 'awaiting_customer') return t('ops.case.next.awaitingCustomer');
    return t('ops.case.next.assist');
  };

  const sendMessage = async (): Promise<void> => {
    if (message.trim() === '') {
      setMissing(true);
      return;
    }
    try {
      await send.mutate({
        params: { caseId: supportCase.id },
        body: { body: message.trim(), internal },
      });
      toast.show(internal ? t('ops.case.noteAdded') : t('ops.case.replySent'), 'success');
      setMessage('');
      setInternal(false);
      setMissing(false);
      invalidateApiQueries('ops.operations.supportCases.get');
    } catch {
      // Shown below the composer.
    }
  };

  return (
    <>
      <PageHeader
        title={`${supportCase.reference} ${supportCase.subject}`}
        back={{ to: opsPaths.support, label: t('ops.support.title') }}
        meta={
          <>
            <StatusChip enum="support_cases.status" value={supportCase.status} />
            <StatusChip enum="support_cases.category" value={supportCase.category} />
            <span>{supportCase.customer.name}</span>
            <span>
              {t('ops.customer.nextAction')}: {nextAction()}
            </span>
          </>
        }
        actions={
          canManage && !closed ? (
            <>
              <Button icon="userPlus" onClick={() => setDialog('assign')}>
                {t('ops.case.assign')}
              </Button>
              {supportCase.capabilities.canRouteToBuyer && (
                <Button icon="arrowRight" onClick={() => setDialog('route')}>
                  {t('ops.case.route')}
                </Button>
              )}
              {supportCase.capabilities.canRequestAccess && (
                <Button icon="key" onClick={() => setDialog('grant')}>
                  {t('ops.case.requestAccess')}
                </Button>
              )}
            </>
          ) : undefined
        }
        primaryAction={
          canManage && !closed ? (
            <Button variant="primary" icon="checkCircle" onClick={() => setDialog('status')}>
              {t('ops.case.changeStatus')}
            </Button>
          ) : undefined
        }
      />
      <Banner tone="info" title={t('ops.support.ruleTitle')}>
        <p>{t('ops.case.rule')}</p>
      </Banner>

      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('ops.case.purpose')}>
          <p>{supportCase.description}</p>
          {supportCase.resolution !== null && (
            <Banner tone="success" title={t('ops.case.resolution')}>
              <p>{supportCase.resolution}</p>
            </Banner>
          )}
        </Card>
        <Card title={t('ops.case.details')}>
          <DetailList
            stacked
            items={[
              {
                key: 'customer',
                label: t('ops.support.col.customer'),
                value: supportCase.customer.name,
              },
              {
                key: 'opened',
                label: t('ops.case.openedBy'),
                value: supportCase.openedBy.fullName,
              },
              {
                key: 'assignee',
                label: t('ops.support.col.assignee'),
                value: personName(supportCase.assignedOperator),
              },
              {
                key: 'routed',
                label: t('ops.case.routedTo'),
                value: supportCase.routedTo?.name ?? null,
              },
              {
                key: 'created',
                label: t('ops.support.col.opened'),
                value: formatDateTime(supportCase.createdAt, timeZone),
              },
              {
                key: 'updated',
                label: t('ops.support.col.updated'),
                value: formatDateTime(supportCase.updatedAt, timeZone),
              },
              {
                key: 'closed',
                label: t('ops.case.closedAt'),
                value:
                  supportCase.closedAt === null
                    ? null
                    : formatDateTime(supportCase.closedAt, timeZone),
              },
            ]}
          />
        </Card>
      </div>

      <Card flush title={t('ops.case.grants')} subtitle={t('ops.case.grantsHint')}>
        <GrantsTable
          rows={supportCase.grants}
          timeZone={timeZone}
          caption={t('ops.case.grants')}
          action={
            canManage
              ? (row) =>
                  row.status === 'active' ? (
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
                  ) : null
              : undefined
          }
        />
      </Card>

      <div className="tiq-grid tiq-grid--2">
        <Card title={t('ops.case.messages')} subtitle={t('ops.case.messagesHint')}>
          <MessageThread
            messages={supportCase.messages}
            timeZone={timeZone}
            label={t('ops.case.messages')}
          />
          {canManage && !closed && (
            <div className="tiq-stack">
              <TextArea
                label={t('ops.case.compose')}
                rows={3}
                value={message}
                onChange={setMessage}
                error={
                  missing && message.trim() === ''
                    ? t('ops.common.required')
                    : send.error?.fieldErrors.find((item) => item.field === 'body')?.message
                }
              />
              <Checkbox
                label={t('ops.case.internalNote')}
                hint={t('ops.case.internalHint')}
                checked={internal}
                onChange={setInternal}
              />
              {looksLikeBid && (
                <Banner tone="warning" title={t('ops.support.notSubmissionTitle')}>
                  <p>{t('ops.support.notSubmission')}</p>
                </Banner>
              )}
              <div className="tiq-inline">
                <Button
                  variant="primary"
                  icon="send"
                  loading={send.pending}
                  onClick={() => void sendMessage()}
                >
                  {internal ? t('ops.case.addNote') : t('ops.case.sendReply')}
                </Button>
              </div>
              <ActionError error={send.error} fields={['body']} />
            </div>
          )}
        </Card>
        <Card title={t('ops.case.activity')} subtitle={t('ops.case.activityHint')}>
          <ActivityHistory
            entries={supportCase.activity}
            timeZone={timeZone}
            label={t('ops.case.activity')}
          />
        </Card>
      </div>

      <ConfirmActionDialog
        open={dialog === 'assign'}
        title={t('ops.case.assignTitle')}
        scope={scope}
        consequence={t('ops.case.assignConsequence')}
        confirmLabel={t('ops.case.assign')}
        pending={assign.pending}
        error={fieldErrorOnly(assign.error)}
        onCancel={close}
        onConfirm={async () => {
          if (assignee === '') {
            setMissing(true);
            return;
          }
          try {
            await assign.mutate({
              params: { caseId: supportCase.id },
              body: { operatorUserId: Number(assignee) },
            });
            toast.show(t('ops.case.assigned'), 'success');
            invalidateApiQueries('ops.operations.supportCases.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <Select
          label={t('ops.support.col.assignee')}
          required
          placeholder={t('ops.common.choose')}
          value={assignee}
          onChange={setAssignee}
          options={staff}
          error={missing && assignee === '' ? t('ops.common.required') : undefined}
        />
        <ActionError error={assign.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'status'}
        title={t('ops.case.statusTitle')}
        scope={scope}
        consequence={
          target === ''
            ? t('ops.customer.status.chooseFirst')
            : t(`ops.case.statusConsequence.${target}`)
        }
        confirmLabel={t('ops.case.statusConfirm')}
        pending={transition.pending}
        error={fieldErrorOnly(transition.error)}
        onCancel={close}
        onConfirm={async () => {
          if (target === '') {
            setMissing(true);
            return;
          }
          try {
            await transition.mutate({
              params: { caseId: supportCase.id },
              body: {
                status: target as (typeof SUPPORT_CASE_STATUS_TARGETS)[number],
                ...(resolution.trim() === '' ? {} : { resolution: resolution.trim() }),
              },
            });
            toast.show(t('ops.case.statusChanged'), 'success');
            invalidateApiQueries('ops.operations.supportCases.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <Select
          label={t('ops.case.statusTarget')}
          required
          placeholder={t('ops.common.choose')}
          value={target}
          onChange={setTarget}
          options={SUPPORT_CASE_STATUS_TARGETS.filter(
            (status) => status !== supportCase.status,
          ).map((status) => ({
            value: status,
            label: enumLabel('support_cases.status', status),
          }))}
          error={missing && target === '' ? t('ops.common.required') : undefined}
        />
        <TextArea
          label={t('ops.case.resolution')}
          hint={t('ops.case.resolutionHint')}
          rows={3}
          value={resolution}
          onChange={setResolution}
          required={target === 'resolved' || target === 'closed'}
        />
        {supportCase.category === 'procurement_merits' && (
          <Banner tone="warning" title={t('ops.support.meritsTitle')}>
            <p>{t('ops.support.merits')}</p>
          </Banner>
        )}
        <ActionError error={transition.error} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'route'}
        title={t('ops.case.routeTitle')}
        scope={scope}
        consequence={t('ops.case.routeConsequence')}
        confirmLabel={t('ops.case.route')}
        reason={{ label: t('ops.case.routeNote'), required: true }}
        pending={route.pending}
        error={fieldErrorOnly(route.error)}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          if (buyerId === '') {
            setMissing(true);
            return;
          }
          try {
            await route.mutate({
              params: { caseId: supportCase.id },
              body: { buyerTenantId: Number(buyerId), note: reason },
            });
            toast.show(t('ops.case.routed'), 'success');
            invalidateApiQueries('ops.operations.supportCases.');
            close();
          } catch {
            // Shown in the dialog.
          }
        }}
      >
        <Select
          label={t('ops.case.routeBuyer')}
          required
          placeholder={t('ops.common.choose')}
          value={buyerId}
          onChange={setBuyerId}
          options={(buyers.data?.items ?? []).map((row) => ({
            value: String(row.tenantId),
            label: row.name,
          }))}
          error={missing && buyerId === '' ? t('ops.common.required') : undefined}
        />
        <ActionError error={route.error} />
      </ConfirmActionDialog>

      {dialog === 'grant' && <RequestGrantDialog supportCase={supportCase} onClose={close} />}

      <ConfirmActionDialog
        open={ending !== null}
        title={t('ops.grants.endTitle')}
        scope={ending === null ? '' : `${scope} · ${grantWindow(ending, timeZone)}`}
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
    </>
  );
}
