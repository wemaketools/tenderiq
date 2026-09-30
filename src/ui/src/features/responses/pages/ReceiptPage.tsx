/**
 * SUP-16/SUP-17 — One official receipt (FR-12): the event, supplier legal party, lots, revision, officially recorded
 * receipt time, status, the deadline in force and the submitted document inventory. A receipt confirms receipt, not
 * compliance, qualification, evaluation success or award. Receipt times render to the second with the official
 * offset and zone; a late-rejected receipt states how late it was and why it was rejected (BR-20, AC-13).
 */
import { getReceipt } from '@contracts/bids';
import type { ReceiptInventoryItem } from '@contracts/bids';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  ButtonLink,
  Card,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  OfficialDeadline,
  PageHeader,
  SkeletonBlock,
  StatusChip,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatBytes } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ReceiptDownloadButton } from '../components/ReceiptDownloadButton';
import { useIdParam } from '../lib/hooks';
import { responsePaths } from '../lib/paths';
import { RESPONSE_READ } from '../lib/permissions';
import { formatOfficialReceiptTime } from '../lib/time';

export default function ReceiptPage() {
  const receiptId = useIdParam('receiptId');
  const canOpenResponse = usePermission(RESPONSE_READ);
  const query = useApiQuery(getReceipt, receiptId === null ? null : { params: { receiptId } });
  const back = { to: responsePaths.receipts, label: t('responses.receipts.back') };

  if (receiptId === null || query.error?.kind === 'not_found') {
    return (
      <div className="tiq-page">
        <PageHeader title={t('responses.receipt.pageTitle')} back={back} />
        <EmptyState
          title={t('responses.receipt.notFound')}
          description={t('responses.receipt.notFoundHint')}
        />
      </div>
    );
  }
  const receipt = query.data;
  if (receipt === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('responses.receipt.pageTitle')} back={back} />
        {query.error !== null ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : (
          <SkeletonBlock lines={8} />
        )}
      </div>
    );
  }
  const timeZone = receipt.deadline.timeZone;

  const columns: DataTableColumn<ReceiptInventoryItem>[] = [
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
      cell: (row) => <span className="tiq-mono">{row.sha256}</span>,
    },
  ];

  return (
    <div className="tiq-page">
      <PageHeader
        title={t('responses.receipt.officialTitle', { receiptNo: receipt.receiptNo })}
        back={back}
        subtitle={`${receipt.tender.reference} ${receipt.tender.title} · ${receipt.tender.buyer.name}`}
        meta={
          <>
            <StatusChip enum="submission_receipts.status" value={receipt.status} />
            {receipt.isEffective && <Chip tone="success">{t('responses.history.effective')}</Chip>}
            <span>
              {t('responses.receipt.receivedLine', {
                time: formatOfficialReceiptTime(receipt.receivedAt, timeZone),
              })}
            </span>
          </>
        }
        primaryAction={
          <ReceiptDownloadButton
            receiptId={receipt.id}
            receiptNo={receipt.receiptNo}
            size="md"
            variant="primary"
          />
        }
        actions={
          canOpenResponse ? (
            <ButtonLink to={responsePaths.history(receipt.bidId)} icon="history">
              {t('responses.receipt.toHistory')}
            </ButtonLink>
          ) : undefined
        }
      />
      {receipt.lateRejection !== null && (
        <Banner
          tone="error"
          title={t('responses.receipt.lateTitle', {
            seconds: receipt.lateRejection.lateBySeconds,
          })}
        >
          <p>
            {t('responses.receipt.lateDetail', {
              received: formatOfficialReceiptTime(receipt.receivedAt, timeZone),
              deadline: formatOfficialReceiptTime(
                receipt.lateRejection.deadlineAtAttempt.at,
                receipt.lateRejection.deadlineAtAttempt.timeZone,
              ),
              seconds: receipt.lateRejection.lateBySeconds,
            })}
          </p>
          {receipt.lateRejection.reason !== null && (
            <p>
              {t('responses.effective.failureReason', { reason: receipt.lateRejection.reason })}
            </p>
          )}
        </Banner>
      )}
      <Banner tone="info" title={t('responses.receipt.meaningTitle')}>
        <p>{t('responses.receipt.notCompliance')}</p>
      </Banner>
      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('responses.receipt.detailsTitle')}>
          <DetailList
            items={[
              {
                label: t('responses.receipt.number'),
                value: <span className="tiq-mono">{receipt.receiptNo}</span>,
              },
              {
                label: t('responses.receipt.receivedAt'),
                value: formatOfficialReceiptTime(receipt.receivedAt, timeZone),
              },
              {
                label: t('responses.receipt.status'),
                value: tEnum('submission_receipts.status', receipt.status),
              },
              {
                label: t('responses.receipt.statusChanged'),
                value: formatOfficialReceiptTime(receipt.statusChangedAt, timeZone),
              },
              { label: t('responses.receipt.legalParty'), value: receipt.legalParty.legalName },
              {
                label: t('responses.receipt.submittedBy'),
                value: `${receipt.submittedBy.fullName}${receipt.submittedBy.capacity === null ? '' : ` (${receipt.submittedBy.capacity})`}`,
              },
              { label: t('responses.receipt.authority'), value: receipt.submitterAuthorityNote },
              { label: t('responses.receipt.lots'), value: receipt.lotsSummary },
              {
                label: t('responses.receipt.revision'),
                value: t('responses.common.revisionNo', { no: receipt.revisionNo }),
              },
              {
                label: t('responses.receipt.round'),
                value: tEnum('bids.round_type', receipt.roundType),
              },
              {
                label: t('responses.receipt.tenderVersion'),
                value: String(receipt.tenderVersionNo),
              },
            ]}
          />
        </Card>
        <Card title={t('responses.receipt.deadlineTitle')}>
          <OfficialDeadline
            deadline={receipt.deadline}
            variant="block"
            label={t('responses.submit.deadlineLabel')}
          />
        </Card>
      </div>
      <Card title={t('responses.receipt.inventoryTitle')} flush>
        <DataTable
          caption={t('responses.receipt.inventoryTitle')}
          columns={columns}
          rows={receipt.inventory}
          rowKey={(row) => String(row.id)}
          empty={<EmptyState compact title={t('responses.receipt.noInventory')} />}
        />
      </Card>
    </div>
  );
}
