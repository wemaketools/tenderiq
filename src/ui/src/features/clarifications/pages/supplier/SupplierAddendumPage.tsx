/**
 * SUP-10 / AC-10: an issued addendum as the supplier sees it. It states what changed (requirements before and after,
 * affected lots, dates), the action required of this supplier (acknowledge, supplement or replace the submission),
 * that the prior receipt stays valid, and the separate delivery, opening and acknowledgment events (BR-41).
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { clarificationsEndpoints } from '@contracts/clarifications';
import type { AcknowledgmentResult, SupplierAddendumDetail } from '@contracts/clarifications';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  OfficialDeadline,
  PageHeader,
  QueryView,
  Reference,
  StatusChip,
  Timeline,
  useToast,
} from '../../../../components/ui';
import type { TimelineItem } from '../../../../components/ui';
import { formatDateTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { ChangeAreaChips, RequirementChangesTable } from '../../components/shared';
import { explainError, lotsLabel, supplierPaths } from '../../lib';

export default function SupplierAddendumPage() {
  const { addendumId } = useParams();
  const id = Number(addendumId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('clarifications.addendumPage.notFound')} />
        <EmptyState title={t('clarifications.addendumPage.notFound')} />
      </div>
    );
  }
  return <SupplierAddendumLoader key={id} addendumId={id} />;
}

function SupplierAddendumLoader({ addendumId }: { readonly addendumId: number }) {
  const query = useApiQuery(clarificationsEndpoints.supplierAddendaGet, { params: { addendumId } });
  const [ack, setAck] = useState<AcknowledgmentResult | null>(null);
  return (
    <div className="tiq-page">
      {query.data === undefined && (
        <PageHeader
          title={t('clarifications.supplier.title')}
          back={{ to: supplierPaths.overview, label: t('clarifications.supplierTender.back') }}
        />
      )}
      <QueryView query={query}>
        {(data) => (
          <SupplierAddendumView
            addendum={
              ack === null
                ? data
                : {
                    ...data,
                    acknowledgedAt: ack.acknowledgedAt,
                    acknowledgedBy: ack.acknowledgedBy,
                    requiredAction: ack.requiredAction,
                    requiredActionCompleted: ack.requiredActionCompleted,
                    priorSubmission: ack.priorSubmission,
                  }
            }
            onAcknowledged={setAck}
          />
        )}
      </QueryView>
    </div>
  );
}

function SupplierAddendumView({
  addendum,
  onAcknowledged,
}: {
  readonly addendum: SupplierAddendumDetail;
  readonly onAcknowledged: (result: AcknowledgmentResult) => void;
}) {
  const toast = useToast();
  const canAcknowledge = usePermission('supplier.notices.acknowledge');
  const [confirming, setConfirming] = useState(false);
  const acknowledge = useApiMutation(clarificationsEndpoints.supplierAddendaAcknowledge);
  const tz =
    addendum.newSubmissionDeadline?.timeZone ??
    addendum.previousSubmissionDeadline?.timeZone ??
    'UTC';
  const needsAck = addendum.acknowledgmentRequired && addendum.acknowledgedAt === null;
  const lotLabel = (lotId: number | null): string => {
    if (lotId === null) return t('clarifications.common.allLots');
    const lot = addendum.affectedLots.find((item) => item.lotId === lotId);
    return lot === undefined
      ? t('clarifications.common.lotShort', { no: lotId })
      : t('clarifications.common.lotLabel', { no: lot.lotNo, title: lot.title });
  };

  const events: TimelineItem[] = [
    {
      id: 'issued',
      title: t('clarifications.supplierAddendum.event.issued'),
      meta: formatDateTime(addendum.issuedAt, tz),
      tone: 'accent',
    },
    {
      id: 'delivered',
      title: t('clarifications.supplierAddendum.event.delivered'),
      meta:
        addendum.deliveredAt === null
          ? t('clarifications.supplierAddendum.event.notYet')
          : formatDateTime(addendum.deliveredAt, tz),
      tone: addendum.deliveredAt === null ? 'neutral' : 'success',
    },
    {
      id: 'opened',
      title: t('clarifications.supplierAddendum.event.opened'),
      meta:
        addendum.openedAt === null
          ? t('clarifications.supplierAddendum.event.notYet')
          : formatDateTime(addendum.openedAt, tz),
      tone: addendum.openedAt === null ? 'neutral' : 'success',
    },
    {
      id: 'acknowledged',
      title: t('clarifications.supplierAddendum.event.acknowledged'),
      meta:
        addendum.acknowledgedAt === null
          ? addendum.acknowledgmentRequired
            ? t('clarifications.supplierAddendum.event.required')
            : t('clarifications.supplierAddendum.notRequired')
          : `${formatDateTime(addendum.acknowledgedAt, tz)} · ${addendum.acknowledgedBy?.fullName ?? ''}`,
      tone:
        addendum.acknowledgedAt !== null
          ? 'success'
          : addendum.acknowledgmentRequired
            ? 'warning'
            : 'neutral',
    },
  ];

  return (
    <>
      <PageHeader
        title={t('clarifications.addendumPage.title', {
          no: addendum.number,
          reference: addendum.tender.reference,
        })}
        subtitle={`${addendum.title} · ${addendum.buyer.name}`}
        back={{
          to: supplierPaths.tender(addendum.tender.tenderId),
          label: t('clarifications.supplierQuestion.back', {
            reference: addendum.tender.reference,
          }),
        }}
        meta={
          <>
            <Reference
              value={addendum.tender.reference}
              to={supplierPaths.tender(addendum.tender.tenderId)}
            />
            <StatusChip enum="addenda.materiality" value={addendum.materiality} />
            {addendum.newSubmissionDeadline !== null && (
              <OfficialDeadline
                variant="block"
                label={t('clarifications.addendumPage.newDeadline')}
                deadline={addendum.newSubmissionDeadline}
                showRemaining
              />
            )}
            <span>
              <strong>{t('clarifications.common.nextAction')}:</strong>{' '}
              {needsAck
                ? t('clarifications.next.supplier.acknowledgeOne')
                : !addendum.requiredActionCompleted && addendum.requiredAction !== 'none'
                  ? t(`clarifications.supplierAddendum.todo.${addendum.requiredAction}`)
                  : t('clarifications.next.none')}
            </span>
          </>
        }
        primaryAction={
          needsAck && canAcknowledge ? (
            <Button variant="primary" icon="check" onClick={() => setConfirming(true)}>
              {t('clarifications.supplierAddendum.acknowledge')}
            </Button>
          ) : undefined
        }
      />

      <Banner
        tone={
          addendum.requiredAction === 'none' || addendum.requiredActionCompleted
            ? 'success'
            : addendum.requiredAction === 'acknowledge'
              ? 'warning'
              : 'error'
        }
        title={t(`clarifications.supplierAddendum.required.${addendum.requiredAction}`)}
      >
        <p>{t(`clarifications.existingAction.${addendum.requiredAction}`)}</p>
        {addendum.requiredAction !== 'none' && (
          <p>
            {addendum.requiredActionCompleted
              ? t('clarifications.addendumPage.actionDone')
              : t('clarifications.addendumPage.actionOutstanding')}
          </p>
        )}
      </Banner>

      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack tiq-stack--spaced">
          <Card title={t('clarifications.addendumPage.changeCard')}>
            <div className="tiq-stack">
              <p>{addendum.changeDescription}</p>
              <DetailList
                items={[
                  {
                    key: 'reason',
                    label: t('clarifications.addendumPage.reason'),
                    value: addendum.reason,
                  },
                  {
                    key: 'areas',
                    label: t('clarifications.addendumPage.changeAreas'),
                    value: <ChangeAreaChips areas={addendum} />,
                  },
                  {
                    key: 'lots',
                    label: t('clarifications.addendumPage.affectedLots'),
                    value: lotsLabel(addendum.affectedLots),
                  },
                  {
                    key: 'version',
                    label: t('clarifications.supplierAddendum.version'),
                    value: t('clarifications.supplierAddendum.versionValue', {
                      version: addendum.resultingVersionNo,
                    }),
                  },
                ]}
              />
            </div>
          </Card>
          <Card flush title={t('clarifications.addendumPage.requirementChanges')}>
            <RequirementChangesTable changes={addendum.requirementChanges} lotLabel={lotLabel} />
          </Card>
          <Card title={t('clarifications.addendumPage.datesCard')}>
            <DetailList
              items={[
                {
                  key: 'previous',
                  label: t('clarifications.supplierAddendum.previousDeadline'),
                  value:
                    addendum.previousSubmissionDeadline === null ? null : (
                      <OfficialDeadline deadline={addendum.previousSubmissionDeadline} />
                    ),
                },
                {
                  key: 'new',
                  label: t('clarifications.addendumPage.newDeadline'),
                  value:
                    addendum.newSubmissionDeadline === null ? (
                      t('clarifications.addenda.noDateChange')
                    ) : (
                      <OfficialDeadline deadline={addendum.newSubmissionDeadline} />
                    ),
                },
              ]}
            />
          </Card>
        </div>

        <div className="tiq-stack tiq-stack--spaced">
          <Card title={t('clarifications.supplierAddendum.yourSubmission')}>
            {addendum.priorSubmission === null ? (
              <EmptyState
                compact
                icon="inbox"
                title={t('clarifications.supplierAddendum.noSubmission')}
              />
            ) : (
              <DetailList
                stacked
                items={[
                  {
                    key: 'receipt',
                    label: t('clarifications.supplierAddendum.receipt'),
                    value: <span className="tiq-mono">{addendum.priorSubmission.receiptNo}</span>,
                  },
                  {
                    key: 'received',
                    label: t('clarifications.supplierAddendum.received'),
                    value: formatDateTime(addendum.priorSubmission.receivedAt, tz),
                  },
                  {
                    key: 'valid',
                    label: t('clarifications.supplierAddendum.receiptStatus'),
                    value: addendum.priorSubmission.remainsValid
                      ? t('clarifications.supplierAddendum.receiptValid')
                      : t('clarifications.supplierAddendum.receiptSuperseded'),
                  },
                ]}
              />
            )}
          </Card>
          <Card title={t('clarifications.supplierAddendum.notice')}>
            <Timeline label={t('clarifications.supplierAddendum.notice')} items={events} />
          </Card>
        </div>
      </div>

      <ConfirmActionDialog
        open={confirming}
        title={t('clarifications.supplierAddendum.ackDialog.title')}
        scope={t('clarifications.addendumPage.scope', {
          no: addendum.number,
          reference: addendum.tender.reference,
          title: addendum.title,
        })}
        consequence={t('clarifications.supplierAddendum.ackDialog.consequence')}
        confirmLabel={t('clarifications.supplierAddendum.acknowledge')}
        acknowledgement={t('clarifications.supplierAddendum.ackDialog.statement')}
        pending={acknowledge.pending}
        error={explainError(acknowledge.error)}
        onCancel={() => {
          acknowledge.reset();
          setConfirming(false);
        }}
        onConfirm={async () => {
          try {
            const result = await acknowledge.mutate({
              params: { addendumId: addendum.id },
              body: { confirmed: true },
            });
            onAcknowledged(result);
            setConfirming(false);
            toast.show(t('clarifications.supplierAddendum.acknowledged'), 'success');
          } catch {
            // Shown in the dialog.
          }
        }}
      />
    </>
  );
}
