/**
 * SUP-16 — Final review and submission: the exact revision, legal party, lots, final declaration, readiness checks,
 * the official deadline and the consequences of submission. Only a caller holding `supplier.response.submit` may
 * submit; a contributor sees why not and who can (AC-03). The deliberate submission confirms organization, capacity,
 * scope and result (COM-02), reports progress through an aria-live region and ends with the official receipt or a
 * clear failure. Draft readiness or internal approval is never displayed as submission (AC-11); a failed or late
 * replacement leaves the earlier receipt effective (AC-12, AC-13). Once the receipt is issued, the result is
 * authoritative for the whole view: the header, status, next action and effective offer come from it, and the
 * pre-submission preview gives way to the receipt, its inventory and the route to the response history.
 */
import { useState } from 'react';
import { Link } from 'react-router';

import { getSubmissionPreview, listSubmissionAttempts, submitBid } from '@contracts/bids';
import type {
  BidDetail,
  SubmissionAttempt,
  SubmissionPreview,
  SubmissionResult,
} from '@contracts/bids';

import type { ApiError } from '../../../api/client';
import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  OfficialDeadline,
  Reference,
  SkeletonBlock,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatBytes, formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { EffectiveOfferBanner } from '../components/EffectiveOfferBanner';
import { ReadinessPanel } from '../components/ReadinessPanel';
import { ReceiptDownloadButton } from '../components/ReceiptDownloadButton';
import { ResponseWorkspace } from '../components/ResponseWorkspace';
import { responseErrorMessage } from '../lib/errors';
import { useActingContext } from '../lib/hooks';
import { bidAfterSubmission } from '../lib/outcome';
import { responsePaths } from '../lib/paths';
import { formatOfficialReceiptTime } from '../lib/time';

type Stage =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'succeeded'; readonly result: SubmissionResult }
  | { readonly kind: 'failed'; readonly error: ApiError };

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

function SubmissionProgress({
  stage,
  preview,
  timeZone,
}: {
  readonly stage: Stage;
  readonly preview: SubmissionPreview;
  readonly timeZone: string;
}) {
  const earlier = preview.effectiveOffer.receipt;
  return (
    <div role="status" aria-live="polite" aria-atomic="true" data-testid="submission-progress">
      {stage.kind === 'submitting' && (
        <Banner tone="info" title={t('responses.submit.progress.submitting')}>
          <p>{t('responses.submit.progress.submittingDetail')}</p>
        </Banner>
      )}
      {stage.kind === 'succeeded' && (
        <Banner
          tone="success"
          title={t('responses.submit.progress.succeeded', {
            receiptNo: stage.result.receipt.receiptNo,
          })}
          actions={
            <ReceiptDownloadButton
              receiptId={stage.result.receipt.id}
              receiptNo={stage.result.receipt.receiptNo}
            />
          }
        >
          <p>
            {t('responses.submit.progress.succeededDetail', {
              time: formatOfficialReceiptTime(stage.result.receipt.receivedAt, timeZone),
              no: stage.result.receipt.revisionNo,
            })}
          </p>
          {stage.result.supersededReceiptId !== null && (
            <p>{t('responses.submit.progress.superseded')}</p>
          )}
          <p>{t('responses.receipt.notCompliance')}</p>
        </Banner>
      )}
      {stage.kind === 'failed' && (
        <Banner
          tone="error"
          title={
            stage.error.code === 'SUBMISSION_LATE'
              ? t('responses.submit.progress.late')
              : t('responses.submit.progress.failed')
          }
        >
          <p>{responseErrorMessage(stage.error)}</p>
          <p>
            {earlier === null
              ? t('responses.submit.progress.noReceipt')
              : t('responses.submit.progress.earlierEffective', { receiptNo: earlier.receiptNo })}
          </p>
          {stage.error.correlationId !== null && (
            <p className="tiq-mono">
              {t('responses.common.correlation', { id: stage.error.correlationId })}
            </p>
          )}
        </Banner>
      )}
    </div>
  );
}

function ReceiptResult({
  result,
  timeZone,
}: {
  readonly result: SubmissionResult;
  readonly timeZone: string;
}) {
  const receipt = result.receipt;
  return (
    <Card
      title={t('responses.receipt.officialTitle', { receiptNo: receipt.receiptNo })}
      subtitle={t('responses.receipt.notCompliance')}
      actions={
        <span className="tiq-inline">
          <Link to={responsePaths.receipt(receipt.id)}>{t('responses.receipt.open')}</Link>
          <ButtonLink to={responsePaths.history(receipt.bidId)} icon="history">
            {t('responses.submit.toHistory')}
          </ButtonLink>
        </span>
      }
    >
      <DetailList
        items={[
          {
            label: t('responses.receipt.receivedAt'),
            value: formatOfficialReceiptTime(receipt.receivedAt, timeZone),
          },
          {
            label: t('responses.receipt.status'),
            value: <StatusChip enum="submission_receipts.status" value={receipt.status} />,
          },
          { label: t('responses.receipt.legalParty'), value: receipt.legalParty.legalName },
          { label: t('responses.receipt.lots'), value: receipt.lotsSummary },
          {
            label: t('responses.receipt.revision'),
            value: t('responses.common.revisionNo', { no: receipt.revisionNo }),
          },
          { label: t('responses.receipt.documents'), value: String(receipt.inventory.length) },
        ]}
      />
    </Card>
  );
}

function AttemptsCard({ bid }: { readonly bid: BidDetail }) {
  const query = useApiQuery(listSubmissionAttempts, {
    params: { bidId: bid.id },
    query: { sort: 'startedAt', dir: 'desc', pageSize: 5 },
  });
  const columns: DataTableColumn<SubmissionAttempt>[] = [
    {
      id: 'started',
      header: t('responses.attempts.col.started'),
      cell: (row) => formatDateTime(row.startedAt, bid.officialTimeZone),
    },
    {
      id: 'outcome',
      header: t('responses.attempts.col.outcome'),
      cell: (row) => (
        <StatusChip enum="submission_attempts.outcome" value={row.outcome} size="sm" />
      ),
    },
    {
      id: 'receipt',
      header: t('responses.attempts.col.receipt'),
      cell: (row) =>
        row.receiptNo === null || row.receiptId === null ? (
          t('responses.attempts.noReceipt')
        ) : (
          <Reference value={row.receiptNo} to={responsePaths.receipt(row.receiptId)} />
        ),
    },
  ];
  return (
    <Card title={t('responses.attempts.recentTitle')} flush>
      <DataTable
        caption={t('responses.attempts.recentTitle')}
        columns={columns}
        rows={query.data?.items}
        rowKey={(row) => String(row.id)}
        loading={query.isFetching}
        error={query.error}
        onRetry={query.reload}
        empty={<EmptyState compact title={t('responses.attempts.empty')} />}
      />
    </Card>
  );
}

function SubmitContent({
  bid,
  applyBid,
}: {
  readonly bid: BidDetail;
  readonly applyBid: (bid: BidDetail) => void;
}) {
  const acting = useActingContext();
  const query = useApiQuery(getSubmissionPreview, { params: { bidId: bid.id } });
  const submit = useApiMutation(submitBid);
  const [confirming, setConfirming] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });

  const preview = query.data;
  if (preview === undefined) {
    return query.error !== null ? (
      <ErrorState error={query.error} onRetry={query.reload} />
    ) : (
      <SkeletonBlock lines={8} />
    );
  }
  const timeZone = preview.deadline.timeZone;
  const revision = preview.revision;
  const readinessBlocked = preview.readiness !== null && !preview.readiness.ready;
  const canSubmitNow =
    preview.authority.canSubmit &&
    revision !== null &&
    preview.submissionWindowOpen &&
    !readinessBlocked &&
    acting !== null &&
    stage.kind !== 'succeeded';
  const lotsLabel = preview.lots
    .map((lot) => t('responses.lots.option', { no: lot.lotNo, title: lot.title }))
    .join('; ');
  const submitterNames = preview.authority.authorizedSubmitters
    .map((person) => person.fullName)
    .join(', ');
  const representative = preview.representative;

  const confirm = async (): Promise<void> => {
    if (revision === null || acting === null) return;
    setConfirming(false);
    setStage({ kind: 'submitting' });
    try {
      const result = await submit.mutate({
        params: { bidId: bid.id },
        body: {
          revisionId: revision.id,
          contentHash: revision.contentHash,
          confirmation: acting,
          finalDeclarationAccepted: true,
          ...(preview.isReplacement ? { replacementAcknowledged: true } : {}),
        },
      });
      setStage({ kind: 'succeeded', result });
      // The receipt is the official outcome: the view shows it rather than re-reading pre-submission state.
      applyBid(bidAfterSubmission(bid, result));
    } catch (caught) {
      setStage({ kind: 'failed', error: caught as ApiError });
    }
  };

  if (stage.kind === 'succeeded') {
    return (
      <>
        <span className="tiq-inline">
          {t('responses.submit.officialStatus')}
          <StatusChip enum="bids.submission_state" value={bid.submissionState} />
        </span>
        <SubmissionProgress stage={stage} preview={preview} timeZone={timeZone} />
        <EffectiveOfferBanner offer={bid.effectiveOffer} timeZone={timeZone} />
        <ReceiptResult result={stage.result} timeZone={timeZone} />
        <Card title={t('responses.receipt.inventoryTitle')} flush>
          <DataTable
            caption={t('responses.receipt.inventoryTitle')}
            columns={[
              { id: 'file', header: t('responses.receipt.col.file'), cell: (row) => row.fileName },
              {
                id: 'envelope',
                header: t('responses.receipt.col.envelope'),
                cell: (row) => tEnum('receipt_inventory_items.envelope', row.envelope),
              },
              {
                id: 'size',
                header: t('responses.receipt.col.size'),
                numeric: true,
                cell: (row) => formatBytes(row.sizeBytes),
              },
              {
                id: 'hash',
                header: t('responses.receipt.col.hash'),
                cell: (row) => <span className="tiq-mono">{shortHash(row.sha256)}</span>,
              },
            ]}
            rows={stage.result.receipt.inventory}
            rowKey={(row) => String(row.id)}
            empty={<EmptyState compact title={t('responses.receipt.noInventory')} />}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="tiq-inline">
        {canSubmitNow && (
          <Button
            variant="primary"
            icon="send"
            onClick={() => setConfirming(true)}
            loading={submit.pending}
          >
            {preview.isReplacement
              ? t('responses.submit.submitReplacement')
              : t('responses.submit.submit')}
          </Button>
        )}
        <span className="tiq-inline">
          {t('responses.submit.officialStatus')}
          <StatusChip enum="bids.submission_state" value={bid.submissionState} />
        </span>
      </div>
      <SubmissionProgress stage={stage} preview={preview} timeZone={timeZone} />
      {revision?.status === 'approved_internally' && (
        <Banner tone="warning" title={t('responses.submit.approvedNotSubmittedTitle')}>
          <p>{t('responses.submit.approvedNotSubmittedDetail')}</p>
        </Banner>
      )}
      {!preview.authority.canSubmit && (
        <Banner tone="warning" title={t('responses.submit.cannotSubmitTitle')}>
          <ul>
            {preview.authority.blockReasons.map((reason) => (
              <li key={reason}>{t(`responses.submit.block.${reason}`)}</li>
            ))}
          </ul>
          {preview.authority.authorizedSubmitters.length > 0 && (
            <p>{t('responses.submit.whoCan', { names: submitterNames })}</p>
          )}
        </Banner>
      )}
      {preview.authority.canSubmit && readinessBlocked && (
        <Banner tone="error" title={t('responses.submit.blockedTitle')}>
          <p>
            {t('responses.submit.blockedDetail', {
              count: preview.readiness?.blockingCount ?? 0,
            })}
          </p>
        </Banner>
      )}
      <EffectiveOfferBanner offer={preview.effectiveOffer} timeZone={timeZone} />
      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          <Card
            title={t('responses.submit.whatTitle')}
            subtitle={t('responses.submit.whatSubtitle')}
          >
            <DetailList
              items={[
                {
                  label: t('responses.submit.revision'),
                  value:
                    revision === null ? (
                      t('responses.submit.noRevision')
                    ) : (
                      <span className="tiq-inline">
                        {t('responses.common.revisionNo', { no: revision.revisionNo })}
                        <StatusChip enum="bid_revisions.status" value={revision.status} size="sm" />
                      </span>
                    ),
                },
                {
                  label: t('responses.review.contentHash'),
                  value:
                    revision === null ? null : (
                      <span className="tiq-mono">{shortHash(revision.contentHash)}</span>
                    ),
                },
                { label: t('responses.submit.legalParty'), value: preview.legalParty.legalName },
                {
                  label: t('responses.submit.representative'),
                  value:
                    representative === null
                      ? t('responses.submit.representativeOther', { names: submitterNames })
                      : `${representative.fullName}${representative.capacity === null ? '' : ` (${representative.capacity})`}`,
                },
                { label: t('responses.submit.lots'), value: lotsLabel },
                {
                  label: t('responses.submit.tender'),
                  value: `${preview.tender.reference} ${preview.tender.title}`,
                },
                {
                  label: t('responses.submit.replacement'),
                  value: preview.isReplacement
                    ? t('responses.answer.yes')
                    : t('responses.answer.no'),
                },
              ]}
            />
          </Card>
          <Card
            title={t('responses.submit.declarationTitle')}
            subtitle={t('responses.submit.declarationSubtitle')}
          >
            <p>
              {t('responses.submit.declarationText', {
                party: preview.legalParty.legalName,
                name:
                  representative === null
                    ? t('responses.submit.declarationSubmitters', { names: submitterNames })
                    : representative.fullName,
                reference: preview.tender.reference,
                lots: lotsLabel,
                no: revision?.revisionNo ?? 0,
                days: preview.finalDeclaration.bidValidityDays,
                version: preview.finalDeclaration.tenderVersionNo,
                terms: preview.finalDeclaration.termsReference,
              })}
            </p>
            <DetailList
              items={[
                {
                  label: t('responses.submit.validity'),
                  value: t('responses.pricing.days', {
                    count: preview.finalDeclaration.bidValidityDays,
                  }),
                },
                {
                  label: t('responses.submit.tenderVersion'),
                  value: String(preview.finalDeclaration.tenderVersionNo),
                },
                {
                  label: t('responses.submit.terms'),
                  value: preview.finalDeclaration.termsReference,
                },
                {
                  label: t('responses.submit.exceptions'),
                  value: String(preview.finalDeclaration.outstandingExceptionCount),
                },
                {
                  label: t('responses.submit.deviations'),
                  value: String(preview.finalDeclaration.deviationCount),
                },
              ]}
            />
          </Card>
          {preview.readiness === null ? (
            <Card title={t('responses.readiness.title')}>
              <EmptyState compact title={t('responses.submit.noReadiness')} />
            </Card>
          ) : (
            <ReadinessPanel readiness={preview.readiness} timeZone={timeZone} />
          )}
        </div>
        <div className="tiq-stack">
          <Card title={t('responses.submit.deadlineTitle')}>
            <OfficialDeadline
              deadline={preview.deadline}
              variant="block"
              label={t('responses.submit.deadlineLabel')}
              showRemaining={preview.submissionWindowOpen}
            />
            <p className="tiq-text-muted">
              {preview.submissionWindowOpen
                ? t('responses.submit.windowOpen')
                : t('responses.submit.windowClosed')}
            </p>
          </Card>
          <Card title={t('responses.submit.consequencesTitle')}>
            <ul className="tiq-stack">
              <li>{t('responses.submit.consequence.receipt')}</li>
              <li>{t('responses.submit.consequence.finalReceipt')}</li>
              <li>
                {preview.isReplacement
                  ? t('responses.submit.consequence.replacement', {
                      receiptNo: preview.effectiveOffer.receipt?.receiptNo ?? '',
                    })
                  : t('responses.submit.consequence.first')}
              </li>
              <li>{t('responses.submit.consequence.notCompliance')}</li>
            </ul>
          </Card>
          <Card title={t('responses.submit.authorityTitle')}>
            <DetailList
              stacked
              items={[
                {
                  label: t('responses.submit.youCan'),
                  value: preview.authority.canSubmit
                    ? t('responses.answer.yes')
                    : t('responses.answer.no'),
                },
                {
                  label: t('responses.submit.authorized'),
                  value: submitterNames,
                },
              ]}
            />
          </Card>
          <AttemptsCard bid={bid} />
        </div>
      </div>
      <ConfirmActionDialog
        open={confirming}
        title={
          preview.isReplacement
            ? t('responses.submit.confirmReplacementTitle')
            : t('responses.submit.confirmTitle')
        }
        scope={t('responses.submit.confirmScope', {
          reference: preview.tender.reference,
          title: preview.tender.title,
          lots: lotsLabel,
          no: revision?.revisionNo ?? 0,
          party: preview.legalParty.legalName,
        })}
        consequence={
          preview.isReplacement
            ? t('responses.submit.confirmConsequenceReplacement', {
                receiptNo: preview.effectiveOffer.receipt?.receiptNo ?? '',
              })
            : t('responses.submit.confirmConsequence')
        }
        acknowledgement={
          preview.isReplacement
            ? t('responses.submit.acknowledgeReplacement', {
                receiptNo: preview.effectiveOffer.receipt?.receiptNo ?? '',
              })
            : t('responses.submit.acknowledge')
        }
        confirmLabel={t('responses.submit.confirm')}
        pending={submit.pending}
        onConfirm={confirm}
        onCancel={() => setConfirming(false)}
      >
        <OfficialDeadline
          deadline={preview.deadline}
          variant="block"
          label={t('responses.submit.deadlineLabel')}
        />
        {revision !== null && (
          <p className="tiq-text-muted">{t('responses.submit.inventoryNote')}</p>
        )}
      </ConfirmActionDialog>
    </>
  );
}

export default function SubmitPage() {
  return (
    <ResponseWorkspace tab="submit" title={t('responses.submit.pageTitle')}>
      {(bid, _reloadBid, applyBid) => <SubmitContent bid={bid} applyBid={applyBid} />}
    </ResponseWorkspace>
  );
}
