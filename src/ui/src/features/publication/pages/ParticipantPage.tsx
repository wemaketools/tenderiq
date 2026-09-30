/**
 * BUY-15 participant record: the invited or interested legal supplier, its intended contact, the access request and
 * decision, confidentiality acceptance, the qualification gate, required acknowledgments, formal deliveries and the
 * record's history. Actions: correct the contact (the invited legal supplier never changes, FR-08), decide access,
 * resend the invitation and send a reminder. Nothing from the supplier's private workspace appears here.
 */
import { useState } from 'react';

import { publicationEndpoints } from '@contracts/publication';
import type {
  ParticipantAcknowledgment,
  ParticipantDelivery,
  ParticipantDetail,
  ParticipantEvent,
  ParticipantRow,
} from '@contracts/publication';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  PageHeader,
  Reference,
  RestrictedState,
  SkeletonBlock,
  StatusChip,
  Timeline,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn, TimelineItem } from '../../../components/ui';
import { formatCalendarDate, formatDateTime, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import {
  AccessDecisionDialog,
  ReminderDialog,
  ReplaceContactDialog,
  ResendDialog,
} from '../components/ParticipantDialogs';
import { useIdParam, useOfficialTimeZone } from '../lib/hooks';
import { publicationPaths } from '../lib/paths';
import { PARTICIPANT_MANAGE } from '../lib/permissions';

type Dialog = 'contact' | 'access' | 'resend' | 'remind' | null;

export default function ParticipantPage() {
  const tenderId = useIdParam('tenderId');
  const participantId = useIdParam('participantId');
  const query = useApiQuery(
    publicationEndpoints.getParticipant,
    tenderId === null || participantId === null ? null : { params: { tenderId, participantId } },
  );
  const back =
    tenderId === null
      ? { to: publicationPaths.register, label: t('publication.common.backToRegister') }
      : { to: publicationPaths.participants(tenderId), label: t('publication.participant.back') };

  if (tenderId === null || participantId === null || query.error?.kind === 'not_found') {
    return (
      <div className="tiq-page">
        <PageHeader title={t('publication.participant.notFoundTitle')} back={back} />
        <EmptyState
          icon="users"
          title={t('publication.participant.notFoundTitle')}
          description={t('publication.participant.notFound')}
        />
      </div>
    );
  }
  if (query.data === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('publication.participant.loadingTitle')} back={back} />
        {query.error === null ? (
          <SkeletonBlock lines={8} />
        ) : query.error.kind === 'forbidden' ? (
          <RestrictedState description={t('publication.participants.restricted')} />
        ) : (
          <ErrorState error={query.error} onRetry={query.reload} />
        )}
      </div>
    );
  }
  return <ParticipantView key={participantId} detail={query.data} back={back} />;
}

const EVENT_TONE: Readonly<Record<ParticipantEvent['event'], TimelineItem['tone']>> = {
  interest_registered: 'info',
  invited: 'accent',
  invitation_resent: 'info',
  contact_replaced: 'warning',
  invitation_accepted: 'success',
  invitation_declined: 'danger',
  access_requested: 'info',
  access_granted: 'success',
  access_denied: 'danger',
  confidentiality_accepted: 'success',
  acknowledged: 'success',
  bid_intent_shared: 'accent',
  reminder_sent: 'neutral',
  delivery_failed: 'danger',
};

function ParticipantView({
  detail: initial,
  back,
}: {
  readonly detail: ParticipantDetail;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const toast = useToast();
  const organizationZone = useOfficialTimeZone();
  const canManagePermission = usePermission(PARTICIPANT_MANAGE);
  const [row, setRow] = useState<ParticipantRow | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [lastReminder, setLastReminder] = useState<string | null>(null);

  const detail: ParticipantDetail = row === null ? initial : { ...initial, ...row };
  const { tender, capabilities } = detail;
  const timeZone = organizationZone;
  const canManage = canManagePermission;
  const at = (value: string | null): string | null =>
    value === null ? null : formatDateTime(value, timeZone);

  const applyRow = (next: ParticipantRow, message: string): void => {
    setDialog(null);
    setRow(next);
    toast.show(message, 'success');
  };

  const ackColumns: DataTableColumn<ParticipantAcknowledgment>[] = [
    {
      id: 'subject',
      header: t('publication.participant.col.subject'),
      cell: (item) => (
        <>
          <span>{item.label}</span>
          <span className="tiq-cell-sub">
            {tEnum('participant_acknowledgments.subject_type', item.subjectType)}
          </span>
        </>
      ),
    },
    {
      id: 'since',
      header: t('publication.participant.col.requiredSince'),
      cell: (item) => at(item.requiredSince),
    },
    {
      id: 'state',
      header: t('publication.participant.col.acknowledged'),
      cell: (item) =>
        item.acknowledgedAt === null ? (
          <Chip tone="warning" size="sm">
            {t('publication.participant.outstanding')}
          </Chip>
        ) : (
          <>
            <span className="tiq-text-success">{at(item.acknowledgedAt)}</span>
            <span className="tiq-cell-sub">{item.acknowledgedBy?.fullName}</span>
          </>
        ),
    },
  ];

  const deliveryColumns: DataTableColumn<ParticipantDelivery>[] = [
    {
      id: 'notice',
      header: t('publication.participant.col.notice'),
      cell: (item) => (
        <>
          <span>{item.title}</span>
          <span className="tiq-cell-sub">{tEnum('notices.notice_type', item.noticeType)}</span>
        </>
      ),
    },
    {
      id: 'recipient',
      header: t('publication.participant.col.recipient'),
      cell: (item) => (
        <>
          <span>{item.recipient?.fullName ?? t('publication.common.none')}</span>
          <span className="tiq-cell-sub">{item.recipientEmail}</span>
        </>
      ),
    },
    {
      id: 'issued',
      header: t('publication.participant.col.issued'),
      cell: (item) => at(item.issuedAt),
    },
    {
      id: 'status',
      header: t('publication.participant.col.delivery'),
      cell: (item) => (
        <>
          <StatusChip
            enum="notice_recipients.delivery_status"
            value={item.deliveryStatus}
            size="sm"
          />
          {item.failureReason !== null && (
            <span className="tiq-cell-sub tiq-text-danger">{item.failureReason}</span>
          )}
          {item.deliveredAt !== null && (
            <span className="tiq-cell-sub">
              {t('publication.participant.deliveredOn', { at: at(item.deliveredAt) ?? '' })}
            </span>
          )}
        </>
      ),
    },
    {
      id: 'ack',
      header: t('publication.participant.col.acknowledged'),
      cell: (item) =>
        item.acknowledgedAt !== null
          ? at(item.acknowledgedAt)
          : item.openedAt !== null
            ? t('publication.participant.openedOn', { at: at(item.openedAt) ?? '' })
            : t('publication.participant.notOpened'),
    },
  ];

  const history: TimelineItem[] = detail.history.map((event, index) => ({
    id: `${event.at}:${index}`,
    title: t(`publication.participant.event.${event.event}`),
    meta: t('publication.participant.eventMeta', {
      at: formatDateTime(event.at, timeZone),
      actor: event.actor?.fullName ?? t('publication.participant.system'),
      organization: event.actorOrganization,
    }),
    detail: event.detail ?? undefined,
    tone: EVENT_TONE[event.event],
  }));

  return (
    <div className="tiq-page">
      <PageHeader
        title={detail.supplier.legalName}
        subtitle={t('publication.participant.subtitle', {
          reference: tender.reference,
          title: tender.title,
        })}
        back={back}
        meta={
          <>
            <Reference value={tender.reference} to={publicationPaths.tender(tender.tenderId)} />
            <StatusChip enum="tenders.status" value={tender.status} />
            <StatusChip enum="participants.invitation_status" value={detail.invitationStatus} />
            <StatusChip enum="participants.access_status" value={detail.accessStatus} />
          </>
        }
        actions={
          canManage ? (
            <>
              {capabilities.canDecideAccess && (
                <Button icon="key" onClick={() => setDialog('access')}>
                  {t('publication.actions.decideAccess')}
                </Button>
              )}
              {capabilities.canReplaceContact && (
                <Button icon="edit" onClick={() => setDialog('contact')}>
                  {t('publication.actions.replaceContact')}
                </Button>
              )}
              {capabilities.canResendInvitation && (
                <Button icon="send" onClick={() => setDialog('resend')}>
                  {t('publication.actions.resend')}
                </Button>
              )}
              {capabilities.canSendReminder && (
                <Button icon="bell" onClick={() => setDialog('remind')}>
                  {t('publication.actions.remind')}
                </Button>
              )}
            </>
          ) : undefined
        }
      />
      <Banner tone="info">
        <p>{t('publication.participants.privacyNote')}</p>
      </Banner>
      {lastReminder !== null && (
        <Banner tone="success" title={t('publication.participant.reminderSent')}>
          <p>{lastReminder}</p>
        </Banner>
      )}

      <div className="tiq-grid tiq-grid--2">
        <Card title={t('publication.participant.invitationTitle')}>
          <DetailList
            items={[
              {
                key: 'supplier',
                label: t('publication.participant.legalSupplier'),
                value: `${detail.supplier.legalName} (${detail.supplier.name})`,
              },
              {
                key: 'source',
                label: t('publication.participant.source'),
                value: tEnum('participants.source', detail.source),
              },
              {
                key: 'contact',
                label: t('publication.participant.contact'),
                value:
                  detail.invitedContactName === null
                    ? null
                    : `${detail.invitedContactName} · ${detail.invitedContactEmail ?? ''}`,
              },
              {
                key: 'invitedAt',
                label: t('publication.participant.invitedAt'),
                value: at(detail.invitedAt),
              },
              {
                key: 'expires',
                label: t('publication.participant.expires'),
                value:
                  detail.invitationExpiresAt === null
                    ? null
                    : formatOfficialTime(detail.invitationExpiresAt, timeZone),
              },
              {
                key: 'registered',
                label: t('publication.participant.registered'),
                value: at(detail.registeredAt),
              },
            ]}
          />
          <p className="tiq-text-muted">{t('publication.participant.legalSupplierNote')}</p>
        </Card>
        <Card title={t('publication.participant.accessTitle')}>
          <DetailList
            items={[
              {
                key: 'access',
                label: t('publication.participant.accessStatus'),
                value: <StatusChip enum="participants.access_status" value={detail.accessStatus} />,
              },
              {
                key: 'requestReason',
                label: t('publication.participant.requestReason'),
                value: detail.accessRequestReason,
              },
              {
                key: 'decided',
                label: t('publication.participant.decided'),
                value:
                  detail.accessDecidedAt === null
                    ? null
                    : t('publication.participant.decidedValue', {
                        at: at(detail.accessDecidedAt) ?? '',
                        by: detail.accessDecidedBy?.fullName ?? t('publication.participant.system'),
                      }),
              },
              {
                key: 'decisionReason',
                label: t('publication.participant.decisionReason'),
                value: detail.accessDecisionReason,
              },
              {
                key: 'confidentiality',
                label: t('publication.participant.confidentiality'),
                value:
                  detail.confidentialityAcceptedAt === null
                    ? t('publication.participants.notAccepted')
                    : t('publication.participant.decidedValue', {
                        at: at(detail.confidentialityAcceptedAt) ?? '',
                        by:
                          detail.confidentialityAcceptedBy?.fullName ??
                          t('publication.participant.system'),
                      }),
              },
            ]}
          />
        </Card>
        <Card title={t('publication.participant.qualificationTitle')}>
          <DetailList
            items={[
              {
                key: 'gate',
                label: t('publication.participant.gate'),
                value: (
                  <StatusChip
                    enum="participants.qualification_gate"
                    value={detail.qualificationGate}
                  />
                ),
              },
              {
                key: 'program',
                label: t('publication.participant.program'),
                value: detail.qualification?.programName,
              },
              {
                key: 'status',
                label: t('publication.participant.qualificationStatus'),
                value:
                  detail.qualification === null ? null : (
                    <StatusChip
                      enum="v_qualification_status.effective_status"
                      value={detail.qualification.effectiveStatus}
                    />
                  ),
              },
              {
                key: 'to',
                label: t('publication.participant.effectiveTo'),
                value:
                  detail.qualification?.effectiveTo === null || detail.qualification === null
                    ? null
                    : formatCalendarDate(detail.qualification.effectiveTo),
              },
              {
                key: 'conditions',
                label: t('publication.participant.qualificationConditions'),
                value: detail.qualification?.conditions,
              },
            ]}
          />
        </Card>
        <Card title={t('publication.participant.intentTitle')}>
          <DetailList
            items={[
              {
                key: 'intent',
                label: t('publication.participant.intent'),
                value: <StatusChip enum="participants.bid_intent" value={detail.bidIntent} />,
              },
              {
                key: 'reason',
                label: t('publication.participant.sharedReason'),
                value: detail.sharedNoBidReason,
              },
              {
                key: 'changed',
                label: t('publication.participant.intentChanged'),
                value: at(detail.intentChangedAt),
              },
              {
                key: 'lots',
                label: t('publication.participant.lots'),
                value:
                  detail.selectedLotNos.length === 0
                    ? null
                    : detail.selectedLotNos
                        .map((no) => t('publication.common.lotNo', { no }))
                        .join(', '),
              },
            ]}
          />
          <p className="tiq-text-muted">{t('publication.participant.intentNote')}</p>
        </Card>
      </div>

      <Card
        flush
        title={t('publication.participant.ackTitle', {
          done: detail.acknowledgments.acknowledged,
          required: detail.acknowledgments.required,
        })}
      >
        <DataTable
          caption={t('publication.participant.ackCaption')}
          columns={ackColumns}
          rows={detail.acknowledgmentItems}
          rowKey={(item) => `${item.subjectType}:${item.subjectId}`}
          empty={
            <EmptyState compact icon="checkSquare" title={t('publication.participant.noAcks')} />
          }
        />
      </Card>
      <Card flush title={t('publication.participant.deliveriesTitle')}>
        <DataTable
          caption={t('publication.participant.deliveriesCaption')}
          columns={deliveryColumns}
          rows={detail.deliveries}
          rowKey={(item) => String(item.noticeId)}
          empty={
            <EmptyState compact icon="mail" title={t('publication.participant.noDeliveries')} />
          }
        />
      </Card>
      <Card title={t('publication.participant.historyTitle')}>
        {history.length === 0 ? (
          <EmptyState compact icon="history" title={t('publication.participant.noHistory')} />
        ) : (
          <Timeline items={history} label={t('publication.participant.historyTitle')} />
        )}
        <ButtonLink to={publicationPaths.participants(tender.tenderId)} size="sm" variant="ghost">
          {t('publication.participant.back')}
        </ButtonLink>
      </Card>

      <ReplaceContactDialog
        tender={tender}
        participant={dialog === 'contact' ? detail : null}
        onClose={() => setDialog(null)}
        onDone={(next) => applyRow(next, t('publication.participant.contactReplaced'))}
      />
      <AccessDecisionDialog
        tender={tender}
        participant={dialog === 'access' ? detail : null}
        requestReason={detail.accessRequestReason}
        onClose={() => setDialog(null)}
        onDone={(next) =>
          applyRow(
            next,
            t('publication.participants.accessDecided', {
              supplier: next.supplier.legalName,
              status: tEnum('participants.access_status', next.accessStatus),
            }),
          )
        }
      />
      <ResendDialog
        tender={tender}
        participant={dialog === 'resend' ? detail : null}
        onClose={() => setDialog(null)}
        onDone={(next) => applyRow(next, t('publication.participant.resent'))}
      />
      <ReminderDialog
        tender={tender}
        participant={dialog === 'remind' ? detail : null}
        onClose={() => setDialog(null)}
        onDone={(message) => {
          setDialog(null);
          setLastReminder(message);
          toast.show(message, 'success');
        }}
      />
    </div>
  );
}
