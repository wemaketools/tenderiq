/**
 * BUY-06 Market research and strategy, one strategy. Required information: research, procedure rationale,
 * competition approach, lot strategy, risks, evaluation approach and timetable. Principal actions: compare
 * approaches, record consultations, propose exceptions and obtain strategy approval (FR-05). Market research is
 * marked as an unverified estimate or a supplier commitment; prior supplier involvement opens a fairness review;
 * an RFI concludes with reviewed findings and a separately identified next event, without an award (AC-39).
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { requestEndpoints } from '@contracts/requests';
import type { FairnessReview, StrategyDetail } from '@contracts/requests';
import type { ApprovalDecision } from '@contracts/approvals';
import type { MarketResearchEntriesSourceType } from '@contracts/enums';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { DocumentList } from '../../../components/documents';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  MoneyText,
  PageHeader,
  QueryView,
  RadioGroup,
  ReadinessChecklist,
  Reference,
  Select,
  StatusChip,
  TextArea,
  TextField,
  formErrors,
  useToast,
} from '../../../components/ui';
import { formatDateTime, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { enumOptions, explainError, requestPaths, strategyNextAction } from '../lib';

type Dialog =
  | { kind: 'submit' }
  | { kind: 'decide' }
  | { kind: 'research' }
  | { kind: 'fairness'; review: FairnessReview };

export default function StrategyPage() {
  const { strategyId } = useParams();
  const id = Number(strategyId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('requests.strategy.notFound')}
          back={{ to: requestPaths.strategies, label: t('requests.strategy.back') }}
        />
        <EmptyState title={t('requests.strategy.notFound')} />
      </div>
    );
  }
  return <StrategyLoader key={id} strategyId={id} />;
}

function StrategyLoader({ strategyId }: { readonly strategyId: number }) {
  const query = useApiQuery(requestEndpoints.getStrategy, { params: { strategyId } });
  const [result, setResult] = useState<StrategyDetail | null>(null);
  return (
    <div className="tiq-page">
      {query.data === undefined && (
        <PageHeader
          title={t('requests.strategy.title')}
          back={{ to: requestPaths.strategies, label: t('requests.strategy.back') }}
        />
      )}
      <QueryView query={query}>
        {(data) => <StrategyWorkspace strategy={result ?? data} onChanged={setResult} />}
      </QueryView>
    </div>
  );
}

function StrategyWorkspace({
  strategy,
  onChanged,
}: {
  readonly strategy: StrategyDetail;
  readonly onChanged: (next: StrategyDetail) => void;
}) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const allowed = strategy.allowedActions;
  const comparison = useApiQuery(requestEndpoints.getProcedureOptions, {
    params: { strategyId: strategy.id },
  });
  const policy = strategy.policy;
  const done = (message: string, next: StrategyDetail | null): void => {
    setDialog(null);
    toast.show(message, 'success');
    if (next !== null) onChanged(next);
  };

  return (
    <>
      <PageHeader
        title={strategy.title}
        back={{ to: requestPaths.strategies, label: t('requests.strategy.back') }}
        meta={
          <>
            {strategy.request !== null && (
              <Reference
                value={strategy.request.reference}
                to={requestPaths.request(strategy.request.id)}
              />
            )}
            {strategy.project !== null && <Reference value={strategy.project.reference} />}
            <StatusChip enum="procurement_strategies.status" value={strategy.status} />
            <StatusChip enum="procurement_strategies.procedure" value={strategy.procedure} />
            <span>{t('requests.detail.revision', { revision: strategy.revision })}</span>
            <span>
              {t('requests.detail.ownerLabel')}:{' '}
              {strategy.owner?.fullName ?? t('requests.common.unassigned')}
            </span>
            <span>
              {t('requests.common.nextAction')}: {strategyNextAction(strategy)}
            </span>
          </>
        }
        primaryAction={
          allowed.includes('submit') ? (
            <Button variant="primary" icon="send" onClick={() => setDialog({ kind: 'submit' })}>
              {t('requests.strategy.submit')}
            </Button>
          ) : allowed.includes('decide') ? (
            <Button variant="primary" icon="gavel" onClick={() => setDialog({ kind: 'decide' })}>
              {t('requests.strategy.decide')}
            </Button>
          ) : allowed.includes('create_tender') && strategy.createTenderPath !== null ? (
            <ButtonLink to={strategy.createTenderPath} variant="primary" icon="fileText">
              {t('requests.actions.create_tender')}
            </ButtonLink>
          ) : undefined
        }
        actions={
          <>
            {allowed.includes('edit') && (
              <ButtonLink to={requestPaths.editStrategy(strategy.id)} icon="edit">
                {t('requests.strategy.edit')}
              </ButtonLink>
            )}
            {allowed.includes('add_research') && (
              <Button icon="plus" onClick={() => setDialog({ kind: 'research' })}>
                {t('requests.strategy.addResearch')}
              </Button>
            )}
          </>
        }
      />

      {strategy.status === 'returned' &&
        strategy.approval?.reason !== null &&
        strategy.approval !== null && (
          <Banner tone="warning" title={t('requests.strategy.returnedTitle')}>
            <p>{strategy.approval.reason}</p>
          </Banner>
        )}
      {strategy.pendingFairnessReviews > 0 && (
        <Banner tone="warning" title={t('requests.strategy.fairnessPendingTitle')}>
          <p>
            {t('requests.strategy.fairnessPending', { count: strategy.pendingFairnessReviews })}
          </p>
        </Banner>
      )}
      {strategy.procedure === 'direct' && (
        <Banner tone="info" title={t('requests.strategy.directTitle')}>
          <p>{t('requests.strategy.direct')}</p>
        </Banner>
      )}

      {strategy.rfiOutcome !== null && (
        <Card
          title={t('requests.strategy.rfi.title')}
          subtitle={strategy.rfiOutcome.participationNote}
        >
          <DetailList
            items={[
              {
                label: t('requests.strategy.rfi.event'),
                value: (
                  <>
                    <Reference value={strategy.rfiOutcome.rfiTender.reference} />{' '}
                    {strategy.rfiOutcome.rfiTender.title}{' '}
                    <StatusChip
                      enum="tenders.status"
                      value={strategy.rfiOutcome.rfiTender.status}
                      size="sm"
                    />
                  </>
                ),
              },
              {
                label: t('requests.strategy.rfi.findings'),
                value: strategy.rfiOutcome.findingsSummary,
              },
              {
                label: t('requests.strategy.rfi.reviewed'),
                value:
                  strategy.rfiOutcome.reviewedBy === null
                    ? null
                    : `${strategy.rfiOutcome.reviewedBy.fullName}${
                        strategy.rfiOutcome.reviewedAt === null
                          ? ''
                          : ` · ${formatDateTime(strategy.rfiOutcome.reviewedAt, timeZone)}`
                      }`,
              },
              {
                label: t('requests.strategy.rfi.decision'),
                value: strategy.rfiOutcome.nextStepDecision,
              },
              {
                label: t('requests.strategy.rfi.nextEvent'),
                value:
                  strategy.rfiOutcome.nextEvent === null ? null : (
                    <>
                      <Reference value={strategy.rfiOutcome.nextEvent.reference} />{' '}
                      {strategy.rfiOutcome.nextEvent.title}{' '}
                      <StatusChip
                        enum="tenders.status"
                        value={strategy.rfiOutcome.nextEvent.status}
                        size="sm"
                      />
                    </>
                  ),
              },
              {
                label: t('requests.strategy.rfi.award'),
                value: t('requests.strategy.rfi.noAward'),
              },
            ]}
          />
        </Card>
      )}

      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          <Card title={t('requests.strategy.sections.approach')}>
            <DetailList
              stacked
              items={[
                {
                  label: t('requests.strategyFields.intendedOutcome'),
                  value: strategy.intendedOutcome,
                },
                {
                  label: t('requests.strategyFields.procedure'),
                  value: `${tEnum('procurement_strategies.procedure', strategy.procedure)} · ${tEnum('procurement_strategies.event_type', strategy.eventType)}`,
                },
                {
                  label: t('requests.strategyFields.competitionRationale'),
                  value: strategy.competitionRationale,
                },
                ...(strategy.procedure === 'direct'
                  ? [
                      {
                        label: t('requests.strategyFields.directAwardGrounds'),
                        value: strategy.directAwardGrounds,
                      },
                    ]
                  : []),
                { label: t('requests.strategyFields.lotStrategy'), value: strategy.lotStrategy },
                {
                  label: t('requests.strategyFields.awardModel'),
                  value: tEnum('procurement_strategies.award_model', strategy.awardModel),
                },
                {
                  label: t('requests.strategyFields.qualificationApproach'),
                  value: strategy.qualificationApproach,
                },
                {
                  label: t('requests.strategyFields.evaluationApproach'),
                  value: strategy.evaluationApproach,
                },
                {
                  label: t('requests.strategyFields.negotiationPermitted'),
                  value: strategy.negotiationPermitted
                    ? t('requests.common.yes')
                    : t('requests.common.no'),
                },
                { label: t('requests.strategyFields.risks'), value: strategy.risks },
                {
                  label: t('requests.strategyFields.timetableSummary'),
                  value: strategy.timetableSummary,
                },
                {
                  label: t('requests.strategyFields.externalOversight'),
                  value: strategy.externalOversight,
                },
                { label: t('requests.strategies.col.category'), value: strategy.category?.name },
                {
                  label: t('requests.strategies.col.estimate'),
                  value: <MoneyText value={strategy.estimatedValue} />,
                },
              ]}
            />
          </Card>

          <Card
            flush
            title={t('requests.strategy.sections.compare')}
            subtitle={t('requests.strategy.compareHint')}
          >
            <DataTable
              caption={t('requests.strategy.sections.compare')}
              rows={comparison.data?.options}
              rowKey={(row) => row.procedure}
              loading={comparison.isFetching}
              error={comparison.error}
              onRetry={comparison.reload}
              empty={<EmptyState compact title={t('requests.strategy.compareEmpty')} />}
              columns={[
                {
                  id: 'procedure',
                  header: t('requests.strategies.col.procedure'),
                  cell: (row) => (
                    <div className="tiq-stack">
                      <span>
                        {tEnum('procurement_strategies.procedure', row.procedure)}{' '}
                        {row.selected && (
                          <div>
                            <Chip tone="accent" size="sm">
                              {t('requests.strategy.selected')}
                            </Chip>
                          </div>
                        )}
                      </span>
                      <span className="tiq-cell-sub">{row.purpose}</span>
                    </div>
                  ),
                },
                {
                  id: 'distinctions',
                  header: t('requests.strategy.distinctions'),
                  cell: (row) => (
                    <ul>
                      {row.requiredDistinctions.map((item) => (
                        <li key={item} className="tiq-cell-sub">
                          {item}
                        </li>
                      ))}
                    </ul>
                  ),
                },
                {
                  id: 'policy',
                  header: t('requests.strategy.policyFit'),
                  cell: (row) => (
                    <div className="tiq-stack">
                      <div>
                        <Chip tone={row.permittedByPolicy ? 'success' : 'danger'} size="sm">
                          {row.permittedByPolicy
                            ? t('requests.strategy.permitted')
                            : t('requests.strategy.notPermitted')}
                        </Chip>
                      </div>
                      {row.withinThreshold !== null && (
                        <div>
                          <Chip tone={row.withinThreshold ? 'success' : 'warning'} size="sm">
                            {row.withinThreshold
                              ? t('requests.strategy.withinThreshold')
                              : t('requests.strategy.overThreshold')}
                          </Chip>
                        </div>
                      )}
                      {row.requiresExceptionApproval && (
                        <div>
                          <Chip tone="warning" size="sm">
                            {t('requests.strategy.exceptionApproval')}
                          </Chip>
                        </div>
                      )}
                      {row.thresholdNote !== null && (
                        <span className="tiq-cell-sub">{row.thresholdNote}</span>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'duration',
                  header: t('requests.strategy.duration'),
                  numeric: true,
                  cell: (row) => t('requests.common.days', { count: row.typicalDurationDays }),
                },
              ]}
            />
          </Card>

          <Card
            flush
            title={t('requests.strategy.sections.research')}
            actions={
              allowed.includes('add_research') ? (
                <Button size="sm" icon="plus" onClick={() => setDialog({ kind: 'research' })}>
                  {t('requests.strategy.addResearch')}
                </Button>
              ) : undefined
            }
          >
            <DataTable
              caption={t('requests.strategy.sections.research')}
              rows={strategy.marketResearch}
              rowKey={(row) => String(row.id)}
              empty={
                <EmptyState compact icon="search" title={t('requests.strategy.researchEmpty')} />
              }
              columns={[
                {
                  id: 'source',
                  header: t('requests.strategy.research.source'),
                  cell: (row) => (
                    <>
                      {row.source}
                      <div className="tiq-cell-sub">
                        {tEnum('market_research_entries.source_type', row.sourceType)}
                      </div>
                    </>
                  ),
                },
                {
                  id: 'finding',
                  header: t('requests.strategy.research.finding'),
                  cell: (row) => row.finding,
                },
                {
                  id: 'nature',
                  header: t('requests.strategy.research.nature'),
                  cell: (row) => (
                    <div className="tiq-stack">
                      <div>
                        <Chip tone={row.isSupplierCommitment ? 'success' : 'warning'} size="sm">
                          {row.isSupplierCommitment
                            ? t('requests.strategy.research.commitment')
                            : t('requests.strategy.research.unverified')}
                        </Chip>
                      </div>
                      {row.priorSpecificationInvolvement && (
                        <div>
                          <Chip tone="danger" outlined size="sm">
                            {t('requests.strategy.research.priorInvolvement')}
                          </Chip>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'supplier',
                  header: t('requests.strategy.research.supplier'),
                  cell: (row) => row.supplier?.name ?? '',
                },
                {
                  id: 'recorded',
                  header: t('requests.strategy.research.recorded'),
                  cell: (row) => (
                    <>
                      {formatDateTime(row.recordedAt, timeZone)}
                      {row.recordedBy !== null && (
                        <div className="tiq-cell-sub">{row.recordedBy.fullName}</div>
                      )}
                    </>
                  ),
                },
              ]}
            />
          </Card>

          <Card flush title={t('requests.strategy.sections.fairness')}>
            <DataTable
              caption={t('requests.strategy.sections.fairness')}
              rows={strategy.fairnessReviews}
              rowKey={(row) => String(row.id)}
              empty={
                <EmptyState compact icon="scale" title={t('requests.strategy.fairnessEmpty')} />
              }
              columns={[
                {
                  id: 'supplier',
                  header: t('requests.strategy.research.supplier'),
                  cell: (row) => row.supplier.name,
                },
                {
                  id: 'reason',
                  header: t('requests.strategy.fairness.reason'),
                  cell: (row) => row.reason,
                },
                {
                  id: 'outcome',
                  header: t('requests.strategy.fairness.outcome'),
                  cell: (row) => (
                    <div className="tiq-stack">
                      <div>
                        <StatusChip enum="fairness_reviews.outcome" value={row.outcome} size="sm" />
                      </div>
                      {row.note !== null && <span className="tiq-cell-sub">{row.note}</span>}
                      {row.reviewer !== null && (
                        <span className="tiq-cell-sub">
                          {row.reviewer.fullName}
                          {row.decidedAt !== null &&
                            ` · ${formatDateTime(row.decidedAt, timeZone)}`}
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'actions',
                  header: t('requests.register.col.actions'),
                  cell: (row) =>
                    row.outcome === 'pending' && allowed.includes('decide_fairness') ? (
                      <Button
                        size="sm"
                        onClick={() => setDialog({ kind: 'fairness', review: row })}
                      >
                        {t('requests.strategy.fairness.decide')}
                      </Button>
                    ) : null,
                },
              ]}
            />
          </Card>

          <DocumentList
            audience="buyer"
            relatedType="procurement_strategy"
            relatedId={strategy.id}
            title={t('requests.strategy.sections.documents')}
            canUpload={allowed.includes('edit')}
          />
        </div>

        <div className="tiq-stack">
          <Card title={t('requests.strategy.sections.approval')}>
            {strategy.approval === null ? (
              <EmptyState compact title={t('requests.strategy.approval.none')} />
            ) : (
              <DetailList
                stacked
                items={[
                  {
                    label: t('requests.decision.route.status'),
                    value: (
                      <StatusChip
                        enum="approval_requests.status"
                        value={strategy.approval.status}
                      />
                    ),
                  },
                  {
                    label: t('requests.strategy.approval.revision'),
                    value:
                      strategy.approval.approvedRevision === null
                        ? null
                        : t('requests.detail.revision', {
                            revision: strategy.approval.approvedRevision,
                          }),
                  },
                  {
                    label: t('requests.strategy.approval.decidedBy'),
                    value:
                      strategy.approval.decidedBy === null
                        ? null
                        : `${strategy.approval.decidedBy.fullName}${
                            strategy.approval.decidedAt === null
                              ? ''
                              : ` · ${formatDateTime(strategy.approval.decidedAt, timeZone)}`
                          }`,
                  },
                  { label: t('requests.decision.conditions'), value: strategy.approval.conditions },
                  {
                    label: t('requests.strategy.approval.reason'),
                    value: strategy.approval.reason,
                  },
                ]}
              />
            )}
            {strategy.callerAuthority !== null && (
              <p
                className={
                  strategy.callerAuthority.sufficient ? 'tiq-text-success' : 'tiq-text-danger'
                }
              >
                {strategy.callerAuthority.sufficient
                  ? t('requests.strategy.authorityOk', {
                      amount: formatMoney(strategy.callerAuthority.amount),
                    })
                  : t('requests.strategy.authorityLow', {
                      amount: formatMoney(strategy.callerAuthority.amount),
                      limit: formatMoney(strategy.callerAuthority.limit),
                    })}
              </p>
            )}
          </Card>

          <Card title={t('requests.strategy.sections.policy')}>
            <DetailList
              stacked
              items={[
                {
                  label: t('requests.strategy.policy.profile'),
                  value:
                    policy.policyProfileVersion === null
                      ? null
                      : t('requests.strategy.policy.version', {
                          name: policy.policyProfileVersion.name,
                          version: policy.policyProfileVersion.versionNo,
                        }),
                },
                {
                  label: t('requests.strategy.policy.permitted'),
                  value: policy.permittedProcedures
                    .map((value) => tEnum('procurement_strategies.procedure', value))
                    .join(', '),
                },
                {
                  label: t('requests.strategy.policy.fit'),
                  value: (
                    <div className="tiq-stack">
                      <div>
                        <Chip tone={policy.procedurePermitted ? 'success' : 'danger'} size="sm">
                          {policy.procedurePermitted
                            ? t('requests.strategy.permitted')
                            : t('requests.strategy.notPermitted')}
                        </Chip>
                      </div>
                      {policy.withinThreshold !== null && (
                        <div>
                          <Chip tone={policy.withinThreshold ? 'success' : 'danger'} size="sm">
                            {policy.withinThreshold
                              ? t('requests.strategy.withinThreshold')
                              : t('requests.strategy.overThreshold')}
                          </Chip>
                        </div>
                      )}
                      {policy.thresholdNote !== null && (
                        <span className="tiq-cell-sub">{policy.thresholdNote}</span>
                      )}
                    </div>
                  ),
                },
                {
                  label: t('requests.strategy.policy.notice'),
                  value: policy.requiresPublicNotice
                    ? t('requests.common.yes')
                    : t('requests.common.no'),
                },
              ]}
            />
          </Card>

          <Card title={t('requests.strategy.sections.distinctions')}>
            <ReadinessChecklist
              label={t('requests.strategy.sections.distinctions')}
              items={strategy.procedureDistinctions.map((item) => ({
                id: item.id,
                label: item.label,
                detail: item.detail ?? undefined,
                status: item.satisfied ? 'passed' : 'warning',
              }))}
            />
          </Card>

          {strategy.submissionReadiness.length > 0 && (
            <Card title={t('requests.detail.readiness')}>
              <ReadinessChecklist
                label={t('requests.detail.readiness')}
                items={strategy.submissionReadiness.map((item) => ({
                  id: item.id,
                  label: item.label,
                  detail: item.detail ?? undefined,
                  status: item.status,
                }))}
              />
            </Card>
          )}

          <Card title={t('requests.strategy.sections.events')}>
            {strategy.tenders.length === 0 ? (
              <EmptyState compact title={t('requests.strategies.noEvents')} />
            ) : (
              <ul className="tiq-stack">
                {strategy.tenders.map((tender) => (
                  <li key={tender.id}>
                    <Reference value={tender.reference} /> {tender.title}{' '}
                    <div>
                      <StatusChip enum="tenders.status" value={tender.status} size="sm" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {dialog?.kind === 'submit' && (
        <SubmitStrategyDialog strategy={strategy} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog?.kind === 'decide' && (
        <DecideStrategyDialog strategy={strategy} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog?.kind === 'research' && (
        <ResearchDialog
          strategy={strategy}
          onClose={() => setDialog(null)}
          onDone={(message, entry, review) =>
            done(message, {
              ...strategy,
              marketResearch: [...strategy.marketResearch, entry],
              fairnessReviews:
                review === null ? strategy.fairnessReviews : [...strategy.fairnessReviews, review],
              pendingFairnessReviews:
                strategy.pendingFairnessReviews + (review?.outcome === 'pending' ? 1 : 0),
            })
          }
        />
      )}
      {dialog?.kind === 'fairness' && (
        <FairnessDialog
          strategy={strategy}
          review={dialog.review}
          onClose={() => setDialog(null)}
          onDone={(message, review) =>
            done(message, {
              ...strategy,
              fairnessReviews: strategy.fairnessReviews.map((item) =>
                item.id === review.id ? review : item,
              ),
              pendingFairnessReviews: Math.max(
                0,
                strategy.pendingFairnessReviews - (review.outcome === 'pending' ? 0 : 1),
              ),
            })
          }
        />
      )}
    </>
  );
}

interface StrategyDialogProps {
  readonly strategy: StrategyDetail;
  readonly onClose: () => void;
  readonly onDone: (message: string, next: StrategyDetail | null) => void;
}

function scopeOf(strategy: StrategyDetail): string {
  return t('requests.strategy.scope', {
    title: strategy.title,
    revision: strategy.revision,
    procedure: tEnum('procurement_strategies.procedure', strategy.procedure),
  });
}

function SubmitStrategyDialog({ strategy, onClose, onDone }: StrategyDialogProps) {
  const submit = useApiMutation(requestEndpoints.submitStrategy);
  const blocking = strategy.submissionReadiness.some((item) => item.status === 'blocking');
  return (
    <ConfirmActionDialog
      open
      title={t('requests.strategy.submitTitle')}
      scope={scopeOf(strategy)}
      consequence={t('requests.strategy.submitConsequence')}
      confirmLabel={t('requests.strategy.submit')}
      reason={{ label: t('requests.strategy.justification'), required: false }}
      acknowledgement={blocking ? t('requests.dialogs.submit.blockingAck') : undefined}
      pending={submit.pending}
      error={explainError(submit.error)}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        try {
          const next = await submit.mutate({
            params: { strategyId: strategy.id },
            body: {
              expectedRevision: strategy.revision,
              justification: reason === '' ? null : reason,
            },
          });
          onDone(t('requests.strategy.submitted'), next);
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      <ReadinessChecklist
        label={t('requests.detail.readiness')}
        items={strategy.submissionReadiness.map((item) => ({
          id: item.id,
          label: item.label,
          detail: item.detail ?? undefined,
          status: item.status,
        }))}
      />
    </ConfirmActionDialog>
  );
}

const STRATEGY_DECISIONS: readonly ApprovalDecision[] = [
  'approve',
  'approve_with_conditions',
  'return',
  'reject',
];

function DecideStrategyDialog({ strategy, onClose, onDone }: StrategyDialogProps) {
  const decide = useApiMutation(requestEndpoints.decideStrategy);
  const insufficient = strategy.callerAuthority !== null && !strategy.callerAuthority.sufficient;
  const [decision, setDecision] = useState<ApprovalDecision>(insufficient ? 'return' : 'approve');
  const [conditions, setConditions] = useState('');
  const [tried, setTried] = useState(false);
  const errors = formErrors(decide.error, ['decision', 'conditions', 'reason']);
  const conditionsMissing = decision === 'approve_with_conditions' && conditions.trim() === '';
  return (
    <ConfirmActionDialog
      open
      tone={decision === 'reject' ? 'danger' : 'primary'}
      title={t('requests.strategy.decideTitle')}
      scope={scopeOf(strategy)}
      consequence={t(`requests.decision.dialog.consequence.${decision}`)}
      confirmLabel={t(`requests.decision.dialog.confirm.${decision}`)}
      reason={{ label: t('requests.decision.dialog.reason'), required: true }}
      pending={decide.pending}
      error={explainError(decide.error)}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        setTried(true);
        if (conditionsMissing) return;
        try {
          const next = await decide.mutate({
            params: { strategyId: strategy.id },
            body: {
              decision,
              reason,
              conditions: decision === 'approve_with_conditions' ? conditions.trim() : null,
              subjectRevision: strategy.revision,
            },
          });
          onDone(t(`requests.decision.done.${decision}`, { reference: strategy.title }), next);
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      <RadioGroup
        label={t('requests.decision.dialog.decision')}
        required
        value={decision}
        onChange={(value) => setDecision(value as ApprovalDecision)}
        error={errors.forField('decision')}
        options={STRATEGY_DECISIONS.map((value) => {
          const approving = value === 'approve' || value === 'approve_with_conditions';
          return {
            value,
            label: t(`requests.decision.dialog.option.${value}`),
            disabled: approving && insufficient,
            hint: approving && insufficient ? t('requests.errors.AUTHORITY_EXCEEDED') : undefined,
          };
        })}
      />
      {decision === 'approve_with_conditions' && (
        <TextArea
          label={t('requests.decision.conditions')}
          required
          rows={3}
          value={conditions}
          onChange={setConditions}
          error={
            errors.forField('conditions') ??
            (tried && conditionsMissing ? t('requests.errors.CONDITIONS_REQUIRED') : undefined)
          }
        />
      )}
    </ConfirmActionDialog>
  );
}

function ResearchDialog({
  strategy,
  onClose,
  onDone,
}: {
  readonly strategy: StrategyDetail;
  readonly onClose: () => void;
  readonly onDone: (
    message: string,
    entry: StrategyDetail['marketResearch'][number],
    review: FairnessReview | null,
  ) => void;
}) {
  const options = useApiQuery(requestEndpoints.getRequestOptions, {});
  const add = useApiMutation(requestEndpoints.addMarketResearch);
  const [sourceType, setSourceType] =
    useState<MarketResearchEntriesSourceType>('supplier_consultation');
  const [source, setSource] = useState('');
  const [finding, setFinding] = useState('');
  const [commitment, setCommitment] = useState(false);
  const [involvement, setInvolvement] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [tried, setTried] = useState(false);
  const errors = formErrors(add.error, [
    'sourceType',
    'source',
    'finding',
    'isSupplierCommitment',
    'supplierTenantId',
    'priorSpecificationInvolvement',
  ]);
  const local = {
    source: source.trim().length < 2 ? t('requests.strategy.research.sourceRequired') : undefined,
    finding:
      finding.trim().length < 5 ? t('requests.strategy.research.findingRequired') : undefined,
    supplier:
      (commitment || involvement) && supplier === ''
        ? t('requests.strategy.research.supplierRequired')
        : undefined,
  };
  const invalid = Object.values(local).some((value) => value !== undefined);
  return (
    <ConfirmActionDialog
      open
      title={t('requests.strategy.addResearch')}
      scope={scopeOf(strategy)}
      consequence={
        involvement
          ? t('requests.strategy.research.consequenceFairness')
          : t('requests.strategy.research.consequence')
      }
      confirmLabel={t('requests.strategy.research.record')}
      pending={add.pending}
      error={explainError(add.error)}
      onCancel={onClose}
      onConfirm={async () => {
        setTried(true);
        if (invalid) return;
        try {
          const result = await add.mutate({
            params: { strategyId: strategy.id },
            body: {
              sourceType,
              source: source.trim(),
              finding: finding.trim(),
              isSupplierCommitment: commitment,
              supplierTenantId: supplier === '' ? null : Number(supplier),
              priorSpecificationInvolvement: involvement,
            },
          });
          onDone(
            result.fairnessReview === null
              ? t('requests.strategy.research.done')
              : t('requests.strategy.research.recordedFairness'),
            result.entry,
            result.fairnessReview,
          );
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      <Select
        label={t('requests.strategy.research.sourceType')}
        required
        value={sourceType}
        onChange={(value) => setSourceType(value as MarketResearchEntriesSourceType)}
        options={enumOptions('market_research_entries.source_type')}
        error={errors.forField('sourceType')}
      />
      <TextField
        label={t('requests.strategy.research.source')}
        required
        value={source}
        onChange={setSource}
        error={errors.forField('source') ?? (tried ? local.source : undefined)}
      />
      <TextArea
        label={t('requests.strategy.research.finding')}
        required
        rows={4}
        value={finding}
        onChange={setFinding}
        error={errors.forField('finding') ?? (tried ? local.finding : undefined)}
      />
      <RadioGroup
        label={t('requests.strategy.research.nature')}
        required
        value={commitment ? 'commitment' : 'unverified'}
        onChange={(value) => setCommitment(value === 'commitment')}
        options={[
          {
            value: 'unverified',
            label: t('requests.strategy.research.unverified'),
            hint: t('requests.strategy.research.unverifiedHint'),
          },
          {
            value: 'commitment',
            label: t('requests.strategy.research.commitment'),
            hint: t('requests.strategy.research.commitmentHint'),
          },
        ]}
        error={errors.forField('isSupplierCommitment')}
      />
      <Select
        label={t('requests.strategy.research.supplier')}
        required={commitment || involvement}
        value={supplier}
        onChange={setSupplier}
        placeholder={t('requests.common.none')}
        options={(options.data?.suppliers ?? []).map((item) => ({
          value: String(item.tenantId),
          label: item.name,
        }))}
        error={errors.forField('supplierTenantId') ?? (tried ? local.supplier : undefined)}
      />
      <Checkbox
        label={t('requests.strategy.research.priorInvolvementLabel')}
        hint={t('requests.strategy.research.priorInvolvementHint')}
        checked={involvement}
        onChange={setInvolvement}
      />
    </ConfirmActionDialog>
  );
}

function FairnessDialog({
  strategy,
  review,
  onClose,
  onDone,
}: {
  readonly strategy: StrategyDetail;
  readonly review: FairnessReview;
  readonly onClose: () => void;
  readonly onDone: (message: string, review: FairnessReview) => void;
}) {
  const decide = useApiMutation(requestEndpoints.decideFairnessReview);
  const [outcome, setOutcome] = useState<'no_issue' | 'mitigated' | 'excluded_from_drafting'>(
    'mitigated',
  );
  return (
    <ConfirmActionDialog
      open
      title={t('requests.strategy.fairness.title', { supplier: review.supplier.name })}
      scope={`${scopeOf(strategy)} · ${review.reason}`}
      consequence={t(`requests.strategy.fairness.consequence.${outcome}`)}
      confirmLabel={t('requests.strategy.fairness.record')}
      reason={{ label: t('requests.strategy.fairness.note'), required: true }}
      pending={decide.pending}
      error={explainError(decide.error)}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        try {
          const next = await decide.mutate({
            params: { strategyId: strategy.id, reviewId: review.id },
            body: { outcome, note: reason },
          });
          onDone(t('requests.strategy.fairness.done', { supplier: review.supplier.name }), next);
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      <RadioGroup
        label={t('requests.strategy.fairness.outcome')}
        required
        value={outcome}
        onChange={(value) => setOutcome(value as typeof outcome)}
        options={enumOptions('fairness_reviews.outcome', [
          'no_issue',
          'mitigated',
          'excluded_from_drafting',
        ])}
      />
    </ConfirmActionDialog>
  );
}
