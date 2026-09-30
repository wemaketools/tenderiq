/**
 * EVA-05 — Moderation: the submitted individual assessments side by side, the divergences between assessors, their
 * reasons and evidence, and the agreed result per cell with the declared method and reasons. The committee discusses
 * (session notes), records consensus or the declared aggregation, returns an assessment to its evaluator and
 * finalizes. Individual scores are never overwritten: an agreed score supersedes the previous agreed row and the
 * originals stay on record (AC-20). A missing individual score is shown as "Not scored" and an average is only formed
 * over a complete set (PRD §9.3, AC-18).
 */
import { useState } from 'react';

import { MODERATION_SESSIONS_METHOD } from '@contracts/enums';
import type { ModerationSessionsMethod } from '@contracts/enums';
import {
  finalizeModeration,
  getModeration,
  recordModeratedScore,
  returnAssessment,
  updateModerationNotes,
} from '@contracts/evaluation';
import type { ModerationAssessor, ModerationCell, ModerationView } from '@contracts/evaluation';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { usePermission } from '../../../auth/permissions';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  ErrorState,
  FilterBar,
  KpiCard,
  KpiGrid,
  MultiSelect,
  OrDash,
  Select,
  SkeletonBlock,
  StatusChip,
  TextArea,
  Timeline,
  UnsavedChangesGuard,
  useToast,
} from '../../../components/ui';
import { formatCount, formatDateTime, formatDecimalString } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ScoreValue } from '../components/chips';
import { EvaluationWorkspace } from '../components/EvaluationWorkspace';
import { PriceGateCard } from '../components/PriceGateCard';
import { Readiness } from '../components/Readiness';
import { evaluationErrorMessage, withEvaluationMessage } from '../lib/errors';
import { useIdParam, useLotId } from '../lib/hooks';
import { bidLabel } from '../lib/labels';
import {
  RATING_PLACES,
  cellKey,
  criteriaById,
  orderedCriteria,
  ratingOptions,
} from '../lib/scores';

export default function ModerationPage() {
  const tenderId = useIdParam('tenderId');
  const lotId = useLotId();
  const query = useApiQuery(
    getModeration,
    tenderId === null ? null : { params: { tenderId }, query: lotId === null ? {} : { lotId } },
  );
  if (tenderId === null) {
    return <EmptyState title={t('evaluation.overview.notFound')} />;
  }
  const view = query.data;
  return (
    <EvaluationWorkspace
      tenderId={tenderId}
      lotId={lotId}
      title={t('evaluation.moderation.title')}
      tender={view?.tender}
      lot={view?.lot}
    >
      {view === undefined ? (
        query.error !== null ? (
          query.error.kind === 'not_found' || query.error.code === 'MODERATION_NOT_FOUND' ? (
            <EmptyState
              title={t('evaluation.moderation.notFound')}
              description={t('evaluation.moderation.notFoundHint')}
              icon="search"
            />
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
        <ModerationWorkspace key={view.session.sessionId} view={view} lotId={lotId} />
      )}
    </EvaluationWorkspace>
  );
}

function ModerationWorkspace({
  view,
  lotId,
}: {
  readonly view: ModerationView;
  readonly lotId: number | null;
}) {
  const toast = useToast();
  const canModerate = usePermission('evaluation.moderate');
  const plan = view.plan;
  const timeZone = view.tender.officialTimeZone;
  const byId = criteriaById(plan);
  const criteria = orderedCriteria(plan, view.criterionIds);
  const scope = `${view.tender.reference} ${view.tender.title}`;

  const [recorded, setRecorded] = useState<Readonly<Record<string, ModerationCell>>>({});
  const [status, setStatus] = useState(view.session.status);
  const [savedNotes, setSavedNotes] = useState(view.session.notes ?? '');
  const [notes, setNotes] = useState(view.session.notes ?? '');
  const [notesMeta, setNotesMeta] = useState<string | null>(null);
  const [returned, setReturned] = useState<Readonly<Record<number, string>>>({});
  const [divergentOnly, setDivergentOnly] = useState(false);
  const [bidFilter, setBidFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [finalScore, setFinalScore] = useState('');
  const [method, setMethod] = useState<ModerationSessionsMethod>(view.session.method);
  const [returning, setReturning] = useState<ModerationAssessor | null>(null);
  const [returnCriteria, setReturnCriteria] = useState<string[]>([]);
  const [finalizeOpen, setFinalizeOpen] = useState(false);

  const record = useApiMutation(recordModeratedScore);
  const saveNotes = useApiMutation(updateModerationNotes);
  const returnMutation = useApiMutation(returnAssessment);
  const finalize = useApiMutation(finalizeModeration);

  const open = status === 'open';
  const canAct = canModerate && open;
  const cells = view.cells.map((cell) => recorded[cellKey(cell.bidId, cell.criterionId)] ?? cell);
  const visible = cells
    .filter((cell) => !divergentOnly || cell.divergent)
    .filter((cell) => bidFilter === '' || String(cell.bidId) === bidFilter)
    .sort((a, b) => {
      const order = (id: number): number => byId.get(id)?.sortOrder ?? 0;
      return a.bidId - b.bidId || order(a.criterionId) - order(b.criterionId);
    });
  const current = cells.find((cell) => cellKey(cell.bidId, cell.criterionId) === selected) ?? null;
  const bidName = (bidId: number): string => {
    const bid = view.bids.find((item) => item.bidId === bidId);
    return bid === undefined ? String(bidId) : bidLabel(bid);
  };
  const criterionName = (criterionId: number): string => {
    const criterion = byId.get(criterionId);
    return criterion === undefined ? String(criterionId) : `${criterion.code} ${criterion.name}`;
  };
  const divergent = cells.filter((cell) => cell.divergent).length;
  const agreed = cells.filter((cell) => cell.current !== null).length;
  const outstanding = cells.reduce((total, cell) => total + cell.outstanding, 0);
  const notesDirty = notes !== savedNotes;

  return (
    <>
      <UnsavedChangesGuard when={notesDirty} />
      {!open && (
        <Banner tone="success" title={t('evaluation.moderation.finalizedTitle')}>
          <p>
            {t('evaluation.moderation.finalized', {
              at: formatDateTime(view.session.finalizedAt, timeZone),
              method: tEnum('moderation_sessions.method', view.session.method),
            })}
          </p>
        </Banner>
      )}
      <KpiGrid>
        <KpiCard
          label={t('evaluation.moderation.kpi.agreed')}
          icon="checkCircle"
          tone="success"
          value={t('evaluation.common.ofTotal', { done: agreed, total: cells.length })}
          hint={t('evaluation.moderation.kpi.agreedHint')}
        />
        <KpiCard
          label={t('evaluation.moderation.kpi.divergent')}
          icon="alertTriangle"
          tone="warning"
          value={formatCount(divergent)}
          hint={t('evaluation.moderation.kpi.divergentHint', {
            threshold: formatDecimalString(view.divergenceThreshold, RATING_PLACES),
          })}
        />
        <KpiCard
          label={t('evaluation.moderation.kpi.outstanding')}
          icon="clock"
          tone="danger"
          value={formatCount(outstanding)}
          hint={t('evaluation.moderation.kpi.outstandingHint')}
        />
        <KpiCard
          label={t('evaluation.moderation.kpi.method')}
          icon="scale"
          tone="info"
          value={tEnum('moderation_sessions.method', view.session.method)}
          hint={t('evaluation.moderation.kpi.methodHint', {
            plan: tEnum('evaluation_plans.aggregation_method', plan.aggregationMethod),
          })}
        />
      </KpiGrid>

      <FilterBar label={t('evaluation.moderation.filters')}>
        <Select
          label={t('evaluation.common.bid')}
          placeholder={t('evaluation.moderation.allBids')}
          value={bidFilter}
          options={view.bids.map((bid) => ({ value: String(bid.bidId), label: bidLabel(bid) }))}
          onChange={setBidFilter}
        />
        <Checkbox
          label={t('evaluation.moderation.divergentOnly')}
          checked={divergentOnly}
          onChange={setDivergentOnly}
        />
      </FilterBar>
      <Card
        title={t('evaluation.moderation.gridTitle')}
        subtitle={t('evaluation.moderation.gridIntro')}
        flush
      >
        <DataTable<ModerationCell>
          caption={t('evaluation.moderation.gridTitle')}
          columns={[
            {
              id: 'cell',
              header: t('evaluation.common.criterion'),
              cell: (cell) => (
                <>
                  <span>{criterionName(cell.criterionId)}</span>
                  <span className="tiq-cell-sub">{bidName(cell.bidId)}</span>
                </>
              ),
            },
            {
              id: 'individual',
              header: t('evaluation.moderation.col.individual'),
              cell: (cell) => (
                <ul className="tiq-check-list">
                  {cell.individual.map((score) => (
                    <li key={score.assignmentId} className="tiq-inline">
                      <span>{score.evaluator.fullName}</span>
                      {score.submitted ? (
                        <ScoreValue
                          score={score.notScored ? null : score.score}
                          isNotApplicable={score.isNotApplicable}
                          places={RATING_PLACES}
                        />
                      ) : (
                        <Chip tone="neutral" size="sm">
                          {t('evaluation.moderation.notSubmitted')}
                        </Chip>
                      )}
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              id: 'spread',
              header: t('evaluation.moderation.col.spread'),
              numeric: true,
              cell: (cell) => (
                <span className="tiq-stack">
                  {cell.spread === null ? (
                    <OrDash>{null}</OrDash>
                  ) : (
                    formatDecimalString(cell.spread, RATING_PLACES)
                  )}
                  {cell.divergent && (
                    <Chip tone="warning" size="sm">
                      {t('evaluation.moderation.divergent')}
                    </Chip>
                  )}
                </span>
              ),
            },
            {
              id: 'average',
              header: t('evaluation.moderation.col.average'),
              numeric: true,
              cell: (cell) =>
                cell.average === null ? (
                  <span className="tiq-text-warning">
                    {cell.outstanding > 0
                      ? t('evaluation.moderation.incompleteSet', { count: cell.outstanding })
                      : t('evaluation.moderation.noAverage')}
                  </span>
                ) : (
                  formatDecimalString(cell.average, plan.decimalPlacesDisplay)
                ),
            },
            {
              id: 'agreed',
              header: t('evaluation.moderation.col.agreed'),
              cell: (cell) =>
                cell.current === null ? (
                  <Chip tone="warning" size="sm" outlined>
                    {t('evaluation.moderation.notAgreed')}
                  </Chip>
                ) : (
                  <>
                    <span className="tiq-num">
                      {t('evaluation.moderation.agreedValue', {
                        score: formatDecimalString(cell.current.finalScore, RATING_PLACES),
                        points: formatDecimalString(
                          cell.current.weightedPoints,
                          plan.decimalPlacesDisplay,
                        ),
                      })}
                    </span>
                    <span className="tiq-cell-sub">
                      {tEnum('moderation_sessions.method', cell.current.method)}
                      {cell.history.length > 0 &&
                        ` · ${t('evaluation.moderation.superseded', { count: cell.history.length })}`}
                    </span>
                  </>
                ),
            },
          ]}
          rows={visible}
          rowKey={(cell) => cellKey(cell.bidId, cell.criterionId)}
          rowLabel={(cell) => `${criterionName(cell.criterionId)} ${bidName(cell.bidId)}`}
          onRowClick={(cell) => setSelected(cellKey(cell.bidId, cell.criterionId))}
          empty={
            <EmptyState
              compact
              title={
                divergentOnly || bidFilter !== ''
                  ? t('evaluation.moderation.emptyFiltered')
                  : t('evaluation.moderation.empty')
              }
            />
          }
        />
      </Card>

      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          {current !== null && (
            <Card
              title={t('evaluation.moderation.cellTitle', {
                criterion: criterionName(current.criterionId),
                bid: bidName(current.bidId),
              })}
              actions={
                canAct ? (
                  <Button
                    variant="primary"
                    icon="check"
                    onClick={() => {
                      record.reset();
                      setFinalScore(current.current?.finalScore ?? current.average ?? '');
                      setMethod(view.session.method);
                      setRecordOpen(true);
                    }}
                  >
                    {t('evaluation.moderation.record')}
                  </Button>
                ) : undefined
              }
            >
              <div className="tiq-stack">
                <h3 className="tiq-form-section-title">
                  {t('evaluation.moderation.individualTitle')}
                </h3>
                <DataTable
                  caption={t('evaluation.moderation.individualTitle')}
                  columns={[
                    {
                      id: 'evaluator',
                      header: t('evaluation.common.evaluator'),
                      cell: (score) => (
                        <>
                          <span>{score.evaluator.fullName}</span>
                          <span className="tiq-cell-sub">
                            {score.submitted
                              ? tEnum('evaluation_scores.status', score.status)
                              : t('evaluation.moderation.notSubmitted')}
                            {score.correctedAfterSubmission &&
                              ` · ${t('evaluation.moderation.corrected')}`}
                          </span>
                        </>
                      ),
                    },
                    {
                      id: 'score',
                      header: t('evaluation.common.score'),
                      numeric: true,
                      cell: (score) =>
                        score.submitted ? (
                          <ScoreValue
                            score={score.notScored ? null : score.score}
                            isNotApplicable={score.isNotApplicable}
                            places={RATING_PLACES}
                          />
                        ) : (
                          <span className="tiq-text-muted">
                            {t('evaluation.moderation.notSubmitted')}
                          </span>
                        ),
                    },
                    {
                      id: 'rationale',
                      header: t('evaluation.assessment.rationale'),
                      cell: (score) => (
                        <>
                          <span>
                            {score.submitted
                              ? (score.rationale ?? <OrDash>{null}</OrDash>)
                              : t('evaluation.moderation.withheldUntilSubmitted')}
                          </span>
                          {score.evidenceRefs.length > 0 && (
                            <span className="tiq-cell-sub">{score.evidenceRefs.join('; ')}</span>
                          )}
                          {score.clarificationNeeded && (
                            <span className="tiq-cell-sub tiq-text-warning">
                              {t('evaluation.moderation.clarificationFlag')}
                            </span>
                          )}
                        </>
                      ),
                    },
                  ]}
                  rows={current.individual}
                  rowKey={(score) => String(score.assignmentId)}
                  empty={<EmptyState compact title={t('evaluation.moderation.noIndividual')} />}
                />
                <h3 className="tiq-form-section-title">{t('evaluation.moderation.agreedTitle')}</h3>
                {current.current === null ? (
                  <p className="tiq-text-muted">{t('evaluation.moderation.notAgreedYet')}</p>
                ) : (
                  <DetailList
                    items={[
                      {
                        key: 'score',
                        label: t('evaluation.moderation.col.agreed'),
                        value: t('evaluation.moderation.agreedValue', {
                          score: formatDecimalString(current.current.finalScore, RATING_PLACES),
                          points: formatDecimalString(
                            current.current.weightedPoints,
                            plan.decimalPlacesDisplay,
                          ),
                        }),
                      },
                      {
                        key: 'method',
                        label: t('evaluation.moderation.method'),
                        value: tEnum('moderation_sessions.method', current.current.method),
                      },
                      {
                        key: 'reasons',
                        label: t('evaluation.moderation.reasons'),
                        value: current.current.reasons,
                      },
                      {
                        key: 'by',
                        label: t('evaluation.moderation.recordedBy'),
                        value: `${current.current.moderatedBy.fullName} · ${formatDateTime(current.current.recordedAt, timeZone)}`,
                      },
                      {
                        key: 'differs',
                        label: t('evaluation.moderation.differs'),
                        value: current.current.differsFromIndividual
                          ? t('evaluation.common.yes')
                          : t('evaluation.common.no'),
                      },
                    ]}
                  />
                )}
                {current.history.length > 0 && (
                  <>
                    <h3 className="tiq-form-section-title">
                      {t('evaluation.moderation.historyTitle')}
                    </h3>
                    <Timeline
                      label={t('evaluation.moderation.historyTitle')}
                      items={current.history.map((item) => ({
                        id: item.moderatedScoreId,
                        title: t('evaluation.moderation.historyItem', {
                          score: formatDecimalString(item.finalScore, RATING_PLACES),
                          method: tEnum('moderation_sessions.method', item.method),
                        }),
                        meta: `${item.moderatedBy.fullName} · ${formatDateTime(item.recordedAt, timeZone)}`,
                        detail: item.reasons,
                        tone: 'neutral' as const,
                      }))}
                    />
                  </>
                )}
              </div>
            </Card>
          )}

          <Card title={t('evaluation.moderation.assessorsTitle')} flush>
            <DataTable<ModerationAssessor>
              caption={t('evaluation.moderation.assessorsTitle')}
              columns={[
                {
                  id: 'evaluator',
                  header: t('evaluation.common.evaluator'),
                  cell: (row) => row.evaluator.fullName,
                },
                {
                  id: 'status',
                  header: t('evaluation.common.status'),
                  cell: (row) => (
                    <StatusChip
                      enum="evaluation_assignments.status"
                      value={returned[row.assignmentId] ?? row.status}
                      size="sm"
                    />
                  ),
                },
                {
                  id: 'submitted',
                  header: t('evaluation.assignment.submittedAt'),
                  cell: (row) =>
                    row.submittedAt === null ? (
                      <OrDash>{null}</OrDash>
                    ) : (
                      formatDateTime(row.submittedAt, timeZone)
                    ),
                },
                {
                  id: 'scored',
                  header: t('evaluation.assignments.col.completion'),
                  cell: (row) => (
                    <>
                      <span>
                        {t('evaluation.common.ofTotal', { done: row.scored, total: row.total })}
                      </span>
                      {row.scored < row.total && (
                        <span className="tiq-cell-sub tiq-text-warning">
                          {t('evaluation.assignments.notScored', { count: row.total - row.scored })}
                        </span>
                      )}
                    </>
                  ),
                },
                {
                  id: 'actions',
                  header: (
                    <span className="tiq-visually-hidden">{t('evaluation.common.actions')}</span>
                  ),
                  cell: (row) =>
                    canAct &&
                    row.status === 'submitted' &&
                    returned[row.assignmentId] === undefined ? (
                      <Button
                        size="sm"
                        icon="arrowLeft"
                        onClick={() => {
                          returnMutation.reset();
                          setReturnCriteria([]);
                          setReturning(row);
                        }}
                      >
                        {t('evaluation.moderation.return')}
                      </Button>
                    ) : null,
                },
              ]}
              rows={view.assessors}
              rowKey={(row) => String(row.assignmentId)}
              empty={<EmptyState compact title={t('evaluation.overview.noCommittee')} />}
            />
          </Card>
        </div>

        <div className="tiq-stack">
          <Card
            title={t('evaluation.moderation.sessionTitle')}
            actions={<StatusChip enum="moderation_sessions.status" value={status} />}
            footer={
              canAct ? (
                <div className="tiq-row-actions">
                  <Button
                    variant="primary"
                    icon="checkCircle"
                    onClick={() => {
                      finalize.reset();
                      setFinalizeOpen(true);
                    }}
                  >
                    {t('evaluation.moderation.finalize')}
                  </Button>
                </div>
              ) : undefined
            }
          >
            <DetailList
              stacked
              items={[
                {
                  key: 'chair',
                  label: t('evaluation.assignment.chair'),
                  value: view.session.chair.fullName,
                },
                {
                  key: 'method',
                  label: t('evaluation.moderation.method'),
                  value: tEnum('moderation_sessions.method', view.session.method),
                },
                {
                  key: 'threshold',
                  label: t('evaluation.moderation.threshold'),
                  value: formatDecimalString(view.divergenceThreshold, RATING_PLACES),
                },
                {
                  key: 'created',
                  label: t('evaluation.moderation.opened'),
                  value: formatDateTime(view.session.createdAt, timeZone),
                },
                {
                  key: 'finalized',
                  label: t('evaluation.moderation.finalizedAt'),
                  value:
                    view.session.finalizedAt === null
                      ? null
                      : formatDateTime(view.session.finalizedAt, timeZone),
                },
              ]}
            />
          </Card>
          <Card title={t('evaluation.moderation.readinessTitle')}>
            <Readiness items={view.readiness} label={t('evaluation.moderation.readinessTitle')} />
          </Card>
          <Card
            title={t('evaluation.moderation.notesTitle')}
            subtitle={notesMeta ?? undefined}
            footer={
              canAct ? (
                <div className="tiq-row-actions">
                  <Button
                    icon="check"
                    disabled={!notesDirty || notes.trim() === ''}
                    loading={saveNotes.pending}
                    onClick={() => {
                      void (async () => {
                        try {
                          const result = await saveNotes.mutate({
                            params: { sessionId: view.session.sessionId },
                            body: { notes },
                          });
                          setSavedNotes(result.notes);
                          setNotes(result.notes);
                          setNotesMeta(
                            t('evaluation.moderation.notesSaved', {
                              name: result.updatedBy.fullName,
                              at: formatDateTime(result.updatedAt, timeZone),
                            }),
                          );
                          toast.show(t('evaluation.moderation.notesSavedToast'), 'success');
                        } catch {
                          // The card shows the error.
                        }
                      })();
                    }}
                  >
                    {t('evaluation.moderation.saveNotes')}
                  </Button>
                </div>
              ) : undefined
            }
          >
            {canAct ? (
              <TextArea
                label={t('evaluation.moderation.notesLabel')}
                rows={6}
                value={notes}
                onChange={setNotes}
                error={
                  saveNotes.error === null ? undefined : evaluationErrorMessage(saveNotes.error)
                }
              />
            ) : (
              <p>{savedNotes === '' ? t('evaluation.moderation.noNotes') : savedNotes}</p>
            )}
          </Card>
          <PriceGateCard
            tenderId={view.tender.tenderId}
            lotId={lotId}
            gate={view.priceGate}
            timeZone={timeZone}
            scope={scope}
          />
        </div>
      </div>

      <ConfirmActionDialog
        open={recordOpen && current !== null}
        title={t('evaluation.moderation.recordTitle')}
        scope={
          current === null
            ? scope
            : `${criterionName(current.criterionId)} · ${bidName(current.bidId)}`
        }
        consequence={
          current?.current === null || current === null
            ? t('evaluation.moderation.recordConsequence')
            : t('evaluation.moderation.recordSupersedes', {
                score: formatDecimalString(current.current.finalScore, RATING_PLACES),
              })
        }
        confirmLabel={t('evaluation.moderation.record')}
        reason={{ label: t('evaluation.moderation.reasons'), required: true }}
        pending={record.pending}
        error={withEvaluationMessage(record.error, { reasons: 'reason' })}
        onCancel={() => setRecordOpen(false)}
        onConfirm={async ({ reason }) => {
          if (current === null || finalScore === '') return;
          try {
            const result = await record.mutate({
              params: { sessionId: view.session.sessionId },
              body: {
                bidId: current.bidId,
                criterionId: current.criterionId,
                finalScore,
                method,
                reasons: reason,
              },
            });
            setRecorded({
              ...recorded,
              [cellKey(current.bidId, current.criterionId)]: {
                ...current,
                current: result.current,
                history:
                  result.superseded === null
                    ? current.history
                    : [result.superseded, ...current.history],
              },
            });
            setRecordOpen(false);
            toast.show(t('evaluation.moderation.recordedToast'), 'success');
          } catch {
            // The dialog shows the error (METHOD_NOT_PERMITTED, SCORE_OUT_OF_SCALE…).
          }
        }}
      >
        <Select
          label={t('evaluation.moderation.finalScore', { max: plan.scaleMax })}
          required
          placeholder={t('evaluation.common.select')}
          value={finalScore}
          options={ratingOptions(plan.scaleAnchors, finalScore === '' ? null : finalScore)}
          onChange={setFinalScore}
          error={finalScore === '' ? t('evaluation.moderation.finalScoreRequired') : undefined}
        />
        <Select
          label={t('evaluation.moderation.method')}
          required
          value={method}
          options={MODERATION_SESSIONS_METHOD.map((value) => ({
            value,
            label: tEnum('moderation_sessions.method', value),
          }))}
          onChange={(value) => setMethod(value as ModerationSessionsMethod)}
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={returning !== null}
        title={t('evaluation.moderation.returnTitle')}
        scope={returning === null ? scope : `${scope} · ${returning.evaluator.fullName}`}
        consequence={t('evaluation.moderation.returnConsequence')}
        confirmLabel={t('evaluation.moderation.return')}
        reason={{ label: t('evaluation.common.reason'), required: true }}
        pending={returnMutation.pending}
        error={withEvaluationMessage(returnMutation.error)}
        onCancel={() => setReturning(null)}
        onConfirm={async ({ reason }) => {
          if (returning === null) return;
          try {
            const result = await returnMutation.mutate({
              params: { assignmentId: returning.assignmentId },
              body: { reason, criterionIds: returnCriteria.map(Number), bidIds: [] },
            });
            setReturned({ ...returned, [result.assignmentId]: result.status });
            setReturning(null);
            toast.show(
              t('evaluation.moderation.returnedToast', { name: returning.evaluator.fullName }),
              'success',
            );
          } catch {
            // The dialog shows the error.
          }
        }}
      >
        <MultiSelect
          label={t('evaluation.moderation.returnCriteria')}
          hint={t('evaluation.moderation.returnCriteriaHint')}
          value={returnCriteria}
          options={criteria.map((criterion) => ({
            value: String(criterion.criterionId),
            label: `${criterion.code} ${criterion.name}`,
          }))}
          onChange={setReturnCriteria}
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={finalizeOpen}
        title={t('evaluation.moderation.finalizeTitle')}
        scope={scope}
        consequence={t('evaluation.moderation.finalizeConsequence')}
        confirmLabel={t('evaluation.moderation.finalize')}
        acknowledgement={t('evaluation.moderation.finalizeAck')}
        pending={finalize.pending}
        error={withEvaluationMessage(finalize.error)}
        onCancel={() => setFinalizeOpen(false)}
        onConfirm={async () => {
          try {
            const result = await finalize.mutate({
              params: { sessionId: view.session.sessionId },
              body: { confirm: true },
            });
            setStatus(result.status);
            setFinalizeOpen(false);
            toast.show(
              t('evaluation.moderation.finalizedToast', { count: result.cellsModerated }),
              'success',
            );
          } catch {
            // The dialog shows the error (ASSESSMENTS_INCOMPLETE, MODERATED_SCORE_MISSING…).
          }
        }}
      >
        <Readiness items={view.readiness} label={t('evaluation.moderation.readinessTitle')} />
      </ConfirmActionDialog>
    </>
  );
}
