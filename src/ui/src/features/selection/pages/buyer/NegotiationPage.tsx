/**
 * BUY-27 — One negotiation: the authorized scope (topics, negotiators, commercial authority), the mandate approval,
 * the round history with minutes, proposals, concessions and unresolved terms, and the process decision. Actions:
 * record permitted rounds, conclude, propose a process decision and seek new approval where needed (BR-30, AC-23).
 */
import { useState } from 'react';

import { selectionEndpoints } from '@contracts/selection';
import type { NegotiationDetail, NegotiationRound, ProcessDecision } from '@contracts/selection';

import { useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import { ApprovalStatusPanel } from '../../../../components/approvals';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  DetailList,
  EmptyState,
  MoneyText,
  PageHeader,
  QueryView,
  Reference,
  StatusChip,
  Timeline,
} from '../../../../components/ui';
import { formatDateTime, formatOfficialTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import { GatePanel } from '../../components/GatePanel';
import { ConcludeNegotiationDialog, RecordRoundDialog } from '../../components/NegotiationDialogs';
import { ProcessDecisionDialog } from '../../components/ProcessDecisionDialog';
import { ProcessDecisionTable } from '../../components/ProcessDecisionTable';
import { SelectionPage } from '../../components/SelectionPage';
import { useCommandResult, useIdParam } from '../../lib/hooks';
import { bidLabel, lotLabel, tenderLabel } from '../../lib/labels';
import { selectionPaths } from '../../lib/paths';
import { NEGOTIATION_CONDUCT, PROCESS_DECISION_PROPOSE } from '../../lib/permissions';

function nextAction(negotiation: NegotiationDetail): string {
  switch (negotiation.status) {
    case 'planned':
      return negotiation.roundGate.allowed
        ? t('selection.negotiation.next.mandate')
        : t('selection.negotiation.next.blocked');
    case 'awaiting_mandate':
      return t('selection.negotiation.next.awaitMandate');
    case 'active':
      return t('selection.negotiation.next.rounds');
    case 'concluded':
      return t('selection.negotiation.next.concluded');
    case 'aborted':
      return t('selection.negotiation.next.aborted');
  }
}

export default function NegotiationPage() {
  const negotiationId = useIdParam('negotiationId');
  const canConduct = usePermission(NEGOTIATION_CONDUCT);
  const canPropose = usePermission(PROCESS_DECISION_PROPOSE);
  const [latest, setLatest] = useCommandResult<NegotiationDetail>(
    negotiationId,
    (record) => record.negotiationId,
  );
  const [dialog, setDialog] = useState<'round' | 'conclude' | 'decision' | null>(null);
  const [rounds, setRounds] = useState<readonly NegotiationRound[]>([]);
  const [proposed, setProposed] = useState<readonly ProcessDecision[]>([]);
  const query = useApiQuery(
    selectionEndpoints.getNegotiation,
    negotiationId === null ? null : { params: { negotiationId } },
  );
  const loaded = latest ?? query.data;
  const view =
    loaded === undefined
      ? undefined
      : {
          ...loaded,
          rounds: [
            ...loaded.rounds,
            ...rounds.filter((item) => !loaded.rounds.some((r) => r.roundId === item.roundId)),
          ],
        };
  const close = (): void => setDialog(null);

  return (
    <SelectionPage
      header={
        <PageHeader
          title={
            view === undefined
              ? t('selection.negotiation.title')
              : t('selection.negotiation.heading', {
                  supplier: bidLabel(view.bid),
                  reference: view.tender.reference,
                })
          }
          back={{ to: selectionPaths.negotiations, label: t('selection.negotiations.title') }}
          meta={
            view === undefined ? undefined : (
              <>
                <Reference
                  value={view.tender.reference}
                  to={selectionPaths.tender(view.tender.tenderId)}
                />
                <StatusChip enum="negotiations.status" value={view.status} />
                <span>{t('selection.negotiations.rounds', { count: view.rounds.length })}</span>
                <span>{t('selection.common.nextAction', { action: nextAction(view) })}</span>
              </>
            )
          }
          primaryAction={
            view !== undefined && canConduct && view.status === 'active' ? (
              <Button
                variant="primary"
                icon="plus"
                disabled={!view.roundGate.allowed}
                onClick={() => setDialog('round')}
              >
                {t('selection.round.action')}
              </Button>
            ) : undefined
          }
          actions={
            view === undefined ? undefined : (
              <>
                {canPropose && (
                  <Button icon="gavel" onClick={() => setDialog('decision')}>
                    {t('selection.processDecision.propose')}
                  </Button>
                )}
                {canConduct && view.status === 'active' && (
                  <Button icon="checkCircle" onClick={() => setDialog('conclude')}>
                    {t('selection.conclude.confirm')}
                  </Button>
                )}
              </>
            )
          }
        />
      }
    >
      <QueryView query={query}>
        {() =>
          view === undefined ? null : (
            <>
              {(view.status === 'planned' ||
                view.status === 'awaiting_mandate' ||
                view.status === 'active') && (
                <GatePanel
                  gate={view.roundGate}
                  blockedTitle={t('selection.negotiation.roundsBlocked')}
                  allowedTitle={
                    view.status === 'active' ? t('selection.negotiation.roundsOpen') : undefined
                  }
                  actions={
                    !view.roundGate.allowed && canPropose ? (
                      <Button size="sm" icon="gavel" onClick={() => setDialog('decision')}>
                        {t('selection.processDecision.propose')}
                      </Button>
                    ) : undefined
                  }
                />
              )}
              {view.outcomeSummary !== null && (
                <Banner
                  tone={view.status === 'aborted' ? 'warning' : 'success'}
                  title={t('selection.negotiation.outcome')}
                >
                  <p>{view.outcomeSummary}</p>
                </Banner>
              )}
              <div className="tiq-grid tiq-grid--sidebar">
                <Card
                  title={t('selection.negotiation.history')}
                  subtitle={t('selection.negotiation.historyHint')}
                >
                  {view.rounds.length === 0 ? (
                    <EmptyState compact title={t('selection.negotiation.noRounds')} />
                  ) : (
                    <Timeline
                      label={t('selection.negotiation.history')}
                      items={view.rounds.map((round) => ({
                        id: round.roundId,
                        icon: 'handshake',
                        tone:
                          round.supplierVisible && round.supplierResponseAt === null
                            ? 'warning'
                            : 'accent',
                        title: t('selection.negotiation.roundTitle', { no: round.roundNo }),
                        meta: (
                          <>
                            {round.meetingAt === null
                              ? t('selection.negotiation.notMet')
                              : formatOfficialTime(round.meetingAt, view.tender.officialTimeZone)}
                            {' · '}
                            {round.participants}
                            {' · '}
                            {round.supplierVisible
                              ? t('selection.negotiation.sharedWithSupplier')
                              : t('selection.negotiation.internalOnly')}
                          </>
                        ),
                        detail: (
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
                                label: t('selection.round.buyerProposal'),
                                value: round.buyerProposal,
                              },
                              {
                                label: t('selection.round.supplierProposal'),
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
                                    ? round.supplierVisible
                                      ? t('selection.negotiation.awaitingSupplier')
                                      : null
                                    : formatDateTime(
                                        round.supplierResponseAt,
                                        view.tender.officialTimeZone,
                                      ),
                              },
                            ]}
                          />
                        ),
                      }))}
                    />
                  )}
                </Card>
                <div className="tiq-stack">
                  <Card title={t('selection.negotiation.mandate')}>
                    <DetailList
                      stacked
                      items={[
                        {
                          label: t('selection.negotiations.col.supplier'),
                          value: bidLabel(view.bid),
                        },
                        { label: t('selection.common.lot'), value: lotLabel(view.lot) },
                        {
                          label: t('selection.negotiations.col.authority'),
                          value: <MoneyText value={view.commercialAuthority} />,
                        },
                        {
                          label: t('selection.negotiations.col.negotiators'),
                          value: view.authorizedNegotiators
                            .map((person) => person.fullName)
                            .join(', '),
                        },
                        {
                          label: t('selection.negotiations.col.topics'),
                          value: (
                            <span className="tiq-inline">
                              {view.allowedTopics.map((topic) => (
                                <Chip key={topic} tone="accent" size="sm">
                                  {topic}
                                </Chip>
                              ))}
                            </span>
                          ),
                        },
                        {
                          label: t('selection.negotiation.basis'),
                          value: view.affectsCompetitionBasis
                            ? t('selection.negotiations.affectsBasis')
                            : t('selection.negotiation.basisUnchanged'),
                        },
                      ]}
                    />
                    {view.preferredBidderId !== null && (
                      <ButtonLink
                        to={selectionPaths.preferredBidder(view.preferredBidderId)}
                        size="sm"
                        iconAfter="arrowRight"
                      >
                        {t('selection.negotiation.openPreferred')}
                      </ButtonLink>
                    )}
                  </Card>
                  <ApprovalStatusPanel
                    subjectType="negotiation_mandate"
                    subjectId={view.approvalSubject.subjectId}
                    subjectLabel={`${bidLabel(view.bid)} · ${tenderLabel(view.tender, view.lot)}`}
                    title={t('selection.negotiation.mandateApproval')}
                    currentVersion={
                      canConduct &&
                      view.status === 'planned' &&
                      view.roundGate.blockers.every((b) => b.code === 'MANDATE_NOT_APPROVED')
                        ? {
                            subjectVersion: view.approvalSubject.subjectVersion,
                            contentHash: view.approvalSubject.contentHash,
                          }
                        : null
                    }
                    requestDefaults={{
                      title: t('selection.negotiation.approvalTitle', {
                        supplier: view.bid.supplierName,
                        reference: view.tender.reference,
                      }),
                      summary: view.allowedTopics.join('; '),
                      ...(view.commercialAuthority === null
                        ? {}
                        : { amount: view.commercialAuthority }),
                    }}
                  />
                </div>
              </div>
              <Card title={t('selection.tender.decisions')} flush>
                <ProcessDecisionTable
                  decisions={[
                    ...proposed,
                    ...(view.processDecision === null ? [] : [view.processDecision]),
                  ]}
                  timeZone={view.tender.officialTimeZone}
                />
              </Card>
              {dialog === 'round' && (
                <RecordRoundDialog
                  negotiation={view}
                  onClose={close}
                  onRecorded={(round) => {
                    setRounds((list) => [...list, round]);
                    close();
                  }}
                />
              )}
              {dialog === 'conclude' && (
                <ConcludeNegotiationDialog
                  negotiation={view}
                  onClose={close}
                  onConcluded={(result) => {
                    setLatest(result);
                    close();
                  }}
                />
              )}
              <ProcessDecisionDialog
                open={dialog === 'decision'}
                onClose={close}
                tender={view.tender}
                lot={view.lot}
                defaultType="new_competition_required"
                onProposed={(decision) => setProposed((list) => [decision, ...list])}
              />
            </>
          )
        }
      </QueryView>
    </SelectionPage>
  );
}
