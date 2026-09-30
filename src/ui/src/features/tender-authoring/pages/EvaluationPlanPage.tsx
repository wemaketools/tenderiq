/**
 * BUY-11 — Evaluation plan: criteria, weights, scales, thresholds, assignments (evaluators and chair), moderation
 * (aggregation method), price method and tie rules. Principal actions: establish and approve the plan before
 * release; a later amendment is shown explicitly (amendment history with notes).
 *
 * Weights of the top-level criteria must total 100 (PRD §9.1): the editor shows the live total and the validation
 * message, and the API refuses the plan with 422 `WEIGHTS_TOTAL_NOT_100`.
 */
import { useState } from 'react';

import { eq } from '@contracts/decimal';
import { approveEvaluationPlan, getEvaluationPlans } from '@contracts/tenders';
import type { EvaluationCriterion, EvaluationPlan } from '@contracts/tenders';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import {
  Banner,
  Button,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  KpiCard,
  KpiGrid,
  OrDash,
  RestrictedState,
  SkeletonBlock,
  StatusChip,
  Tabs,
  Timeline,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { formatCalendarDate, formatDateTime, formatDecimalString } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { IssueList } from '../components/IssueList';
import { PlanEditor } from '../components/PlanEditor';
import { TenderHeader, TenderWorkspace } from '../components/TenderWorkspace';
import type { TenderWorkspaceContext } from '../components/TenderWorkspace';
import { withTenderMessage } from '../lib/errors';
import { scopeLabel } from '../lib/labels';
import { useOverlay } from '../lib/overlay';

export default function EvaluationPlanPage() {
  return <TenderWorkspace>{(context) => <Plans context={context} />}</TenderWorkspace>;
}

function Plans({ context }: { readonly context: TenderWorkspaceContext }) {
  const { tender, canEdit, canApprove } = context;
  const toast = useToast();
  const query = useApiQuery(getEvaluationPlans, { params: { tenderId: tender.id } });
  const plans = useOverlay<EvaluationPlan>();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState(false);
  const approve = useApiMutation(approveEvaluationPlan);

  const rows = query.data === undefined ? [] : plans.apply(query.data.plans);
  const plan = rows.find((row) => String(row.id) === selected) ?? rows[0] ?? null;
  const blocking =
    plan?.issues.filter(
      (issue) => issue.severity === 'blocking' && issue.code !== 'PLAN_NOT_APPROVED',
    ) ?? [];
  const canApproveNow =
    canApprove && tender.editability.editable && plan !== null && plan.status !== 'approved';

  const confirmApprove = async ({ reason }: { readonly reason: string }): Promise<void> => {
    if (plan === null) return;
    try {
      const result = await approve.mutate({
        params: { tenderId: tender.id, planId: plan.id },
        body: { expectedVersion: plan.version, ...(reason === '' ? {} : { note: reason }) },
      });
      plans.put(result.plan);
      context.reportChange(result.change);
      toast.show(t('tender-authoring.plan.approved', { version: result.plan.version }), 'success');
      setApproving(false);
      approve.reset();
    } catch {
      // Shown in the dialog.
    }
  };

  const criterionColumns = (current: EvaluationPlan): DataTableColumn<EvaluationCriterion>[] => {
    const codeById = new Map(current.criteria.map((row) => [row.id, row.code]));
    return [
      {
        id: 'code',
        header: t('tender-authoring.plan.code'),
        cell: (row) => (
          <>
            <span className="tiq-mono">{row.code}</span>
            {row.parentId !== null && (
              <span className="tiq-cell-sub">
                {t('tender-authoring.plan.under', { parent: codeById.get(row.parentId) ?? '' })}
              </span>
            )}
          </>
        ),
      },
      {
        id: 'name',
        header: t('tender-authoring.plan.name'),
        cell: (row) => (
          <>
            <span>{row.name}</span>
            <span className="tiq-cell-sub">{row.scoringGuidance ?? row.description ?? ''}</span>
          </>
        ),
      },
      {
        id: 'points',
        header: t('tender-authoring.plan.maxPoints'),
        numeric: true,
        cell: (row) => (
          <span className="tiq-inline">
            {formatDecimalString(row.maxPoints)}
            {row.isPrice && (
              <Chip tone="accent" size="sm">
                {t('tender-authoring.plan.price')}
              </Chip>
            )}
          </span>
        ),
      },
      {
        id: 'min',
        header: t('tender-authoring.plan.minScore'),
        numeric: true,
        cell: (row) => (
          <OrDash>{row.minScore === null ? null : formatDecimalString(row.minScore)}</OrDash>
        ),
      },
      {
        id: 'envelope',
        header: t('tender-authoring.plan.envelope'),
        cell: (row) => tEnum('evaluation_criteria.envelope', row.envelope),
      },
      {
        id: 'linked',
        header: t('tender-authoring.plan.linked'),
        numeric: true,
        cell: (row) => (
          <>
            <span>{row.linkedRequirementCount}</span>
            {row.naPermitted && (
              <span className="tiq-cell-sub">{t('tender-authoring.plan.naPermitted')}</span>
            )}
          </>
        ),
      },
    ];
  };

  const view = (current: EvaluationPlan) => {
    const totalOk = eq(current.weightsTotal, '100');
    return (
      <div className="tiq-stack">
        <IssueList issues={current.issues} label={t('tender-authoring.plan.issues')} />
        <div className="tiq-grid tiq-grid--sidebar">
          <div className="tiq-stack">
            <Card
              title={t('tender-authoring.plan.criteria')}
              subtitle={
                <Chip
                  tone={totalOk ? 'success' : 'danger'}
                  size="sm"
                  icon={totalOk ? 'checkCircle' : 'xCircle'}
                >
                  {totalOk
                    ? t('tender-authoring.plan.total', {
                        total: formatDecimalString(current.weightsTotal),
                      })
                    : t('tender-authoring.plan.weightsNot100', {
                        total: formatDecimalString(current.weightsTotal),
                      })}
                </Chip>
              }
              flush
            >
              <DataTable
                caption={t('tender-authoring.plan.criteriaCaption')}
                columns={criterionColumns(current)}
                rows={[...current.criteria].sort((a, b) => a.sortOrder - b.sortOrder)}
                rowKey={(row) => String(row.id)}
                empty={
                  <EmptyState
                    compact
                    icon="listChecks"
                    title={t('tender-authoring.plan.noCriteria')}
                  />
                }
              />
            </Card>
            <div className="tiq-grid tiq-grid--2">
              <Card title={t('tender-authoring.plan.anchors')}>
                {current.anchors.length === 0 ? (
                  <EmptyState compact icon="list" title={t('tender-authoring.plan.noAnchors')} />
                ) : (
                  <DetailList
                    stacked
                    items={[...current.anchors]
                      .sort((a, b) => a.value - b.value)
                      .map((anchor) => ({
                        key: String(anchor.value),
                        label: `${anchor.value} · ${anchor.label}`,
                        value: anchor.description,
                      }))}
                  />
                )}
              </Card>
              <Card title={t('tender-authoring.plan.tieRules')}>
                {current.tieBreakRules.length === 0 ? (
                  <EmptyState compact icon="list" title={t('tender-authoring.plan.noTieRules')} />
                ) : (
                  <ol className="tiq-stack">
                    {[...current.tieBreakRules]
                      .sort((a, b) => a.sequence - b.sequence)
                      .map((rule) => (
                        <li key={rule.sequence}>
                          {tEnum('tie_break_rules.rule', rule.rule)}
                          {rule.criterion === null
                            ? ''
                            : ` · ${rule.criterion.code} ${rule.criterion.name}`}
                        </li>
                      ))}
                  </ol>
                )}
              </Card>
            </div>
          </div>
          <div className="tiq-stack">
            <Card title={t('tender-authoring.plan.approvalTitle')}>
              <DetailList
                stacked
                items={[
                  {
                    key: 'status',
                    label: t('tender-authoring.fields.status'),
                    value: <StatusChip enum="evaluation_plans.status" value={current.status} />,
                  },
                  {
                    key: 'version',
                    label: t('tender-authoring.plan.version'),
                    value: current.version,
                  },
                  {
                    key: 'approved',
                    label: t('tender-authoring.plan.approvedBy'),
                    value:
                      current.approvedBy === null
                        ? t('tender-authoring.plan.notApproved')
                        : `${current.approvedBy.fullName} · ${current.approvedAt === null ? '' : formatDateTime(current.approvedAt, tender.officialTimeZone)}`,
                  },
                ]}
              />
              {current.amendments.length > 0 && (
                <Timeline
                  label={t('tender-authoring.plan.amendments')}
                  items={current.amendments.map((row) => ({
                    id: row.version,
                    title: t('tender-authoring.plan.amendedVersion', { version: row.version }),
                    meta: `${formatDateTime(row.amendedAt, tender.officialTimeZone)} · ${row.amendedBy.fullName}`,
                    detail: row.note,
                    tone: 'warning',
                  }))}
                />
              )}
            </Card>
            <Card title={t('tender-authoring.plan.settings')}>
              <DetailList
                stacked
                items={[
                  {
                    key: 'scale',
                    label: t('tender-authoring.plan.scaleMax'),
                    value: t('tender-authoring.plan.scaleValue', { max: current.scaleMax }),
                  },
                  {
                    key: 'aggregation',
                    label: t('tender-authoring.plan.aggregation'),
                    value: tEnum('evaluation_plans.aggregation_method', current.aggregationMethod),
                  },
                  {
                    key: 'price',
                    label: t('tender-authoring.plan.priceMethod'),
                    value: `${tEnum('evaluation_plans.price_method', current.priceMethod)}${current.priceWeight === null ? '' : ` · ${formatDecimalString(current.priceWeight)}`}`,
                  },
                  {
                    key: 'formula',
                    label: t('tender-authoring.plan.formula'),
                    value: current.priceFormulaNote,
                  },
                  {
                    key: 'zero',
                    label: t('tender-authoring.plan.zeroPrice'),
                    value: current.zeroPriceTreatment,
                  },
                  {
                    key: 'missing',
                    label: t('tender-authoring.plan.missingPrice'),
                    value: current.missingPriceTreatment,
                  },
                  {
                    key: 'threshold',
                    label: t('tender-authoring.plan.thresholdScope'),
                    value: `${tEnum('evaluation_plans.threshold_scope', current.thresholdScope)}${current.nonPriceThreshold === null ? '' : ` · ${formatDecimalString(current.nonPriceThreshold)}`}`,
                  },
                  {
                    key: 'decimals',
                    label: t('tender-authoring.plan.decimals'),
                    value: t('tender-authoring.plan.decimalsValue', {
                      calc: current.decimalPlacesCalc,
                      display: current.decimalPlacesDisplay,
                    }),
                  },
                  {
                    key: 'currency',
                    label: t('tender-authoring.plan.comparisonCurrency'),
                    value: current.comparisonCurrency,
                  },
                  {
                    key: 'fx',
                    label: t('tender-authoring.plan.fxSource'),
                    value:
                      current.fxSource === null
                        ? null
                        : `${current.fxSource}${current.fxDate === null ? '' : ` · ${formatCalendarDate(current.fxDate)}`}`,
                  },
                ]}
              />
            </Card>
            <Card title={t('tender-authoring.plan.assignments')}>
              <DetailList
                stacked
                items={[
                  {
                    key: 'chair',
                    label: t('tender-authoring.overview.chair'),
                    value: tender.team.evaluationChair?.fullName ?? null,
                  },
                  {
                    key: 'evaluators',
                    label: t('tender-authoring.overview.evaluators'),
                    value:
                      tender.team.evaluators.length === 0
                        ? null
                        : tender.team.evaluators.map((row) => row.fullName).join(', '),
                  },
                  {
                    key: 'moderation',
                    label: t('tender-authoring.plan.moderation'),
                    value: tEnum('evaluation_plans.aggregation_method', current.aggregationMethod),
                  },
                  {
                    key: 'independent',
                    label: t('tender-authoring.fields.independentEvaluation'),
                    value: tender.independentEvaluation
                      ? t('tender-authoring.common.yes')
                      : t('tender-authoring.common.no'),
                  },
                ]}
              />
            </Card>
          </div>
        </div>
      </div>
    );
  };

  const body = (() => {
    if (query.error !== null) {
      return query.error.kind === 'forbidden' ? (
        <RestrictedState />
      ) : (
        <ErrorState error={query.error} onRetry={query.reload} />
      );
    }
    if (query.data === undefined) return <SkeletonBlock lines={8} />;
    if (plan === null) {
      return (
        <Card>
          <EmptyState
            icon="scale"
            title={t('tender-authoring.plan.none')}
            description={t('tender-authoring.plan.noneHint')}
          />
        </Card>
      );
    }
    const content = editing ? (
      <PlanEditor
        key={`${plan.id}-${plan.version}`}
        tenderId={tender.id}
        plan={plan}
        currency={tender.currency}
        onCancel={() => setEditing(false)}
        onSaved={(result) => {
          plans.put(result.plan);
          context.reportChange(result.change);
          setEditing(false);
          toast.show(t('tender-authoring.plan.saved', { version: result.plan.version }), 'success');
        }}
      />
    ) : (
      view(plan)
    );
    return (
      <>
        <KpiGrid>
          <KpiCard
            label={t('tender-authoring.plan.kpi.status')}
            icon="clipboardCheck"
            tone={plan.status === 'approved' ? 'success' : 'warning'}
            value={tEnum('evaluation_plans.status', plan.status)}
            hint={t('tender-authoring.plan.versionValue', { version: plan.version })}
          />
          <KpiCard
            label={t('tender-authoring.plan.kpi.criteria')}
            icon="listChecks"
            value={plan.criteria.length}
          />
          <KpiCard
            label={t('tender-authoring.plan.kpi.gates')}
            icon="shieldCheck"
            tone="info"
            value={query.data.mandatoryGateCount}
            hint={t('tender-authoring.plan.kpi.gatesHint')}
          />
          <KpiCard
            label={t('tender-authoring.plan.kpi.unrated')}
            icon="alertTriangle"
            tone={query.data.ratedRequirementsWithoutCriterion > 0 ? 'danger' : 'success'}
            value={query.data.ratedRequirementsWithoutCriterion}
            hint={t('tender-authoring.plan.kpi.unratedHint')}
          />
        </KpiGrid>
        {rows.length > 1 ? (
          <Tabs
            label={t('tender-authoring.plan.plans')}
            selected={String(plan.id)}
            onSelect={(id) => {
              setSelected(id);
              setEditing(false);
            }}
            tabs={rows.map((row) => ({ id: String(row.id), label: scopeLabel(row.lot) }))}
          >
            {content}
          </Tabs>
        ) : (
          content
        )}
      </>
    );
  })();

  return (
    <>
      <TenderHeader
        context={context}
        section="evaluation"
        primaryAction={
          canApproveNow && !editing ? (
            <Button
              variant="primary"
              icon="checkCircle"
              onClick={() => setApproving(true)}
              disabled={blocking.length > 0}
            >
              {t('tender-authoring.plan.approve')}
            </Button>
          ) : undefined
        }
        actions={
          canEdit && plan !== null && !editing ? (
            <Button icon="edit" onClick={() => setEditing(true)}>
              {plan.status === 'draft'
                ? t('tender-authoring.plan.edit')
                : t('tender-authoring.plan.amend')}
            </Button>
          ) : undefined
        }
      />
      {canApproveNow && blocking.length > 0 && !editing && (
        <Banner tone="error" title={t('tender-authoring.plan.cannotApprove')}>
          <p>{t('tender-authoring.plan.cannotApproveDetail', { count: blocking.length })}</p>
        </Banner>
      )}
      {body}
      {plan !== null && (
        <ConfirmActionDialog
          open={approving}
          title={t('tender-authoring.plan.approveTitle')}
          scope={`${tender.reference} · ${scopeLabel(plan.lot)} · ${t('tender-authoring.plan.versionValue', { version: plan.version })}`}
          consequence={t('tender-authoring.plan.approveResult')}
          confirmLabel={t('tender-authoring.plan.approve')}
          reason={{ label: t('tender-authoring.plan.approveNote'), required: false }}
          onConfirm={confirmApprove}
          onCancel={() => {
            setApproving(false);
            approve.reset();
          }}
          pending={approve.pending}
          error={withTenderMessage(approve.error)}
        />
      )}
    </>
  );
}
