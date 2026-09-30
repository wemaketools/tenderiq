/**
 * SUP-15 — Internal bid review and approval: the proposed revision, unresolved issues, commercial exposure, the
 * required approvers and the approval history. Approvers approve, reject, return or delegate within authority; an
 * approval applies to the exact revision content, and a material change invalidates it (BR-10). Internal approval is
 * not submission (AC-11).
 */
import { useState } from 'react';

import {
  decideInternalApproval,
  getInternalReview,
  requestInternalApproval,
} from '@contracts/bids';
import type {
  BidDetail,
  InternalApproval,
  InternalApprovalDecision,
  InternalReview,
} from '@contracts/bids';
import { BID_INTERNAL_APPROVALS_APPROVAL_TYPE } from '@contracts/enums';
import type { BidInternalApprovalsApprovalType, ChipTone } from '@contracts/enums';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  Dialog,
  EmptyState,
  ErrorState,
  FormErrorSummary,
  RestrictedState,
  Select,
  SkeletonBlock,
  StatusChip,
  TextArea,
  Timeline,
  formErrors,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn, TimelineTone } from '../../../components/ui';
import { formatDateTime, formatMoney, formatPercent } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ReadinessPanel } from '../components/ReadinessPanel';
import { ResponseWorkspace } from '../components/ResponseWorkspace';
import { responseErrorMessage, withResponseMessage } from '../lib/errors';
import { useCurrentUserId } from '../lib/hooks';

const STATE_TONE: Readonly<Record<string, ChipTone>> = {
  approved: 'success',
  pending: 'warning',
  invalidated: 'danger',
  missing: 'neutral',
  rejected: 'danger',
  returned: 'warning',
};

const HISTORY_TONE: Readonly<Record<string, TimelineTone>> = {
  approved: 'success',
  pending: 'warning',
  invalidated: 'danger',
  rejected: 'danger',
  returned: 'warning',
};

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

// ---------------------------------------------------------------------------------------------------------
// Request approval
// ---------------------------------------------------------------------------------------------------------

function RequestApprovalDialog({
  bid,
  review,
  open,
  onClose,
  onDone,
}: {
  readonly bid: BidDetail;
  readonly review: InternalReview;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onDone: (review: InternalReview) => void;
}) {
  const toast = useToast();
  const types = review.requiredApprovals
    .filter((row) => row.state !== 'approved' && row.state !== 'pending')
    .map((row) => row.approvalType);
  const initialTypes: readonly BidInternalApprovalsApprovalType[] =
    types.length > 0 ? types : BID_INTERNAL_APPROVALS_APPROVAL_TYPE;
  const [approvers, setApprovers] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const request = useApiMutation(requestInternalApproval);
  const errors = formErrors(request.error, ['approvers', 'note']);
  const chosen = initialTypes.flatMap((approvalType) => {
    const userId = approvers[approvalType];
    return userId === undefined || userId === ''
      ? []
      : [{ approvalType, approverUserId: Number(userId) }];
  });

  const submit = async (): Promise<void> => {
    try {
      const result = await request.mutate({
        params: { bidId: bid.id },
        body: {
          revisionId: review.revision.id,
          contentHash: review.revision.contentHash,
          approvers: chosen,
          ...(note.trim() === '' ? {} : { note: note.trim() }),
        },
      });
      toast.show(t('responses.review.requested'), 'success');
      onDone(result);
      onClose();
    } catch {
      // Shown in the dialog.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('responses.review.requestTitle')}
      description={t('responses.review.requestDescription', {
        no: review.revision.revisionNo,
        hash: shortHash(review.revision.contentHash),
      })}
      dismissible={!request.pending}
      footer={
        <>
          <Button onClick={onClose} disabled={request.pending}>
            {t('responses.common.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={request.pending}
            disabled={chosen.length === 0}
            onClick={() => void submit()}
          >
            {t('responses.review.requestConfirm')}
          </Button>
        </>
      }
    >
      <div className="tiq-stack">
        {initialTypes.map((approvalType) => (
          <Select
            key={approvalType}
            label={t('responses.review.approverFor', {
              type: tEnum('bid_internal_approvals.approval_type', approvalType),
            })}
            placeholder={t('responses.review.chooseApprover')}
            value={approvers[approvalType] ?? ''}
            options={review.eligibleApprovers.map((person) => ({
              value: String(person.userId),
              label: person.fullName,
            }))}
            onChange={(value) => setApprovers((current) => ({ ...current, [approvalType]: value }))}
            error={errors.forField('approvers')}
          />
        ))}
        <TextArea
          label={t('responses.review.note')}
          value={note}
          rows={3}
          onChange={setNote}
          error={errors.forField('note')}
        />
        {request.error !== null && (
          <FormErrorSummary title={responseErrorMessage(request.error)} errors={errors.other} />
        )}
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Decide
// ---------------------------------------------------------------------------------------------------------

function DecideDialog({
  bid,
  review,
  approval,
  decision,
  onClose,
  onDone,
}: {
  readonly bid: BidDetail;
  readonly review: InternalReview;
  readonly approval: InternalApproval;
  readonly decision: InternalApprovalDecision;
  readonly onClose: () => void;
  readonly onDone: (review: InternalReview) => void;
}) {
  const toast = useToast();
  const [delegate, setDelegate] = useState('');
  const decide = useApiMutation(decideInternalApproval);
  const needsReason = decision === 'reject' || decision === 'return';
  const type = tEnum('bid_internal_approvals.approval_type', approval.approvalType);

  const confirm = async ({ reason }: { readonly reason: string }): Promise<void> => {
    if (decision === 'delegate' && delegate === '') return;
    try {
      const result = await decide.mutate({
        params: { bidId: bid.id, approvalId: approval.id },
        body: {
          decision,
          contentHash: review.revision.contentHash,
          ...(reason === '' ? {} : { note: reason }),
          ...(decision === 'delegate' ? { delegateToUserId: Number(delegate) } : {}),
        },
      });
      toast.show(t(`responses.review.decided.${decision}`), 'success');
      onDone(result);
      onClose();
    } catch {
      // Shown in the dialog.
    }
  };

  return (
    <ConfirmActionDialog
      open
      title={t(`responses.review.decideTitle.${decision}`, { type })}
      scope={t('responses.review.decideScope', {
        reference: bid.tender.reference,
        no: review.revision.revisionNo,
        hash: shortHash(review.revision.contentHash),
      })}
      consequence={t(`responses.review.decideConsequence.${decision}`)}
      confirmLabel={t(`responses.review.decision.${decision}`)}
      tone={decision === 'reject' ? 'danger' : 'primary'}
      reason={{
        label: needsReason ? t('responses.review.reason') : t('responses.review.note'),
        required: needsReason,
      }}
      pending={decide.pending}
      error={withResponseMessage(decide.error)}
      onConfirm={confirm}
      onCancel={onClose}
    >
      {decision === 'delegate' && (
        <Select
          label={t('responses.review.delegateTo')}
          required
          placeholder={t('responses.review.chooseApprover')}
          value={delegate}
          options={review.eligibleApprovers
            .filter((person) => person.userId !== approval.approver.userId)
            .map((person) => ({ value: String(person.userId), label: person.fullName }))}
          onChange={setDelegate}
        />
      )}
    </ConfirmActionDialog>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------------------

function ReviewContent({
  bid,
  reloadBid,
}: {
  readonly bid: BidDetail;
  readonly reloadBid: () => void;
}) {
  const userId = useCurrentUserId();
  const query = useApiQuery(getInternalReview, { params: { bidId: bid.id }, query: {} });
  const [latest, setLatest] = useState<InternalReview | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [deciding, setDeciding] = useState<{
    readonly approval: InternalApproval;
    readonly decision: InternalApprovalDecision;
  } | null>(null);

  const review = latest ?? query.data;
  if (review === undefined) {
    return query.error !== null ? (
      <ErrorState error={query.error} onRetry={query.reload} />
    ) : (
      <SkeletonBlock lines={8} />
    );
  }
  const timeZone = bid.officialTimeZone;
  const exposure = review.commercialExposure;
  const reviewable =
    review.revision.status === 'draft' ||
    review.revision.status === 'internal_review' ||
    review.revision.status === 'approved_internally';
  const done = (next: InternalReview): void => {
    setLatest(next);
    reloadBid();
  };

  const columns: DataTableColumn<InternalApproval>[] = [
    {
      id: 'type',
      header: t('responses.review.col.type'),
      cell: (row) => tEnum('bid_internal_approvals.approval_type', row.approvalType),
    },
    {
      id: 'approver',
      header: t('responses.review.col.approver'),
      cell: (row) => (
        <>
          <span>{row.approver.fullName}</span>
          <span className="tiq-cell-sub">
            {t('responses.review.requestedBy', {
              name: row.requestedBy.fullName,
              time: formatDateTime(row.requestedAt, timeZone),
            })}
          </span>
        </>
      ),
    },
    {
      id: 'status',
      header: t('responses.review.col.status'),
      cell: (row) => (
        <>
          <StatusChip enum="bid_internal_approvals.status" value={row.status} />
          {row.decidedAt !== null && (
            <span className="tiq-cell-sub">{formatDateTime(row.decidedAt, timeZone)}</span>
          )}
          {row.invalidatedAt !== null && (
            <span className="tiq-cell-sub tiq-text-danger">
              {t('responses.review.invalidatedAt', {
                time: formatDateTime(row.invalidatedAt, timeZone),
              })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'note',
      header: t('responses.review.col.note'),
      cell: (row) => row.note ?? '',
    },
    {
      id: 'actions',
      header: t('responses.common.actions'),
      cell: (row) => {
        const mine =
          row.status === 'pending' && bid.viewer.canApprove && row.approver.userId === userId;
        if (!mine) return null;
        return (
          <span className="tiq-inline">
            {(['approve', 'return', 'reject', 'delegate'] as const).map((decision) => (
              <Button
                key={decision}
                size="sm"
                variant={
                  decision === 'approve'
                    ? 'primary'
                    : decision === 'reject'
                      ? 'danger-soft'
                      : 'secondary'
                }
                onClick={() => setDeciding({ approval: row, decision })}
              >
                {t(`responses.review.decision.${decision}`)}
              </Button>
            ))}
          </span>
        );
      },
    },
  ];

  return (
    <>
      {review.materialChangeSinceApproval && (
        <Banner tone="warning" title={t('responses.review.materialChangeTitle')}>
          <p>{t('responses.review.materialChangeDetail')}</p>
        </Banner>
      )}
      {review.revision.status === 'approved_internally' && (
        <Banner tone="info" title={t('responses.review.approvedNotSubmittedTitle')}>
          <p>{t('responses.review.approvedNotSubmittedDetail')}</p>
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          <Card
            title={t('responses.review.revisionTitle', { no: review.revision.revisionNo })}
            actions={
              bid.viewer.canEditResponse && reviewable ? (
                <Button size="sm" icon="send" onClick={() => setRequestOpen(true)}>
                  {t('responses.review.request')}
                </Button>
              ) : undefined
            }
          >
            <DetailList
              items={[
                {
                  label: t('responses.review.status'),
                  value: <StatusChip enum="bid_revisions.status" value={review.revision.status} />,
                },
                {
                  label: t('responses.review.contentHash'),
                  value: <span className="tiq-mono">{shortHash(review.revision.contentHash)}</span>,
                },
                {
                  label: t('responses.review.basedOn'),
                  value:
                    review.revision.basedOnRevisionNo === null
                      ? null
                      : t('responses.common.revisionNo', { no: review.revision.basedOnRevisionNo }),
                },
                {
                  label: t('responses.review.createdBy'),
                  value: t('responses.review.createdByValue', {
                    name: review.revision.createdBy.fullName,
                    time: formatDateTime(review.revision.createdAt, timeZone),
                  }),
                },
                {
                  label: t('responses.review.approvedAt'),
                  value:
                    review.revision.internallyApprovedAt === null
                      ? null
                      : formatDateTime(review.revision.internallyApprovedAt, timeZone),
                },
                {
                  label: t('responses.review.tenderVersion'),
                  value: t('responses.review.tenderVersionValue', {
                    no: review.revision.acknowledgedTenderVersion,
                    current: bid.currentTenderVersionNo,
                  }),
                },
              ]}
            />
          </Card>
          <Card
            title={t('responses.review.requiredTitle')}
            subtitle={t('responses.review.requiredSubtitle')}
          >
            {review.requiredApprovals.length === 0 ? (
              <EmptyState compact title={t('responses.review.noneRequired')} />
            ) : (
              <ul className="tiq-stack" aria-label={t('responses.review.requiredTitle')}>
                {review.requiredApprovals.map((row) => (
                  <li key={row.approvalType} className="tiq-inline">
                    <strong>
                      {tEnum('bid_internal_approvals.approval_type', row.approvalType)}
                    </strong>
                    <Chip tone={STATE_TONE[row.state] ?? 'neutral'}>
                      {t(`responses.review.state.${row.state}`)}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t('responses.review.approvalsTitle')} flush>
            <DataTable
              caption={t('responses.review.approvalsTitle')}
              columns={columns}
              rows={review.approvals}
              rowKey={(row) => String(row.id)}
              empty={<EmptyState compact title={t('responses.review.noApprovals')} />}
            />
          </Card>
          <Card title={t('responses.review.historyTitle')}>
            {review.history.length === 0 ? (
              <EmptyState compact title={t('responses.review.noHistory')} />
            ) : (
              <Timeline
                label={t('responses.review.historyTitle')}
                items={review.history.map((row) => ({
                  id: row.id,
                  tone: HISTORY_TONE[row.status] ?? 'neutral',
                  icon: row.status === 'approved' ? 'checkCircle' : 'clipboardCheck',
                  title: t('responses.review.historyItem', {
                    type: tEnum('bid_internal_approvals.approval_type', row.approvalType),
                    status: tEnum('bid_internal_approvals.status', row.status),
                    no: row.revisionNo,
                  }),
                  meta: `${row.approver.fullName} · ${formatDateTime(row.decidedAt ?? row.requestedAt, timeZone)}`,
                  detail: row.note ?? undefined,
                }))}
              />
            )}
          </Card>
        </div>
        <div className="tiq-stack">
          <Card title={t('responses.review.exposureTitle')}>
            {exposure.visible ? (
              <DetailList
                stacked
                items={[
                  {
                    label: t('responses.review.exposure.oneTime'),
                    value: formatMoney(exposure.totalOneTime),
                  },
                  ...exposure.recurring.map((row) => ({
                    key: row.recurrence,
                    label: t('responses.pricing.totals.recurring', {
                      recurrence: tEnum('pricing_items.recurrence', row.recurrence),
                    }),
                    value: formatMoney(row.gross),
                  })),
                  {
                    label: t('responses.review.exposure.validity'),
                    value:
                      exposure.validityDays === null
                        ? null
                        : t('responses.pricing.days', { count: exposure.validityDays }),
                  },
                  {
                    label: t('responses.review.exposure.exceptions'),
                    value: String(exposure.exceptionCount),
                  },
                  {
                    label: t('responses.review.exposure.deviations'),
                    value: String(exposure.deviationCount),
                  },
                  {
                    label: t('responses.review.exposure.subcontracted'),
                    value: formatPercent(exposure.subcontractedSharePercent),
                  },
                ]}
              />
            ) : (
              <>
                <RestrictedState compact description={t('responses.review.exposure.restricted')} />
                <DetailList
                  stacked
                  items={[
                    {
                      label: t('responses.review.exposure.exceptions'),
                      value: String(exposure.exceptionCount),
                    },
                    {
                      label: t('responses.review.exposure.deviations'),
                      value: String(exposure.deviationCount),
                    },
                  ]}
                />
              </>
            )}
          </Card>
          <ReadinessPanel
            readiness={review.readiness}
            timeZone={timeZone}
            title={t('responses.review.issuesTitle')}
          />
        </div>
      </div>
      <RequestApprovalDialog
        key={`${review.revision.contentHash}-${String(requestOpen)}`}
        bid={bid}
        review={review}
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        onDone={done}
      />
      {deciding !== null && (
        <DecideDialog
          bid={bid}
          review={review}
          approval={deciding.approval}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
          onDone={done}
        />
      )}
    </>
  );
}

export default function ReviewPage() {
  return (
    <ResponseWorkspace tab="review" title={t('responses.review.pageTitle')}>
      {(bid, reloadBid) => <ReviewContent bid={bid} reloadBid={reloadBid} />}
    </ResponseWorkspace>
  );
}
