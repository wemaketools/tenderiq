/**
 * Evaluation overview of one tender or lot (EVA-01 for the chair, entry to EVA-04/05/06): the approved evaluation
 * plan (criteria and weights, scale anchors, aggregation, price method, thresholds, precision and tie rules, BR-28),
 * the bids in evaluation, the committee with each member's status, due date, completion and conflict disposition, and
 * the dated timeline. Missing work is counted, never scored as zero (AC-18).
 */
import { useNavigate } from 'react-router';

import { getEvaluation } from '@contracts/evaluation';
import type { CommitteeLine, EvaluationOverview } from '@contracts/evaluation';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Card,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  OrDash,
  SkeletonBlock,
  StatusChip,
  Timeline,
} from '../../../components/ui';
import {
  formatCalendarDate,
  formatCount,
  formatDateTime,
  formatDecimalString,
} from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { PriceGateCard } from '../components/PriceGateCard';
import { EvaluationWorkspace } from '../components/EvaluationWorkspace';
import { ProgressMeter } from '../components/ProgressMeter';
import { evaluationErrorMessage } from '../lib/errors';
import { useIdParam, useLotId } from '../lib/hooks';
import { bidLabel } from '../lib/labels';
import { evaluationPaths } from '../lib/paths';

function PlanCard({ overview }: { readonly overview: EvaluationOverview }) {
  const { plan } = overview;
  const criterion = (id: number | null): string | null => {
    if (id === null) return null;
    const found = plan.criteria.find((item) => item.criterionId === id);
    return found === undefined ? null : `${found.code} ${found.name}`;
  };
  return (
    <Card
      title={t('evaluation.overview.planTitle')}
      subtitle={t('evaluation.overview.planVersion', { version: plan.version })}
      actions={<StatusChip enum="evaluation_plans.status" value={plan.status} />}
    >
      <div className="tiq-stack">
        <DetailList
          items={[
            {
              key: 'scale',
              label: t('evaluation.overview.scale'),
              value: t('evaluation.overview.scaleValue', { max: plan.scaleMax }),
            },
            {
              key: 'aggregation',
              label: t('evaluation.overview.aggregation'),
              value: tEnum('evaluation_plans.aggregation_method', plan.aggregationMethod),
            },
            {
              key: 'price',
              label: t('evaluation.overview.priceMethod'),
              value: `${tEnum('evaluation_plans.price_method', plan.priceMethod)} · ${t('evaluation.overview.pointsValue', { points: formatDecimalString(plan.priceWeight, plan.decimalPlacesDisplay) })}`,
            },
            {
              key: 'formula',
              label: t('evaluation.overview.priceFormula'),
              value: plan.priceFormulaNote,
            },
            {
              key: 'zero',
              label: t('evaluation.overview.zeroPrice'),
              value: plan.zeroPriceTreatment,
            },
            {
              key: 'missing',
              label: t('evaluation.overview.missingPrice'),
              value: plan.missingPriceTreatment,
            },
            {
              key: 'threshold',
              label: t('evaluation.overview.threshold'),
              value:
                plan.nonPriceThreshold === null
                  ? null
                  : `${formatDecimalString(plan.nonPriceThreshold, plan.decimalPlacesDisplay)} · ${tEnum('evaluation_plans.threshold_scope', plan.thresholdScope)}`,
            },
            {
              key: 'precision',
              label: t('evaluation.overview.precision'),
              value: t('evaluation.overview.precisionValue', {
                calc: plan.decimalPlacesCalc,
                display: plan.decimalPlacesDisplay,
              }),
            },
            {
              key: 'currency',
              label: t('evaluation.overview.currency'),
              value: [
                plan.comparisonCurrency,
                plan.fxSource,
                plan.fxDate === null ? null : formatCalendarDate(plan.fxDate),
              ]
                .filter((part) => part !== null)
                .join(' · '),
            },
            {
              key: 'ties',
              label: t('evaluation.overview.ties'),
              value:
                plan.tieBreakRules.length === 0
                  ? null
                  : [...plan.tieBreakRules]
                      .sort((a, b) => a.sequence - b.sequence)
                      .map((rule) =>
                        [tEnum('tie_break_rules.rule', rule.rule), criterion(rule.criterionId)]
                          .filter((part) => part !== null)
                          .join(': '),
                      )
                      .join(' → '),
            },
          ]}
        />
        <DataTable
          caption={t('evaluation.overview.criteriaCaption')}
          columns={[
            {
              id: 'criterion',
              header: t('evaluation.common.criterion'),
              cell: (row) => (
                <>
                  <span>
                    {row.code} {row.name}
                  </span>
                  {row.description !== null && (
                    <span className="tiq-cell-sub">{row.description}</span>
                  )}
                </>
              ),
            },
            {
              id: 'maxPoints',
              header: t('evaluation.common.maxPoints'),
              numeric: true,
              cell: (row) => formatDecimalString(row.maxPoints, plan.decimalPlacesDisplay),
            },
            {
              id: 'minScore',
              header: t('evaluation.overview.minScore'),
              numeric: true,
              cell: (row) =>
                row.minScore === null ? (
                  <OrDash>{null}</OrDash>
                ) : (
                  formatDecimalString(row.minScore, plan.decimalPlacesDisplay)
                ),
            },
            {
              id: 'envelope',
              header: t('evaluation.common.envelope'),
              cell: (row) => (
                <StatusChip enum="evaluation_criteria.envelope" value={row.envelope} size="sm" />
              ),
            },
            {
              id: 'na',
              header: t('evaluation.overview.naPermitted'),
              cell: (row) =>
                row.naPermitted ? t('evaluation.common.yes') : t('evaluation.common.no'),
            },
          ]}
          rows={[...plan.criteria].sort((a, b) => a.sortOrder - b.sortOrder)}
          rowKey={(row) => String(row.criterionId)}
        />
      </div>
    </Card>
  );
}

export default function EvaluationOverviewPage() {
  const tenderId = useIdParam('tenderId');
  const lotId = useLotId();
  const navigate = useNavigate();
  const isChair = usePermission('evaluation.chair');
  const query = useApiQuery(
    getEvaluation,
    tenderId === null ? null : { params: { tenderId }, query: lotId === null ? {} : { lotId } },
  );

  if (tenderId === null) {
    return <EmptyState title={t('evaluation.overview.notFound')} />;
  }
  const overview = query.data;
  const title = t('evaluation.overview.title');

  return (
    <EvaluationWorkspace
      tenderId={tenderId}
      lotId={lotId}
      title={title}
      tender={overview?.tender}
      lot={overview?.lot}
    >
      {overview === undefined ? (
        query.error !== null ? (
          query.error.kind === 'not_found' ? (
            <EmptyState title={t('evaluation.overview.notFound')} icon="search" />
          ) : query.error.code === 'LOT_REQUIRED' ? (
            <EmptyState
              title={t('evaluation.common.lotRequired')}
              description={evaluationErrorMessage(query.error)}
            />
          ) : (
            <ErrorState error={query.error} onRetry={query.reload} />
          )
        ) : (
          <SkeletonBlock lines={8} />
        )
      ) : (
        <>
          <KpiGrid>
            <KpiCard
              label={t('evaluation.overview.kpi.submitted')}
              icon="checkCircle"
              tone="success"
              value={t('evaluation.common.ofTotal', {
                done: overview.progress.submitted,
                total: overview.progress.total,
              })}
              hint={t('evaluation.overview.kpi.submittedHint', {
                count: overview.progress.accepted,
              })}
            />
            <KpiCard
              label={t('evaluation.overview.kpi.incomplete')}
              icon="alertTriangle"
              tone="warning"
              value={formatCount(overview.progress.incomplete)}
              hint={t('evaluation.overview.kpi.incompleteHint')}
            />
            <KpiCard
              label={t('evaluation.overview.kpi.overdue')}
              icon="clock"
              tone="danger"
              value={formatCount(overview.progress.overdue)}
              hint={t('evaluation.overview.kpi.overdueHint')}
            />
            <KpiCard
              label={t('evaluation.overview.kpi.conflicts')}
              icon="shield"
              tone="info"
              value={formatCount(overview.progress.conflictsPendingReview)}
              hint={t('evaluation.overview.kpi.conflictsHint')}
            />
          </KpiGrid>
          <div className="tiq-grid tiq-grid--sidebar">
            <div className="tiq-stack">
              <Card title={t('evaluation.overview.committeeTitle')} flush>
                <DataTable<CommitteeLine>
                  caption={t('evaluation.overview.committeeTitle')}
                  columns={[
                    {
                      id: 'evaluator',
                      header: t('evaluation.common.evaluator'),
                      cell: (row) => (
                        <>
                          <span>{row.evaluator.fullName}</span>
                          <span className="tiq-cell-sub">
                            {row.isCommercial
                              ? t('evaluation.assignments.kind.commercial')
                              : row.evaluator.capacity}
                          </span>
                        </>
                      ),
                    },
                    {
                      id: 'status',
                      header: t('evaluation.common.status'),
                      cell: (row) => (
                        <StatusChip
                          enum="evaluation_assignments.status"
                          value={row.status}
                          size="sm"
                        />
                      ),
                    },
                    {
                      id: 'due',
                      header: t('evaluation.common.due'),
                      cell: (row) => <OfficialDeadline deadline={row.dueAt} showLocal={false} />,
                    },
                    {
                      id: 'completion',
                      header: t('evaluation.assignments.col.completion'),
                      cell: (row) =>
                        row.isCommercial ? (
                          <OrDash>{null}</OrDash>
                        ) : (
                          <>
                            <ProgressMeter
                              done={row.scored}
                              total={row.total}
                              label={t('evaluation.overview.completionOf', {
                                name: row.evaluator.fullName,
                              })}
                            />
                            {row.scored < row.total && (
                              <span className="tiq-cell-sub tiq-text-warning">
                                {t('evaluation.assignments.notScored', {
                                  count: row.total - row.scored,
                                })}
                              </span>
                            )}
                          </>
                        ),
                    },
                    {
                      id: 'conflict',
                      header: t('evaluation.overview.conflict'),
                      cell: (row) =>
                        row.conflictDisposition === null ? (
                          <span className="tiq-text-muted">
                            {t('evaluation.assignments.noConflict')}
                          </span>
                        ) : (
                          <StatusChip
                            enum="conflict_declarations.disposition"
                            value={row.conflictDisposition}
                            size="sm"
                          />
                        ),
                    },
                  ]}
                  rows={overview.committee}
                  rowKey={(row) => String(row.assignmentId)}
                  rowLabel={(row) => row.evaluator.fullName}
                  onRowClick={
                    isChair
                      ? (row) => void navigate(evaluationPaths.assignment(row.assignmentId))
                      : undefined
                  }
                  empty={<EmptyState compact title={t('evaluation.overview.noCommittee')} />}
                />
              </Card>
              <Card title={t('evaluation.overview.bidsTitle')} flush>
                <DataTable
                  caption={t('evaluation.overview.bidsTitle')}
                  columns={[
                    { id: 'bid', header: t('evaluation.common.bid'), cell: (bid) => bidLabel(bid) },
                    {
                      id: 'receipt',
                      header: t('evaluation.common.receipt'),
                      cell: (bid) => (
                        <>
                          <span className="tiq-mono">{bid.receiptNo}</span>
                          <span className="tiq-cell-sub">
                            {formatDateTime(bid.receivedAt, overview.tender.officialTimeZone)}
                          </span>
                        </>
                      ),
                    },
                    {
                      id: 'compliance',
                      header: t('evaluation.common.compliance'),
                      cell: (bid) => (
                        <StatusChip
                          enum="bids.compliance_status"
                          value={bid.complianceStatus}
                          size="sm"
                        />
                      ),
                    },
                    {
                      id: 'evaluation',
                      header: t('evaluation.overview.bidEvaluation'),
                      cell: (bid) => (
                        <StatusChip
                          enum="bids.evaluation_status"
                          value={bid.evaluationStatus}
                          size="sm"
                        />
                      ),
                    },
                  ]}
                  rows={overview.bids}
                  rowKey={(bid) => String(bid.bidId)}
                  empty={<EmptyState compact title={t('evaluation.assignment.noBids')} />}
                />
              </Card>
              <PlanCard overview={overview} />
            </div>
            <div className="tiq-stack">
              <PriceGateCard
                tenderId={overview.tender.tenderId}
                lotId={overview.lot?.lotId ?? null}
                gate={overview.priceGate}
                timeZone={overview.tender.officialTimeZone}
                scope={`${overview.tender.reference} ${overview.tender.title}`}
              />
              <Card title={t('evaluation.overview.statusTitle')}>
                <DetailList
                  stacked
                  items={[
                    {
                      key: 'moderation',
                      label: t('evaluation.list.col.moderation'),
                      value:
                        overview.moderationStatus === null ? null : (
                          <StatusChip
                            enum="moderation_sessions.status"
                            value={overview.moderationStatus}
                          />
                        ),
                    },
                    {
                      key: 'commercial',
                      label: t('evaluation.overview.commercial'),
                      value:
                        overview.commercialStatus === null ? null : (
                          <StatusChip
                            enum="commercial_evaluations.status"
                            value={overview.commercialStatus}
                          />
                        ),
                    },
                    {
                      key: 'report',
                      label: t('evaluation.list.col.report'),
                      value:
                        overview.reportStatus === null ? null : (
                          <StatusChip
                            enum="evaluation_reports.status"
                            value={overview.reportStatus}
                          />
                        ),
                    },
                    {
                      key: 'independent',
                      label: t('evaluation.assignment.independent'),
                      value: overview.tender.independentEvaluation
                        ? t('evaluation.assignment.independentYes')
                        : t('evaluation.common.no'),
                    },
                    {
                      key: 'opening',
                      label: t('evaluation.overview.openingMode'),
                      value: tEnum('tenders.opening_mode', overview.tender.openingMode),
                    },
                    {
                      key: 'award',
                      label: t('evaluation.overview.awardModel'),
                      value: tEnum('tenders.award_model', overview.tender.awardModel),
                    },
                  ]}
                />
              </Card>
              <Card title={t('evaluation.overview.timelineTitle')}>
                {overview.timeline.length === 0 ? (
                  <EmptyState compact title={t('evaluation.overview.noTimeline')} />
                ) : (
                  <Timeline
                    label={t('evaluation.overview.timelineTitle')}
                    items={[...overview.timeline]
                      .sort((a, b) => b.at.localeCompare(a.at))
                      .map((event, index) => ({
                        id: index,
                        title: event.title,
                        meta: `${formatDateTime(event.at, overview.tender.officialTimeZone)}${event.actor === null ? '' : ` · ${event.actor.fullName}`}`,
                        detail: event.detail ?? undefined,
                      }))}
                  />
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </EvaluationWorkspace>
  );
}
