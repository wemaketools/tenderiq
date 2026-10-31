/**
 * Evaluation overview of one tender or lot (EVA-01 for the chair, entry to EVA-04/05/06; docs/plan/design1): how
 * many assessments are in, with the overdue, incomplete and conflict counts in words; the review team with each
 * member's progress, due date, status and conflict disposition; the bids with compliance and assessment status; the
 * price gate derived from the real gate; what happens next in the evaluation stages; the status, the timeline and the
 * approved plan (criteria and weights, scale anchors, aggregation, price method, thresholds, precision and tie
 * rules, BR-28). Missing work is counted, never scored as zero (AC-18).
 */
import { useNavigate } from 'react-router';

import { EVALUATION_STAGES, getEvaluation } from '@contracts/evaluation';
import type { CommitteeLine, EvaluationBidRef, EvaluationOverview } from '@contracts/evaluation';

import { useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Attention,
  Banner,
  BigCount,
  Columns,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  IconTile,
  NumberedSteps,
  OfficialDeadline,
  OrDash,
  Person,
  ProgressDots,
  Section,
  SkeletonBlock,
  StatusChip,
  Timeline,
  buttonClassName,
} from '../../../components/ui';
import type { CheckState, NumberedStep } from '../../../components/ui';
import { CheckMark } from '../../../components/ui';
import {
  formatCalendarDate,
  formatCount,
  formatDateTime,
  formatDecimalString,
} from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import { EvaluationWorkspace } from '../components/EvaluationWorkspace';
import { PriceGateCallout } from '../components/PriceGateCallout';
import { evaluationErrorMessage } from '../lib/errors';
import { useIdParam, useLotId } from '../lib/hooks';
import { bidLabel } from '../lib/labels';
import { evaluationPaths } from '../lib/paths';

const PLAN_SECTION_ID = 'evaluation-plan';

/** The compliance of a bid as a check: compliant is done; exclusion and non-compliance fail; the rest is pending. */
const COMPLIANCE_CHECK: Readonly<Record<EvaluationBidRef['complianceStatus'], CheckState>> = {
  compliant: 'done',
  non_compliant: 'danger',
  excluded: 'danger',
  pending: 'pending',
  clarification_pending: 'warning',
};

function PlanSection({ overview }: { readonly overview: EvaluationOverview }) {
  const { plan } = overview;
  const criterion = (id: number | null): string | null => {
    if (id === null) return null;
    const found = plan.criteria.find((item) => item.criterionId === id);
    return found === undefined ? null : `${found.code} ${found.name}`;
  };
  return (
    <Section
      id={PLAN_SECTION_ID}
      title={t('evaluation.overview.planTitle')}
      count={t('evaluation.overview.planVersion', { version: plan.version })}
      actions={<StatusChip enum="evaluation_plans.status" value={plan.status} />}
    >
      <div className="tiq-stack tiq-stack--spaced">
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
          variant="plain"
          caption={t('evaluation.overview.criteriaCaption')}
          columns={[
            {
              id: 'criterion',
              header: t('evaluation.common.criterion'),
              cell: (row) => (
                <>
                  <span className="tiq-cell-title">
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
    </Section>
  );
}

/** The official due date with, in words, whether the work is complete or overdue. */
function DueCell({ row, now }: { readonly row: CommitteeLine; readonly now: number }) {
  const complete = row.status === 'submitted' || row.status === 'finalized';
  const closed = row.status === 'recused' || row.status === 'reassigned';
  const overdue = !complete && !closed && new Date(row.dueAt.at).getTime() < now;
  return (
    <span className="tiq-stack tiq-stack--start">
      <OfficialDeadline deadline={row.dueAt} showLocal={false} />
      {complete && (
        <Attention tone="accent" icon="check">
          {t('evaluation.overview.complete')}
        </Attention>
      )}
      {overdue && (
        <Attention tone="danger" icon="clock">
          {t('evaluation.overview.overdueFlag')}
        </Attention>
      )}
    </span>
  );
}

function ProgressSummary({ overview }: { readonly overview: EvaluationOverview }) {
  const { progress } = overview;
  return (
    <div className="tiq-stack">
      <BigCount
        value={progress.submitted}
        total={progress.total}
        label={t('evaluation.overview.submittedLabel')}
        meterLabel={t('evaluation.overview.meterLabel')}
        aside={
          progress.overdue > 0 ? (
            <Attention tone="danger" icon="clock">
              {t('evaluation.overview.overdueCount', { count: progress.overdue })}
            </Attention>
          ) : undefined
        }
      />
      {(progress.incomplete > 0 || progress.conflictsPendingReview > 0) && (
        <div className="tiq-inline tiq-evaluation-flags">
          {progress.incomplete > 0 && (
            <Attention tone="warning" icon="alertTriangle">
              {t('evaluation.overview.incompleteCount', { count: progress.incomplete })}
            </Attention>
          )}
          {progress.conflictsPendingReview > 0 && (
            <Attention tone="warning" icon="shield">
              {t('evaluation.overview.conflictsCount', {
                count: progress.conflictsPendingReview,
              })}
            </Attention>
          )}
        </div>
      )}
    </div>
  );
}

function NextSteps({ overview }: { readonly overview: EvaluationOverview }) {
  const currentIndex = EVALUATION_STAGES.indexOf(overview.stage);
  const steps: NumberedStep[] = EVALUATION_STAGES.map((stage, index) => ({
    id: stage,
    title: t(`evaluation.stage.${stage}`),
    text: t(`evaluation.overview.steps.${stage}`),
    done: index < currentIndex || overview.stage === 'complete',
    current: index === currentIndex && overview.stage !== 'complete',
  }));
  return (
    <Section title={t('evaluation.overview.nextTitle')} headingLevel={2}>
      <NumberedSteps steps={steps} label={t('evaluation.overview.nextTitle')} />
    </Section>
  );
}

export default function EvaluationOverviewPage() {
  const tenderId = useIdParam('tenderId');
  const lotId = useLotId();
  const navigate = useNavigate();
  const now = useNow();
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
      headline={t('evaluation.overview.headline')}
      tender={overview?.tender}
      lot={overview?.lot}
      primaryAction={
        overview === undefined ? undefined : (
          <a className={buttonClassName('primary')} href={`#${PLAN_SECTION_ID}`}>
            {t('evaluation.overview.viewPlan')}
          </a>
        )
      }
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
          {overview.detailLevel !== 'full' && (
            <Banner
              tone="info"
              title={t(`evaluation.overview.detail.${overview.detailLevel}.title`)}
            >
              <p>{t(`evaluation.overview.detail.${overview.detailLevel}.body`)}</p>
            </Banner>
          )}
          <Columns
            main={
              <>
                <ProgressSummary overview={overview} />
                <Section title={t('evaluation.overview.teamTitle')}>
                  <DataTable<CommitteeLine>
                    variant="plain"
                    caption={t('evaluation.overview.committeeTitle')}
                    columns={[
                      {
                        id: 'evaluator',
                        header: t('evaluation.overview.col.name'),
                        cell: (row) => (
                          <span className="tiq-cell-lead">
                            <Person name={row.evaluator.fullName} />
                            <span className="tiq-cell-sub">
                              {row.isCommercial
                                ? t('evaluation.assignments.kind.commercial')
                                : row.evaluator.capacity}
                            </span>
                          </span>
                        ),
                      },
                      {
                        id: 'completion',
                        header: t('evaluation.overview.col.assessments'),
                        cell: (row) =>
                          row.isCommercial ? (
                            <OrDash>{null}</OrDash>
                          ) : (
                            <span className="tiq-stack tiq-stack--start">
                              <ProgressDots
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
                            </span>
                          ),
                      },
                      {
                        id: 'due',
                        header: t('evaluation.overview.col.due'),
                        cell: (row) => <DueCell row={row} now={now} />,
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
                </Section>
                <Section
                  title={t('evaluation.overview.bidsTitle')}
                  count={formatCount(overview.bids.length)}
                >
                  <DataTable
                    variant="plain"
                    caption={t('evaluation.overview.bidsTitle')}
                    columns={[
                      {
                        id: 'bid',
                        header: t('evaluation.overview.col.supplier'),
                        cell: (bid) => (
                          <span className="tiq-cell-lead">
                            <IconTile icon="building" tone="neutral" size="sm" />
                            <span>
                              <span className="tiq-cell-title">{bidLabel(bid)}</span>
                              <span className="tiq-cell-sub">
                                {t('evaluation.overview.receiptLine', {
                                  receipt: bid.receiptNo,
                                  time: formatDateTime(
                                    bid.receivedAt,
                                    overview.tender.officialTimeZone,
                                  ),
                                })}
                              </span>
                            </span>
                          </span>
                        ),
                      },
                      {
                        id: 'compliance',
                        header: t('evaluation.common.compliance'),
                        cell: (bid) => (
                          <span
                            className="tiq-checkitem"
                            data-state={COMPLIANCE_CHECK[bid.complianceStatus]}
                          >
                            <CheckMark state={COMPLIANCE_CHECK[bid.complianceStatus]} />
                            <span>{tEnum('bids.compliance_status', bid.complianceStatus)}</span>
                          </span>
                        ),
                      },
                      {
                        id: 'evaluation',
                        header: t('evaluation.overview.col.assessmentStatus'),
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
                    empty={
                      <EmptyState
                        compact
                        title={
                          overview.detailLevel === 'conflict_pending_review'
                            ? t('evaluation.overview.bidsWithheld')
                            : t('evaluation.assignment.noBids')
                        }
                      />
                    }
                  />
                </Section>
              </>
            }
            side={
              <>
                <PriceGateCallout
                  tenderId={overview.tender.tenderId}
                  lotId={overview.lot?.lotId ?? null}
                  gate={overview.priceGate}
                  timeZone={overview.tender.officialTimeZone}
                  scope={`${overview.tender.reference} ${overview.tender.title}`}
                />
                <NextSteps overview={overview} />
                <Section title={t('evaluation.overview.statusTitle')} headingLevel={3}>
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
                </Section>
                <Section title={t('evaluation.overview.timelineTitle')} headingLevel={3}>
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
                </Section>
              </>
            }
          />
          <PlanSection overview={overview} />
        </>
      )}
    </EvaluationWorkspace>
  );
}
