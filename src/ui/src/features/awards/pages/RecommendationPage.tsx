/**
 * BUY-26 — Award recommendation and approval: the final evaluation and commercial comparison, qualification, due
 * diligence, funding and affordability, conflicts and exceptions, lot outcomes and allocations, proposed contracts
 * and the approval decision. Draft (saved), submitted (awaiting approval) and approved states look distinct.
 * Approvers approve, approve with conditions, return or reject with a rationale; "no award" is a lot outcome.
 */
import { useState } from 'react';
import { Link } from 'react-router';

import {
  RECOMMENDATION_DECISIONS,
  decideRecommendation,
  getAwardOverview,
  getRecommendation,
  submitRecommendation,
} from '@contracts/awards';
import type {
  RecommendationDecision,
  RecommendationDetail,
  RecommendationDiligenceRow,
  RecommendationOfferRow,
  RecommendationQualificationRow,
  ProposedContract,
  LotOutcome,
} from '@contracts/awards';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  MoneyText,
  OrDash,
  RadioGroup,
  SkeletonBlock,
  StatusChip,
  TextArea,
  Timeline,
  formErrors,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn, TimelineTone } from '../../../components/ui';
import { formatCalendarDate, formatDateTime, formatDecimalString } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { AwardFileLayout } from '../components/AwardFileLayout';
import { GateChecklist } from '../components/GateChecklist';
import { blockingCount } from '../lib/gates';
import { ReconciliationCard } from '../components/ReconciliationCard';
import { RecommendationEditor } from '../components/RecommendationEditor';
import { TextBlock } from '../components/TextBlock';
import { withAwardMessage } from '../lib/errors';
import { useIdParam, useLatest, useOfficialTimeZone } from '../lib/hooks';
import { lotLabel, lotNosLabel, yesNo } from '../lib/labels';
import { awardPaths } from '../lib/paths';

const EDITABLE = ['draft', 'returned'];

const HISTORY_TONE: Readonly<Record<string, TimelineTone>> = {
  created: 'neutral',
  edited: 'neutral',
  submitted: 'info',
  approved: 'success',
  approved_with_conditions: 'success',
  returned: 'warning',
  rejected: 'danger',
  superseded: 'neutral',
};

export default function RecommendationPage() {
  const tenderId = useIdParam('tenderId');
  const recommendationId = useIdParam('recommendationId');
  const overview = useApiQuery(
    getAwardOverview,
    tenderId === null ? null : { params: { tenderId } },
  );
  const query = useApiQuery(
    getRecommendation,
    recommendationId === null ? null : { params: { recommendationId } },
  );
  const [latest, setLatest] = useLatest<RecommendationDetail>(
    recommendationId === null ? null : String(recommendationId),
    (record) => String(record.recommendationId),
  );
  const detail = latest ?? query.data;

  if (tenderId === null || recommendationId === null) {
    return <EmptyState title={t('awards.recommendation.notFound')} icon="clipboard" />;
  }

  return (
    <AwardFileLayout
      tenderId={tenderId}
      overview={overview}
      title={
        detail === undefined
          ? t('awards.recommendation.title')
          : t('awards.recommendation.titleVersion', {
              reference: detail.tender.reference,
              version: detail.version,
            })
      }
      back={{ to: awardPaths.file(tenderId), label: t('awards.recommendation.back') }}
    >
      {detail === undefined ? (
        query.error !== null ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : (
          <SkeletonBlock lines={8} />
        )
      ) : (
        <RecommendationBody key={detail.updatedAt} detail={detail} onChanged={setLatest} />
      )}
    </AwardFileLayout>
  );
}

function StatusBanner({ detail }: { readonly detail: RecommendationDetail }) {
  switch (detail.status) {
    case 'draft':
      return (
        <Banner tone="info" title={t('awards.recommendation.state.draft')}>
          {t('awards.recommendation.state.draftText')}
        </Banner>
      );
    case 'awaiting_approval':
      return (
        <Banner tone="warning" title={t('awards.recommendation.state.awaiting')}>
          {t('awards.recommendation.state.awaitingText')}
        </Banner>
      );
    case 'approved':
      return (
        <Banner tone="success" title={t('awards.recommendation.state.approved')}>
          {detail.approval.conditions === null
            ? t('awards.recommendation.state.approvedText')
            : t('awards.recommendation.state.approvedConditions', {
                conditions: detail.approval.conditions,
              })}
        </Banner>
      );
    case 'returned':
      return (
        <Banner tone="warning" title={t('awards.recommendation.state.returned')}>
          {detail.approval.rationale ?? t('awards.recommendation.state.returnedText')}
        </Banner>
      );
    case 'rejected':
      return (
        <Banner tone="error" title={t('awards.recommendation.state.rejected')}>
          {detail.approval.rationale ?? t('awards.recommendation.state.rejectedText')}
        </Banner>
      );
    default:
      return (
        <Banner tone="info" title={t('awards.recommendation.state.superseded')}>
          {t('awards.recommendation.state.supersededText')}
        </Banner>
      );
  }
}

function RecommendationBody({
  detail,
  onChanged,
}: {
  readonly detail: RecommendationDetail;
  readonly onChanged: (detail: RecommendationDetail) => void;
}) {
  const toast = useToast();
  const timeZone = useOfficialTimeZone();
  const canRecommend = usePermission('award.recommend');
  const canApprove = usePermission('award.approve');
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [decision, setDecision] = useState<RecommendationDecision>('approve');
  const [conditions, setConditions] = useState('');

  const submit = useApiMutation(submitRecommendation);
  const decide = useApiMutation(decideRecommendation);

  const editable = canRecommend && EDITABLE.includes(detail.status);
  const decidable = canApprove && detail.status === 'awaiting_approval';
  const blocking = blockingCount(detail.submissionChecks);
  const scope = `${detail.tender.reference} ${detail.tender.title} · ${t('awards.common.version', { no: detail.version })}`;

  const confirmSubmit = async ({ reason }: { readonly reason: string }): Promise<void> => {
    try {
      const result = await submit.mutate({
        params: { recommendationId: detail.recommendationId },
        body: { note: reason.trim() === '' ? undefined : reason.trim() },
      });
      setSubmitting(false);
      onChanged(result);
      invalidateApiQueries('buyer.awards.');
      toast.show(t('awards.recommendation.submitted'), 'success');
    } catch {
      // The dialog shows the error.
    }
  };

  const confirmDecision = async ({ reason }: { readonly reason: string }): Promise<void> => {
    try {
      const result = await decide.mutate({
        params: { recommendationId: detail.recommendationId },
        body: {
          decision,
          rationale: reason.trim(),
          conditions:
            decision === 'approve_with_conditions' && conditions.trim() !== ''
              ? conditions.trim()
              : undefined,
        },
      });
      setDeciding(false);
      onChanged(result);
      invalidateApiQueries('buyer.awards.');
      toast.show(t(`awards.recommendation.decided.${decision}`), 'success');
    } catch {
      // The dialog shows the error.
    }
  };

  if (editing) {
    return (
      <RecommendationEditor
        detail={detail}
        onCancel={() => setEditing(false)}
        onSaved={(saved) => {
          setEditing(false);
          onChanged(saved);
          toast.show(t('awards.editor.saved'), 'success');
        }}
      />
    );
  }

  const offerColumns: DataTableColumn<RecommendationOfferRow>[] = [
    {
      id: 'supplier',
      header: t('awards.recommendation.col.supplier'),
      cell: (row) => (
        <>
          <span>{row.supplier.name}</span>
          {row.note !== null && <span className="tiq-cell-sub">{row.note}</span>}
        </>
      ),
    },
    {
      id: 'lots',
      header: t('awards.recommendation.col.lots'),
      cell: (row) => lotNosLabel(row.lotNos),
    },
    {
      id: 'compliance',
      header: t('awards.recommendation.col.compliance'),
      cell: (row) => (
        <StatusChip enum="bids.compliance_status" value={row.complianceStatus} size="sm" />
      ),
    },
    {
      id: 'technical',
      header: t('awards.recommendation.col.technical'),
      numeric: true,
      cell: (row) => formatDecimalString(row.technicalScore, 2),
    },
    {
      id: 'commercial',
      header: t('awards.recommendation.col.commercial'),
      numeric: true,
      cell: (row) => formatDecimalString(row.commercialScore, 2),
    },
    {
      id: 'total',
      header: t('awards.recommendation.col.total'),
      numeric: true,
      cell: (row) => formatDecimalString(row.totalScore, 2),
    },
    {
      id: 'rank',
      header: t('awards.recommendation.col.rank'),
      numeric: true,
      cell: (row) => (row.rank === null ? <OrDash>{null}</OrDash> : String(row.rank)),
    },
    {
      id: 'price',
      header: t('awards.recommendation.col.price'),
      numeric: true,
      cell: (row) =>
        row.evaluatedPrice === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <MoneyText value={row.evaluatedPrice} />
        ),
    },
  ];

  const qualificationColumns: DataTableColumn<RecommendationQualificationRow>[] = [
    {
      id: 'supplier',
      header: t('awards.recommendation.col.supplier'),
      cell: (row) => row.supplier.name,
    },
    {
      id: 'status',
      header: t('awards.recommendation.col.status'),
      cell: (row) => (
        <StatusChip enum="v_qualification_status.effective_status" value={row.status} size="sm" />
      ),
    },
    {
      id: 'scope',
      header: t('awards.recommendation.col.scope'),
      cell: (row) => (
        <>
          <span>{row.scope}</span>
          {row.conditions !== null && <span className="tiq-cell-sub">{row.conditions}</span>}
        </>
      ),
    },
    {
      id: 'validTo',
      header: t('awards.recommendation.col.validTo'),
      cell: (row) =>
        row.validTo === null ? <OrDash>{null}</OrDash> : formatCalendarDate(row.validTo),
    },
  ];

  const diligenceColumns: DataTableColumn<RecommendationDiligenceRow>[] = [
    {
      id: 'supplier',
      header: t('awards.recommendation.col.supplier'),
      cell: (row) => row.supplier.name,
    },
    {
      id: 'status',
      header: t('awards.recommendation.col.status'),
      cell: (row) => (
        <StatusChip enum="due_diligence_cases.status" value={row.caseStatus} size="sm" />
      ),
    },
    {
      id: 'blocking',
      header: t('awards.recommendation.col.blockingFindings'),
      numeric: true,
      cell: (row) => (
        <span className={row.blockingFindings > 0 ? 'tiq-text-danger' : undefined}>
          {row.blockingFindings}
        </span>
      ),
    },
    { id: 'summary', header: t('awards.recommendation.col.summary'), cell: (row) => row.summary },
  ];

  const outcomeColumns: DataTableColumn<LotOutcome>[] = [
    { id: 'lot', header: t('awards.recommendation.col.lot'), cell: (row) => lotLabel(row.lot) },
    {
      id: 'outcome',
      header: t('awards.recommendation.col.outcome'),
      cell: (row) => (
        <span className="tiq-inline">
          <StatusChip enum="lot_outcomes.outcome" value={row.outcome} size="sm" />
          <StatusChip enum="lot_outcomes.status" value={row.status} size="sm" />
        </span>
      ),
    },
    {
      id: 'supplier',
      header: t('awards.recommendation.col.supplier'),
      cell: (row) => row.supplier?.name ?? <OrDash>{null}</OrDash>,
    },
    {
      id: 'value',
      header: t('awards.recommendation.col.value'),
      numeric: true,
      cell: (row) =>
        row.awardedValue === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <MoneyText value={row.awardedValue} />
        ),
    },
    {
      id: 'reason',
      header: t('awards.recommendation.col.reason'),
      cell: (row) => (
        <>
          <span>{row.reason ?? ''}</span>
          {row.conditions !== null && (
            <span className="tiq-cell-sub">
              {t('awards.file.conditions', { text: row.conditions })}
            </span>
          )}
        </>
      ),
    },
  ];

  const contractColumns: DataTableColumn<ProposedContract>[] = [
    {
      id: 'supplier',
      header: t('awards.recommendation.col.supplier'),
      cell: (row) => row.supplier.name,
    },
    {
      id: 'lots',
      header: t('awards.recommendation.col.lots'),
      cell: (row) => lotNosLabel(row.lotNos),
    },
    {
      id: 'value',
      header: t('awards.recommendation.col.value'),
      numeric: true,
      cell: (row) => <MoneyText value={row.value} />,
    },
    {
      id: 'contract',
      header: t('awards.recommendation.col.contract'),
      cell: (row) =>
        row.contractId === null || row.contractReference === null ? (
          <span className="tiq-text-muted">{t('awards.recommendation.contractNotCreated')}</span>
        ) : (
          <span className="tiq-inline">
            <Link className="tiq-ref" to={awardPaths.contract(row.contractId)}>
              {row.contractReference}
            </Link>
            {row.contractStatus !== null && (
              <StatusChip enum="contracts.status" value={row.contractStatus} size="sm" />
            )}
          </span>
        ),
    },
  ];

  const decisionErrors = formErrors(decide.error, ['conditions', 'rationale', 'decision']);

  return (
    <div className="tiq-stack tiq-stack--spaced">
      <StatusBanner detail={detail} />
      {(editable || decidable) && (
        <div className="tiq-inline">
          {editable && (
            <>
              <Button
                variant="primary"
                icon="send"
                onClick={() => {
                  submit.reset();
                  setSubmitting(true);
                }}
              >
                {t('awards.recommendation.submit')}
              </Button>
              <Button icon="edit" onClick={() => setEditing(true)}>
                {t('awards.recommendation.edit')}
              </Button>
            </>
          )}
          {decidable && (
            <Button
              variant="primary"
              icon="gavel"
              onClick={() => {
                decide.reset();
                setDecision('approve');
                setConditions('');
                setDeciding(true);
              }}
            >
              {t('awards.recommendation.decide')}
            </Button>
          )}
        </div>
      )}
      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack tiq-stack--spaced">
          <Card title={t('awards.recommendation.summaryTitle')}>
            <DetailList
              stacked
              items={(
                [
                  'summary',
                  'compliantOffersSummary',
                  'affordabilitySummary',
                  'conflictsSummary',
                  'exceptionsSummary',
                  'negotiationSummary',
                  'unresolvedConditions',
                ] as const
              ).map((field) => ({
                key: field,
                label: t(`awards.recommendation.text.${field}`),
                value: <TextBlock text={detail[field]} />,
              }))}
            />
          </Card>
        </div>
        <div className="tiq-stack tiq-stack--spaced">
          <Card
            title={t('awards.recommendation.checksTitle')}
            subtitle={
              blocking > 0
                ? t('awards.recommendation.checksBlocking', { count: blocking })
                : t('awards.recommendation.checksClear')
            }
          >
            <GateChecklist
              checks={detail.submissionChecks}
              label={t('awards.recommendation.checksTitle')}
            />
          </Card>
          <Card title={t('awards.recommendation.recordTitle')}>
            <DetailList
              stacked
              items={[
                {
                  label: t('awards.recommendation.status'),
                  value: <StatusChip enum="award_recommendations.status" value={detail.status} />,
                },
                {
                  label: t('awards.recommendation.createdBy'),
                  value: `${detail.createdBy.fullName} · ${formatDateTime(detail.createdAt, timeZone)}`,
                },
                {
                  label: t('awards.recommendation.updated'),
                  value: formatDateTime(detail.updatedAt, timeZone),
                },
                {
                  label: t('awards.recommendation.snapshot'),
                  value:
                    detail.snapshotId === null
                      ? t('awards.recommendation.noSnapshot')
                      : t('awards.recommendation.snapshotId', { id: detail.snapshotId }),
                },
              ]}
            />
          </Card>
          <Card title={t('awards.recommendation.approvalTitle')}>
            <DetailList
              stacked
              items={[
                {
                  label: t('awards.recommendation.approvalStatus'),
                  value:
                    detail.approval.status === null ? (
                      t('awards.recommendation.approvalNotRequested')
                    ) : (
                      <StatusChip enum="approval_requests.status" value={detail.approval.status} />
                    ),
                },
                {
                  label: t('awards.recommendation.approver'),
                  value: detail.approval.approver?.fullName ?? null,
                },
                {
                  label: t('awards.recommendation.decidedAt'),
                  value:
                    detail.approval.decidedAt === null
                      ? null
                      : formatDateTime(detail.approval.decidedAt, timeZone),
                },
                {
                  label: t('awards.recommendation.approvalConditions'),
                  value: detail.approval.conditions,
                },
                {
                  label: t('awards.recommendation.rationale'),
                  value: detail.approval.rationale,
                },
              ]}
            />
          </Card>
        </div>
      </div>
      <Card
        title={t('awards.recommendation.offersTitle')}
        subtitle={t('awards.recommendation.offersSubtitle')}
        flush
      >
        <DataTable
          caption={t('awards.recommendation.offersTitle')}
          columns={offerColumns}
          rows={detail.offers}
          rowKey={(row) => String(row.bidId)}
          empty={<EmptyState compact title={t('awards.recommendation.noOffers')} />}
        />
      </Card>
      <div className="tiq-grid tiq-grid--2">
        <Card title={t('awards.recommendation.affordabilityTitle')}>
          <DetailList
            items={[
              {
                label: t('awards.recommendation.budget'),
                value:
                  detail.affordability.budgetAmount === null ? null : (
                    <MoneyText value={detail.affordability.budgetAmount} />
                  ),
              },
              {
                label: t('awards.recommendation.fundingConfirmed'),
                value: (
                  <span
                    className={
                      detail.affordability.fundingConfirmed ? 'tiq-text-success' : 'tiq-text-danger'
                    }
                  >
                    {yesNo(detail.affordability.fundingConfirmed)}
                  </span>
                ),
              },
              {
                label: t('awards.recommendation.withinBudget'),
                value: (
                  <span
                    className={
                      detail.affordability.withinBudget ? 'tiq-text-success' : 'tiq-text-warning'
                    }
                  >
                    {yesNo(detail.affordability.withinBudget)}
                  </span>
                ),
              },
              {
                label: t('awards.recommendation.conflicts'),
                value: (
                  <span
                    className={detail.unresolvedConflictCount > 0 ? 'tiq-text-danger' : undefined}
                  >
                    {t('awards.recommendation.unresolvedConflicts', {
                      count: detail.unresolvedConflictCount,
                    })}
                  </span>
                ),
              },
            ]}
          />
        </Card>
        <Card title={t('awards.recommendation.diligenceTitle')} flush>
          <DataTable
            caption={t('awards.recommendation.diligenceTitle')}
            columns={diligenceColumns}
            rows={detail.diligence}
            rowKey={(row) => String(row.supplier.supplierTenantId)}
            empty={<EmptyState compact title={t('awards.recommendation.noDiligence')} />}
          />
        </Card>
      </div>
      <Card title={t('awards.recommendation.qualificationTitle')} flush>
        <DataTable
          caption={t('awards.recommendation.qualificationTitle')}
          columns={qualificationColumns}
          rows={detail.qualification}
          rowKey={(row) => String(row.supplier.supplierTenantId)}
          empty={<EmptyState compact title={t('awards.recommendation.noQualification')} />}
        />
      </Card>
      <Card
        title={t('awards.recommendation.outcomesTitle')}
        subtitle={t('awards.recommendation.outcomesSubtitle')}
        flush
      >
        <DataTable
          caption={t('awards.recommendation.outcomesTitle')}
          columns={outcomeColumns}
          rows={detail.lotOutcomes}
          rowKey={(row) => String(row.lotOutcomeId)}
          empty={<EmptyState compact title={t('awards.recommendation.noOutcomes')} />}
        />
      </Card>
      <ReconciliationCard reconciliation={detail.reconciliation} />
      <Card title={t('awards.recommendation.contractsTitle')} flush>
        <DataTable
          caption={t('awards.recommendation.contractsTitle')}
          columns={contractColumns}
          rows={detail.proposedContracts}
          rowKey={(row) => `${row.supplier.supplierTenantId}-${row.lotNos.join('-')}`}
          empty={<EmptyState compact title={t('awards.recommendation.noContracts')} />}
        />
      </Card>
      <Card title={t('awards.recommendation.historyTitle')}>
        <Timeline
          label={t('awards.recommendation.historyTitle')}
          items={detail.history.map((entry, index) => ({
            id: index,
            title: t(`awards.recommendation.history.${entry.action}`, { version: entry.version }),
            meta: `${entry.actor.fullName} · ${formatDateTime(entry.at, timeZone)}`,
            detail: entry.note ?? undefined,
            tone: HISTORY_TONE[entry.action] ?? 'neutral',
          }))}
        />
      </Card>

      <ConfirmActionDialog
        open={submitting}
        title={t('awards.recommendation.submitTitle')}
        scope={scope}
        consequence={t('awards.recommendation.submitConsequence')}
        confirmLabel={t('awards.recommendation.submit')}
        reason={{ label: t('awards.common.noteOptional'), required: false }}
        pending={submit.pending}
        error={withAwardMessage(submit.error)}
        onCancel={() => setSubmitting(false)}
        onConfirm={confirmSubmit}
      >
        <GateChecklist
          checks={detail.submissionChecks}
          label={t('awards.recommendation.checksTitle')}
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={deciding}
        title={t('awards.recommendation.decideTitle')}
        scope={scope}
        consequence={t(`awards.recommendation.decisionConsequence.${decision}`)}
        confirmLabel={t(`awards.recommendation.decision.${decision}`)}
        tone={decision === 'reject' ? 'danger' : 'primary'}
        reason={{
          label: t('awards.recommendation.rationale'),
          required: true,
          hint: t('awards.recommendation.rationaleHint'),
        }}
        pending={decide.pending}
        error={withAwardMessage(decide.error)}
        onCancel={() => setDeciding(false)}
        onConfirm={confirmDecision}
      >
        <RadioGroup
          label={t('awards.recommendation.decisionLabel')}
          required
          value={decision}
          error={decisionErrors.forField('decision')}
          options={RECOMMENDATION_DECISIONS.map((value) => ({
            value,
            label: t(`awards.recommendation.decision.${value}`),
            hint: t(`awards.recommendation.decisionHint.${value}`),
          }))}
          onChange={(value) => {
            const found = RECOMMENDATION_DECISIONS.find((item) => item === value);
            if (found !== undefined) setDecision(found);
          }}
        />
        {decision === 'approve_with_conditions' && (
          <TextArea
            label={t('awards.recommendation.approvalConditions')}
            required
            value={conditions}
            error={decisionErrors.forField('conditions')}
            onChange={setConditions}
            rows={3}
          />
        )}
        <p className="tiq-text-muted">
          {t('awards.recommendation.decisionStatus', {
            status: tEnum('award_recommendations.status', detail.status),
          })}
        </p>
      </ConfirmActionDialog>
    </div>
  );
}
