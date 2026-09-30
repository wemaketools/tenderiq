/**
 * SUP-21 — One outcome: the supplier's own result per lot (preferred or final award, unsuccessful, cancelled),
 * the outcome notices with their acknowledgment and terms acceptance, the waiting period, the debriefing route and
 * the challenge instructions. An intention to award is never shown as a final award or a contract (BR-31), and a
 * debrief explains only the supplier's own result (AC-27).
 */
import { useState } from 'react';
import { Link } from 'react-router';

import {
  acceptOutcomeNoticeTerms,
  acknowledgeOutcomeNotice,
  getSupplierOutcome,
  requestDebrief,
} from '@contracts/awards';
import type {
  NoticeAcknowledgment,
  SupplierDebrief,
  SupplierOutcomeDetail,
  SupplierOutcomeLot,
  SupplierOutcomeNotice,
} from '@contracts/awards';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  MoneyText,
  OfficialDeadline,
  OrDash,
  PageHeader,
  QueryView,
  Reference,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatDateTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { OwnResultCard } from '../../awards/components/OwnResultCard';
import { TextBlock } from '../../awards/components/TextBlock';
import { withAwardMessage } from '../../awards/lib/errors';
import { useIdParam } from '../../awards/lib/hooks';
import {
  LOT_RESULT_TONE,
  OUTCOME_RESULT_TONE,
  lotLabel,
  lotNosLabel,
} from '../../awards/lib/labels';
import { outcomePaths } from '../lib/paths';

export default function SupplierOutcomePage() {
  const tenderId = useIdParam('tenderId');
  const query = useApiQuery(
    getSupplierOutcome,
    tenderId === null ? null : { params: { tenderId } },
  );
  if (tenderId === null) {
    return <EmptyState title={t('outcomes.detail.notFound')} icon="trophy" />;
  }
  const back = { to: outcomePaths.outcomes, label: t('outcomes.detail.back') };
  return (
    <QueryView
      query={query}
      loading={<PageHeader title={t('outcomes.detail.title')} back={back} />}
    >
      {(data) => <OutcomeBody key={data.tenderId} outcome={data} back={back} />}
    </QueryView>
  );
}

type NoticeCommand = {
  readonly kind: 'acknowledge' | 'accept';
  readonly notice: SupplierOutcomeNotice;
};

function OutcomeBody({
  outcome,
  back,
}: {
  readonly outcome: SupplierOutcomeDetail;
  readonly back: { readonly to: string; readonly label: string };
}) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = outcome.officialTimeZone;
  const canAcknowledge = usePermission('supplier.notices.acknowledge');
  const canAccept = usePermission(acceptOutcomeNoticeTerms.permission);
  const canComplain = usePermission('supplier.complaint.submit');
  const [acks, setAcks] = useState<Readonly<Record<number, NoticeAcknowledgment>>>({});
  const [debrief, setDebrief] = useState<SupplierDebrief | null>(outcome.debrief);
  const [command, setCommand] = useState<NoticeCommand | null>(null);
  const [requesting, setRequesting] = useState(false);

  const acknowledge = useApiMutation(acknowledgeOutcomeNotice);
  const accept = useApiMutation(acceptOutcomeNoticeTerms);
  const request = useApiMutation(requestDebrief);
  const active = command?.kind === 'accept' ? accept : acknowledge;

  const intent = outcome.lots.some((lot) => lot.result === 'intent_to_award');
  const preferred = outcome.lots.some((lot) => lot.result === 'preferred_bidder');
  const preferredWithdrawn = outcome.lots.some((lot) => lot.result === 'preferred_withdrawn');
  const scopeOf = (notice: SupplierOutcomeNotice): string =>
    `${outcome.reference} · ${notice.title} · ${outcome.buyer.name}`;

  const noticeState = (notice: SupplierOutcomeNotice) => {
    const ack = acks[notice.noticeId];
    return {
      acknowledgedAt: ack?.acknowledgedAt ?? notice.acknowledgedAt,
      acknowledgedBy: ack?.acknowledgedBy ?? notice.acknowledgedBy,
      termsAcceptedAt: ack?.termsAcceptedAt ?? notice.termsAcceptedAt,
    };
  };

  const confirmNotice = async (): Promise<void> => {
    if (command === null) return;
    try {
      const result =
        command.kind === 'acknowledge'
          ? await acknowledge.mutate({ params: { noticeId: command.notice.noticeId } })
          : await accept.mutate({
              params: { noticeId: command.notice.noticeId },
              body: { confirmation: true },
            });
      setAcks((current) => ({ ...current, [result.noticeId]: result }));
      setCommand(null);
      toast.show(
        command.kind === 'acknowledge'
          ? t('outcomes.detail.acknowledged')
          : t('outcomes.detail.accepted'),
        'success',
      );
    } catch {
      // The dialog shows the error.
    }
  };

  const confirmRequest = async ({ reason }: { readonly reason: string }): Promise<void> => {
    try {
      const result = await request.mutate({
        params: { tenderId: outcome.tenderId },
        body: { note: reason.trim() === '' ? undefined : reason.trim() },
      });
      setDebrief(result);
      setRequesting(false);
      toast.show(t('outcomes.detail.debriefRequested'), 'success');
    } catch {
      // The dialog shows the error.
    }
  };

  const lotColumns: DataTableColumn<SupplierOutcomeLot>[] = [
    { id: 'lot', header: t('outcomes.detail.col.lot'), cell: (row) => lotLabel(row.lot) },
    {
      id: 'result',
      header: t('outcomes.detail.col.result'),
      cell: (row) => (
        <Chip tone={LOT_RESULT_TONE[row.result]}>{t(`outcomes.lotResultValue.${row.result}`)}</Chip>
      ),
    },
    {
      id: 'value',
      header: t('outcomes.detail.col.value'),
      numeric: true,
      cell: (row) =>
        row.awardedValue === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <MoneyText value={row.awardedValue} />
        ),
    },
    {
      id: 'reason',
      header: t('outcomes.detail.col.reason'),
      cell: (row) => (
        <>
          <span>{row.reason ?? ''}</span>
          {row.conditions !== null && (
            <span className="tiq-cell-sub">
              {t('outcomes.detail.conditions', { text: row.conditions })}
            </span>
          )}
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={`${outcome.reference} ${outcome.title}`}
        back={back}
        meta={
          <>
            <span>{t('outcomes.detail.actingAs', { name: tenant?.name ?? '' })}</span>
            <Reference value={outcome.reference} />
            <span>{outcome.buyer.name}</span>
            <Chip tone={OUTCOME_RESULT_TONE[outcome.result]}>
              {t(`outcomes.result.${outcome.result}`)}
            </Chip>
            {outcome.standstill !== null && (
              <span className="tiq-inline">
                <span className="tiq-text-muted">{t('outcomes.detail.standstillEnds')}</span>
                <OfficialDeadline deadline={outcome.standstill.effectiveEndsAt} />
              </span>
            )}
          </>
        }
        primaryAction={
          outcome.canRequestDebrief && debrief === null ? (
            <Button
              variant="primary"
              icon="messageSquare"
              onClick={() => {
                request.reset();
                setRequesting(true);
              }}
            >
              {t('outcomes.detail.requestDebrief')}
            </Button>
          ) : undefined
        }
      />
      <div className="tiq-stack tiq-stack--spaced">
        {preferred && (
          <Banner tone="warning" title={t('outcomes.detail.preferredTitle')}>
            {t('outcomes.detail.preferredText')}
          </Banner>
        )}
        {preferredWithdrawn && (
          <Banner tone="info" title={t('outcomes.detail.preferredWithdrawnTitle')}>
            {t('outcomes.detail.preferredWithdrawnText')}
          </Banner>
        )}
        {intent && (
          <Banner tone="warning" title={t('outcomes.detail.intentTitle')}>
            {t('outcomes.detail.intentText')}
          </Banner>
        )}
        {outcome.procurementHoldActive && (
          <Banner tone="error" title={t('outcomes.detail.holdTitle')}>
            {t('outcomes.detail.holdText')}
          </Banner>
        )}
        <Card
          title={t('outcomes.detail.lotsTitle')}
          subtitle={t('outcomes.detail.lotsSubtitle')}
          flush
        >
          <DataTable
            caption={t('outcomes.detail.lotsTitle')}
            columns={lotColumns}
            rows={outcome.lots}
            rowKey={(row) => String(row.lot.lotId)}
            empty={<EmptyState compact title={t('outcomes.detail.noLots')} />}
          />
        </Card>
        <div className="tiq-grid tiq-grid--sidebar">
          <div className="tiq-stack tiq-stack--spaced">
            <Card title={t('outcomes.detail.noticesTitle')}>
              {outcome.notices.length === 0 ? (
                <p className="tiq-text-muted">{t('outcomes.detail.noNotices')}</p>
              ) : (
                <div className="tiq-stack tiq-stack--spaced">
                  {outcome.notices.map((notice) => {
                    const state = noticeState(notice);
                    return (
                      <section
                        key={notice.noticeId}
                        className="tiq-stack"
                        aria-label={notice.title}
                      >
                        <div className="tiq-inline">
                          <StatusChip enum="notices.notice_type" value={notice.noticeType} />
                          <strong>{notice.title}</strong>
                        </div>
                        <p className="tiq-text-muted">
                          {t('outcomes.detail.issued', {
                            at: formatDateTime(notice.issuedAt, timeZone),
                            lots: lotNosLabel(notice.lotNos),
                          })}
                        </p>
                        <TextBlock text={notice.body} />
                        <DetailList
                          items={[
                            {
                              label: t('outcomes.detail.ackStatus'),
                              value: !notice.requiresAcknowledgment ? (
                                t('outcomes.detail.ackNotRequired')
                              ) : state.acknowledgedAt === null ? (
                                <span className="tiq-text-warning">
                                  {t('outcomes.detail.ackPending')}
                                </span>
                              ) : (
                                t('outcomes.detail.ackDone', {
                                  at: formatDateTime(state.acknowledgedAt, timeZone),
                                  name: state.acknowledgedBy?.fullName ?? '',
                                })
                              ),
                            },
                            {
                              label: t('outcomes.detail.terms'),
                              value: !notice.hasTerms
                                ? t('outcomes.detail.noTerms')
                                : state.termsAcceptedAt === null
                                  ? t('outcomes.detail.termsPending')
                                  : t('outcomes.detail.termsAccepted', {
                                      at: formatDateTime(state.termsAcceptedAt, timeZone),
                                    }),
                            },
                          ]}
                        />
                        <div className="tiq-inline">
                          {canAcknowledge &&
                            notice.requiresAcknowledgment &&
                            state.acknowledgedAt === null && (
                              <Button
                                icon="check"
                                onClick={() => {
                                  acknowledge.reset();
                                  setCommand({ kind: 'acknowledge', notice });
                                }}
                              >
                                {t('outcomes.detail.acknowledge')}
                              </Button>
                            )}
                          {canAccept &&
                            notice.hasTerms &&
                            state.acknowledgedAt !== null &&
                            state.termsAcceptedAt === null && (
                              <Button
                                icon="handshake"
                                onClick={() => {
                                  accept.reset();
                                  setCommand({ kind: 'accept', notice });
                                }}
                              >
                                {t('outcomes.detail.acceptTerms')}
                              </Button>
                            )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </Card>
            <Card title={t('outcomes.detail.debriefTitle')}>
              <div className="tiq-stack">
                <TextBlock text={outcome.debriefInstructions} />
                {debrief === null ? (
                  outcome.canRequestDebrief ? (
                    outcome.debriefDeadline !== null && (
                      <OfficialDeadline
                        deadline={outcome.debriefDeadline}
                        variant="block"
                        label={t('outcomes.detail.debriefDeadline')}
                        showRemaining
                      />
                    )
                  ) : (
                    <p className="tiq-text-muted">{t('outcomes.detail.debriefNotAvailable')}</p>
                  )
                ) : (
                  <DetailList
                    stacked
                    items={[
                      {
                        label: t('outcomes.detail.debriefStatus'),
                        value: <StatusChip enum="debrief_requests.status" value={debrief.status} />,
                      },
                      {
                        label: t('outcomes.detail.requestedBy'),
                        value: `${debrief.requestedBy.fullName} · ${formatDateTime(debrief.requestedAt, timeZone)}`,
                      },
                      {
                        label: t('outcomes.detail.debriefDue'),
                        value: <OfficialDeadline deadline={debrief.dueAt} />,
                      },
                      {
                        label: t('outcomes.detail.meeting'),
                        value:
                          debrief.meetingAt === null ? null : (
                            <OfficialDeadline deadline={debrief.meetingAt} />
                          ),
                      },
                      {
                        label: t('outcomes.detail.writtenResponse'),
                        value: (
                          <TextBlock
                            text={debrief.writtenResponse}
                            empty={t('outcomes.detail.notYetProvided')}
                          />
                        ),
                      },
                      { label: t('outcomes.detail.effect'), value: debrief.effectOnDeadlines },
                      { label: t('outcomes.detail.declineReason'), value: debrief.declineReason },
                    ]}
                  />
                )}
              </div>
            </Card>
            {debrief?.ownResult !== null && debrief?.ownResult !== undefined && (
              <OwnResultCard result={debrief.ownResult} title={t('outcomes.detail.ownResult')} />
            )}
          </div>
          <div className="tiq-stack tiq-stack--spaced">
            <Card title={t('outcomes.detail.standstillTitle')}>
              {outcome.standstill === null ? (
                <p className="tiq-text-muted">{t('outcomes.detail.noStandstill')}</p>
              ) : (
                <DetailList
                  stacked
                  items={[
                    {
                      label: t('outcomes.detail.standstillStatus'),
                      value: (
                        <StatusChip
                          enum="standstill_periods.status"
                          value={outcome.standstill.status}
                        />
                      ),
                    },
                    {
                      label: t('outcomes.detail.effectiveEnd'),
                      value: (
                        <OfficialDeadline
                          deadline={outcome.standstill.effectiveEndsAt}
                          variant="block"
                        />
                      ),
                    },
                    {
                      label: t('outcomes.detail.originalEnd'),
                      value: (
                        <OfficialDeadline deadline={outcome.standstill.endsAt} showLocal={false} />
                      ),
                    },
                    {
                      label: t('outcomes.detail.extendedTo'),
                      value:
                        outcome.standstill.extendedTo === null ? null : (
                          <OfficialDeadline
                            deadline={outcome.standstill.extendedTo}
                            showLocal={false}
                          />
                        ),
                    },
                    {
                      label: t('outcomes.detail.extensionReason'),
                      value: outcome.standstill.extensionReason,
                    },
                    {
                      label: t('outcomes.detail.dayType'),
                      value: tEnum(
                        'policy_profile_versions.standstill_day_type',
                        outcome.standstill.dayType,
                      ),
                    },
                  ]}
                />
              )}
            </Card>
            <Card
              title={t('outcomes.detail.challengeTitle')}
              actions={
                canComplain ? (
                  <ButtonLink
                    to={outcomePaths.newComplaint(outcome.tenderId)}
                    icon="scale"
                    size="sm"
                  >
                    {t('outcomes.detail.lodge')}
                  </ButtonLink>
                ) : undefined
              }
            >
              <div className="tiq-stack">
                <TextBlock text={outcome.challengeInstructions} />
                {outcome.complaintDeadline !== null && (
                  <OfficialDeadline
                    deadline={outcome.complaintDeadline}
                    variant="block"
                    label={t('outcomes.detail.complaintDeadline')}
                  />
                )}
                {outcome.complaints.length > 0 && (
                  <ul className="tiq-stack">
                    {outcome.complaints.map((complaint) => (
                      <li key={complaint.complaintId} className="tiq-inline">
                        <Link to={outcomePaths.complaint(complaint.complaintId)}>
                          {complaint.reference}
                        </Link>
                        <StatusChip enum="complaints.status" value={complaint.status} size="sm" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <ConfirmActionDialog
        open={command !== null}
        title={
          command?.kind === 'accept'
            ? t('outcomes.detail.acceptTitle')
            : t('outcomes.detail.acknowledgeTitle')
        }
        scope={command === null ? '' : scopeOf(command.notice)}
        consequence={
          command?.kind === 'accept'
            ? t('outcomes.detail.acceptConsequence')
            : t('outcomes.detail.acknowledgeConsequence')
        }
        confirmLabel={
          command?.kind === 'accept'
            ? t('outcomes.detail.acceptTerms')
            : t('outcomes.detail.acknowledge')
        }
        acknowledgement={
          command?.kind === 'accept' ? t('outcomes.detail.acceptAcknowledgement') : undefined
        }
        pending={active.pending}
        error={withAwardMessage(active.error)}
        onCancel={() => setCommand(null)}
        onConfirm={confirmNotice}
      />
      <ConfirmActionDialog
        open={requesting}
        title={t('outcomes.detail.requestDebrief')}
        scope={`${outcome.reference} ${outcome.title} · ${outcome.buyer.name}`}
        consequence={t('outcomes.detail.requestConsequence')}
        confirmLabel={t('outcomes.detail.requestDebrief')}
        reason={{ label: t('outcomes.detail.requestNote'), required: false }}
        pending={request.pending}
        error={withAwardMessage(request.error)}
        onCancel={() => setRequesting(false)}
        onConfirm={confirmRequest}
      />
    </>
  );
}
