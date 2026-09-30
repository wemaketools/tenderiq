/**
 * SUP-17 — Receipts, revision history and withdrawal of one response: official receipts, submission times,
 * inventories, the effective revision, superseded editions, every attempt with its true completion time, and the
 * withdrawal status. The supplier downloads receipts, prepares a replacement while permitted (the effective receipt
 * stays effective until a replacement succeeds, BR-19) or explicitly withdraws with a confirmation number (AC-14).
 * After a withdrawal the result is authoritative for the view: the header, the effective-offer explanation, the
 * receipts, revisions and withdrawals all show the withdrawal, and nothing still reads as effective.
 * Receipt, submission and attempt times render to the second with the official offset (BR-20, AC-13).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  createRevision,
  listBidReceipts,
  listRevisions,
  listSubmissionAttempts,
  listWithdrawals,
  withdrawBid,
} from '@contracts/bids';
import type {
  BidDetail,
  BidRevision,
  ReceiptSummary,
  SubmissionAttempt,
  Withdrawal,
  WithdrawalResult,
} from '@contracts/bids';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  KpiCard,
  KpiGrid,
  OrDash,
  Reference,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { EffectiveOfferBanner } from '../components/EffectiveOfferBanner';
import { ReceiptDownloadButton } from '../components/ReceiptDownloadButton';
import { ResponseWorkspace } from '../components/ResponseWorkspace';
import { withResponseMessage } from '../lib/errors';
import { useActingContext } from '../lib/hooks';
import {
  bidAfterWithdrawal,
  receiptsAfterWithdrawal,
  revisionsAfterWithdrawal,
  withdrawalsAfter,
} from '../lib/outcome';
import { responsePaths } from '../lib/paths';
import { formatOfficialReceiptTime, formatReceiptTime } from '../lib/time';

function HistoryContent({
  bid,
  reloadBid,
  applyBid,
}: {
  readonly bid: BidDetail;
  readonly reloadBid: () => void;
  readonly applyBid: (bid: BidDetail) => void;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const acting = useActingContext();
  const timeZone = bid.officialTimeZone;
  const receipts = useApiQuery(listBidReceipts, {
    params: { bidId: bid.id },
    query: { sort: 'receivedAt', dir: 'desc', pageSize: 100 },
  });
  const revisions = useApiQuery(listRevisions, {
    params: { bidId: bid.id },
    query: { sort: 'revisionNo', dir: 'desc', pageSize: 100 },
  });
  const attempts = useApiQuery(listSubmissionAttempts, {
    params: { bidId: bid.id },
    query: { sort: 'startedAt', dir: 'desc', pageSize: 100 },
  });
  const withdrawals = useApiQuery(listWithdrawals, {
    params: { bidId: bid.id },
    query: { sort: 'withdrawnAt', dir: 'desc' },
  });
  const create = useApiMutation(createRevision);
  const withdraw = useApiMutation(withdrawBid);
  const [dialog, setDialog] = useState<'replace' | 'withdraw' | null>(null);
  const [withdrawn, setWithdrawn] = useState<WithdrawalResult | null>(null);

  const effective = bid.effectiveReceipt;
  const loadedReceipts = receipts.data?.items;
  const receiptRows =
    loadedReceipts === undefined || withdrawn === null
      ? loadedReceipts
      : receiptsAfterWithdrawal(loadedReceipts, withdrawn);
  const loadedRevisions = revisions.data?.items;
  const revisionRows =
    loadedRevisions === undefined || withdrawn === null
      ? loadedRevisions
      : revisionsAfterWithdrawal(loadedRevisions, withdrawn);
  const loadedWithdrawals = withdrawals.data?.items;
  const withdrawalRows =
    loadedWithdrawals === undefined || withdrawn === null
      ? loadedWithdrawals
      : withdrawalsAfter(loadedWithdrawals, withdrawn);
  const withdrawalCount =
    withdrawals.data === undefined
      ? undefined
      : withdrawn === null ||
          withdrawals.data.items.some((row) => row.id === withdrawn.withdrawal.id)
        ? withdrawals.data.total
        : withdrawals.data.total + 1;
  const effectiveRevision = (revisionRows ?? []).find((row) => row.isEffective) ?? null;
  const canReplace =
    bid.replacementPermitted &&
    bid.viewer.canEditResponse &&
    bid.workingRevision === null &&
    effectiveRevision !== null &&
    withdrawn === null;
  const canWithdraw =
    bid.viewer.canSubmit &&
    bid.submissionWindowOpen &&
    effective !== null &&
    bid.submissionState === 'submitted' &&
    acting !== null &&
    withdrawn === null;
  const scope = t('responses.history.scope', {
    reference: bid.tender.reference,
    title: bid.tender.title,
    receiptNo: effective?.receiptNo ?? '',
  });

  const replace = async ({ reason }: { readonly reason: string }): Promise<void> => {
    if (effectiveRevision === null) return;
    try {
      await create.mutate({
        params: { bidId: bid.id },
        body: {
          basedOnRevisionId: effectiveRevision.id,
          ...(reason === '' ? {} : { reason }),
        },
      });
      setDialog(null);
      toast.show(t('responses.history.replacementStarted'), 'success');
      reloadBid();
      void navigate(responsePaths.answers(bid.id));
    } catch {
      // Shown in the dialog.
    }
  };

  const doWithdraw = async ({ reason }: { readonly reason: string }): Promise<void> => {
    if (effective === null || acting === null) return;
    try {
      const result = await withdraw.mutate({
        params: { bidId: bid.id },
        body: { receiptId: effective.id, reason, confirmation: acting, effectUnderstood: true },
      });
      setWithdrawn(result);
      setDialog(null);
      // The withdrawal result is the official outcome: the view shows it rather than re-reading earlier state.
      applyBid(bidAfterWithdrawal(bid, result));
    } catch {
      // Shown in the dialog.
    }
  };

  const receiptColumns: DataTableColumn<ReceiptSummary>[] = [
    {
      id: 'receiptNo',
      header: t('responses.history.col.receipt'),
      cell: (row) => (
        <>
          <Reference value={row.receiptNo} to={responsePaths.receipt(row.id)} />
          {row.isEffective && (
            <Chip tone="success" size="sm">
              {t('responses.history.effective')}
            </Chip>
          )}
        </>
      ),
    },
    {
      id: 'revision',
      header: t('responses.history.col.revision'),
      cell: (row) => t('responses.common.revisionNo', { no: row.revisionNo }),
    },
    {
      id: 'receivedAt',
      header: t('responses.history.col.received'),
      cell: (row) => formatReceiptTime(row.receivedAt, timeZone),
    },
    {
      id: 'status',
      header: t('responses.history.col.status'),
      cell: (row) => (
        <>
          <StatusChip enum="submission_receipts.status" value={row.status} />
          <span className="tiq-cell-sub">{formatDateTime(row.statusChangedAt, timeZone)}</span>
        </>
      ),
    },
    {
      id: 'documents',
      header: t('responses.history.col.documents'),
      numeric: true,
      cell: (row) => formatCount(row.documentCount),
    },
    {
      id: 'download',
      header: t('responses.common.actions'),
      cell: (row) => <ReceiptDownloadButton receiptId={row.id} receiptNo={row.receiptNo} />,
    },
  ];

  const revisionColumns: DataTableColumn<BidRevision>[] = [
    {
      id: 'revisionNo',
      header: t('responses.history.col.revision'),
      cell: (row) => (
        <span className="tiq-inline">
          {t('responses.common.revisionNo', { no: row.revisionNo })}
          {row.isEffective && (
            <Chip tone="success" size="sm">
              {t('responses.history.effective')}
            </Chip>
          )}
          {row.isWorking && (
            <Chip tone="info" size="sm">
              {t('responses.history.working')}
            </Chip>
          )}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('responses.history.col.status'),
      cell: (row) => <StatusChip enum="bid_revisions.status" value={row.status} />,
    },
    {
      id: 'basedOn',
      header: t('responses.history.col.basedOn'),
      cell: (row) =>
        row.basedOnRevisionNo === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          t('responses.common.revisionNo', { no: row.basedOnRevisionNo })
        ),
    },
    {
      id: 'submittedAt',
      header: t('responses.history.col.submitted'),
      cell: (row) =>
        row.submittedAt === null ? (
          t('responses.history.notSubmitted')
        ) : (
          <>
            <span>{formatReceiptTime(row.submittedAt, timeZone)}</span>
            {row.receiptNo !== null && <span className="tiq-cell-sub">{row.receiptNo}</span>}
          </>
        ),
    },
    {
      id: 'created',
      header: t('responses.history.col.created'),
      cell: (row) => (
        <>
          <span>{row.createdBy.fullName}</span>
          <span className="tiq-cell-sub">{formatDateTime(row.createdAt, timeZone)}</span>
        </>
      ),
    },
  ];

  const attemptColumns: DataTableColumn<SubmissionAttempt>[] = [
    {
      id: 'revision',
      header: t('responses.history.col.revision'),
      cell: (row) => t('responses.common.revisionNo', { no: row.revisionNo }),
    },
    {
      id: 'by',
      header: t('responses.attempts.col.by'),
      cell: (row) => row.attemptedBy.fullName,
    },
    {
      id: 'started',
      header: t('responses.attempts.col.started'),
      cell: (row) => formatDateTime(row.startedAt, timeZone),
    },
    {
      id: 'completed',
      header: t('responses.attempts.col.completed'),
      cell: (row) =>
        row.completedAt === null ? (
          t('responses.attempts.inFlight')
        ) : (
          <>
            <span>{formatReceiptTime(row.completedAt, timeZone)}</span>
            {row.lateBySeconds !== null && (
              <span className="tiq-cell-sub tiq-text-danger">
                {t('responses.attempts.lateBy', { seconds: row.lateBySeconds })}
              </span>
            )}
          </>
        ),
    },
    {
      id: 'outcome',
      header: t('responses.attempts.col.outcome'),
      cell: (row) => (
        <>
          <StatusChip enum="submission_attempts.outcome" value={row.outcome} />
          {row.failureReason !== null && <span className="tiq-cell-sub">{row.failureReason}</span>}
        </>
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

  const withdrawalColumns: DataTableColumn<Withdrawal>[] = [
    {
      id: 'confirmation',
      header: t('responses.withdrawals.col.confirmation'),
      cell: (row) => <span className="tiq-mono">{row.confirmationNo}</span>,
    },
    {
      id: 'receipt',
      header: t('responses.withdrawals.col.receipt'),
      cell: (row) => <Reference value={row.receiptNo} to={responsePaths.receipt(row.receiptId)} />,
    },
    {
      id: 'withdrawnAt',
      header: t('responses.withdrawals.col.when'),
      cell: (row) => (
        <>
          <span>{formatReceiptTime(row.withdrawnAt, timeZone)}</span>
          <span className="tiq-cell-sub">
            {row.withdrawnBy.fullName}
            {row.withdrawnBy.capacity === null ? '' : ` (${row.withdrawnBy.capacity})`}
          </span>
        </>
      ),
    },
    { id: 'reason', header: t('responses.withdrawals.col.reason'), cell: (row) => row.reason },
  ];

  return (
    <>
      <div className="tiq-inline">
        {canReplace && (
          <Button icon="copy" onClick={() => setDialog('replace')}>
            {t('responses.history.prepareReplacement')}
          </Button>
        )}
        {canWithdraw && (
          <Button variant="danger-soft" icon="ban" onClick={() => setDialog('withdraw')}>
            {t('responses.history.withdraw')}
          </Button>
        )}
        {effective !== null && (
          <ReceiptDownloadButton
            receiptId={effective.id}
            receiptNo={effective.receiptNo}
            size="md"
            variant="primary"
          />
        )}
      </div>
      {withdrawn !== null && (
        <div role="status" aria-live="polite">
          <Banner
            tone="success"
            title={t('responses.history.withdrawnTitle', {
              confirmationNo: withdrawn.withdrawal.confirmationNo,
            })}
          >
            <p>
              {t('responses.history.withdrawnDetail', {
                receiptNo: withdrawn.receipt.receiptNo,
                time: formatOfficialReceiptTime(withdrawn.withdrawal.withdrawnAt, timeZone),
              })}
            </p>
          </Banner>
        </div>
      )}
      <EffectiveOfferBanner offer={bid.effectiveOffer} timeZone={timeZone} />
      {!bid.submissionWindowOpen && (
        <Banner tone="info" title={t('responses.history.windowClosedTitle')}>
          <p>{t('responses.history.windowClosedDetail')}</p>
        </Banner>
      )}
      <KpiGrid>
        <KpiCard
          label={t('responses.history.kpi.effective')}
          icon="receipt"
          tone="success"
          value={
            effective === null
              ? null
              : t('responses.common.revisionNo', { no: effective.revisionNo })
          }
          hint={
            effective === null
              ? t('responses.history.kpi.noEffective')
              : `${effective.receiptNo} · ${formatReceiptTime(effective.receivedAt, timeZone)}`
          }
        />
        <KpiCard
          label={t('responses.history.kpi.receipts')}
          icon="files"
          value={receipts.data === undefined ? '…' : formatCount(receipts.data.total)}
          hint={t('responses.history.kpi.receiptsHint')}
        />
        <KpiCard
          label={t('responses.history.kpi.attempts')}
          icon="history"
          tone="warning"
          value={
            attempts.data === undefined
              ? '…'
              : formatCount(attempts.data.items.filter((row) => row.outcome !== 'succeeded').length)
          }
          hint={t('responses.history.kpi.attemptsHint')}
        />
        <KpiCard
          label={t('responses.history.kpi.withdrawals')}
          icon="ban"
          value={withdrawalCount === undefined ? '…' : formatCount(withdrawalCount)}
          hint={t('responses.history.kpi.withdrawalsHint')}
        />
      </KpiGrid>
      <Card
        title={t('responses.history.receiptsTitle')}
        subtitle={t('responses.receipt.notCompliance')}
        flush
      >
        <DataTable
          caption={t('responses.history.receiptsTitle')}
          columns={receiptColumns}
          rows={receiptRows}
          rowKey={(row) => String(row.id)}
          loading={receipts.isFetching}
          error={receipts.error}
          onRetry={receipts.reload}
          empty={<EmptyState compact title={t('responses.history.noReceipts')} />}
        />
      </Card>
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('responses.history.revisionsTitle')} flush>
          <DataTable
            caption={t('responses.history.revisionsTitle')}
            columns={revisionColumns}
            rows={revisionRows}
            rowKey={(row) => String(row.id)}
            loading={revisions.isFetching}
            error={revisions.error}
            onRetry={revisions.reload}
            empty={<EmptyState compact title={t('responses.history.noRevisions')} />}
          />
        </Card>
        <Card title={t('responses.withdrawals.title')} flush>
          <DataTable
            caption={t('responses.withdrawals.title')}
            columns={withdrawalColumns}
            rows={withdrawalRows}
            rowKey={(row) => String(row.id)}
            loading={withdrawals.isFetching}
            error={withdrawals.error}
            onRetry={withdrawals.reload}
            empty={<EmptyState compact title={t('responses.withdrawals.empty')} />}
          />
        </Card>
      </div>
      <Card title={t('responses.attempts.title')} subtitle={t('responses.attempts.subtitle')} flush>
        <DataTable
          caption={t('responses.attempts.title')}
          columns={attemptColumns}
          rows={attempts.data?.items}
          rowKey={(row) => String(row.id)}
          loading={attempts.isFetching}
          error={attempts.error}
          onRetry={attempts.reload}
          empty={<EmptyState compact title={t('responses.attempts.empty')} />}
        />
      </Card>
      <ConfirmActionDialog
        open={dialog === 'replace'}
        title={t('responses.history.replaceTitle')}
        scope={scope}
        consequence={t('responses.history.replaceConsequence', {
          receiptNo: effective?.receiptNo ?? '',
        })}
        confirmLabel={t('responses.history.replaceConfirm')}
        reason={{ label: t('responses.history.replaceReason'), required: false }}
        pending={create.pending}
        error={withResponseMessage(create.error)}
        onConfirm={replace}
        onCancel={() => setDialog(null)}
      />
      <ConfirmActionDialog
        open={dialog === 'withdraw'}
        tone="danger"
        title={t('responses.history.withdrawTitle')}
        scope={scope}
        consequence={t('responses.history.withdrawConsequence')}
        confirmLabel={t('responses.history.withdrawConfirm')}
        reason={{ label: t('responses.history.withdrawReason'), required: true }}
        acknowledgement={t('responses.history.withdrawAcknowledge')}
        pending={withdraw.pending}
        error={withResponseMessage(withdraw.error)}
        onConfirm={doWithdraw}
        onCancel={() => setDialog(null)}
      >
        <DetailList
          stacked
          items={[
            { label: t('responses.history.col.receipt'), value: effective?.receiptNo },
            {
              label: t('responses.history.col.received'),
              value:
                effective === null
                  ? null
                  : formatOfficialReceiptTime(effective.receivedAt, timeZone),
            },
            {
              label: t('responses.history.otherReceipts'),
              value: String(Math.max((receiptRows ?? []).length - 1, 0)),
            },
          ]}
        />
      </ConfirmActionDialog>
    </>
  );
}

export default function ResponseHistoryPage() {
  return (
    <ResponseWorkspace tab="history" title={t('responses.history.pageTitle')}>
      {(bid, reloadBid, applyBid) => (
        <HistoryContent bid={bid} reloadBid={reloadBid} applyBid={applyBid} />
      )}
    </ResponseWorkspace>
  );
}
