/**
 * BUY-24 — One preferred-bidder recommendation: the comparison, the proposed supplier and lot, value, rationale,
 * remaining checks (diligence plan), negotiation topics, contingency and fallback, the approval, the process
 * decisions and the award gate. Actions: request conditional approval (returned or approved through the shared
 * approvals), withdraw, and record the fallback decision after a failure (FR-16, BR-31, AC-24).
 */
import { useState } from 'react';

import { ACTIVE_PREFERRED_BIDDER_STATUSES, selectionEndpoints } from '@contracts/selection';
import type { PreferredBidderDetail, ProcessDecision } from '@contracts/selection';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
import { ApprovalStatusPanel } from '../../../../components/approvals';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  MoneyText,
  PageHeader,
  QueryView,
  Reference,
  StatusChip,
  useToast,
} from '../../../../components/ui';
import { t } from '../../../../lib/i18n';
import { CandidateTable } from '../../components/CandidateTable';
import { GatePanel } from '../../components/GatePanel';
import { ProcessDecisionDialog } from '../../components/ProcessDecisionDialog';
import { ProcessDecisionTable } from '../../components/ProcessDecisionTable';
import { RecordFallbackDialog } from '../../components/RecordFallbackDialog';
import { SelectionPage } from '../../components/SelectionPage';
import { withSelectionMessage } from '../../lib/errors';
import { useCommandResult, useIdParam } from '../../lib/hooks';
import { bidLabel, lotLabel, tenderLabel } from '../../lib/labels';
import { attempt } from '../../lib/lists';
import { selectionPaths } from '../../lib/paths';
import { PROCESS_DECISION_PROPOSE, SELECTION_MANAGE } from '../../lib/permissions';

function isActive(status: PreferredBidderDetail['status']): boolean {
  return (ACTIVE_PREFERRED_BIDDER_STATUSES as readonly string[]).includes(status);
}

function nextAction(preferred: PreferredBidderDetail): string {
  if (preferred.fallbackGate.allowed) return t('selection.preferredBidder.next.fallback');
  switch (preferred.status) {
    case 'proposed':
      return t('selection.preferredBidder.next.approval');
    case 'awaiting_approval':
      return t('selection.preferredBidder.next.awaitApproval');
    case 'approved':
      return preferred.awardGate.allowed
        ? t('selection.preferredBidder.next.recommendation')
        : t('selection.preferredBidder.next.diligence');
    default:
      return t('selection.preferredBidder.next.none');
  }
}

export default function PreferredBidderPage() {
  const preferredBidderId = useIdParam('preferredBidderId');
  const toast = useToast();
  const canManage = usePermission(SELECTION_MANAGE);
  const canPropose = usePermission(PROCESS_DECISION_PROPOSE);
  const [latest, setLatest] = useCommandResult<PreferredBidderDetail>(
    preferredBidderId,
    (record) => record.preferredBidderId,
  );
  const [dialog, setDialog] = useState<'withdraw' | 'fallback' | 'decision' | null>(null);
  const [proposed, setProposed] = useState<readonly ProcessDecision[]>([]);
  const query = useApiQuery(
    selectionEndpoints.getPreferredBidder,
    preferredBidderId === null ? null : { params: { preferredBidderId } },
  );
  const withdraw = useApiMutation(selectionEndpoints.withdrawPreferredBidder);
  const view = latest ?? query.data;
  const close = (): void => setDialog(null);
  const fallbackRecorded =
    view !== undefined &&
    view.fallbackGate.blockers.some((blocker) => blocker.code === 'FALLBACK_ALREADY_RECORDED');

  return (
    <SelectionPage
      header={
        <PageHeader
          title={
            view === undefined
              ? t('selection.preferredBidder.title')
              : t('selection.preferredBidder.heading', {
                  supplier: bidLabel(view.bid),
                  reference: view.tender.reference,
                })
          }
          back={{ to: selectionPaths.preferredBidders, label: t('selection.preferred.title') }}
          meta={
            view === undefined ? undefined : (
              <>
                <Reference
                  value={view.tender.reference}
                  to={selectionPaths.tender(view.tender.tenderId)}
                />
                <StatusChip enum="preferred_bidders.status" value={view.status} />
                <MoneyText value={view.proposedValue} />
                <span>{t('selection.common.nextAction', { action: nextAction(view) })}</span>
              </>
            )
          }
          primaryAction={
            view !== undefined && canManage && view.fallbackGate.allowed ? (
              <Button variant="primary" icon="repeat" onClick={() => setDialog('fallback')}>
                {t('selection.fallback.action')}
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
                {canManage && isActive(view.status) && (
                  <Button variant="danger-soft" icon="ban" onClick={() => setDialog('withdraw')}>
                    {t('selection.preferredBidder.withdraw')}
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
              <Banner tone="info" title={t('selection.preferredForm.conditionalTitle')}>
                <p>{t('selection.preferredForm.conditionalBody')}</p>
              </Banner>
              {view.statusReason !== null && !isActive(view.status) && (
                <Banner
                  tone={view.status === 'failed_diligence' ? 'error' : 'warning'}
                  title={t('selection.preferredBidder.statusReason')}
                >
                  <p>{view.statusReason}</p>
                </Banner>
              )}
              {fallbackRecorded ? (
                <Banner tone="success" title={t('selection.preferredBidder.fallbackRecorded')} />
              ) : (
                !isActive(view.status) && (
                  <GatePanel
                    gate={view.fallbackGate}
                    blockedTitle={t('selection.preferredBidder.fallbackBlocked')}
                    allowedTitle={t('selection.preferredBidder.fallbackRequired')}
                  />
                )
              )}
              <GatePanel
                gate={view.awardGate}
                blockedTitle={t('selection.tender.gate.awardBlocked')}
                allowedTitle={t('selection.tender.gate.awardOpen')}
              />
              <div className="tiq-grid tiq-grid--sidebar">
                <Card title={t('selection.preferredBidder.recommendation')}>
                  <DetailList
                    items={[
                      { label: t('selection.preferred.col.supplier'), value: bidLabel(view.bid) },
                      { label: t('selection.common.lot'), value: lotLabel(view.lot) },
                      {
                        label: t('selection.preferred.col.value'),
                        value: <MoneyText value={view.proposedValue} />,
                      },
                      {
                        label: t('selection.preferred.col.owner'),
                        value: view.decisionOwner.fullName,
                      },
                      {
                        label: t('selection.preferred.col.fallback'),
                        value: view.fallbackBid === null ? null : bidLabel(view.fallbackBid),
                      },
                    ]}
                  />
                  <DetailList
                    stacked
                    items={[
                      { label: t('selection.preferredForm.scope'), value: view.scope },
                      { label: t('selection.preferredForm.rationale'), value: view.rationale },
                      {
                        label: t('selection.preferredForm.remainingChecks'),
                        value: view.remainingChecks,
                      },
                      {
                        label: t('selection.preferredForm.contingency'),
                        value: view.contingencyPlan,
                      },
                    ]}
                  />
                </Card>
                <div className="tiq-stack">
                  <Card title={t('selection.preferredBidder.topics')}>
                    {view.negotiationTopics.length === 0 ? (
                      <EmptyState compact title={t('selection.preferredBidder.noTopics')} />
                    ) : (
                      <div className="tiq-inline">
                        {view.negotiationTopics.map((topic) => (
                          <Chip key={topic} tone="accent" size="sm">
                            {topic}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </Card>
                  <Card title={t('selection.preferredBidder.diligence')}>
                    {view.dueDiligence === null ? (
                      <EmptyState compact title={t('selection.preferred.noCase')} />
                    ) : (
                      <div className="tiq-stack">
                        <span className="tiq-inline">
                          <StatusChip
                            enum="due_diligence_cases.status"
                            value={view.dueDiligence.status}
                          />
                          {view.dueDiligence.awardBlockingCount > 0 && (
                            <Chip tone="danger" size="sm" icon="ban">
                              {t('selection.preferred.blocking', {
                                count: view.dueDiligence.awardBlockingCount,
                              })}
                            </Chip>
                          )}
                        </span>
                        <ButtonLink
                          to={selectionPaths.diligenceCase(view.dueDiligence.caseId)}
                          size="sm"
                          iconAfter="arrowRight"
                        >
                          {t('selection.preferredBidder.openCase')}
                        </ButtonLink>
                      </div>
                    )}
                  </Card>
                  <ApprovalStatusPanel
                    subjectType="preferred_bidder"
                    subjectId={view.approvalSubject.subjectId}
                    subjectLabel={`${bidLabel(view.bid)} · ${tenderLabel(view.tender, view.lot)}`}
                    currentVersion={
                      canManage && view.status === 'proposed'
                        ? {
                            subjectVersion: view.approvalSubject.subjectVersion,
                            contentHash: view.approvalSubject.contentHash,
                          }
                        : null
                    }
                    requestDefaults={{
                      title: t('selection.preferredBidder.approvalTitle', {
                        supplier: view.bid.supplierName,
                        reference: view.tender.reference,
                      }),
                      summary: view.rationale,
                      amount: view.proposedValue,
                    }}
                  />
                </div>
              </div>
              <Card
                title={t('selection.preferredForm.comparison')}
                subtitle={t('selection.preferredForm.comparisonHint')}
                flush
              >
                <CandidateTable
                  candidates={view.comparison}
                  caption={t('selection.preferredForm.comparison')}
                  preferredBidId={view.bid.bidId}
                  fallbackBidId={view.fallbackBid?.bidId ?? null}
                />
              </Card>
              <Card title={t('selection.tender.decisions')} flush>
                <ProcessDecisionTable
                  decisions={[...proposed, ...view.processDecisions]}
                  timeZone={view.tender.officialTimeZone}
                />
              </Card>
              {dialog === 'fallback' && (
                <RecordFallbackDialog
                  preferred={view}
                  onClose={close}
                  onRecorded={(result) => {
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
                defaultType="fallback_to_next_bidder"
                onProposed={(decision) => setProposed((list) => [decision, ...list])}
              />
              {dialog === 'withdraw' && (
                <ConfirmActionDialog
                  open
                  tone="danger"
                  title={t('selection.preferredBidder.withdrawTitle')}
                  scope={`${bidLabel(view.bid)} · ${tenderLabel(view.tender, view.lot)}`}
                  consequence={t('selection.preferredBidder.withdrawConsequence')}
                  confirmLabel={t('selection.preferredBidder.withdraw')}
                  reason={{ label: t('selection.common.reason'), required: true }}
                  pending={withdraw.pending}
                  error={withSelectionMessage(withdraw.error)}
                  onCancel={() => {
                    withdraw.reset();
                    close();
                  }}
                  onConfirm={async ({ reason }) => {
                    const result = await attempt(
                      withdraw.mutate({
                        params: { preferredBidderId: view.preferredBidderId },
                        body: { reason },
                      }),
                    );
                    if (result === undefined) return;
                    toast.show(t('selection.preferredBidder.withdrawn'), 'success');
                    setLatest(result);
                    close();
                  }}
                />
              )}
            </>
          )
        }
      </QueryView>
    </SelectionPage>
  );
}
