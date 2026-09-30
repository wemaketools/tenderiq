/**
 * SUP-07 one invitation or access request: the inviting buyer, the event, the intended LEGAL supplier, the invited
 * contact, confidentiality conditions, participation conditions with this supplier's state, the access decision and
 * the record's history. An authorized representative accepts or declines (optionally sharing a reason with the
 * buyer), accepts the confidentiality undertaking, or requests document access again after a denial.
 */
import { useState } from 'react';

import { publicationEndpoints } from '@contracts/publication';
import type { ConditionState, InvitationDetail, ParticipantEvent } from '@contracts/publication';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  DetailList,
  EmptyState,
  ErrorState,
  OfficialDeadline,
  PageHeader,
  Reference,
  RestrictedState,
  SkeletonBlock,
  StatusChip,
  Timeline,
  useToast,
} from '../../../components/ui';
import type { TimelineItem } from '../../../components/ui';
import { formatDateTime, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ConditionsCard } from '../../publication/components/NoticeSections';
import { useIdParam } from '../../publication/lib/hooks';
import { opportunityPaths } from '../../publication/lib/paths';
import { NOTICES_ACKNOWLEDGE } from '../../publication/lib/permissions';
import {
  AcceptInvitationDialog,
  ConfidentialityDialog,
  DeclineInvitationDialog,
  RequestAccessDialog,
} from '../components/ParticipationDialogs';

export default function InvitationPage() {
  const participantId = useIdParam('participantId');
  const query = useApiQuery(
    publicationEndpoints.getInvitation,
    participantId === null ? null : { params: { participantId } },
  );
  const back = { to: opportunityPaths.invitations, label: t('opportunities.invitation.back') };

  if (participantId === null || query.error?.kind === 'not_found') {
    return (
      <div className="tiq-page">
        <PageHeader title={t('opportunities.invitation.notFoundTitle')} back={back} />
        <EmptyState
          icon="mail"
          title={t('opportunities.invitation.notFoundTitle')}
          description={t('opportunities.invitation.notFound')}
        />
      </div>
    );
  }
  if (query.data === undefined) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('opportunities.invitation.loadingTitle')} back={back} />
        {query.error === null ? (
          <SkeletonBlock lines={8} />
        ) : query.error.kind === 'forbidden' ? (
          <RestrictedState />
        ) : (
          <ErrorState error={query.error} onRetry={query.reload} />
        )}
      </div>
    );
  }
  return <InvitationView key={participantId} initial={query.data} back={back} />;
}

type Dialog = 'accept' | 'decline' | 'confidentiality' | 'access' | null;

function nextActionOf(detail: InvitationDetail): string {
  if (detail.kind === 'invitation' && detail.invitationStatus === 'invited') {
    return t('opportunities.next.answerInvitation');
  }
  if (detail.confidentialityRequired && detail.confidentialityAcceptedAt === null) {
    return t('opportunities.next.acceptConfidentiality');
  }
  if (detail.accessStatus === 'requested') return t('opportunities.next.awaitAccess');
  if (detail.accessStatus === 'denied') return t('opportunities.next.accessDenied');
  return t('opportunities.next.openWorkspace');
}

function ConditionStateChip({ condition }: { readonly condition: ConditionState }) {
  if (condition.state === 'met') {
    return (
      <Chip tone="success" size="sm">
        {t('opportunities.conditions.met')}
      </Chip>
    );
  }
  if (condition.state === 'outstanding') {
    return (
      <Chip tone="warning" size="sm">
        {t('opportunities.conditions.outstanding')}
      </Chip>
    );
  }
  return (
    <Chip tone="neutral" size="sm">
      {t('opportunities.conditions.notApplicable')}
    </Chip>
  );
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

function InvitationView({
  initial,
  back,
}: {
  readonly initial: InvitationDetail;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const toast = useToast();
  const canAnswerPermission = usePermission(NOTICES_ACKNOWLEDGE);
  const [detail, setDetail] = useState(initial);
  const [dialog, setDialog] = useState<Dialog>(null);
  // The invitation belongs to the buyer's event: its dates render in the buyer's official zone (DD-33).
  const timeZone = detail.buyer.officialTimeZone;
  const at = (value: string | null): string | null =>
    value === null ? null : formatDateTime(value, timeZone);

  const canRespond =
    canAnswerPermission &&
    detail.capabilities.canRespond &&
    detail.kind === 'invitation' &&
    detail.invitationStatus === 'invited';
  const canConfidentiality =
    canAnswerPermission &&
    detail.capabilities.canAcceptConfidentiality &&
    detail.confidentialityRequired &&
    detail.confidentialityAcceptedAt === null &&
    detail.invitationStatus !== 'invited';
  const canRequestAgain = canAnswerPermission && detail.accessStatus === 'denied';

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
        title={t(`opportunities.invitation.title.${detail.kind}`, {
          reference: detail.tender.reference,
        })}
        subtitle={detail.tender.title}
        back={back}
        meta={
          <>
            <Reference value={detail.tender.reference} to={detail.opportunityPath} />
            <StatusChip enum="tenders.status" value={detail.tender.status} />
            {detail.kind === 'invitation' ? (
              <StatusChip enum="participants.invitation_status" value={detail.invitationStatus} />
            ) : (
              <StatusChip enum="participants.access_status" value={detail.accessStatus} />
            )}
            {detail.closingAt !== null && (
              <OfficialDeadline
                deadline={detail.closingAt}
                label={t('opportunities.common.closing')}
                showLocal={false}
              />
            )}
            <span className="tiq-text-muted">
              {t('opportunities.common.nextAction')}: <strong>{nextActionOf(detail)}</strong>
            </span>
          </>
        }
        primaryAction={
          canRespond ? (
            <Button variant="primary" icon="checkCircle" onClick={() => setDialog('accept')}>
              {t('opportunities.invitation.accept')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {canRespond && (
              <Button icon="xCircle" onClick={() => setDialog('decline')}>
                {t('opportunities.invitation.decline')}
              </Button>
            )}
            {canConfidentiality && (
              <Button icon="lock" onClick={() => setDialog('confidentiality')}>
                {t('opportunities.confidentiality.accept')}
              </Button>
            )}
            {canRequestAgain && (
              <Button icon="key" onClick={() => setDialog('access')}>
                {t('opportunities.access.requestAgain')}
              </Button>
            )}
            <ButtonLink to={detail.opportunityPath} icon="arrowRight">
              {t('opportunities.invitation.openWorkspace')}
            </ButtonLink>
          </>
        }
      />
      {!canAnswerPermission && detail.awaitingResponse && (
        <Banner tone="warning" title={t('opportunities.invitation.representativeTitle')}>
          <p>{t('opportunities.invitation.representative')}</p>
        </Banner>
      )}
      {detail.invitationStatus === 'declined' && (
        <Banner tone="info" title={t('opportunities.invitation.declinedTitle')}>
          <p>
            {detail.sharedNoBidReason === null
              ? t('opportunities.invitation.declinedPrivate')
              : t('opportunities.invitation.declinedShared', { reason: detail.sharedNoBidReason })}
          </p>
        </Banner>
      )}

      <div className="tiq-grid tiq-grid--2">
        <Card title={t('opportunities.invitation.detailsTitle')}>
          <DetailList
            items={[
              {
                key: 'buyer',
                label: t('opportunities.invitation.buyer'),
                value: detail.buyer.name,
              },
              {
                key: 'event',
                label: t('opportunities.invitation.event'),
                value: `${detail.tender.reference} · ${detail.tender.title} (${tEnum('tenders.participation', detail.tender.participation)})`,
              },
              {
                key: 'legal',
                label: t('opportunities.invitation.legalSupplier'),
                value: `${detail.intendedSupplier.legalName} (${detail.intendedSupplier.name})`,
              },
              {
                key: 'contact',
                label: t('opportunities.invitation.contact'),
                value:
                  detail.invitedContactName === null
                    ? null
                    : `${detail.invitedContactName} · ${detail.invitedContactEmail ?? ''}`,
              },
              {
                key: 'invited',
                label: t('opportunities.invitation.invitedAt'),
                value: at(detail.invitedAt),
              },
              {
                key: 'expires',
                label: t('opportunities.invitation.expires'),
                value:
                  detail.invitationExpiresAt === null
                    ? null
                    : formatOfficialTime(detail.invitationExpiresAt, timeZone),
              },
              {
                key: 'message',
                label: t('opportunities.invitation.message'),
                value: detail.invitationMessage,
              },
            ]}
          />
          <p className="tiq-text-muted">{t('opportunities.invitation.legalNote')}</p>
        </Card>
        <Card title={t('opportunities.invitation.accessTitle')}>
          <DetailList
            items={[
              {
                key: 'access',
                label: t('opportunities.invitations.accessStatus'),
                value: <StatusChip enum="participants.access_status" value={detail.accessStatus} />,
              },
              {
                key: 'requested',
                label: t('opportunities.invitation.requestedAt'),
                value: at(detail.accessRequestedAt),
              },
              {
                key: 'reason',
                label: t('opportunities.invitation.requestReason'),
                value: detail.accessRequestReason,
              },
              {
                key: 'decided',
                label: t('opportunities.invitation.decidedAt'),
                value: at(detail.accessDecidedAt),
              },
              {
                key: 'decision',
                label: t('opportunities.invitation.decisionReason'),
                value: detail.accessDecisionReason,
              },
            ]}
          />
        </Card>
        <Card title={t('opportunities.invitation.confidentialityTitle')}>
          {!detail.confidentialityRequired ? (
            <EmptyState
              compact
              icon="unlock"
              title={t('opportunities.invitation.noConfidentiality')}
            />
          ) : (
            <div className="tiq-stack">
              <p>
                {detail.confidentialityText ?? t('opportunities.invitation.confidentialityDefault')}
              </p>
              {detail.confidentialityAcceptedAt === null ? (
                <span className="tiq-inline">
                  <Chip tone="warning">{t('opportunities.invitations.outstanding')}</Chip>
                </span>
              ) : (
                <p className="tiq-text-success">
                  {t('opportunities.invitation.acceptedBy', {
                    at: at(detail.confidentialityAcceptedAt) ?? '',
                    by:
                      detail.confidentialityAcceptedBy?.fullName ??
                      t('publication.participant.system'),
                  })}
                </p>
              )}
            </div>
          )}
        </Card>
        <ConditionsCard
          conditions={detail.conditions}
          intro={t('opportunities.conditions.intro')}
          renderState={(condition) => <ConditionStateChip condition={condition} />}
        />
      </div>

      <Card title={t('publication.participant.historyTitle')}>
        {history.length === 0 ? (
          <EmptyState compact icon="history" title={t('publication.participant.noHistory')} />
        ) : (
          <Timeline items={history} label={t('publication.participant.historyTitle')} />
        )}
      </Card>

      <AcceptInvitationDialog
        open={dialog === 'accept'}
        invitation={detail}
        onClose={() => setDialog(null)}
        onDone={(next) => {
          setDialog(null);
          setDetail(next);
          toast.show(
            t('opportunities.invitation.accepted', { reference: next.tender.reference }),
            'success',
          );
        }}
      />
      <DeclineInvitationDialog
        open={dialog === 'decline'}
        invitation={detail}
        onClose={() => setDialog(null)}
        onDone={(next) => {
          setDialog(null);
          setDetail(next);
          toast.show(
            t('opportunities.invitation.declined', { reference: next.tender.reference }),
            'success',
          );
        }}
      />
      <ConfidentialityDialog
        open={dialog === 'confidentiality'}
        tender={detail.tender}
        text={detail.confidentialityText}
        onClose={() => setDialog(null)}
        onDone={(participation) => {
          setDialog(null);
          setDetail({
            ...detail,
            confidentialityAcceptedAt: participation.confidentialityAcceptedAt,
          });
          toast.show(t('opportunities.confidentiality.accepted'), 'success');
        }}
      />
      <RequestAccessDialog
        tender={dialog === 'access' ? detail.tender : null}
        onClose={() => setDialog(null)}
        onDone={(participation, tender) => {
          setDialog(null);
          setDetail({ ...detail, accessStatus: participation.accessStatus });
          toast.show(
            t('opportunities.access.requested', {
              reference: tender.reference,
              status: tEnum('participants.access_status', participation.accessStatus),
            }),
            'success',
          );
        }}
      />
    </div>
  );
}
