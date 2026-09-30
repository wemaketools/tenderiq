/**
 * EVA-02 — Individual assessment: for each bid and criterion in the assignment, the requirement, the opened response
 * and its evidence, the scoring guide with its scale anchors, and the evaluator's own rating, rationale, evidence
 * references, clarification need and notes. The evaluator saves drafts and submits; submission makes the assessment a
 * formal record (FR-14) and is refused while a cell is "Not scored" (never zero, AC-18). Peers' scores stay hidden
 * until the evaluator's own submission (independent evaluation) and prices are never shown here (AC-16). A submitted
 * score changes only through a correction with a reason; the history is kept (BR-27).
 */
import { useState } from 'react';
import { Link } from 'react-router';

import { correctScore, getAssessment, saveScores, submitAssessment } from '@contracts/evaluation';
import type {
  Assessment,
  AssessedBid,
  EvaluationCriterion,
  ScoreCell,
} from '@contracts/evaluation';
import type { ClarificationDetail } from '@contracts/opening';

import type { ApiError } from '../../../api/client';
import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
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
  ErrorState,
  FormErrorSummary,
  KpiCard,
  KpiGrid,
  OfficialDeadline,
  PageHeader,
  Reference,
  RestrictedState,
  Select,
  SkeletonBlock,
  StatusChip,
  Tabs,
  TextArea,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import type { ReadinessItem } from '../../../components/ui';
import { ReadinessChecklist } from '../../../components/ui';
import { formatCount, formatDateTime, formatDecimalString } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { CellClarificationDialog } from '../components/CellClarificationDialog';
import { PriceGateChip, ScoreValue } from '../components/chips';
import { checkCells, draftOf, inputOf, splitKey, withCell } from '../lib/assessment';
import type { CellDraft } from '../lib/assessment';
import { evaluationErrorMessage, withEvaluationMessage } from '../lib/errors';
import { useIdParam } from '../lib/hooks';
import { bidLabel, lotLabel } from '../lib/labels';
import { evaluationPaths } from '../lib/paths';
import {
  cellKey,
  criteriaById,
  orderedCriteria,
  ratingOptions,
  weightedPoints,
} from '../lib/scores';

/**
 * A field label whose visible text stays short while its accessible name also says which criterion and bid the field
 * scores, so the identical fields of each criterion card are distinguishable to screen readers (WCAG 2.4.6, 1.3.1).
 */
function contextLabel(text: string, criterion: string, bid: string) {
  return (
    <>
      <span aria-hidden="true">{text}</span>
      <span className="tiq-visually-hidden">
        {t('evaluation.assessment.fieldContext', { label: text, criterion, bid })}
      </span>
    </>
  );
}

/** The chair's clarification coordination queue (EVA-03, owned by the opening feature). */
const CLARIFICATIONS_PATH = '/buyer/bid-clarifications';

const CLOSED = new Set(['submitted', 'finalized', 'recused', 'reassigned']);

export default function AssessmentPage() {
  const assignmentId = useIdParam('assignmentId');
  const query = useApiQuery(
    getAssessment,
    assignmentId === null ? null : { params: { assignmentId } },
  );
  const [latest, setLatest] = useState<Assessment | null>(null);
  const assessment =
    latest !== null && latest.assignmentId === assignmentId ? latest : (query.data ?? null);

  if (assessment === null) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('evaluation.assessment.title')}
          back={
            assignmentId === null
              ? { to: evaluationPaths.assignments, label: t('evaluation.assignments.title') }
              : {
                  to: evaluationPaths.assignment(assignmentId),
                  label: t('evaluation.assignment.title'),
                }
          }
        />
        {assignmentId === null ? (
          <EmptyState title={t('evaluation.assignment.notFound')} />
        ) : query.error !== null ? (
          <BlockedOrError error={query.error} assignmentId={assignmentId} onRetry={query.reload} />
        ) : (
          <SkeletonBlock lines={8} />
        )}
      </div>
    );
  }
  return <AssessmentWorkspace assessment={assessment} onUpdated={setLatest} />;
}

function BlockedOrError({
  error,
  assignmentId,
  onRetry,
}: {
  readonly error: ApiError;
  readonly assignmentId: number;
  readonly onRetry: () => void;
}) {
  if (error.code === 'ASSESSMENT_CONTENT_BLOCKED' || error.code === 'COMMERCIAL_ASSIGNMENT') {
    return (
      <RestrictedState
        title={t(`evaluation.assessment.blocked.${error.code}`)}
        description={evaluationErrorMessage(error)}
        action={
          <ButtonLink to={evaluationPaths.assignment(assignmentId)} variant="primary">
            {t('evaluation.assessment.toAssignment')}
          </ButtonLink>
        }
      />
    );
  }
  if (error.kind === 'not_found') {
    return <EmptyState title={t('evaluation.assignment.notFound')} icon="search" />;
  }
  return <ErrorState error={error} onRetry={onRetry} />;
}

function ResponsePanel({
  bid,
  criterionId,
}: {
  readonly bid: AssessedBid;
  readonly criterionId: number;
}) {
  const responses =
    bid.responses.find((item) => item.criterionId === criterionId)?.requirements ?? [];
  if (responses.length === 0) {
    return <p className="tiq-text-muted">{t('evaluation.assessment.noResponse')}</p>;
  }
  return (
    <div className="tiq-stack">
      {responses.map((response) => (
        <div key={response.requirementId} className="tiq-stack">
          <span className="tiq-inline">
            <span className="tiq-mono">{response.refCode}</span>
            {response.isDeviation && (
              <Chip tone="warning" size="sm">
                {t('evaluation.assessment.deviation')}
              </Chip>
            )}
          </span>
          <p>
            <strong>{t('evaluation.assessment.requirement')}</strong> {response.requirementText}
          </p>
          <p>
            <strong>{t('evaluation.assessment.response')}</strong>{' '}
            {response.answerText ?? t('evaluation.assessment.noAnswer')}
          </p>
          {response.documents.length > 0 && (
            <ul className="tiq-check-list" aria-label={t('evaluation.assessment.evidenceDocs')}>
              {response.documents.map((document) => (
                <li key={document.documentId}>
                  <Link to={evaluationPaths.document(document.documentId)}>{document.title}</Link>{' '}
                  <span className="tiq-text-muted">{document.fileName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function fieldError(
  error: ApiError | null,
  sentKeys: readonly string[],
  key: string,
  field: string,
): string | undefined {
  if (error === null) return undefined;
  const index = sentKeys.indexOf(key);
  if (index < 0) return undefined;
  return error.fieldErrors.find((item) => item.field === `scores.${index}.${field}`)?.message;
}

function AssessmentWorkspace({
  assessment,
  onUpdated,
}: {
  readonly assessment: Assessment;
  readonly onUpdated: (assessment: Assessment) => void;
}) {
  const tenant = useActiveTenant();
  const toast = useToast();
  const canScore = usePermission('evaluation.score');
  const timeZone = assessment.tender.officialTimeZone;
  const plan = assessment.plan;
  const criteria = orderedCriteria(plan, assessment.criterionIds);
  const byId = criteriaById(plan);
  const cells = new Map(
    assessment.scores.map((cell) => [cellKey(cell.bidId, cell.criterionId), cell]),
  );
  const editable = !assessment.readOnly && canScore && !CLOSED.has(assessment.status);
  // EVA-02 → EVA-03: an assessor sends a flagged question to the chair's clarification queue.
  const canRaise =
    !assessment.readOnly &&
    canScore &&
    assessment.status !== 'recused' &&
    assessment.status !== 'reassigned';
  const canCorrect =
    !assessment.readOnly &&
    canScore &&
    assessment.status === 'submitted' &&
    assessment.correctionsOpen;

  const [drafts, setDrafts] = useState<Readonly<Record<string, CellDraft>>>({});
  const [selectedBid, setSelectedBid] = useState<number>(assessment.bids[0]?.bidId ?? 0);
  const [sentKeys, setSentKeys] = useState<readonly string[]>([]);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [correcting, setCorrecting] = useState<ScoreCell | null>(null);
  const [correctRating, setCorrectRating] = useState('');
  const [correctRationale, setCorrectRationale] = useState('');
  const [raising, setRaising] = useState<ScoreCell | null>(null);
  const [raised, setRaised] = useState<Readonly<Record<string, ClarificationDetail>>>({});

  const save = useApiMutation(saveScores);
  const submit = useApiMutation(submitAssessment);
  const correct = useApiMutation(correctScore);

  const effective = (key: string): CellDraft => drafts[key] ?? draftOf(cells.get(key));
  const dirtyKeys = Object.keys(drafts);
  const dirty = dirtyKeys.length > 0;
  const checks = checkCells(assessment, effective);
  const notScored = checks.filter((check) => check.status === 'not_scored');
  const clarifications = checks.filter((check) => effective(check.key).clarificationNeeded).length;
  const bid = assessment.bids.find((item) => item.bidId === selectedBid) ?? assessment.bids[0];
  const scope = `${assessment.tender.reference} ${assessment.tender.title}${
    assessment.lot === null ? '' : ` · ${lotLabel(assessment.lot) ?? ''}`
  }`;

  const update = (key: string, patch: Partial<CellDraft>): void => {
    setDrafts({ ...drafts, [key]: { ...effective(key), ...patch } });
  };
  const dirtyInputs = () =>
    dirtyKeys.map((key) => {
      const { bidId, criterionId } = splitKey(key);
      return inputOf(bidId, criterionId, drafts[key] ?? draftOf(cells.get(key)));
    });

  const criterionName = (criterionId: number): string => {
    const criterion = byId.get(criterionId);
    return criterion === undefined ? String(criterionId) : `${criterion.code} ${criterion.name}`;
  };
  const bidName = (bidId: number): string => {
    const found = assessment.bids.find((item) => item.bidId === bidId);
    return found === undefined ? String(bidId) : bidLabel(found);
  };

  /** A correction-dialog field label that also names, for screen readers, the criterion and bid being corrected. */
  const correctionLabel = (text: string) =>
    correcting === null
      ? text
      : contextLabel(text, criterionName(correcting.criterionId), bidName(correcting.bidId));

  const readiness: ReadinessItem[] = [
    ...checks
      .filter((check) => check.status === 'not_scored' || check.status === 'rationale_missing')
      .map((check) => ({
        id: check.key,
        status: 'blocking' as const,
        label:
          check.status === 'not_scored'
            ? t('evaluation.assessment.check.notScored', {
                criterion: criterionName(check.criterionId),
                bid: bidName(check.bidId),
              })
            : t('evaluation.assessment.check.rationale', {
                criterion: criterionName(check.criterionId),
                bid: bidName(check.bidId),
              }),
      })),
    ...checks
      .filter((check) => check.status === 'clarification')
      .map((check) => ({
        id: `${check.key}:clarification`,
        status: 'warning' as const,
        label: t('evaluation.assessment.check.clarification', {
          criterion: criterionName(check.criterionId),
          bid: bidName(check.bidId),
        }),
      })),
    ...(checks.every(
      (check) => check.status !== 'not_scored' && check.status !== 'rationale_missing',
    )
      ? [
          {
            id: 'complete',
            status: 'passed' as const,
            label: t('evaluation.assessment.check.complete'),
          },
        ]
      : []),
  ];

  const onSave = async (): Promise<void> => {
    const keys = dirtyKeys;
    setSentKeys(keys);
    try {
      const next = await save.mutate({
        params: { assignmentId: assessment.assignmentId },
        body: { scores: dirtyInputs() },
      });
      setDrafts({});
      onUpdated(next);
      toast.show(t('evaluation.assessment.saved'), 'success');
    } catch {
      // The page shows the error next to the fields and in the summary.
    }
  };

  const saveError = save.error;
  const savedAt = assessment.scores
    .map((cell) => cell.submittedAt)
    .filter((value): value is string => value !== null)
    .sort()
    .at(-1);

  const renderCriterion = (criterion: EvaluationCriterion, current: AssessedBid) => {
    const key = cellKey(current.bidId, criterion.criterionId);
    const saved = cells.get(key);
    const draft = effective(key);
    const isDirty = drafts[key] !== undefined;
    const points = weightedPoints(
      draft.isNotApplicable ? null : draft.score || null,
      criterion,
      plan,
    );
    const titleId = `criterion-${key}`;
    const context = { criterion: `${criterion.code} ${criterion.name}`, bid: bidLabel(current) };
    const fieldLabel = (text: string) => contextLabel(text, context.criterion, context.bid);
    return (
      <Card
        key={key}
        title={`${criterion.code} ${criterion.name}`}
        subtitle={t('evaluation.assessment.maxPoints', {
          points: formatDecimalString(criterion.maxPoints, plan.decimalPlacesDisplay),
        })}
        actions={
          <span className="tiq-inline" id={titleId}>
            {isDirty && (
              <Chip tone="info" size="sm">
                {t('evaluation.assessment.unsaved')}
              </Chip>
            )}
            {saved !== undefined && saved.scoreId !== null && (
              <StatusChip enum="evaluation_scores.status" value={saved.status} size="sm" />
            )}
            {!draft.isNotApplicable && draft.score === '' && <ScoreValue score={null} />}
          </span>
        }
      >
        <div className="tiq-grid tiq-grid--2">
          <div className="tiq-stack">
            {criterion.description !== null && <p>{criterion.description}</p>}
            {criterion.scoringGuidance !== null && (
              <Banner tone="info" title={t('evaluation.assessment.guidance')}>
                <p>{criterion.scoringGuidance}</p>
              </Banner>
            )}
            <ResponsePanel bid={current} criterionId={criterion.criterionId} />
          </div>
          <div
            className="tiq-form-stack"
            role="group"
            aria-label={t('evaluation.assessment.cellGroup', context)}
          >
            {editable ? (
              <>
                <Select
                  label={fieldLabel(t('evaluation.assessment.rating', { max: plan.scaleMax }))}
                  required
                  placeholder={t('evaluation.score.notScored')}
                  value={draft.isNotApplicable ? '' : draft.score}
                  disabled={draft.isNotApplicable}
                  options={ratingOptions(
                    plan.scaleAnchors,
                    draft.score === '' ? null : draft.score,
                  )}
                  onChange={(score) => update(key, { score })}
                  hint={
                    points === null
                      ? t('evaluation.assessment.pointsNone')
                      : t('evaluation.assessment.points', {
                          points: formatDecimalString(points, plan.decimalPlacesDisplay),
                        })
                  }
                  error={fieldError(saveError, sentKeys, key, 'score')}
                />
                {criterion.naPermitted && (
                  <Checkbox
                    label={fieldLabel(t('evaluation.assessment.notApplicable'))}
                    checked={draft.isNotApplicable}
                    onChange={(checked) =>
                      update(key, { isNotApplicable: checked, score: checked ? '' : draft.score })
                    }
                  />
                )}
                <TextArea
                  label={fieldLabel(t('evaluation.assessment.rationale'))}
                  required
                  rows={3}
                  value={draft.rationale}
                  onChange={(rationale) => update(key, { rationale })}
                  error={fieldError(saveError, sentKeys, key, 'rationale')}
                />
                <TextArea
                  label={fieldLabel(t('evaluation.assessment.evidence'))}
                  hint={t('evaluation.assessment.evidenceHint')}
                  rows={2}
                  value={draft.evidence}
                  onChange={(evidence) => update(key, { evidence })}
                  error={fieldError(saveError, sentKeys, key, 'evidenceRefs')}
                />
                <Checkbox
                  label={fieldLabel(t('evaluation.assessment.clarify'))}
                  checked={draft.clarificationNeeded}
                  onChange={(clarificationNeeded) => update(key, { clarificationNeeded })}
                />
                {draft.clarificationNeeded && (
                  <TextArea
                    label={fieldLabel(t('evaluation.assessment.clarifyQuestion'))}
                    required
                    rows={2}
                    value={draft.clarificationQuestion}
                    onChange={(clarificationQuestion) => update(key, { clarificationQuestion })}
                    error={fieldError(saveError, sentKeys, key, 'clarificationQuestion')}
                  />
                )}
              </>
            ) : (
              <DetailList
                stacked
                items={[
                  {
                    key: 'rating',
                    label: t('evaluation.assessment.rating', { max: plan.scaleMax }),
                    value: (
                      <ScoreValue
                        score={saved?.score ?? null}
                        isNotApplicable={saved?.isNotApplicable}
                      />
                    ),
                  },
                  {
                    key: 'points',
                    label: t('evaluation.assessment.weighted'),
                    value:
                      saved?.weightedPoints === null || saved === undefined
                        ? null
                        : formatDecimalString(saved.weightedPoints, plan.decimalPlacesDisplay),
                  },
                  {
                    key: 'rationale',
                    label: t('evaluation.assessment.rationale'),
                    value: saved?.rationale ?? null,
                  },
                  {
                    key: 'evidence',
                    label: t('evaluation.assessment.evidence'),
                    value:
                      saved === undefined || saved.evidenceRefs.length === 0
                        ? null
                        : saved.evidenceRefs.join('; '),
                  },
                  {
                    key: 'clarification',
                    label: t('evaluation.assessment.clarify'),
                    value: saved?.clarificationNeeded === true ? saved.clarificationQuestion : null,
                  },
                ]}
              />
            )}
            {canRaise &&
              !isDirty &&
              saved !== undefined &&
              saved.clarificationNeeded &&
              saved.clarificationQuestion !== null &&
              (raised[key] === undefined ? (
                <div className="tiq-row-actions">
                  <Button size="sm" icon="messageQuestion" onClick={() => setRaising(saved)}>
                    {fieldLabel(t('evaluation.assessment.raise.action'))}
                  </Button>
                </div>
              ) : (
                <Banner
                  tone="success"
                  title={t('evaluation.assessment.raise.done', { id: raised[key].id })}
                >
                  <p>{t('evaluation.assessment.raise.doneBody')}</p>
                  <Link to={CLARIFICATIONS_PATH}>{t('evaluation.assessment.raise.open')}</Link>
                </Banner>
              ))}
            {canCorrect &&
              saved !== undefined &&
              saved.scoreId !== null &&
              saved.status === 'submitted' && (
                <div className="tiq-row-actions">
                  <Button
                    size="sm"
                    icon="edit"
                    onClick={() => {
                      correct.reset();
                      setCorrectRating(saved.score ?? '');
                      setCorrectRationale(saved.rationale ?? '');
                      setCorrecting(saved);
                    }}
                  >
                    {t('evaluation.assessment.correct')}
                  </Button>
                </div>
              )}
            {saved !== undefined && saved.corrections.length > 0 && (
              <div className="tiq-stack">
                <h4 className="tiq-form-section-title">{t('evaluation.assessment.corrections')}</h4>
                <ul className="tiq-check-list">
                  {saved.corrections.map((item) => (
                    <li key={item.correctionId}>
                      {t('evaluation.assessment.correctionLine', {
                        from: item.previousScore ?? t('evaluation.score.notScored'),
                        to: item.newScore ?? t('evaluation.score.notScored'),
                        by: item.correctedBy.fullName,
                        at: formatDateTime(item.correctedAt, timeZone),
                      })}
                      <span className="tiq-cell-sub">{item.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="tiq-page">
      <UnsavedChangesGuard when={dirty} />
      <PageHeader
        title={t('evaluation.assessment.title')}
        subtitle={scope}
        back={{
          to: evaluationPaths.assignment(assessment.assignmentId),
          label: t('evaluation.assignment.title'),
        }}
        primaryAction={
          editable ? (
            <Button
              variant="primary"
              icon="send"
              onClick={() => {
                submit.reset();
                setConfirmSubmit(true);
              }}
            >
              {t('evaluation.assessment.submit')}
            </Button>
          ) : undefined
        }
        actions={
          editable ? (
            <Button
              icon="check"
              disabled={!dirty}
              loading={save.pending}
              onClick={() => void onSave()}
            >
              {t('evaluation.assessment.saveDraft')}
            </Button>
          ) : undefined
        }
        meta={
          <>
            <Reference
              value={assessment.tender.reference}
              to={evaluationPaths.tender(assessment.tender.tenderId)}
            />
            {tenant !== null && <span className="tiq-text-muted">{tenant.name}</span>}
            <span>{assessment.evaluator.fullName}</span>
            <StatusChip enum="evaluation_assignments.status" value={assessment.status} />
            <OfficialDeadline deadline={assessment.dueAt} label={t('evaluation.common.due')} />
            <span>
              <strong>{t('evaluation.common.nextAction')}</strong>{' '}
              {editable
                ? notScored.length > 0
                  ? t('evaluation.assessment.next.score', { count: notScored.length })
                  : t('evaluation.assessment.next.submit')
                : t('evaluation.assessment.next.none')}
            </span>
          </>
        }
      />

      {assessment.readOnly && (
        <Banner tone="info" title={t('evaluation.assessment.readOnlyTitle')}>
          <p>{t('evaluation.assessment.readOnly', { name: assessment.evaluator.fullName })}</p>
        </Banner>
      )}
      {assessment.returnReason !== null && (
        <Banner tone="warning" title={t('evaluation.assignment.returnedTitle')}>
          <p>{assessment.returnReason}</p>
        </Banner>
      )}
      {assessment.status === 'submitted' && (
        <Banner tone="success" title={t('evaluation.assessment.submittedTitle')}>
          <p>
            {t('evaluation.assessment.submittedAt', {
              at: formatDateTime(assessment.submittedAt ?? savedAt ?? null, timeZone),
            })}
          </p>
          {!assessment.readOnly && !assessment.correctionsOpen && (
            <p>{t('evaluation.assessment.correctionsClosed')}</p>
          )}
        </Banner>
      )}
      {assessment.tender.anonymizedEvaluation && (
        <Banner tone="info" title={t('evaluation.assessment.anonymizedTitle')}>
          <p>
            {assessment.tender.anonymizationLimitations ?? t('evaluation.assessment.anonymized')}
          </p>
        </Banner>
      )}
      {saveError !== null && (
        <Banner tone="error" title={t('evaluation.assessment.saveFailed')}>
          <p>{evaluationErrorMessage(saveError)}</p>
          {saveError.fieldErrors.length > 0 && (
            <FormErrorSummary
              title={t('evaluation.common.fixErrors')}
              errors={saveError.fieldErrors}
            />
          )}
        </Banner>
      )}

      <KpiGrid>
        <KpiCard
          label={t('evaluation.assessment.kpi.scored')}
          icon="checkSquare"
          value={t('evaluation.common.ofTotal', {
            done: checks.length - notScored.length,
            total: checks.length,
          })}
          hint={t('evaluation.assessment.kpi.scoredHint')}
        />
        <KpiCard
          label={t('evaluation.assessment.kpi.notScored')}
          icon="alertTriangle"
          tone={notScored.length > 0 ? 'warning' : 'success'}
          value={formatCount(notScored.length)}
          hint={t('evaluation.assessment.kpi.notScoredHint')}
        />
        <KpiCard
          label={t('evaluation.assessment.kpi.clarifications')}
          icon="messageQuestion"
          tone="info"
          value={formatCount(clarifications)}
          hint={t('evaluation.assessment.kpi.clarificationsHint')}
        />
        <KpiCard
          label={t('evaluation.assessment.kpi.state')}
          icon="fileText"
          value={
            dirty
              ? t('evaluation.assessment.state.unsaved', { count: dirtyKeys.length })
              : assessment.status === 'submitted'
                ? t('evaluation.assessment.state.submitted')
                : t('evaluation.assessment.state.saved')
          }
          hint={t('evaluation.assessment.kpi.stateHint')}
        />
      </KpiGrid>

      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          {assessment.bids.length === 0 || bid === undefined ? (
            <EmptyState title={t('evaluation.assessment.noBids')} />
          ) : (
            <Tabs
              label={t('evaluation.assessment.bidsLabel')}
              selected={String(bid.bidId)}
              onSelect={(id) => setSelectedBid(Number(id))}
              tabs={assessment.bids.map((item) => ({
                id: String(item.bidId),
                label: bidLabel(item),
                count: notScored.filter((check) => check.bidId === item.bidId).length || undefined,
              }))}
            >
              <div className="tiq-stack">
                <DetailList
                  items={[
                    { key: 'receipt', label: t('evaluation.common.receipt'), value: bid.receiptNo },
                    {
                      key: 'received',
                      label: t('evaluation.common.received'),
                      value: formatDateTime(bid.receivedAt, timeZone),
                    },
                    {
                      key: 'compliance',
                      label: t('evaluation.common.compliance'),
                      value: (
                        <StatusChip enum="bids.compliance_status" value={bid.complianceStatus} />
                      ),
                    },
                  ]}
                />
                {criteria.map((criterion) => renderCriterion(criterion, bid))}
              </div>
            </Tabs>
          )}
        </div>
        <div className="tiq-stack">
          <Card
            title={t('evaluation.assessment.guideTitle')}
            subtitle={t('evaluation.assessment.guideIntro', { max: plan.scaleMax })}
          >
            <DetailList
              stacked
              items={[...plan.scaleAnchors]
                .sort((a, b) => a.value - b.value)
                .map((anchor) => ({
                  key: String(anchor.value),
                  label: `${anchor.value} — ${anchor.label}`,
                  value: anchor.description,
                }))}
            />
          </Card>
          <Card title={t('evaluation.assessment.priceTitle')}>
            <p>{t('evaluation.assessment.priceHidden')}</p>
            <PriceGateChip gate={assessment.priceGate} />
          </Card>
          <Card
            title={t('evaluation.assessment.peersTitle')}
            flush={assessment.peerScores.visibility === 'visible'}
          >
            {assessment.peerScores.visibility === 'visible' ? (
              <DataTable
                caption={t('evaluation.assessment.peersTitle')}
                columns={[
                  {
                    id: 'evaluator',
                    header: t('evaluation.common.evaluator'),
                    cell: (peer) => peer.evaluator.fullName,
                  },
                  {
                    id: 'cell',
                    header: t('evaluation.common.criterion'),
                    cell: (peer) => (
                      <>
                        <span>{criterionName(peer.criterionId)}</span>
                        <span className="tiq-cell-sub">{bidName(peer.bidId)}</span>
                      </>
                    ),
                  },
                  {
                    id: 'score',
                    header: t('evaluation.common.score'),
                    numeric: true,
                    cell: (peer) => (
                      <ScoreValue score={peer.score} isNotApplicable={peer.isNotApplicable} />
                    ),
                  },
                ]}
                rows={assessment.peerScores.items}
                rowKey={(peer) => `${peer.evaluator.userId}:${peer.bidId}:${peer.criterionId}`}
                empty={<EmptyState compact title={t('evaluation.assessment.noPeers')} />}
              />
            ) : (
              <p className="tiq-text-muted">
                {t(`evaluation.assessment.peers.${assessment.peerScores.visibility}`)}
              </p>
            )}
          </Card>
        </div>
      </div>

      <ConfirmActionDialog
        open={confirmSubmit}
        title={t('evaluation.assessment.submitTitle')}
        scope={scope}
        consequence={t('evaluation.assessment.submitConsequence')}
        confirmLabel={t('evaluation.assessment.submit')}
        acknowledgement={t('evaluation.assessment.submitAck')}
        pending={submit.pending}
        error={withEvaluationMessage(submit.error)}
        onCancel={() => setConfirmSubmit(false)}
        onConfirm={async () => {
          setSentKeys(dirtyKeys);
          try {
            const next = await submit.mutate({
              params: { assignmentId: assessment.assignmentId },
              body: { confirmIndependent: true, scores: dirtyInputs() },
            });
            setDrafts({});
            setConfirmSubmit(false);
            onUpdated(next);
            toast.show(t('evaluation.assessment.submittedToast'), 'success');
          } catch {
            // The dialog shows the error (ASSESSMENT_INCOMPLETE names the cells still not scored).
          }
        }}
      >
        <ReadinessChecklist label={t('evaluation.assessment.readiness')} items={readiness} />
      </ConfirmActionDialog>

      {raising !== null && (
        <CellClarificationDialog
          bidId={raising.bidId}
          question={raising.clarificationQuestion ?? ''}
          scope={`${criterionName(raising.criterionId)} · ${bidName(raising.bidId)} · ${assessment.tender.reference}`}
          timeZone={timeZone}
          onCancel={() => setRaising(null)}
          onRaised={(clarification) => {
            const key = cellKey(raising.bidId, raising.criterionId);
            setRaised((current) => ({ ...current, [key]: clarification }));
            setRaising(null);
            toast.show(t('evaluation.assessment.raise.done', { id: clarification.id }), 'success');
          }}
        />
      )}

      <ConfirmActionDialog
        open={correcting !== null}
        title={t('evaluation.assessment.correctTitle')}
        scope={
          correcting === null
            ? scope
            : `${criterionName(correcting.criterionId)} · ${bidName(correcting.bidId)}`
        }
        consequence={t('evaluation.assessment.correctConsequence')}
        confirmLabel={t('evaluation.assessment.correct')}
        reason={{ label: t('evaluation.assessment.correctReason'), required: true }}
        pending={correct.pending}
        error={withEvaluationMessage(correct.error)}
        onCancel={() => setCorrecting(null)}
        onConfirm={async ({ reason }) => {
          if (correcting === null || correcting.scoreId === null || correctRationale.trim() === '')
            return;
          try {
            const cell = await correct.mutate({
              params: { assignmentId: assessment.assignmentId, scoreId: correcting.scoreId },
              body: {
                newScore: correctRating === '' ? null : correctRating,
                newRationale: correctRationale.trim(),
                reason,
              },
            });
            onUpdated(withCell(assessment, cell));
            setCorrecting(null);
            toast.show(t('evaluation.assessment.correctedToast'), 'success');
          } catch {
            // The dialog shows the error.
          }
        }}
      >
        <Select
          label={correctionLabel(t('evaluation.assessment.newRating'))}
          placeholder={t('evaluation.score.notScored')}
          value={correctRating}
          options={ratingOptions(plan.scaleAnchors, correctRating === '' ? null : correctRating)}
          onChange={setCorrectRating}
        />
        <TextArea
          label={correctionLabel(t('evaluation.assessment.newRationale'))}
          required
          rows={3}
          value={correctRationale}
          onChange={setCorrectRationale}
          error={
            correctRationale.trim() === ''
              ? t('evaluation.assessment.rationaleRequired')
              : undefined
          }
        />
      </ConfirmActionDialog>
    </div>
  );
}
