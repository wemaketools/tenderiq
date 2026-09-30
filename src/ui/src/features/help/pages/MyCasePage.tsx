/**
 * COM-09 personal service case: the case the person opened for one of their organizations, its status, routing to
 * the responsible buyer, the conversation with support (never internal notes) and every access request made on the
 * organization's behalf. Action: reply. Support is never a submission channel; a reply that looks like a bid is
 * flagged and refused.
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { BID_SUBMISSION_IN_TEXT, operationsEndpoints } from '@contracts/operations';
import type { MySupportCaseDetail } from '@contracts/operations';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Button,
  Card,
  DetailList,
  PageHeader,
  QueryView,
  StatusChip,
  TextArea,
  useToast,
} from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { GrantsTable } from '../../ops/components/GrantsTable';
import { MessageThread } from '../../ops/components/shared';
import { helpPaths } from '../lib/paths';
import { ActionError } from '../../ops/components/ActionError';

export default function MyCasePage() {
  const { caseId } = useParams();
  const supportCase = useApiQuery(operationsEndpoints.getMySupportCase, {
    params: { caseId: Number(caseId) },
  });
  return (
    <div className="tiq-page">
      {supportCase.data === undefined && (
        <PageHeader
          title={t('help.case.title')}
          back={{ to: helpPaths.home, label: t('help.title') }}
        />
      )}
      <QueryView query={supportCase}>{(data) => <CaseView supportCase={data} />}</QueryView>
    </div>
  );
}

function CaseView({ supportCase }: { readonly supportCase: MySupportCaseDetail }) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [reply, setReply] = useState('');
  const [missing, setMissing] = useState(false);
  const send = useApiMutation(operationsEndpoints.replyMySupportCase);
  const closed = supportCase.status === 'closed';
  const looksLikeBid = BID_SUBMISSION_IN_TEXT.test(reply);

  const submit = async (): Promise<void> => {
    if (reply.trim() === '') {
      setMissing(true);
      return;
    }
    try {
      await send.mutate(
        { params: { caseId: supportCase.id }, body: { body: reply.trim() } },
        { tenantId: supportCase.organization.tenantId },
      );
      toast.show(t('help.case.replySent'), 'success');
      setReply('');
      setMissing(false);
      invalidateApiQueries('me.operations.supportCases.');
    } catch {
      // Shown below the composer.
    }
  };

  return (
    <>
      <PageHeader
        title={`${supportCase.reference} ${supportCase.subject}`}
        back={{ to: helpPaths.home, label: t('help.title') }}
        meta={
          <>
            <StatusChip enum="support_cases.status" value={supportCase.status} />
            <StatusChip enum="support_cases.category" value={supportCase.category} />
            <span>{supportCase.organization.tenantName}</span>
            <span>
              {t('ops.customer.nextAction')}:{' '}
              {closed
                ? t('help.case.next.closed')
                : supportCase.status === 'awaiting_customer'
                  ? t('help.case.next.reply')
                  : supportCase.status === 'routed_to_buyer'
                    ? t('help.case.next.buyer')
                    : t('help.case.next.support')}
            </span>
          </>
        }
      />
      {supportCase.routedTo !== null && (
        <Banner tone="info" title={t('help.case.routedTitle', { name: supportCase.routedTo.name })}>
          <p>{t('help.case.routed')}</p>
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('help.case.request')}>
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
                key: 'org',
                label: t('help.cases.col.organization'),
                value: supportCase.organization.tenantName,
              },
              {
                key: 'opened',
                label: t('help.cases.col.opened'),
                value: formatDateTime(supportCase.createdAt, timeZone),
              },
              {
                key: 'updated',
                label: t('help.cases.col.updated'),
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
      <Card title={t('ops.case.messages')}>
        <MessageThread
          messages={supportCase.messages}
          timeZone={timeZone}
          label={t('ops.case.messages')}
        />
        {!closed && (
          <div className="tiq-stack">
            <TextArea
              label={t('help.case.reply')}
              rows={4}
              value={reply}
              onChange={setReply}
              error={
                missing && reply.trim() === ''
                  ? t('ops.common.required')
                  : send.error?.fieldErrors.find((item) => item.field === 'body')?.message
              }
            />
            {looksLikeBid && (
              <Banner tone="error" title={t('ops.support.notSubmissionTitle')}>
                <p>{t('ops.errors.SUPPORT_NOT_SUBMISSION_CHANNEL')}</p>
              </Banner>
            )}
            <div className="tiq-inline">
              <Button
                variant="primary"
                icon="send"
                loading={send.pending}
                onClick={() => void submit()}
              >
                {t('help.case.send')}
              </Button>
            </div>
            <ActionError error={send.error} fields={['body']} />
          </div>
        )}
      </Card>
      <Card flush title={t('help.case.grants')} subtitle={t('help.case.grantsHint')}>
        <GrantsTable
          rows={supportCase.grants}
          timeZone={timeZone}
          caption={t('help.case.grants')}
        />
      </Card>
    </>
  );
}
