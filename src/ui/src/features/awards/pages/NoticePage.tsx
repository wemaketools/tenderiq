/**
 * BUY-28 — One outcome notice: its type, version, lots, body, audience and disclosure review; each recipient's
 * delivery, opening, acknowledgment and terms acceptance (reading, acknowledging and accepting are distinct events,
 * BR-41). A draft is issued after a confirmed disclosure review; a failed delivery can be re-sent and never moves
 * a deadline by itself (BR-42).
 */
import { useState } from 'react';

import {
  getAwardOverview,
  getOutcomeNotice,
  issueOutcomeNotice,
  resendOutcomeNotice,
} from '@contracts/awards';
import type { NoticeRecipient, OutcomeNoticeDetail } from '@contracts/awards';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  OrDash,
  SkeletonBlock,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AwardFileLayout } from '../components/AwardFileLayout';
import { TextBlock } from '../components/TextBlock';
import { withAwardMessage } from '../lib/errors';
import { useIdParam, useLatest, useOfficialTimeZone } from '../lib/hooks';
import { lotNosLabel, yesNo } from '../lib/labels';
import { awardPaths } from '../lib/paths';

export default function NoticePage() {
  const tenderId = useIdParam('tenderId');
  const noticeId = useIdParam('noticeId');
  const overview = useApiQuery(
    getAwardOverview,
    tenderId === null ? null : { params: { tenderId } },
  );
  const query = useApiQuery(getOutcomeNotice, noticeId === null ? null : { params: { noticeId } });
  const [latest, setLatest] = useLatest<OutcomeNoticeDetail>(
    noticeId === null ? null : String(noticeId),
    (record) => String(record.noticeId),
  );
  const notice = latest ?? query.data;

  if (tenderId === null || noticeId === null) {
    return <EmptyState title={t('awards.notice.notFound')} icon="mail" />;
  }

  return (
    <AwardFileLayout
      tenderId={tenderId}
      overview={overview}
      title={notice?.title ?? t('awards.notice.title')}
      back={{ to: awardPaths.notices(tenderId), label: t('awards.notice.back') }}
    >
      {notice === undefined ? (
        query.error !== null ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : (
          <SkeletonBlock lines={8} />
        )
      ) : (
        <NoticeBody notice={notice} onChanged={setLatest} />
      )}
    </AwardFileLayout>
  );
}

function NoticeBody({
  notice,
  onChanged,
}: {
  readonly notice: OutcomeNoticeDetail;
  readonly onChanged: (notice: OutcomeNoticeDetail) => void;
}) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const canIssue = usePermission('notice.issue');
  const issue = useApiMutation(issueOutcomeNotice);
  const resend = useApiMutation(resendOutcomeNotice);
  const [issuing, setIssuing] = useState(false);
  const [resendTarget, setResendTarget] = useState<NoticeRecipient | null>(null);

  const scope = `${notice.title} · ${lotNosLabel(notice.lotNos)} · ${t('awards.notice.recipients', { count: notice.recipientCount })}`;

  const confirmIssue = async ({ reason }: { readonly reason: string }): Promise<void> => {
    try {
      const result = await issue.mutate({
        params: { noticeId: notice.noticeId },
        body: { disclosureReviewed: true, note: reason.trim() === '' ? undefined : reason.trim() },
      });
      setIssuing(false);
      onChanged(result);
      invalidateApiQueries('buyer.awards.');
      toast.show(t('awards.notice.issued'), 'success');
    } catch {
      // The dialog shows the error.
    }
  };

  const confirmResend = async (): Promise<void> => {
    if (resendTarget === null) return;
    try {
      const result = await resend.mutate({
        params: { noticeId: notice.noticeId, recipientId: resendTarget.recipientId },
      });
      onChanged({
        ...notice,
        recipients: notice.recipients.map((row) =>
          row.recipientId === result.recipient.recipientId ? result.recipient : row,
        ),
      });
      setResendTarget(null);
      toast.show(
        t('awards.notice.resent', { supplier: result.recipient.supplier.name }),
        'success',
      );
    } catch {
      // The dialog shows the error.
    }
  };

  const columns: DataTableColumn<NoticeRecipient>[] = [
    {
      id: 'supplier',
      header: t('awards.notice.col.supplier'),
      cell: (row) => (
        <>
          <span>{row.supplier.name}</span>
          <span className="tiq-cell-sub">
            {row.recipientUser?.fullName ?? t('awards.notice.organizationInbox')}
          </span>
        </>
      ),
    },
    {
      id: 'delivery',
      header: t('awards.notice.col.delivery'),
      cell: (row) => (
        <>
          <StatusChip
            enum="notice_recipients.delivery_status"
            value={row.deliveryStatus}
            size="sm"
          />
          {row.deliveredAt !== null && (
            <span className="tiq-cell-sub">{formatDateTime(row.deliveredAt, timeZone)}</span>
          )}
          {row.failureReason !== null && (
            <span className="tiq-cell-sub tiq-text-danger">{row.failureReason}</span>
          )}
        </>
      ),
    },
    {
      id: 'opened',
      header: t('awards.notice.col.opened'),
      cell: (row) =>
        row.openedAt === null ? <OrDash>{null}</OrDash> : formatDateTime(row.openedAt, timeZone),
    },
    {
      id: 'acknowledged',
      header: t('awards.notice.col.acknowledged'),
      cell: (row) =>
        row.acknowledgedAt === null ? (
          notice.requiresAcknowledgment ? (
            <span className="tiq-text-warning">{t('awards.notice.awaitingAck')}</span>
          ) : (
            <OrDash>{null}</OrDash>
          )
        ) : (
          <>
            <span>{formatDateTime(row.acknowledgedAt, timeZone)}</span>
            {row.acknowledgedBy !== null && (
              <span className="tiq-cell-sub">{row.acknowledgedBy.fullName}</span>
            )}
          </>
        ),
    },
    {
      id: 'terms',
      header: t('awards.notice.col.terms'),
      cell: (row) =>
        row.termsAcceptedAt === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          formatDateTime(row.termsAcceptedAt, timeZone)
        ),
    },
    {
      id: 'actions',
      header: t('awards.notice.col.actions'),
      cell: (row) =>
        canIssue && notice.status === 'issued' && row.deliveryStatus === 'failed' ? (
          <Button
            size="sm"
            icon="send"
            onClick={() => {
              resend.reset();
              setResendTarget(row);
            }}
          >
            {t('awards.notice.resend')}
          </Button>
        ) : (
          <OrDash>{null}</OrDash>
        ),
    },
  ];

  return (
    <div className="tiq-stack tiq-stack--spaced">
      {notice.status === 'draft' ? (
        <Banner
          tone="info"
          title={t('awards.notice.draftBanner')}
          actions={
            canIssue ? (
              <Button
                variant="primary"
                icon="send"
                onClick={() => {
                  issue.reset();
                  setIssuing(true);
                }}
              >
                {t('awards.notice.issue')}
              </Button>
            ) : undefined
          }
        >
          {t('awards.notice.draftBannerText')}
        </Banner>
      ) : notice.status === 'issued' ? (
        <Banner tone="success" title={t('awards.notice.issuedBanner')}>
          {notice.issuedAt === null
            ? null
            : t('awards.notice.issuedBannerText', {
                at: formatDateTime(notice.issuedAt, timeZone),
                name: notice.issuedBy?.fullName ?? t('awards.common.unknownPerson'),
              })}
        </Banner>
      ) : null}
      {notice.failedCount > 0 && (
        <Banner
          tone="warning"
          title={t('awards.notice.failedBanner', { count: notice.failedCount })}
        >
          {t('awards.notice.failedBannerText')}
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('awards.notice.bodyTitle')} subtitle={notice.audienceDescription}>
          <TextBlock text={notice.body} />
        </Card>
        <div className="tiq-stack tiq-stack--spaced">
          <Card title={t('awards.notice.detailsTitle')}>
            <DetailList
              stacked
              items={[
                {
                  label: t('awards.notice.type'),
                  value: <StatusChip enum="notices.notice_type" value={notice.noticeType} />,
                },
                {
                  label: t('awards.notice.status'),
                  value: <StatusChip enum="notices.status" value={notice.status} />,
                },
                {
                  label: t('awards.notice.version'),
                  value: t('awards.common.version', { no: notice.version }),
                },
                { label: t('awards.notice.lots'), value: lotNosLabel(notice.lotNos) },
                {
                  label: t('awards.notice.requiresAck'),
                  value: yesNo(notice.requiresAcknowledgment),
                },
                {
                  label: t('awards.notice.basis'),
                  value:
                    notice.periodStartBasis === null
                      ? t('awards.notice.noBasis')
                      : tEnum('notices.period_start_basis', notice.periodStartBasis),
                },
                {
                  label: t('awards.notice.approval'),
                  value:
                    notice.approvalRequestId === null
                      ? t('awards.notice.noApproval')
                      : t('awards.notice.approvalId', { id: notice.approvalRequestId }),
                },
              ]}
            />
          </Card>
          <Card title={t('awards.notice.disclosureTitle')}>
            <DetailList
              stacked
              items={[
                {
                  label: t('awards.notice.disclosureStatus'),
                  value: (
                    <span
                      className={
                        notice.disclosureReview.status === 'completed'
                          ? 'tiq-text-success'
                          : 'tiq-text-warning'
                      }
                    >
                      {t(`awards.notice.disclosure.${notice.disclosureReview.status}`)}
                    </span>
                  ),
                },
                {
                  label: t('awards.notice.reviewedBy'),
                  value:
                    notice.disclosureReview.reviewedBy === null
                      ? null
                      : `${notice.disclosureReview.reviewedBy.fullName}${
                          notice.disclosureReview.reviewedAt === null
                            ? ''
                            : ` · ${formatDateTime(notice.disclosureReview.reviewedAt, timeZone)}`
                        }`,
                },
                { label: t('awards.notice.reviewNote'), value: notice.disclosureReview.note },
              ]}
            />
          </Card>
        </div>
      </div>
      <Card
        title={t('awards.notice.recipientsTitle')}
        subtitle={t('awards.notice.recipientsSummary', {
          delivered: notice.deliveredCount,
          failed: notice.failedCount,
          acknowledged: notice.acknowledgedCount,
          total: notice.recipientCount,
        })}
        flush
      >
        <DataTable
          caption={t('awards.notice.recipientsTitle')}
          columns={columns}
          rows={notice.recipients}
          rowKey={(row) => String(row.recipientId)}
          empty={<EmptyState compact icon="users" title={t('awards.notice.noRecipients')} />}
        />
      </Card>

      <ConfirmActionDialog
        open={issuing}
        title={t('awards.notice.issueTitle')}
        scope={scope}
        consequence={t(
          notice.noticeType === 'intent_to_award'
            ? 'awards.notice.issueConsequenceIntent'
            : 'awards.notice.issueConsequence',
        )}
        confirmLabel={t('awards.notice.issue')}
        acknowledgement={t('awards.notice.issueAcknowledgement')}
        reason={{ label: t('awards.common.noteOptional'), required: false }}
        pending={issue.pending}
        error={withAwardMessage(issue.error)}
        onCancel={() => setIssuing(false)}
        onConfirm={confirmIssue}
      />
      <ConfirmActionDialog
        open={resendTarget !== null}
        title={t('awards.notice.resendTitle')}
        scope={`${notice.title} · ${resendTarget?.supplier.name ?? ''}`}
        consequence={t('awards.notice.resendConsequence')}
        confirmLabel={t('awards.notice.resend')}
        pending={resend.pending}
        error={withAwardMessage(resend.error)}
        onCancel={() => setResendTarget(null)}
        onConfirm={confirmResend}
      />
    </div>
  );
}
