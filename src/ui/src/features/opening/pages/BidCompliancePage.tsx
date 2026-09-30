/**
 * BUY-21 — Compliance review of one bid: the checklist (timeliness, declarations, documents, eligibility, mandatory
 * requirements…) with each finding's class, result, reason and evidence; the clarification requests with their
 * permitted scope; the exclusion rationale and approval; and the conclusion (pass or reject with documented
 * reasons). Readiness separates blocking conditions from warnings. Before the qualification envelope (or the single
 * stage) is opened, no check is shown (BR-17).
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { openingEndpoints } from '@contracts/opening';
import type {
  ClarificationRow,
  ComplianceBidRow,
  ComplianceCheck,
  ExclusionRow,
} from '@contracts/opening';

import { useActiveTenant } from '../../../app/hooks';
import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  ConfirmActionDialog,
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  OrDash,
  PageHeader,
  RadioGroup,
  ReadinessChecklist,
  Reference,
  StatusChip,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn, ReadinessItem } from '../../../components/ui';
import { formatCount, formatOfficialTime } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { CheckSummaryText, RankingChip } from '../components/ComplianceChips';
import { EnvelopeChips } from '../components/EnvelopeChips';
import { LoadingFrame } from '../components/LoadingFrame';
import { ProposeExclusionDialog } from '../components/ProposeExclusionDialog';
import { RaiseClarificationDialog } from '../components/RaiseClarificationDialog';
import { RecordCheckDialog } from '../components/RecordCheckDialog';
import { RecordNotFound } from '../components/RecordNotFound';
import { withBusinessMessage } from '../lib/errors';
import { bidNextAction } from '../lib/nextAction';
import { idParam, openingPaths } from '../lib/paths';
import { useClarificationSources } from '../lib/sources';

type DialogKind = 'raise' | 'propose' | 'decide';

const DECIDED = new Set(['compliant', 'non_compliant', 'excluded']);
const ACTIVE_EXCLUSION = new Set(['proposed', 'awaiting_approval', 'approved']);
const OPEN_CLARIFICATION = new Set(['draft', 'approved', 'issued', 'responded']);

function readinessItems(
  bid: ComplianceBidRow,
  contentAvailable: boolean,
  checks: readonly ComplianceCheck[],
  clarifications: readonly ClarificationRow[],
  exclusions: readonly ExclusionRow[],
): ReadinessItem[] {
  if (!contentAvailable) {
    // Receipt is not compliance: nothing can be concluded before the content is opened (BR-17).
    return [
      {
        id: 'opened',
        label: t('opening.decide.ready.notOpened'),
        detail: t('opening.decide.ready.notOpenedDetail'),
        status: 'blocking',
      },
    ];
  }
  const pending = checks.filter((check) => check.result === 'pending').length;
  const failed = checks.filter((check) => check.result === 'fail').length;
  const open = clarifications.filter(
    (row) => row.consolidatedIntoId === null && OPEN_CLARIFICATION.has(row.status),
  ).length;
  const exclusion = exclusions.some(
    (row) => row.status === 'proposed' || row.status === 'awaiting_approval',
  );
  return [
    {
      id: 'checks',
      label: t('opening.decide.ready.checks'),
      detail:
        pending > 0
          ? t('opening.decide.ready.checksPending', { count: pending })
          : t('opening.decide.ready.checksDone'),
      status: pending > 0 ? 'blocking' : 'passed',
    },
    {
      id: 'clarifications',
      label: t('opening.decide.ready.clarifications'),
      detail:
        open > 0
          ? t('opening.decide.ready.clarificationsOpen', { count: open })
          : t('opening.decide.ready.clarificationsDone'),
      status: open > 0 ? 'blocking' : 'passed',
    },
    {
      id: 'exclusion',
      label: t('opening.decide.ready.exclusion'),
      detail: exclusion
        ? t('opening.decide.ready.exclusionPending')
        : t('opening.decide.ready.exclusionNone'),
      status: exclusion ? 'blocking' : 'passed',
    },
    {
      id: 'failed',
      label: t('opening.decide.ready.failed'),
      detail:
        failed > 0
          ? t('opening.decide.ready.failedSome', { count: failed })
          : t('opening.decide.ready.failedNone'),
      status: failed > 0 ? 'warning' : 'passed',
    },
    {
      id: 'ranking',
      label: t('opening.decide.ready.ranking'),
      detail: bid.rankingEligible
        ? t('opening.ranking.eligibleHint')
        : t('opening.ranking.notRankedHint'),
      status: bid.rankingEligible ? 'passed' : 'warning',
    },
  ];
}

function BidView({ bidId }: { readonly bidId: number }) {
  const query = useApiQuery(openingEndpoints.getBidCompliance, { params: { bidId } });
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const canAssess = usePermission('compliance.assess');
  const sources = useClarificationSources();
  const toast = useToast();
  const decide = useApiMutation(openingEndpoints.decideCompliance);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [editing, setEditing] = useState<ComplianceCheck | null>(null);
  const [recorded, setRecorded] = useState<ReadonlyMap<number, ComplianceCheck>>(new Map());
  const [decided, setDecided] = useState<ComplianceBidRow | null>(null);
  const [raised, setRaised] = useState<ClarificationRow[]>([]);
  const [proposed, setProposed] = useState<ExclusionRow[]>([]);
  const [outcome, setOutcome] = useState<'compliant' | 'non_compliant'>('compliant');
  const back = { to: openingPaths.compliance, label: t('opening.compliance.back') };

  return (
    <LoadingFrame title={t('opening.bid.loadingTitle')} back={back} query={query}>
      {(data) => {
        const bid = decided ?? data.bid;
        const tender = data.tender;
        const checks = data.checks.map((check) => recorded.get(check.id) ?? check);
        const clarifications = [...raised, ...data.clarifications];
        const exclusions = [...proposed, ...data.exclusions];
        const scope = t('opening.bid.scope', {
          supplier: bid.supplier.name,
          reference: tender.reference,
        });
        const isDecided = DECIDED.has(bid.complianceStatus);
        const canRecord = canAssess && data.contentAvailable && !isDecided;
        const hasActiveExclusion = exclusions.some((row) => ACTIVE_EXCLUSION.has(row.status));
        const readiness = readinessItems(
          bid,
          data.contentAvailable,
          checks,
          clarifications,
          exclusions,
        );
        const registerBack = {
          to: openingPaths.register(tender.tenderId),
          label: t('opening.register.back'),
        };

        const checkColumns: DataTableColumn<ComplianceCheck>[] = [
          {
            id: 'type',
            header: t('opening.columns.checkType'),
            cell: (row) => (
              <>
                {tEnum('compliance_checks.check_type', row.checkType)}
                {row.requirement !== null && (
                  <span className="tiq-cell-sub">
                    <span className="tiq-mono">{row.requirement.refCode}</span>{' '}
                    {row.requirement.text}
                  </span>
                )}
              </>
            ),
          },
          {
            id: 'result',
            header: t('opening.columns.result'),
            cell: (row) => <StatusChip enum="compliance_checks.result" value={row.result} />,
          },
          {
            id: 'class',
            header: t('opening.columns.findingClass'),
            cell: (row) =>
              row.findingClass === 'none' ? (
                <OrDash>{null}</OrDash>
              ) : (
                <StatusChip
                  enum="compliance_checks.finding_class"
                  value={row.findingClass}
                  size="sm"
                />
              ),
          },
          {
            id: 'evidence',
            header: t('opening.columns.evidence'),
            cell: (row) => (
              <>
                <OrDash>{row.evidenceRef}</OrDash>
                {row.reason !== null && <span className="tiq-cell-sub">{row.reason}</span>}
              </>
            ),
          },
          {
            id: 'assessed',
            header: t('opening.columns.assessed'),
            cell: (row) =>
              row.assessedBy === null ? (
                <OrDash>{null}</OrDash>
              ) : (
                <>
                  {row.assessedBy.fullName}
                  <span className="tiq-cell-sub">
                    <OrDash>
                      {row.assessedAt === null
                        ? null
                        : formatOfficialTime(row.assessedAt, timeZone)}
                    </OrDash>
                  </span>
                </>
              ),
          },
          {
            id: 'action',
            header: <span className="tiq-visually-hidden">{t('opening.columns.actions')}</span>,
            cell: (row) =>
              canRecord ? (
                <Button size="sm" icon="edit" onClick={() => setEditing(row)}>
                  {row.result === 'pending' ? t('opening.check.record') : t('opening.check.revise')}
                </Button>
              ) : null,
          },
        ];

        const clarificationColumns: DataTableColumn<ClarificationRow>[] = [
          {
            id: 'question',
            header: t('opening.columns.question'),
            cell: (row) => (
              <>
                <Reference
                  value={t('opening.clarification.number', { id: row.id })}
                  to={openingPaths.clarification(row.id)}
                />
                <span className="tiq-cell-sub">{row.question}</span>
              </>
            ),
          },
          {
            id: 'source',
            header: t('opening.columns.source'),
            cell: (row) => tEnum('bid_clarifications.source', row.source),
          },
          {
            id: 'status',
            header: t('opening.columns.status'),
            cell: (row) => <StatusChip enum="bid_clarifications.status" value={row.status} />,
          },
          {
            id: 'due',
            header: t('opening.columns.due'),
            cell: (row) =>
              row.dueAt === null ? (
                <OrDash>{null}</OrDash>
              ) : (
                <OfficialDeadline deadline={row.dueAt} showLocal={false} />
              ),
          },
          {
            id: 'effect',
            header: t('opening.columns.effect'),
            cell: (row) =>
              row.effect === null ? (
                <OrDash>{null}</OrDash>
              ) : (
                <StatusChip enum="bid_clarifications.effect" value={row.effect} size="sm" />
              ),
          },
        ];

        const exclusionColumns: DataTableColumn<ExclusionRow>[] = [
          {
            id: 'exclusion',
            header: t('opening.columns.grounds'),
            cell: (row) => (
              <>
                <Reference
                  value={t('opening.exclusion.number', { id: row.id })}
                  to={openingPaths.exclusion(row.id)}
                />
                <span className="tiq-cell-sub">{row.grounds}</span>
              </>
            ),
          },
          {
            id: 'status',
            header: t('opening.columns.status'),
            cell: (row) => <StatusChip enum="exclusions.status" value={row.status} />,
          },
          {
            id: 'approval',
            header: t('opening.columns.approval'),
            cell: (row) =>
              row.approvalStatus === null ? (
                <OrDash>{null}</OrDash>
              ) : (
                <StatusChip enum="approval_requests.status" value={row.approvalStatus} size="sm" />
              ),
          },
          {
            id: 'notice',
            header: t('opening.columns.notice'),
            cell: (row) =>
              row.noticeStatus === null ? (
                <OrDash>{null}</OrDash>
              ) : (
                <StatusChip enum="notices.status" value={row.noticeStatus} size="sm" />
              ),
          },
        ];

        return (
          <div className="tiq-page">
            <PageHeader
              title={t('opening.bid.title', { supplier: bid.supplier.name })}
              subtitle={`${tender.reference} ${tender.title}`}
              back={registerBack}
              primaryAction={
                canAssess && data.contentAvailable && !isDecided && !hasActiveExclusion ? (
                  <Button
                    variant="primary"
                    icon="clipboardCheck"
                    onClick={() => setDialog('decide')}
                  >
                    {t('opening.decide.action')}
                  </Button>
                ) : undefined
              }
              actions={
                <>
                  {sources.length > 0 &&
                    data.contentAvailable &&
                    bid.complianceStatus !== 'excluded' && (
                      <Button icon="messageQuestion" onClick={() => setDialog('raise')}>
                        {t('opening.raise.action')}
                      </Button>
                    )}
                  {canAssess && data.contentAvailable && !hasActiveExclusion && (
                    <Button variant="danger-soft" icon="ban" onClick={() => setDialog('propose')}>
                      {t('opening.propose.action')}
                    </Button>
                  )}
                </>
              }
              meta={
                <>
                  <Reference value={tender.reference} to={openingPaths.register(tender.tenderId)} />
                  <span className="tiq-mono">{bid.receiptNo}</span>
                  <StatusChip enum="bids.compliance_status" value={bid.complianceStatus} />
                  {data.contentAvailable && <RankingChip eligible={bid.rankingEligible} />}
                  <span>
                    <strong>{t('opening.common.nextAction')}</strong>{' '}
                    {bidNextAction(bid, data.contentAvailable)}
                  </span>
                </>
              }
            />
            {!data.contentAvailable && (
              <Banner tone="info" title={t('opening.bid.sealedTitle')}>
                {t('opening.bid.sealed')}
              </Banner>
            )}
            {data.contentAvailable && !bid.rankingEligible && (
              <Banner tone="warning" title={t('opening.ranking.notRanked')}>
                {t('opening.ranking.notRankedHint')}
              </Banner>
            )}
            <KpiGrid>
              <KpiCard
                label={t('opening.kpi.checksPassed')}
                value={formatCount(bid.checkSummary.pass)}
                icon="checkCircle"
                tone="success"
              />
              <KpiCard
                label={t('opening.kpi.checksFailed')}
                value={formatCount(bid.checkSummary.fail)}
                icon="xCircle"
                tone="danger"
              />
              <KpiCard
                label={t('opening.kpi.checksPending')}
                value={formatCount(
                  bid.checkSummary.pending + bid.checkSummary.clarificationRequired,
                )}
                icon="hourglass"
                tone="warning"
              />
              <KpiCard
                label={t('opening.kpi.clarificationsOpen')}
                value={formatCount(bid.openClarifications)}
                icon="messageQuestion"
                tone="info"
              />
            </KpiGrid>
            <div className="tiq-grid tiq-grid--2">
              <Card title={t('opening.decide.readiness')}>
                <ReadinessChecklist label={t('opening.decide.readiness')} items={readiness} />
              </Card>
              <Card title={t('opening.bid.envelopes')}>
                <div className="tiq-stack">
                  <EnvelopeChips envelopes={bid.envelopes} />
                  <p className="tiq-text-muted">
                    {hasActiveExclusion
                      ? t('opening.bid.envelopesExcludedHint')
                      : t('opening.bid.envelopesHint')}
                  </p>
                  <ButtonLink to={openingPaths.tender(tender.tenderId)} icon="layers" size="sm">
                    {t('opening.session.toTender')}
                  </ButtonLink>
                </div>
              </Card>
            </div>
            <Card title={t('opening.checks.title')} subtitle={<CheckSummaryText row={bid} />} flush>
              <DataTable
                caption={t('opening.checks.title')}
                columns={checkColumns}
                rows={checks}
                rowKey={(row) => String(row.id)}
                empty={
                  <EmptyState
                    compact
                    icon="lock"
                    title={
                      data.contentAvailable
                        ? t('opening.checks.none')
                        : t('opening.bid.sealedTitle')
                    }
                  />
                }
              />
            </Card>
            <Card
              title={t('opening.clarifications.title')}
              subtitle={t('opening.br22.buyer')}
              flush
            >
              <DataTable
                caption={t('opening.clarifications.title')}
                columns={clarificationColumns}
                rows={clarifications}
                rowKey={(row) => String(row.id)}
                empty={
                  <EmptyState
                    compact
                    icon="messageQuestion"
                    title={t('opening.clarifications.none')}
                  />
                }
              />
            </Card>
            <Card
              title={t('opening.exclusions.title')}
              subtitle={t('opening.exclusions.subtitle')}
              flush
            >
              <DataTable
                caption={t('opening.exclusions.title')}
                columns={exclusionColumns}
                rows={exclusions}
                rowKey={(row) => String(row.id)}
                empty={
                  <EmptyState
                    compact
                    icon="shieldCheck"
                    title={t('opening.exclusions.noneForBid')}
                  />
                }
              />
            </Card>

            {editing !== null && (
              <RecordCheckDialog
                check={editing}
                supplierName={bid.supplier.name}
                onClose={() => setEditing(null)}
                onRecorded={(check) => {
                  setRecorded((current) => new Map(current).set(check.id, check));
                  setEditing(null);
                  invalidateApiQueries('buyer.opening.listBids');
                  toast.show(t('opening.check.recorded'), 'success');
                }}
              />
            )}
            {dialog === 'raise' && (
              <RaiseClarificationDialog
                bidId={bid.bidId}
                scope={scope}
                timeZone={timeZone}
                sources={sources}
                onClose={() => setDialog(null)}
                onRaised={(clarification) => {
                  setRaised((current) => [clarification, ...current]);
                  setDialog(null);
                  invalidateApiQueries('buyer.opening.listClarifications');
                  toast.show(t('opening.raise.done'), 'success');
                }}
              />
            )}
            {dialog === 'propose' && (
              <ProposeExclusionDialog
                bidId={bid.bidId}
                scope={scope}
                checks={checks}
                onClose={() => setDialog(null)}
                onProposed={(exclusion) => {
                  setProposed((current) => [exclusion, ...current]);
                  setDialog(null);
                  invalidateApiQueries('buyer.opening.listExclusions');
                  toast.show(t('opening.propose.done'), 'success');
                }}
              />
            )}
            {dialog === 'decide' && (
              <ConfirmActionDialog
                open
                title={t('opening.decide.title')}
                scope={scope}
                consequence={
                  outcome === 'compliant'
                    ? t('opening.decide.resultCompliant')
                    : t('opening.decide.resultNonCompliant')
                }
                confirmLabel={t('opening.decide.confirm')}
                tone={outcome === 'compliant' ? 'primary' : 'danger'}
                reason={{ label: t('opening.decide.note'), required: outcome === 'non_compliant' }}
                pending={decide.pending}
                error={withBusinessMessage(decide.error)}
                onCancel={() => {
                  decide.reset();
                  setDialog(null);
                }}
                onConfirm={async ({ reason }) => {
                  try {
                    const result = await decide.mutate({
                      params: { bidId: bid.bidId },
                      body: reason === '' ? { outcome } : { outcome, note: reason },
                    });
                    setDecided(result);
                    setDialog(null);
                    invalidateApiQueries('buyer.opening.listBids');
                    toast.show(t('opening.decide.done'), 'success');
                  } catch {
                    // Shown in the dialog.
                  }
                }}
              >
                <ReadinessChecklist label={t('opening.decide.readiness')} items={readiness} />
                <RadioGroup
                  label={t('opening.decide.outcome')}
                  required
                  value={outcome}
                  onChange={(value) =>
                    setOutcome(value === 'non_compliant' ? 'non_compliant' : 'compliant')
                  }
                  options={(['compliant', 'non_compliant'] as const).map((value) => ({
                    value,
                    label: tEnum('bids.compliance_status', value),
                    hint: t(`opening.decide.outcomeHint.${value}`),
                  }))}
                />
              </ConfirmActionDialog>
            )}
          </div>
        );
      }}
    </LoadingFrame>
  );
}

export default function BidCompliancePage() {
  const params = useParams();
  const bidId = idParam(params.bidId);
  if (bidId === null) {
    return (
      <RecordNotFound
        title={t('opening.bid.loadingTitle')}
        back={{ to: openingPaths.compliance, label: t('opening.compliance.back') }}
      />
    );
  }
  return <BidView key={bidId} bidId={bidId} />;
}
