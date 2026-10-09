/**
 * SUP-22 — One of the supplier's own complaints: grounds, dates, evidence, case status and the history the buyer
 * shares, the response and remedy, whether a procurement hold is active, and the appeal route with its deadline.
 * The supplier may add evidence, appeal a response while the route is open, or withdraw the complaint.
 *
 * A complaint just lodged arrives with its record in the router state; it is shown from there even when the
 * static mock cannot read it back (nothing persists in the prototype), and the error state appears only when no
 * record is available at all.
 */
import { useState } from 'react';

import {
  AppealComplaintBody,
  appealComplaint,
  getSupplierComplaint,
  withdrawComplaint,
} from '@contracts/awards';
import type { SupplierComplaintDetail } from '@contracts/awards';
import type { FieldError } from '@contracts/common';
import { listSupplierDocuments } from '@contracts/documents';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useCanCall, usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  ErrorState,
  OfficialDeadline,
  PageHeader,
  Reference,
  SkeletonBlock,
  StatusChip,
  TextArea,
  Timeline,
  useToast,
} from '../../../components/ui';
import { DocumentList } from '../../../components/documents';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { TextBlock } from '../../awards/components/TextBlock';
import { withAwardMessage } from '../../awards/lib/errors';
import { useIdParam, useLatest, useOfficialTimeZone } from '../../awards/lib/hooks';
import { yesNo } from '../../awards/lib/labels';
import { errorLookup, validateWith } from '../../awards/lib/validation';
import { outcomePaths } from '../lib/paths';

const CLOSED = ['closed', 'withdrawn'];

export default function SupplierComplaintPage() {
  const complaintId = useIdParam('complaintId');
  const query = useApiQuery(
    getSupplierComplaint,
    complaintId === null ? null : { params: { complaintId } },
  );
  const [latest, setLatest] = useLatest<SupplierComplaintDetail>(
    complaintId === null ? null : String(complaintId),
    (record) => String(record.complaintId),
  );
  const detail = latest ?? query.data;
  if (complaintId === null) {
    return <EmptyState title={t('outcomes.complaint.notFound')} icon="scale" />;
  }
  const back = { to: outcomePaths.complaints, label: t('outcomes.complaint.back') };
  if (detail !== undefined) {
    return <ComplaintBody detail={detail} onChanged={setLatest} back={back} />;
  }
  return (
    <>
      <PageHeader title={t('outcomes.complaint.title')} back={back} />
      {query.error !== null ? (
        <ErrorState error={query.error} onRetry={query.reload} />
      ) : (
        <SkeletonBlock lines={8} />
      )}
    </>
  );
}

type Command = 'appeal' | 'withdraw';

function ComplaintBody({
  detail,
  onChanged,
  back,
}: {
  readonly detail: SupplierComplaintDetail;
  readonly onChanged: (detail: SupplierComplaintDetail) => void;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const canSubmit = usePermission('supplier.complaint.submit');
  const canReadDocuments = useCanCall(listSupplierDocuments);
  const [command, setCommand] = useState<Command | null>(null);
  const [appealGrounds, setAppealGrounds] = useState('');
  const [clientErrors, setClientErrors] = useState<readonly FieldError[]>([]);
  const appeal = useApiMutation(appealComplaint);
  const withdraw = useApiMutation(withdrawComplaint);
  const active = command === 'appeal' ? appeal : withdraw;
  const errors = errorLookup(clientErrors, appeal.error, ['appealGrounds']);
  const closed = CLOSED.includes(detail.status);
  const scope = `${detail.reference} · ${detail.tender.reference} ${detail.tender.title} · ${detail.buyer.name}`;

  const confirm = async ({ reason }: { readonly reason: string }): Promise<void> => {
    try {
      let result: SupplierComplaintDetail;
      if (command === 'appeal') {
        const body = { appealGrounds: appealGrounds.trim() };
        const found = validateWith(AppealComplaintBody, body);
        setClientErrors(found);
        if (found.length > 0) return;
        result = await appeal.mutate({ params: { complaintId: detail.complaintId }, body });
      } else {
        result = await withdraw.mutate({
          params: { complaintId: detail.complaintId },
          body: { reason: reason.trim() },
        });
      }
      const done = command;
      setCommand(null);
      onChanged(result);
      invalidateApiQueries('supplier.complaints.');
      toast.show(
        done === 'appeal' ? t('outcomes.complaint.appealed') : t('outcomes.complaint.withdrawn'),
        'success',
      );
    } catch {
      // The dialog shows the error.
    }
  };

  return (
    <>
      <PageHeader
        title={t('outcomes.complaint.titleFor', { reference: detail.reference })}
        back={back}
        meta={
          <>
            <Reference value={detail.reference} />
            <span>{detail.buyer.name}</span>
            <StatusChip enum="complaints.status" value={detail.status} />
            {detail.responseDueAt !== null && (
              <span className="tiq-inline">
                <span className="tiq-text-muted">{t('outcomes.complaint.responseDue')}</span>
                <OfficialDeadline deadline={detail.responseDueAt} />
              </span>
            )}
          </>
        }
        primaryAction={
          canSubmit && detail.appealAvailable ? (
            <Button
              variant="primary"
              icon="repeat"
              onClick={() => {
                appeal.reset();
                setClientErrors([]);
                setAppealGrounds('');
                setCommand('appeal');
              }}
            >
              {t('outcomes.complaint.appeal')}
            </Button>
          ) : undefined
        }
        actions={
          canSubmit && !closed ? (
            <Button
              icon="x"
              onClick={() => {
                withdraw.reset();
                setCommand('withdraw');
              }}
            >
              {t('outcomes.complaint.withdraw')}
            </Button>
          ) : undefined
        }
      />
      <div className="tiq-stack tiq-stack--spaced">
        {detail.procurementHoldActive && (
          <Banner tone="warning" title={t('outcomes.complaint.holdTitle')}>
            {t('outcomes.complaint.holdText')}
          </Banner>
        )}
        {!detail.withinWindow && (
          <Banner tone="warning" title={t('outcomes.complaint.lateTitle')}>
            {t('outcomes.complaint.lateText')}
          </Banner>
        )}
        <div className="tiq-grid tiq-grid--sidebar">
          <div className="tiq-stack tiq-stack--spaced">
            <Card title={t('outcomes.complaint.groundsTitle')}>
              <TextBlock text={detail.grounds} />
            </Card>
            <Card title={t('outcomes.complaint.responseTitle')}>
              <DetailList
                stacked
                items={[
                  {
                    label: t('outcomes.complaint.outcome'),
                    value:
                      detail.outcome === null ? (
                        t('outcomes.complaint.noOutcome')
                      ) : (
                        <StatusChip enum="complaints.outcome" value={detail.outcome} />
                      ),
                  },
                  {
                    label: t('outcomes.complaint.response'),
                    value: (
                      <TextBlock
                        text={detail.responseText}
                        empty={t('outcomes.complaint.noResponse')}
                      />
                    ),
                  },
                  { label: t('outcomes.complaint.remedy'), value: detail.remedy },
                ]}
              />
            </Card>
            <Card title={t('outcomes.complaint.appealTitle')}>
              <div className="tiq-stack">
                {detail.appealAvailable ? (
                  <p>{t('outcomes.complaint.appealOpen')}</p>
                ) : (
                  <p className="tiq-text-muted">{t('outcomes.complaint.appealClosed')}</p>
                )}
                {detail.appealDeadline !== null && (
                  <OfficialDeadline
                    deadline={detail.appealDeadline}
                    variant="block"
                    label={t('outcomes.complaint.appealDeadline')}
                  />
                )}
                <DetailList
                  stacked
                  items={[
                    { label: t('outcomes.complaint.appealGrounds'), value: detail.appealGrounds },
                    { label: t('outcomes.complaint.appealOutcome'), value: detail.appealOutcome },
                  ]}
                />
              </div>
            </Card>
            <Card title={t('outcomes.complaint.historyTitle')}>
              <Timeline
                label={t('outcomes.complaint.historyTitle')}
                items={detail.events.map((event) => ({
                  id: event.eventId,
                  title: t(`awards.complaint.event.${event.eventType}`),
                  meta: formatDateTime(event.occurredAt, timeZone),
                  detail:
                    event.toStatus === null
                      ? event.note
                      : `${tEnum('complaints.status', event.toStatus)}. ${event.note}`,
                }))}
              />
            </Card>
          </div>
          <div className="tiq-stack tiq-stack--spaced">
            <Card title={t('outcomes.complaint.caseTitle')}>
              <DetailList
                stacked
                items={[
                  { label: t('outcomes.complaint.buyer'), value: detail.buyer.name },
                  {
                    label: t('outcomes.complaint.tender'),
                    value: `${detail.tender.reference} ${detail.tender.title}`,
                  },
                  {
                    label: t('outcomes.complaint.lot'),
                    value:
                      detail.lot === null
                        ? t('awards.common.allLots')
                        : t('awards.common.lotLabel', {
                            no: detail.lot.lotNo,
                            title: detail.lot.title,
                          }),
                  },
                  {
                    label: t('outcomes.complaint.subject'),
                    value: tEnum('complaints.subject', detail.subject),
                  },
                  {
                    label: t('outcomes.complaint.lodgedBy'),
                    value: `${detail.complainantUser.fullName} · ${formatDateTime(detail.receivedAt, timeZone)}`,
                  },
                  {
                    label: t('outcomes.complaint.withinWindow'),
                    value: yesNo(detail.withinWindow),
                  },
                  {
                    label: t('outcomes.complaint.acknowledged'),
                    value:
                      detail.acknowledgedAt === null
                        ? null
                        : formatDateTime(detail.acknowledgedAt, timeZone),
                  },
                  {
                    label: t('outcomes.complaint.hold'),
                    value: detail.procurementHoldActive
                      ? t('outcomes.complaints.holdActive')
                      : t('outcomes.complaint.noHold'),
                  },
                  {
                    label: t('outcomes.complaint.closedAt'),
                    value:
                      detail.closedAt === null ? null : formatDateTime(detail.closedAt, timeZone),
                  },
                ]}
              />
            </Card>
            {canReadDocuments && (
              <DocumentList
                audience="supplier"
                relatedType="complaint"
                relatedId={detail.complaintId}
                title={t('outcomes.complaint.evidenceTitle')}
                canUpload={canSubmit && !closed}
                defaultClassification="supplier_private"
              />
            )}
          </div>
        </div>
      </div>

      <ConfirmActionDialog
        open={command !== null}
        title={
          command === 'appeal'
            ? t('outcomes.complaint.appealTitle')
            : t('outcomes.complaint.withdrawTitle')
        }
        scope={scope}
        consequence={
          command === 'appeal'
            ? t('outcomes.complaint.appealConsequence')
            : t('outcomes.complaint.withdrawConsequence')
        }
        confirmLabel={
          command === 'appeal' ? t('outcomes.complaint.appeal') : t('outcomes.complaint.withdraw')
        }
        tone={command === 'withdraw' ? 'danger' : 'primary'}
        reason={
          command === 'withdraw'
            ? { label: t('outcomes.complaint.withdrawReason'), required: true }
            : undefined
        }
        pending={active.pending}
        error={withAwardMessage(active.error)}
        onCancel={() => setCommand(null)}
        onConfirm={confirm}
      >
        {command === 'appeal' && (
          <TextArea
            label={t('outcomes.complaint.appealGrounds')}
            required
            rows={6}
            value={appealGrounds}
            error={errors.forField('appealGrounds')}
            onChange={setAppealGrounds}
          />
        )}
      </ConfirmActionDialog>
    </>
  );
}
