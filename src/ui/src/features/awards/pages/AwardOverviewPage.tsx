/**
 * BUY-26 — Award file of one tender: each lot's explicit outcome, standstill and final-award gate (AC-26), the
 * recommendations and their approvals, the totals reconciliation (BR-33), active holds (AC-25) and the links to
 * notices, cases and closeout. A proposed or intended value is labelled as such, never as an award (BR-31). The
 * final award is its own approval per lot outcome (DD-14): it is requested from the lot row or the readiness card
 * and recorded only when the gate passes.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { getSubjectApprovals } from '@contracts/approvals';
import {
  APPROVED_LOT_OUTCOME_STATUSES,
  createRecommendation,
  finalAwardLotOutcome,
  getAwardOverview,
} from '@contracts/awards';
import type { AwardOverview, LotAwardStatus, LotOutcome } from '@contracts/awards';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { useCanCall, usePermission } from '../../../auth/permissions';
import { ApprovalStatusPanel, RequestApprovalDialog } from '../../../components/approvals';
import type { RequestApprovalDefaults } from '../../../components/approvals';
import {
  Banner,
  Button,
  Card,
  CardLink,
  Checkbox,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  KpiCard,
  KpiGrid,
  MoneyText,
  OfficialDeadline,
  OrDash,
  StatusChip,
  Tabs,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCount, formatDateTime, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AwardFileLayout } from '../components/AwardFileLayout';
import { GateChecklist } from '../components/GateChecklist';
import { blockingCount } from '../lib/gates';
import { HoldsCard } from '../components/HoldsCard';
import { ReconciliationCard } from '../components/ReconciliationCard';
import { withAwardMessage } from '../lib/errors';
import { useIdParam, useOfficialTimeZone } from '../lib/hooks';
import { lotLabel, lotNosLabel, valueBasisHint, valueBasisLabel } from '../lib/labels';
import { awardPaths } from '../lib/paths';

type RecommendationRow = AwardOverview['recommendations'][number];

const AWARDING = ['award', 'partial_award', 'conditional_award'];
const FINAL_READY_STATUSES = ['approved', 'intent_notified'];

function canFinalAward(outcome: LotOutcome | null): outcome is LotOutcome {
  return (
    outcome !== null &&
    AWARDING.includes(outcome.outcome) &&
    FINAL_READY_STATUSES.includes(outcome.status)
  );
}

export default function AwardOverviewPage() {
  const tenderId = useIdParam('tenderId');
  const overview = useApiQuery(
    getAwardOverview,
    tenderId === null ? null : { params: { tenderId } },
  );
  if (tenderId === null) {
    return <EmptyState title={t('awards.file.notFound')} icon="award" />;
  }
  return (
    <AwardFileLayout tenderId={tenderId} overview={overview}>
      {overview.data !== undefined && (
        <AwardFileBody tenderId={tenderId} overview={overview.data} />
      )}
    </AwardFileLayout>
  );
}

function AwardFileBody({
  tenderId,
  overview,
}: {
  readonly tenderId: number;
  readonly overview: AwardOverview;
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const canRecommend = usePermission('award.recommend');
  const canFinal = usePermission(['award.recommend', 'award.approve']);
  const canCases = usePermission(['complaint.manage', 'debrief.manage', 'audit.view']);
  const canSeeApprovals = useCanCall(getSubjectApprovals);

  const [finalResults, setFinalResults] = useState<Readonly<Record<number, LotOutcome>>>({});
  const [finalTarget, setFinalTarget] = useState<LotAwardStatus | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedLots, setSelectedLots] = useState<readonly number[]>([]);
  const [lotsMissing, setLotsMissing] = useState(false);
  const [gateLot, setGateLot] = useState<string>(String(overview.lots[0]?.lot.lotId ?? ''));
  const [approvalTarget, setApprovalTarget] = useState<LotAwardStatus | null>(null);

  const finalAward = useApiMutation(finalAwardLotOutcome);
  const create = useApiMutation(createRecommendation);

  const outcomeOf = (lot: LotAwardStatus): LotOutcome | null =>
    lot.outcome === null ? null : (finalResults[lot.outcome.lotOutcomeId] ?? lot.outcome);

  const activeHolds = overview.holds.filter((hold) => hold.releasedAt === null);
  const finalBlocked = activeHolds.filter((hold) => hold.blockedActions.includes('award_final'));
  const withOutcome = overview.lots.filter(
    (lot) => lot.outcome !== null && APPROVED_LOT_OUTCOME_STATUSES.includes(lot.outcome.status),
  ).length;
  const proposed = overview.lots.filter((lot) => lot.outcome?.status === 'recommended').length;
  const value = overview.reconciliation?.value ?? null;

  const approvalSubject = (lot: LotAwardStatus): string =>
    t('awards.file.finalApproval.subject', {
      tender: overview.tender.reference,
      lot: lotLabel(lot.lot),
    });
  const approvalDefaults = (lot: LotAwardStatus): RequestApprovalDefaults => {
    const outcome = outcomeOf(lot);
    const supplier = outcome?.supplier?.name ?? '';
    return {
      title: t('awards.file.finalApproval.requestTitle', {
        tender: overview.tender.reference,
        lot: lot.lot.lotNo,
        supplier,
      }),
      summary: t('awards.file.finalApproval.requestSummary', {
        lot: lotLabel(lot.lot),
        supplier,
        value: formatMoney(outcome?.awardedValue ?? null),
      }),
      amount: outcome?.awardedValue ?? undefined,
    };
  };
  const finalAwarded = overview.lots.filter(
    (lot) => outcomeOf(lot)?.status === 'final_awarded',
  ).length;
  const openLots = overview.lots.filter(
    (lot) => lot.outcome === null || lot.outcome.status === 'withdrawn',
  );

  const startCreate = (): void => {
    setSelectedLots(openLots.map((lot) => lot.lot.lotId));
    setLotsMissing(false);
    create.reset();
    setCreating(true);
  };

  const confirmCreate = async ({ reason }: { readonly reason: string }): Promise<void> => {
    if (selectedLots.length === 0) {
      setLotsMissing(true);
      return;
    }
    try {
      const record = await create.mutate({
        params: { tenderId },
        body: {
          lotIds: [...selectedLots],
          summary: reason.trim() === '' ? undefined : reason.trim(),
        },
      });
      setCreating(false);
      toast.show(t('awards.file.created', { version: record.version }), 'success');
      invalidateApiQueries('buyer.awards.');
      void navigate(awardPaths.recommendation(tenderId, record.recommendationId), {
        state: { record },
      });
    } catch {
      // The dialog shows the error.
    }
  };

  const confirmFinal = async ({ reason }: { readonly reason: string }): Promise<void> => {
    const outcome = finalTarget === null ? null : outcomeOf(finalTarget);
    if (outcome === null) return;
    try {
      const result = await finalAward.mutate({
        params: { lotOutcomeId: outcome.lotOutcomeId },
        body: { confirmation: true, note: reason.trim() === '' ? undefined : reason.trim() },
      });
      setFinalResults((current) => ({ ...current, [result.lotOutcomeId]: result }));
      setFinalTarget(null);
      toast.show(t('awards.file.finalRecorded', { lot: result.lot.lotNo }), 'success');
    } catch {
      // The dialog shows the error.
    }
  };

  const lotColumns: DataTableColumn<LotAwardStatus>[] = [
    {
      id: 'lot',
      header: t('awards.file.col.lot'),
      cell: (row) => (
        <>
          <span>{lotLabel(row.lot)}</span>
          <span className="tiq-cell-sub">
            <StatusChip enum="lots.stage" value={row.stage} size="sm" />
          </span>
        </>
      ),
    },
    {
      id: 'outcome',
      header: t('awards.file.col.outcome'),
      cell: (row) => {
        const outcome = outcomeOf(row);
        if (outcome === null) {
          return <span className="tiq-text-muted">{t('awards.file.noOutcome')}</span>;
        }
        return (
          <>
            <span className="tiq-inline">
              <StatusChip enum="lot_outcomes.outcome" value={outcome.outcome} size="sm" />
              <StatusChip enum="lot_outcomes.status" value={outcome.status} size="sm" />
            </span>
            {outcome.reason !== null && <span className="tiq-cell-sub">{outcome.reason}</span>}
            {outcome.conditions !== null && (
              <span className="tiq-cell-sub">
                {t('awards.file.conditions', { text: outcome.conditions })}
              </span>
            )}
          </>
        );
      },
    },
    {
      id: 'supplier',
      header: t('awards.file.col.supplier'),
      cell: (row) => outcomeOf(row)?.supplier?.name ?? <OrDash>{null}</OrDash>,
    },
    {
      id: 'value',
      header: t('awards.file.col.value'),
      numeric: true,
      cell: (row) => {
        const value = outcomeOf(row)?.awardedValue ?? null;
        return value === null ? <OrDash>{null}</OrDash> : <MoneyText value={value} />;
      },
    },
    {
      id: 'standstill',
      header: t('awards.file.col.standstill'),
      cell: (row) =>
        row.standstillStatus === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <StatusChip enum="standstill_periods.status" value={row.standstillStatus} size="sm" />
            {row.standstillEndsAt !== null && (
              <span className="tiq-cell-sub">
                <OfficialDeadline deadline={row.standstillEndsAt} showLocal={false} />
              </span>
            )}
          </>
        ),
    },
    {
      id: 'final',
      header: t('awards.file.col.final'),
      cell: (row) => {
        const outcome = outcomeOf(row);
        if (outcome?.status === 'final_awarded') {
          return (
            <>
              <span className="tiq-text-success">{t('awards.file.finalAwarded')}</span>
              {outcome.finalAwardedAt !== null && (
                <span className="tiq-cell-sub">
                  {formatDateTime(outcome.finalAwardedAt, timeZone)}
                </span>
              )}
            </>
          );
        }
        const blocking = blockingCount(row.finalAwardGate);
        if (row.finalAwardGate.length === 0 && !(canFinal && canFinalAward(outcome))) {
          return <OrDash>{null}</OrDash>;
        }
        return (
          <span className="tiq-stack">
            {row.finalAwardGate.length > 0 && (
              <span className={blocking > 0 ? 'tiq-text-danger' : 'tiq-text-success'}>
                {blocking > 0
                  ? t('awards.file.gateBlocking', { count: blocking })
                  : t('awards.file.gateClear')}
              </span>
            )}
            {canRecommend && row.finalAwardApproval?.requestable === true && (
              <Button size="sm" icon="send" onClick={() => setApprovalTarget(row)}>
                {t('awards.file.finalApproval.request')}
              </Button>
            )}
            {canFinal && canFinalAward(outcome) && (
              <Button
                size="sm"
                variant={blocking > 0 ? 'secondary' : 'primary'}
                icon="gavel"
                onClick={() => {
                  finalAward.reset();
                  setFinalTarget(row);
                }}
              >
                {t('awards.file.finalAward')}
              </Button>
            )}
          </span>
        );
      },
    },
  ];

  const recommendationColumns: DataTableColumn<RecommendationRow>[] = [
    {
      id: 'version',
      header: t('awards.file.col.version'),
      cell: (row) => (
        <Link to={awardPaths.recommendation(tenderId, row.recommendationId)}>
          {t('awards.common.version', { no: row.version })}
        </Link>
      ),
    },
    { id: 'lots', header: t('awards.file.col.lots'), cell: (row) => lotNosLabel(row.lotNos) },
    {
      id: 'status',
      header: t('awards.file.col.status'),
      cell: (row) => <StatusChip enum="award_recommendations.status" value={row.status} />,
    },
    {
      id: 'created',
      header: t('awards.file.col.created'),
      cell: (row) => formatDateTime(row.createdAt, timeZone),
    },
    {
      id: 'decided',
      header: t('awards.file.col.decided'),
      cell: (row) =>
        row.decidedAt === null ? (
          <span className="tiq-text-muted">{t('awards.file.notDecided')}</span>
        ) : (
          formatDateTime(row.decidedAt, timeZone)
        ),
    },
  ];

  const selectedGate = overview.lots.find((lot) => String(lot.lot.lotId) === gateLot);
  const finalOutcome = finalTarget === null ? null : outcomeOf(finalTarget);

  return (
    <div className="tiq-stack tiq-stack--spaced">
      {finalBlocked.length > 0 && (
        <Banner tone="error" title={t('awards.file.holdBanner')}>
          <ul>
            {finalBlocked.map((hold) => (
              <li key={hold.holdId}>
                {hold.complaintReference !== null && hold.complaintId !== null ? (
                  <Link to={awardPaths.complaint(hold.complaintId)}>{hold.complaintReference}</Link>
                ) : (
                  hold.subjectLabel
                )}
                {': '}
                {hold.reason}
              </li>
            ))}
          </ul>
        </Banner>
      )}
      {overview.tender.status === 'partially_awarded' && (
        <Banner tone="info" title={t('awards.file.partialBanner')}>
          {t('awards.file.partialBannerText')}
        </Banner>
      )}
      <KpiGrid>
        <KpiCard
          label={t('awards.file.kpi.outcomes')}
          icon="listChecks"
          value={t('awards.file.kpi.ofLots', { done: withOutcome, total: overview.lots.length })}
          hint={
            proposed > 0
              ? t('awards.file.kpi.outcomesProposed', { count: proposed })
              : t('awards.file.kpi.outcomesHint')
          }
        />
        <KpiCard
          label={t('awards.file.kpi.final')}
          icon="gavel"
          tone="success"
          value={t('awards.file.kpi.ofLots', { done: finalAwarded, total: overview.lots.length })}
          hint={t('awards.file.kpi.finalHint')}
        />
        <KpiCard
          label={value === null ? t('awards.value.none') : valueBasisLabel(value.basis)}
          icon="coins"
          tone={value?.basis === 'final_awarded' ? 'success' : 'accent'}
          value={value === null ? null : <MoneyText value={value.total} compact />}
          hint={
            value === null
              ? undefined
              : value.basis !== 'final_awarded' && value.finalAwardedTotal.amount !== '0.00'
                ? t('awards.value.finalPart', { value: formatMoney(value.finalAwardedTotal) })
                : valueBasisHint(value.basis)
          }
        />
        <KpiCard
          label={t('awards.file.kpi.cases')}
          icon="scale"
          tone={overview.openComplaintCount > 0 ? 'danger' : 'info'}
          value={formatCount(overview.openComplaintCount + overview.openDebriefCount)}
          hint={t('awards.file.kpi.casesHint', {
            complaints: overview.openComplaintCount,
            debriefs: overview.openDebriefCount,
          })}
          to={canCases ? awardPaths.complaints : undefined}
        />
      </KpiGrid>
      <Card
        title={t('awards.file.lotsTitle')}
        subtitle={t('awards.file.lotsSubtitle', {
          model: tEnum('tenders.award_model', overview.awardModel),
        })}
        flush
      >
        <DataTable
          caption={t('awards.file.lotsTitle')}
          columns={lotColumns}
          rows={overview.lots}
          rowKey={(row) => String(row.lot.lotId)}
          empty={<EmptyState compact title={t('awards.file.noLots')} />}
        />
      </Card>
      {overview.lots.length > 0 && (
        <Card title={t('awards.file.gateTitle')} subtitle={t('awards.file.gateSubtitle')}>
          <Tabs
            label={t('awards.file.gateTitle')}
            selected={gateLot}
            onSelect={setGateLot}
            tabs={overview.lots.map((lot) => ({
              id: String(lot.lot.lotId),
              label: t('awards.common.lotNo', { no: lot.lot.lotNo }),
              count: blockingCount(lot.finalAwardGate) || undefined,
            }))}
          >
            {selectedGate !== undefined && (
              <div className="tiq-stack">
                <GateChecklist
                  checks={selectedGate.finalAwardGate}
                  label={t('awards.file.gateFor', { lot: lotLabel(selectedGate.lot) })}
                />
                {selectedGate.finalAwardApproval !== null && (
                  <>
                    {!selectedGate.finalAwardApproval.requestable &&
                      selectedGate.finalAwardApproval.unavailableReason !== null && (
                        <Banner tone="info" title={t('awards.file.finalApproval.unavailable')}>
                          {selectedGate.finalAwardApproval.unavailableReason}
                        </Banner>
                      )}
                    {canSeeApprovals &&
                      (selectedGate.finalAwardApproval.requestable ||
                        selectedGate.finalAwardApproval.approvalRequestId !== null) && (
                        <ApprovalStatusPanel
                          key={selectedGate.finalAwardApproval.lotOutcomeId}
                          title={t('awards.file.finalApproval.title')}
                          subjectType="final_award"
                          subjectId={selectedGate.finalAwardApproval.lotOutcomeId}
                          subjectLabel={approvalSubject(selectedGate)}
                          currentVersion={
                            canRecommend && selectedGate.finalAwardApproval.requestable
                              ? {
                                  subjectVersion: selectedGate.finalAwardApproval.subjectVersion,
                                  contentHash: selectedGate.finalAwardApproval.contentHash,
                                }
                              : null
                          }
                          requestDefaults={approvalDefaults(selectedGate)}
                        />
                      )}
                  </>
                )}
              </div>
            )}
          </Tabs>
        </Card>
      )}
      <Card
        title={t('awards.file.recommendationsTitle')}
        subtitle={t('awards.file.recommendationsSubtitle')}
        actions={
          canRecommend && openLots.length > 0 ? (
            <Button icon="plus" onClick={startCreate}>
              {t('awards.file.prepare')}
            </Button>
          ) : undefined
        }
        flush
      >
        <DataTable
          caption={t('awards.file.recommendationsTitle')}
          columns={recommendationColumns}
          rows={overview.recommendations}
          rowKey={(row) => String(row.recommendationId)}
          empty={
            <EmptyState
              compact
              icon="clipboard"
              title={t('awards.file.noRecommendations')}
              description={t('awards.file.noRecommendationsHint')}
            />
          }
        />
      </Card>
      {overview.reconciliation !== null && (
        <ReconciliationCard reconciliation={overview.reconciliation} />
      )}
      <HoldsCard holds={overview.holds} timeZone={timeZone} complaintPath={awardPaths.complaint} />
      <div className="tiq-grid tiq-grid--2">
        <Card
          title={t('awards.file.publicNoticeTitle')}
          actions={
            <CardLink to={awardPaths.notices(tenderId)}>{t('awards.file.openNotices')}</CardLink>
          }
        >
          <DetailList
            items={[
              {
                label: t('awards.file.publicNoticeStatus'),
                value:
                  overview.publicNoticeStatus === null ? (
                    t('awards.file.publicNoticeNone')
                  ) : (
                    <StatusChip
                      enum="public_award_notices.status"
                      value={overview.publicNoticeStatus}
                    />
                  ),
              },
            ]}
          />
        </Card>
        <Card
          title={t('awards.file.closeoutTitle')}
          actions={
            <CardLink to={awardPaths.closeout(tenderId)}>{t('awards.file.openCloseout')}</CardLink>
          }
        >
          <DetailList
            items={[
              {
                label: t('awards.file.closeoutStatus'),
                value:
                  overview.closeoutStatus === null ? (
                    t('awards.register.closeoutNotStarted')
                  ) : (
                    <StatusChip enum="event_closeouts.status" value={overview.closeoutStatus} />
                  ),
              },
            ]}
          />
        </Card>
      </div>

      <ConfirmActionDialog
        open={creating}
        title={t('awards.file.createTitle')}
        scope={`${overview.tender.reference} ${overview.tender.title}`}
        consequence={t('awards.file.createConsequence')}
        confirmLabel={t('awards.file.createConfirm')}
        reason={{ label: t('awards.file.createSummary'), required: false }}
        pending={create.pending}
        error={withAwardMessage(create.error)}
        onCancel={() => setCreating(false)}
        onConfirm={confirmCreate}
      >
        <fieldset className="tiq-fieldset">
          <legend className="tiq-field-label">{t('awards.file.createLots')}</legend>
          <div className="tiq-check-list">
            {overview.lots.map((lot) => (
              <Checkbox
                key={lot.lot.lotId}
                label={lotLabel(lot.lot)}
                hint={
                  openLots.some((open) => open.lot.lotId === lot.lot.lotId)
                    ? undefined
                    : t('awards.file.lotFinal')
                }
                disabled={!openLots.some((open) => open.lot.lotId === lot.lot.lotId)}
                checked={selectedLots.includes(lot.lot.lotId)}
                onChange={(checked) => {
                  setLotsMissing(false);
                  setSelectedLots((current) =>
                    checked
                      ? [...current, lot.lot.lotId]
                      : current.filter((id) => id !== lot.lot.lotId),
                  );
                }}
              />
            ))}
          </div>
          {lotsMissing && (
            <p className="tiq-field-error" role="alert">
              {t('awards.file.createLotsRequired')}
            </p>
          )}
        </fieldset>
      </ConfirmActionDialog>

      {approvalTarget !== null && approvalTarget.finalAwardApproval !== null && (
        <RequestApprovalDialog
          open
          onClose={() => setApprovalTarget(null)}
          subjectType="final_award"
          subjectId={approvalTarget.finalAwardApproval.lotOutcomeId}
          subjectVersion={approvalTarget.finalAwardApproval.subjectVersion}
          contentHash={approvalTarget.finalAwardApproval.contentHash}
          subjectLabel={approvalSubject(approvalTarget)}
          defaults={approvalDefaults(approvalTarget)}
          onRequested={() => {
            toast.show(t('approvalWidget.request.done'), 'success');
            invalidateApiQueries('buyer.approvals.');
            invalidateApiQueries('buyer.awards.');
          }}
        />
      )}

      <ConfirmActionDialog
        open={finalTarget !== null}
        title={t('awards.file.finalTitle')}
        scope={
          finalTarget === null
            ? ''
            : t('awards.file.finalScope', {
                tender: overview.tender.reference,
                lot: lotLabel(finalTarget.lot),
                supplier: finalOutcome?.supplier?.name ?? '',
              })
        }
        consequence={t('awards.file.finalConsequence')}
        confirmLabel={t('awards.file.finalConfirm')}
        acknowledgement={t('awards.file.finalAcknowledgement')}
        reason={{ label: t('awards.common.noteOptional'), required: false }}
        pending={finalAward.pending}
        error={withAwardMessage(finalAward.error)}
        onCancel={() => setFinalTarget(null)}
        onConfirm={confirmFinal}
      >
        {finalTarget !== null && (
          <GateChecklist
            checks={finalTarget.finalAwardGate}
            label={t('awards.file.gateFor', { lot: lotLabel(finalTarget.lot) })}
          />
        )}
      </ConfirmActionDialog>
    </div>
  );
}
