/**
 * The selection workspace of one tender: the issued conditions that govern selection, the negotiation, final-offer
 * and award gates with every blocking reason, the candidates, the team and criteria, the process decisions, and the
 * next steps into each selection screen (BUY-22..BUY-25, BUY-27; PRD §19 context).
 */
import { useState } from 'react';

import { selectionEndpoints } from '@contracts/selection';
import type {
  ProcessDecision,
  SelectionConditions,
  TenderSelectionSummary,
} from '@contracts/selection';

import { useApiQuery } from '../../../../api/hooks';
import { useCanCall, usePermission } from '../../../../auth/permissions';
import {
  Button,
  ButtonLink,
  Card,
  Chip,
  DetailList,
  EmptyState,
  ErrorState,
  PageHeader,
  QueryView,
  StatusChip,
} from '../../../../components/ui';
import { formatDecimalString } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { CandidateTable } from '../../components/CandidateTable';
import { GatePanel } from '../../components/GatePanel';
import { ProcessDecisionDialog } from '../../components/ProcessDecisionDialog';
import { ProcessDecisionTable } from '../../components/ProcessDecisionTable';
import { SelectionPage } from '../../components/SelectionPage';
import { useIdParam, useOfficialTimeZone } from '../../lib/hooks';
import { selectionPaths } from '../../lib/paths';
import { PROCESS_DECISION_PROPOSE, SELECTION_MANAGE } from '../../lib/permissions';

const CONDITION_KEYS = [
  'demonstrationsPermitted',
  'referencesPermitted',
  'negotiationPermitted',
  'bafoPermitted',
  'alternativesAllowed',
] as const satisfies readonly (keyof SelectionConditions)[];

/** The next required action of the tender's selection stage (PRD §19). */
function nextAction(summary: TenderSelectionSummary): string {
  const row = summary.tender;
  if (row.shortlistStatus === null || row.shortlistStatus === 'draft') {
    return t('selection.tender.next.shortlist');
  }
  if (row.shortlistStatus === 'awaiting_approval' || row.shortlistStatus === 'changed') {
    return t('selection.tender.next.shortlistApproval');
  }
  if (row.preferredBidderStatus === null) return t('selection.tender.next.preferred');
  if (
    row.preferredBidderStatus === 'failed_diligence' ||
    row.preferredBidderStatus === 'withdrawn'
  ) {
    return t('selection.tender.next.fallback');
  }
  if (row.dueDiligenceStatus === 'open' || row.dueDiligenceStatus === 'ready_for_decision') {
    return t('selection.tender.next.diligence');
  }
  if (row.negotiationStatus === 'active' || row.negotiationStatus === 'awaiting_mandate') {
    return t('selection.tender.next.negotiation');
  }
  return summary.gates.award.allowed
    ? t('selection.tender.next.award')
    : t('selection.tender.next.resolveBlocks');
}

export default function TenderSelectionPage() {
  const tenderId = useIdParam('tenderId');
  const timeZone = useOfficialTimeZone();
  const canManage = usePermission(SELECTION_MANAGE);
  const canPropose = usePermission(PROCESS_DECISION_PROPOSE);
  const [proposing, setProposing] = useState(false);
  const [proposed, setProposed] = useState<readonly ProcessDecision[]>([]);
  const query = useApiQuery(
    selectionEndpoints.getTender,
    tenderId === null ? null : { params: { tenderId } },
  );
  const canReadDecisions = useCanCall(selectionEndpoints.listProcessDecisions);
  const decisions = useApiQuery(
    selectionEndpoints.listProcessDecisions,
    tenderId === null || !canReadDecisions
      ? null
      : { query: { tenderId, pageSize: 100, sort: 'createdAt', dir: 'desc' } },
  );

  if (tenderId === null) {
    return (
      <SelectionPage header={<PageHeader title={t('selection.tender.title')} />}>
        <EmptyState title={t('selection.common.notFound')} />
      </SelectionPage>
    );
  }

  const summary = query.data;
  const row = summary?.tender;

  return (
    <SelectionPage
      header={
        <PageHeader
          title={row === undefined ? t('selection.tender.title') : `${row.reference} ${row.title}`}
          back={{ to: selectionPaths.home, label: t('selection.register.title') }}
          meta={
            summary === undefined || row === undefined ? undefined : (
              <>
                <StatusChip enum="tenders.status" value={row.status} />
                <span>{tEnum('tenders.procedure', row.procedure)}</span>
                <span>{t('selection.common.stageNo', { stage: row.stageNo })}</span>
                <span>{t('selection.common.ownerName', { name: row.owner.fullName })}</span>
                <span>{t('selection.common.nextAction', { action: nextAction(summary) })}</span>
              </>
            )
          }
          actions={
            canPropose && summary !== undefined ? (
              <Button icon="gavel" onClick={() => setProposing(true)}>
                {t('selection.processDecision.propose')}
              </Button>
            ) : undefined
          }
        />
      }
    >
      <QueryView query={query}>
        {(data) => (
          <>
            <div className="tiq-stack">
              <GatePanel
                gate={data.gates.award}
                blockedTitle={t('selection.tender.gate.awardBlocked')}
                allowedTitle={t('selection.tender.gate.awardOpen')}
              />
              <GatePanel
                gate={data.gates.negotiation}
                blockedTitle={t('selection.tender.gate.negotiationBlocked')}
              />
              <GatePanel
                gate={data.gates.finalOffer}
                blockedTitle={t('selection.tender.gate.finalOfferBlocked')}
              />
            </div>
            <div className="tiq-grid tiq-grid--sidebar">
              <Card
                title={t('selection.tender.candidates')}
                subtitle={t('selection.tender.candidatesHint')}
                flush
              >
                <CandidateTable
                  candidates={data.candidates}
                  caption={t('selection.tender.candidates')}
                />
              </Card>
              <Card
                title={t('selection.tender.conditions')}
                subtitle={data.tender.conditions.conditionsNote}
              >
                <DetailList
                  stacked
                  items={CONDITION_KEYS.map((key) => ({
                    key,
                    label: t(`selection.tender.condition.${key}`),
                    value: data.tender.conditions[key] ? (
                      <Chip tone="success" size="sm" icon="check">
                        {t('selection.common.permitted')}
                      </Chip>
                    ) : (
                      <Chip tone="neutral" size="sm" icon="ban">
                        {t('selection.common.notPermitted')}
                      </Chip>
                    ),
                  }))}
                />
              </Card>
            </div>
            <Card title={t('selection.tender.steps')} subtitle={t('selection.tender.stepsHint')}>
              <div className="tiq-inline">
                <ButtonLink to={`${selectionPaths.assessments}?tenderId=${data.tender.tenderId}`}>
                  {t('selection.tender.link.assessments', { count: data.tender.sessionCount })}
                </ButtonLink>
                <ButtonLink to={`${selectionPaths.shortlists}?tenderId=${data.tender.tenderId}`}>
                  {t('selection.tabs.shortlists')}
                </ButtonLink>
                <ButtonLink
                  to={`${selectionPaths.preferredBidders}?tenderId=${data.tender.tenderId}`}
                >
                  {t('selection.tabs.preferredBidders')}
                </ButtonLink>
                <ButtonLink to={`${selectionPaths.diligence}?tenderId=${data.tender.tenderId}`}>
                  {t('selection.tabs.diligence')}
                </ButtonLink>
                <ButtonLink to={`${selectionPaths.negotiations}?tenderId=${data.tender.tenderId}`}>
                  {t('selection.tabs.negotiations')}
                </ButtonLink>
                <ButtonLink to={`${selectionPaths.finalOffers}?tenderId=${data.tender.tenderId}`}>
                  {t('selection.tabs.finalOffers')}
                </ButtonLink>
                {canManage && (
                  <ButtonLink
                    to={selectionPaths.newSession(data.tender.tenderId)}
                    icon="plus"
                    variant="primary"
                  >
                    {t('selection.assessments.new')}
                  </ButtonLink>
                )}
              </div>
            </Card>
            <div className="tiq-grid tiq-grid--2">
              <Card title={t('selection.tender.team')}>
                {data.team.length === 0 ? (
                  <EmptyState compact title={t('selection.tender.noTeam')} />
                ) : (
                  <ul className="tiq-check-list">
                    {data.team.map((person) => (
                      <li key={person.userId}>{person.fullName}</li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title={t('selection.tender.criteria')}>
                {data.criteria.length === 0 ? (
                  <EmptyState compact title={t('selection.tender.noCriteria')} />
                ) : (
                  <DetailList
                    stacked
                    items={data.criteria.map((criterion) => ({
                      key: String(criterion.criterionId),
                      label: criterion.name,
                      value: t('selection.common.weight', {
                        weight: formatDecimalString(criterion.weight),
                      }),
                    }))}
                  />
                )}
              </Card>
            </div>
            {canReadDecisions && decisions.error?.kind !== 'forbidden' && (
              <Card title={t('selection.tender.decisions')} flush>
                {decisions.error !== null ? (
                  <ErrorState error={decisions.error} onRetry={decisions.reload} />
                ) : (
                  <ProcessDecisionTable
                    decisions={[
                      ...proposed.filter((item) => item.tender.tenderId === tenderId),
                      ...(decisions.data?.items ?? []),
                    ]}
                    timeZone={timeZone}
                  />
                )}
              </Card>
            )}
            <ProcessDecisionDialog
              open={proposing}
              onClose={() => setProposing(false)}
              tender={{
                tenderId: data.tender.tenderId,
                reference: data.tender.reference,
                title: data.tender.title,
                officialTimeZone: data.tender.officialTimeZone,
              }}
              defaultType="other"
              onProposed={(decision) => setProposed((list) => [decision, ...list])}
            />
          </>
        )}
      </QueryView>
    </SelectionPage>
  );
}
