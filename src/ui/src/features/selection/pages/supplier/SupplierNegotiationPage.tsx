/**
 * SUP-19 — The supplier's own negotiation: authorized topics, the meeting records shared with it, proposed terms,
 * concessions and unresolved issues, and the final-offer rounds it is invited to. Actions: review terms, send an
 * internally approved round response, and open the response workspace to submit a final offer. Other suppliers'
 * negotiation records remain hidden.
 */
import { useState } from 'react';

import { selectionEndpoints } from '@contracts/selection';
import type { SupplierNegotiationRound } from '@contracts/selection';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  OfficialDeadline,
  PageHeader,
  QueryView,
  StatusChip,
  TextArea,
  Timeline,
  formErrors,
  useToast,
} from '../../../../components/ui';
import { formatDateTime, formatOfficialTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { withSelectionMessage } from '../../lib/errors';
import { useIdParam } from '../../lib/hooks';
import { attempt } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';
import { SUPPLIER_ROUND_RESPOND } from '../../lib/permissions';

export default function SupplierNegotiationPage() {
  const negotiationId = useIdParam('negotiationId');
  const toast = useToast();
  const canRespond = usePermission(SUPPLIER_ROUND_RESPOND);
  const [responding, setResponding] = useState<SupplierNegotiationRound | null>(null);
  const [proposal, setProposal] = useState('');
  const [concessions, setConcessions] = useState('');
  const [touched, setTouched] = useState(false);
  const [answered, setAnswered] = useState<Readonly<Record<number, SupplierNegotiationRound>>>({});
  const query = useApiQuery(
    selectionEndpoints.getSupplierNegotiation,
    negotiationId === null ? null : { params: { negotiationId } },
  );
  const respond = useApiMutation(selectionEndpoints.respondToRound);
  const server = formErrors(respond.error, ['supplierProposal', 'concessions']);
  const view = query.data;
  const roundsOf = (list: readonly SupplierNegotiationRound[]) =>
    list.map((round) => answered[round.roundId] ?? round);
  const awaiting =
    view === undefined ? [] : roundsOf(view.rounds).filter((round) => round.awaitingResponse);

  const closeDialog = (): void => {
    respond.reset();
    setResponding(null);
    setProposal('');
    setConcessions('');
    setTouched(false);
  };

  return (
    <div className="tiq-page">
      <PageHeader
        title={
          view === undefined
            ? t('selection.supplierNegotiation.title')
            : t('selection.supplierNegotiation.heading', { reference: view.tender.reference })
        }
        back={{
          to: selectionPaths.supplierNegotiations,
          label: t('selection.supplierNegotiations.title'),
        }}
        meta={
          view === undefined ? undefined : (
            <>
              <span className="tiq-ref">{view.tender.reference}</span>
              <span>{view.buyer.name}</span>
              <StatusChip enum="negotiations.status" value={view.status} />
              <span>
                {t('selection.common.nextAction', {
                  action:
                    awaiting.length > 0
                      ? t('selection.supplierNegotiation.next.respond')
                      : t('selection.supplierNegotiation.next.none'),
                })}
              </span>
            </>
          )
        }
        primaryAction={
          view !== undefined && canRespond && awaiting[0] !== undefined ? (
            <Button
              variant="primary"
              icon="send"
              onClick={() => setResponding(awaiting[0] ?? null)}
            >
              {t('selection.supplierNegotiation.respond')}
            </Button>
          ) : undefined
        }
      />
      <QueryView query={query}>
        {(data) => (
          <>
            <Banner tone="info" title={t('selection.supplierNegotiation.privacy')} />
            {data.outcomeSummary !== null && (
              <Banner tone="success" title={t('selection.negotiation.outcome')}>
                <p>{data.outcomeSummary}</p>
              </Banner>
            )}
            <div className="tiq-grid tiq-grid--sidebar">
              <Card
                title={t('selection.supplierNegotiation.rounds')}
                subtitle={t('selection.supplierNegotiation.roundsHint')}
              >
                {data.rounds.length === 0 ? (
                  <EmptyState compact title={t('selection.supplierNegotiation.noRounds')} />
                ) : (
                  <Timeline
                    label={t('selection.supplierNegotiation.rounds')}
                    items={roundsOf(data.rounds).map((round) => ({
                      id: round.roundId,
                      icon: 'handshake',
                      tone: round.awaitingResponse ? 'warning' : 'accent',
                      title: t('selection.negotiation.roundTitle', { no: round.roundNo }),
                      meta: (
                        <>
                          {round.meetingAt === null
                            ? t('selection.negotiation.notMet')
                            : formatOfficialTime(round.meetingAt, data.tender.officialTimeZone)}
                          {' · '}
                          {round.participants}
                        </>
                      ),
                      detail: (
                        <div className="tiq-stack">
                          <DetailList
                            stacked
                            items={[
                              {
                                label: t('selection.negotiation.topics'),
                                value:
                                  round.topics.length === 0
                                    ? t('selection.negotiation.noTopics')
                                    : round.topics.join(' · '),
                              },
                              { label: t('selection.round.minutes'), value: round.minutes },
                              {
                                label: t('selection.supplierNegotiation.buyerTerms'),
                                value: round.buyerProposal,
                              },
                              {
                                label: t('selection.supplierNegotiation.yourProposal'),
                                value: round.supplierProposal,
                              },
                              { label: t('selection.round.concessions'), value: round.concessions },
                              {
                                label: t('selection.round.unresolved'),
                                value: round.unresolvedIssues,
                              },
                              {
                                label: t('selection.negotiation.supplierResponse'),
                                value:
                                  round.supplierResponseAt === null
                                    ? null
                                    : formatDateTime(
                                        round.supplierResponseAt,
                                        data.tender.officialTimeZone,
                                      ),
                              },
                            ]}
                          />
                          {round.awaitingResponse && canRespond && (
                            <div className="tiq-inline">
                              <Button size="sm" icon="send" onClick={() => setResponding(round)}>
                                {t('selection.supplierNegotiation.respond')}
                              </Button>
                            </div>
                          )}
                          {round.awaitingResponse && !canRespond && (
                            <p className="tiq-text-muted">
                              {t('selection.supplierNegotiation.respondRestricted')}
                            </p>
                          )}
                        </div>
                      ),
                    }))}
                  />
                )}
              </Card>
              <div className="tiq-stack">
                <Card title={t('selection.supplierNegotiation.scope')}>
                  <DetailList
                    stacked
                    items={[
                      { label: t('selection.supplierInvites.buyer'), value: data.buyer.name },
                      {
                        label: t('selection.common.tender'),
                        value: `${data.tender.reference} ${data.tender.title}`,
                      },
                      {
                        label: t('selection.supplierNegotiation.offer'),
                        value: data.isAlternative
                          ? t('selection.common.variant')
                          : t('selection.supplierNegotiation.mainOffer'),
                      },
                      {
                        label: t('selection.negotiations.col.topics'),
                        value: (
                          <span className="tiq-inline">
                            {data.allowedTopics.map((topic) => (
                              <Chip key={topic} tone="accent" size="sm">
                                {topic}
                              </Chip>
                            ))}
                          </span>
                        ),
                      },
                    ]}
                  />
                </Card>
                <Card title={t('selection.supplierNegotiations.finalOffers')}>
                  {data.finalOfferRounds.length === 0 ? (
                    <EmptyState compact title={t('selection.supplierNegotiations.noFinalOffers')} />
                  ) : (
                    <ul className="tiq-check-list">
                      {data.finalOfferRounds.map((round) => (
                        <li key={round.roundId} className="tiq-stack">
                          <span className="tiq-inline">
                            <StatusChip enum="final_offer_rounds.status" value={round.status} />
                            {round.deadline !== null && (
                              <OfficialDeadline deadline={round.deadline} showRemaining />
                            )}
                          </span>
                          <span className="tiq-inline">
                            <ButtonLink
                              to={selectionPaths.supplierFinalOffer(round.roundId)}
                              size="sm"
                            >
                              {t('selection.supplierFinalOffer.view')}
                            </ButtonLink>
                            {round.status === 'issued' && (
                              <ButtonLink
                                to={round.responseWorkspaceLink}
                                size="sm"
                                variant="primary"
                                iconAfter="arrowRight"
                              >
                                {t('selection.supplierFinalOffer.workspace')}
                              </ButtonLink>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
            {responding !== null && (
              <ConfirmActionDialog
                open
                title={t('selection.supplierNegotiation.respondTitle', {
                  no: responding.roundNo,
                })}
                scope={`${data.tender.reference} · ${data.buyer.name}`}
                consequence={t('selection.supplierNegotiation.respondConsequence')}
                confirmLabel={t('selection.supplierNegotiation.respond')}
                acknowledgement={t('selection.supplierNegotiation.internalApproval')}
                pending={respond.pending}
                error={withSelectionMessage(respond.error)}
                onCancel={closeDialog}
                onConfirm={async () => {
                  setTouched(true);
                  if (proposal.trim() === '') return;
                  const result = await attempt(
                    respond.mutate({
                      params: { negotiationId: data.negotiationId, roundId: responding.roundId },
                      body: {
                        supplierProposal: proposal.trim(),
                        concessions: concessions.trim() === '' ? null : concessions.trim(),
                        internalApprovalConfirmed: true,
                      },
                    }),
                  );
                  if (result === undefined) return;
                  setAnswered((map) => ({ ...map, [result.roundId]: result }));
                  toast.show(t('selection.supplierNegotiation.responded'), 'success');
                  closeDialog();
                }}
              >
                {responding.buyerProposal !== null && (
                  <DetailList
                    stacked
                    items={[
                      {
                        label: t('selection.supplierNegotiation.buyerTerms'),
                        value: responding.buyerProposal,
                      },
                    ]}
                  />
                )}
                <TextArea
                  label={t('selection.supplierNegotiation.yourProposal')}
                  required
                  rows={4}
                  value={proposal}
                  onChange={setProposal}
                  error={
                    (touched && proposal.trim() === ''
                      ? t('selection.form.required')
                      : undefined) ?? server.forField('supplierProposal')
                  }
                />
                <TextArea
                  label={t('selection.round.concessions')}
                  rows={2}
                  value={concessions}
                  onChange={setConcessions}
                  error={server.forField('concessions')}
                />
              </ConfirmActionDialog>
            )}
          </>
        )}
      </QueryView>
    </div>
  );
}
