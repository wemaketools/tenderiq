/**
 * EVA-06 — Ranking and evaluation report: per bid the eligibility, criterion points (moderated ratings or the price
 * formula), non-price, price and total scores at calculation precision with the displayed rounding, gate failures,
 * tie treatment, lot constraints, explanations and — separately from rank — affordability (PRD §9.1, §9.3, AC-19).
 * The chair validates the outcomes and submits the report for committee sign-off; members sign or decline; the
 * signed-off record is exported and handed to the award recommendation. Readiness separates blocking errors from
 * warnings, so an incomplete assessment blocks sign-off (AC-18).
 */
import { useState } from 'react';

import { EXPORTS_FORMAT } from '@contracts/enums';
import type { ExportsFormat } from '@contracts/enums';
import {
  exportReport,
  getResults,
  handoffReport,
  signoffReport,
  submitReport,
  validateResults,
} from '@contracts/evaluation';
import type {
  EvaluationReport,
  HandoffResult,
  RankingView,
  ReportExport,
  ResultRow,
} from '@contracts/evaluation';

import { isApiError } from '../../../api/client';
import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useAppSelector } from '../../../app/hooks';
import { usePermission } from '../../../auth/permissions';
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
  Menu,
  MoneyText,
  OrDash,
  RadioGroup,
  RestrictedState,
  SkeletonBlock,
  StatusChip,
  isReady,
  useToast,
} from '../../../components/ui';
import type { DataTableColumn } from '../../../components/ui';
import { EMPTY_VALUE, formatCount, formatDateTime, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ResultStateChip } from '../components/chips';
import { EvaluationWorkspace } from '../components/EvaluationWorkspace';
import { Readiness } from '../components/Readiness';
import { evaluationErrorMessage, withEvaluationMessage } from '../lib/errors';
import { useIdParam, useLotId } from '../lib/hooks';
import { bidLabel, gateFailureLabel } from '../lib/labels';
import { REPORT_EXPORT_PERMISSIONS } from '../lib/permissions';

type ReportDialog = 'validate' | 'submit' | 'signoff' | 'handoff' | null;

export default function ResultsPage() {
  const tenderId = useIdParam('tenderId');
  const lotId = useLotId();
  const query = useApiQuery(
    getResults,
    tenderId === null ? null : { params: { tenderId }, query: lotId === null ? {} : { lotId } },
  );
  const [latest, setLatest] = useState<RankingView | null>(null);
  if (tenderId === null) {
    return <EmptyState title={t('evaluation.overview.notFound')} />;
  }
  const view =
    latest !== null && latest.tender.tenderId === tenderId && (latest.lot?.lotId ?? null) === lotId
      ? latest
      : query.data;
  return (
    <EvaluationWorkspace
      tenderId={tenderId}
      lotId={lotId}
      title={t('evaluation.results.title')}
      tender={view?.tender}
      lot={view?.lot}
    >
      {view === undefined ? (
        query.error !== null ? (
          query.error.code === 'OWN_ASSESSMENT_NOT_SUBMITTED' ? (
            <RestrictedState
              title={t('evaluation.results.ownFirst')}
              description={evaluationErrorMessage(query.error)}
            />
          ) : query.error.kind === 'not_found' ? (
            <EmptyState title={t('evaluation.results.notFound')} icon="search" />
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
        <ResultsView view={view} lotId={lotId} onUpdated={setLatest} />
      )}
    </EvaluationWorkspace>
  );
}

function ReportCard({
  report,
  timeZone,
  title,
}: {
  readonly report: EvaluationReport;
  readonly timeZone: string;
  readonly title: string;
}) {
  return (
    <Card
      title={title}
      subtitle={t('evaluation.results.reportVersion', { version: report.version })}
      actions={<StatusChip enum="evaluation_reports.status" value={report.status} />}
      flush
    >
      <div className="tiq-stack">
        <DetailList
          items={[
            { key: 'summary', label: t('evaluation.results.summary'), value: report.summary },
            {
              key: 'created',
              label: t('evaluation.results.created'),
              value: `${report.createdBy.fullName} · ${formatDateTime(report.createdAt, timeZone)}`,
            },
            {
              key: 'submitted',
              label: t('evaluation.results.submittedForSignoff'),
              value:
                report.submittedForSignoffAt === null
                  ? null
                  : formatDateTime(report.submittedForSignoffAt, timeZone),
            },
            {
              key: 'signed',
              label: t('evaluation.results.signedOff'),
              value:
                report.signedOffAt === null ? null : formatDateTime(report.signedOffAt, timeZone),
            },
            {
              key: 'handed',
              label: t('evaluation.results.handedOff'),
              value:
                report.handedOffAt === null ? null : formatDateTime(report.handedOffAt, timeZone),
            },
          ]}
        />
        <DataTable
          caption={t('evaluation.results.signoffsCaption', { version: report.version })}
          columns={[
            {
              id: 'signer',
              header: t('evaluation.results.signer'),
              cell: (line) => (
                <>
                  <span>{line.signer.fullName}</span>
                  <span className="tiq-cell-sub">{line.signer.capacity}</span>
                </>
              ),
            },
            {
              id: 'decision',
              header: t('evaluation.results.decision'),
              cell: (line) =>
                line.decision === null ? (
                  <Chip tone="neutral" size="sm">
                    {t('evaluation.results.awaiting')}
                  </Chip>
                ) : (
                  <StatusChip
                    enum="evaluation_report_signoffs.decision"
                    value={line.decision}
                    size="sm"
                  />
                ),
            },
            {
              id: 'note',
              header: t('evaluation.commercial.note'),
              cell: (line) => line.note ?? <OrDash>{null}</OrDash>,
            },
            {
              id: 'at',
              header: t('evaluation.results.decidedAt'),
              cell: (line) =>
                line.decidedAt === null ? (
                  <OrDash>{null}</OrDash>
                ) : (
                  formatDateTime(line.decidedAt, timeZone)
                ),
            },
          ]}
          rows={report.signoffs}
          rowKey={(line) => String(line.signer.userId)}
          empty={<EmptyState compact title={t('evaluation.results.noSigners')} />}
        />
      </div>
    </Card>
  );
}

function ResultsView({
  view,
  lotId,
  onUpdated,
}: {
  readonly view: RankingView;
  readonly lotId: number | null;
  readonly onUpdated: (view: RankingView) => void;
}) {
  const toast = useToast();
  const userId = useAppSelector((state) => state.session.user?.id ?? null);
  const isChair = usePermission('evaluation.chair');
  const canSign = usePermission('evaluation.signoff');
  const canExport = usePermission(REPORT_EXPORT_PERMISSIONS);
  const plan = view.plan;
  const timeZone = view.tender.officialTimeZone;
  const scope = `${view.tender.reference} ${view.tender.title}`;
  const [reportOverride, setReportOverride] = useState<EvaluationReport | null>(null);
  const report = reportOverride ?? view.report;
  const [dialog, setDialog] = useState<ReportDialog>(null);
  const [decision, setDecision] = useState<'signed' | 'declined'>('signed');
  const [exported, setExported] = useState<ReportExport | null>(null);
  const [handedOff, setHandedOff] = useState<HandoffResult | null>(null);

  const validate = useApiMutation(validateResults);
  const submit = useApiMutation(submitReport);
  const signoff = useApiMutation(signoffReport);
  const exporter = useApiMutation(exportReport);
  const handoff = useApiMutation(handoffReport);

  const detailed = view.detail === 'full';
  const ranked = [...view.results].sort(
    (a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER),
  );
  const top = ranked.find((row) => row.rank === 1) ?? null;
  const blocking = view.readiness.filter((item) => item.status === 'blocking').length;
  const ready = isReady(view.readiness);
  const criteria = [...plan.criteria].sort((a, b) => a.sortOrder - b.sortOrder);
  const myLine = report?.signoffs.find((line) => line.signer.userId === userId) ?? null;
  const canDecide =
    canSign && report?.status === 'in_signoff' && myLine !== null && myLine.decision === null;
  const open = (next: ReportDialog): void => {
    validate.reset();
    submit.reset();
    signoff.reset();
    handoff.reset();
    setDialog(next);
  };
  const close = (): void => setDialog(null);

  const runExport = async (format: ExportsFormat): Promise<void> => {
    if (report === null) return;
    try {
      const result = await exporter.mutate({
        params: { reportId: report.reportId },
        body: { format },
      });
      setExported(result);
      toast.show(t('evaluation.results.exportQueued', { format: format.toUpperCase() }), 'success');
    } catch (error) {
      toast.show(
        isApiError(error) ? evaluationErrorMessage(error) : t('evaluation.results.exportFailed'),
        'error',
      );
    }
  };

  const columns: DataTableColumn<ResultRow>[] = [
    {
      id: 'rank',
      header: t('evaluation.results.col.rank'),
      numeric: true,
      cell: (row) =>
        row.rank === null ? (
          <Chip tone="danger" size="sm">
            {t('evaluation.results.notRanked')}
          </Chip>
        ) : (
          <strong>{row.rank}</strong>
        ),
    },
    {
      id: 'bid',
      header: t('evaluation.common.bid'),
      cell: (row) => (
        <>
          <span>{bidLabel(row.bid)}</span>
          <span className="tiq-cell-sub tiq-mono">{row.bid.receiptNo}</span>
        </>
      ),
    },
    ...(detailed ? criteria : []).map((criterion): DataTableColumn<ResultRow> => ({
      id: `c${criterion.criterionId}`,
      header: `${criterion.code} ${criterion.name}`,
      accessibleHeader: t('evaluation.results.criterionHeader', {
        name: criterion.name,
        max: criterion.maxPoints,
      }),
      numeric: true,
      cell: (row) => {
        const points = row.criterionPoints.find(
          (item) => item.criterionId === criterion.criterionId,
        );
        if (points === undefined || points.pointsDisplay === null) {
          return <span className="tiq-text-muted">{t('evaluation.results.notAvailable')}</span>;
        }
        return (
          <span title={points.points ?? undefined}>
            {points.pointsDisplay}
            {points.rating !== null && (
              <span className="tiq-cell-sub">
                {t('evaluation.results.rating', { rating: points.rating })}
              </span>
            )}
          </span>
        );
      },
    })),
    {
      id: 'total',
      header: t('evaluation.results.col.total'),
      numeric: true,
      cell: (row) =>
        row.totalScoreDisplay === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          <>
            <strong>{row.totalScoreDisplay}</strong>
            <span className="tiq-cell-sub">
              {t('evaluation.results.decisionValue', { value: row.totalScore ?? '' })}
            </span>
          </>
        ),
    },
    {
      id: 'gates',
      header: t('evaluation.results.col.gates'),
      cell: (row) =>
        row.passesGates ? (
          <Chip tone="success" size="sm" icon="checkCircle">
            {t('evaluation.results.gatesPassed')}
          </Chip>
        ) : (
          <span className="tiq-stack">
            <Chip tone="danger" size="sm" icon="xCircle">
              {t('evaluation.results.gatesFailed')}
            </Chip>
            {row.gateFailures.map((failure) => (
              <span key={failure} className="tiq-cell-sub">
                {gateFailureLabel(failure, plan)}
              </span>
            ))}
          </span>
        ),
    },
    {
      id: 'tie',
      header: t('evaluation.results.col.tie'),
      cell: (row) =>
        row.tieBreakApplied === null ? (
          <OrDash>{null}</OrDash>
        ) : (
          tEnum('tie_break_rules.rule', row.tieBreakApplied)
        ),
    },
    {
      id: 'cost',
      header: t('evaluation.commercial.col.evaluated'),
      numeric: true,
      cell: (row) => <MoneyText value={row.evaluatedCost} places={2} />,
    },
    {
      id: 'affordability',
      header: t('evaluation.commercial.col.affordability'),
      cell: (row) => (
        <StatusChip
          enum="commercial_evaluations.affordability"
          value={row.affordability}
          size="sm"
        />
      ),
    },
  ];

  return (
    <>
      {handedOff !== null && (
        <Banner tone="success" title={t('evaluation.results.handedOffTitle')}>
          <p>{handedOff.basis}</p>
        </Banner>
      )}
      {exported !== null && (
        <Banner tone="info" title={t('evaluation.results.exportTitle')}>
          <p>
            {t('evaluation.results.exportStatus', {
              id: exported.exportId,
              format: exported.format.toUpperCase(),
              status: tEnum('exports.status', exported.status),
            })}
          </p>
        </Banner>
      )}
      {/* DD-49: a reduced detail level (totals only, reports only) simply shows less, without a role notice. */}
      {view.detail !== 'reports_only' && (
        <>
          <KpiGrid>
            <KpiCard
              label={t('evaluation.results.kpi.top')}
              icon="trophy"
              tone="success"
              value={
                top === null ? EMPTY_VALUE : `${top.bid.label} · ${top.totalScoreDisplay ?? ''}`
              }
              hint={top === null ? t('evaluation.results.kpi.noTop') : bidLabel(top.bid)}
            />
            <KpiCard
              label={t('evaluation.results.kpi.ranked')}
              icon="listChecks"
              value={t('evaluation.common.ofTotal', {
                done: view.results.filter((row) => row.rank !== null).length,
                total: view.results.length,
              })}
              hint={t('evaluation.results.kpi.rankedHint')}
            />
            <KpiCard
              label={t('evaluation.results.kpi.budget')}
              icon="wallet"
              tone="info"
              value={formatMoney(view.budget)}
              hint={t('evaluation.results.kpi.budgetHint')}
            />
            {detailed && (
              <KpiCard
                label={t('evaluation.results.kpi.blocking')}
                icon="alertOctagon"
                tone={blocking > 0 ? 'danger' : 'success'}
                value={formatCount(blocking)}
                hint={t('evaluation.results.kpi.blockingHint')}
              />
            )}
          </KpiGrid>

          <Card
            title={t('evaluation.results.rankingTitle')}
            subtitle={t('evaluation.results.rankingIntro', {
              calc: plan.decimalPlacesCalc,
              display: plan.decimalPlacesDisplay,
            })}
            actions={
              <span className="tiq-inline">
                <ResultStateChip state={view.status} />
                {view.computedAt !== null && (
                  <span className="tiq-text-muted">
                    {t('evaluation.results.computedAt', {
                      at: formatDateTime(view.computedAt, timeZone),
                    })}
                  </span>
                )}
                {isChair && (
                  <Button icon="refresh" onClick={() => open('validate')}>
                    {t('evaluation.results.validate')}
                  </Button>
                )}
              </span>
            }
            flush
          >
            <DataTable<ResultRow>
              caption={t('evaluation.results.rankingTitle')}
              columns={columns}
              rows={ranked}
              rowKey={(row) => String(row.resultId)}
              empty={
                <EmptyState
                  compact
                  title={t('evaluation.results.empty')}
                  description={t('evaluation.results.emptyHint')}
                />
              }
            />
          </Card>
        </>
      )}

      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          {report === null ? (
            (detailed || view.reportHistory.length === 0) && (
              <Card title={t('evaluation.results.reportTitle')}>
                <EmptyState
                  compact
                  title={t('evaluation.results.noReport')}
                  description={
                    detailed
                      ? t('evaluation.results.noReportHint')
                      : t('evaluation.results.noReportObserver')
                  }
                />
              </Card>
            )
          ) : (
            <ReportCard
              report={report}
              timeZone={timeZone}
              title={t('evaluation.results.reportTitle')}
            />
          )}
          {view.reportHistory.map((previous) => (
            <ReportCard
              key={previous.reportId}
              report={previous}
              timeZone={timeZone}
              title={t('evaluation.results.previousReport')}
            />
          ))}
        </div>
        <div className="tiq-stack">
          {(detailed || report !== null) && (
            <Card
              title={t('evaluation.results.actionsTitle')}
              subtitle={t(`evaluation.results.next.${report?.status ?? 'none'}`)}
            >
              <div className="tiq-stack">
                {isChair && report !== null && report.status === 'draft' && (
                  <Button variant="primary" icon="send" onClick={() => open('submit')}>
                    {t('evaluation.results.submit')}
                  </Button>
                )}
                {canDecide && (
                  <Button variant="primary" icon="fileSignature" onClick={() => open('signoff')}>
                    {t('evaluation.results.signoff')}
                  </Button>
                )}
                {isChair &&
                  report !== null &&
                  report.status === 'signed_off' &&
                  report.handedOffAt === null &&
                  handedOff === null && (
                    <Button variant="primary" icon="arrowRight" onClick={() => open('handoff')}>
                      {t('evaluation.results.handoff')}
                    </Button>
                  )}
                {canExport && report !== null && (
                  <Menu
                    label={t('evaluation.results.export')}
                    entries={EXPORTS_FORMAT.map((format) => ({
                      id: format,
                      label: t('evaluation.results.exportAs', { format: format.toUpperCase() }),
                      icon: 'download' as const,
                      onSelect: () => void runExport(format),
                    }))}
                    trigger={(props) => (
                      <Button
                        icon="download"
                        iconAfter="chevronDown"
                        loading={exporter.pending}
                        {...props}
                      >
                        {t('evaluation.results.export')}
                      </Button>
                    )}
                  />
                )}
                {report !== null &&
                  report.status === 'in_signoff' &&
                  myLine !== null &&
                  myLine.decision !== null && (
                    <p className="tiq-text-muted">
                      {t('evaluation.results.alreadyDecided', {
                        decision: tEnum('evaluation_report_signoffs.decision', myLine.decision),
                      })}
                    </p>
                  )}
              </div>
            </Card>
          )}
          {ranked.length > 0 && (
            <Card title={t('evaluation.results.explanationsTitle')}>
              <DetailList
                stacked
                items={ranked.map((row) => ({
                  key: String(row.resultId),
                  label: bidLabel(row.bid),
                  value: row.explanation,
                }))}
              />
            </Card>
          )}
          {detailed && (
            <Card title={t('evaluation.results.readinessTitle')}>
              <Readiness items={view.readiness} label={t('evaluation.results.readinessTitle')} />
            </Card>
          )}
          <Card title={t('evaluation.results.constraintsTitle')}>
            <DetailList
              stacked
              items={[
                {
                  key: 'lot',
                  label: t('evaluation.results.lotConstraints'),
                  value: view.lotConstraints.note,
                },
                {
                  key: 'ties',
                  label: t('evaluation.overview.ties'),
                  value:
                    plan.tieBreakRules.length === 0
                      ? null
                      : [...plan.tieBreakRules]
                          .sort((a, b) => a.sequence - b.sequence)
                          .map((rule) => tEnum('tie_break_rules.rule', rule.rule))
                          .join(' → '),
                },
                {
                  key: 'threshold',
                  label: t('evaluation.overview.threshold'),
                  value:
                    plan.nonPriceThreshold === null
                      ? null
                      : `${plan.nonPriceThreshold} · ${tEnum('evaluation_plans.threshold_scope', plan.thresholdScope)}`,
                },
                {
                  key: 'formula',
                  label: t('evaluation.overview.priceFormula'),
                  value: plan.priceFormulaNote,
                },
                {
                  key: 'budget',
                  label: t('evaluation.results.kpi.budget'),
                  value: formatMoney(view.budget),
                },
              ]}
            />
          </Card>
        </div>
      </div>

      <ConfirmActionDialog
        open={dialog === 'validate'}
        title={t('evaluation.results.validateTitle')}
        scope={scope}
        consequence={t('evaluation.results.validateConsequence')}
        confirmLabel={t('evaluation.results.validate')}
        pending={validate.pending}
        error={withEvaluationMessage(validate.error)}
        onCancel={close}
        onConfirm={async () => {
          try {
            const next = await validate.mutate({
              params: { tenderId: view.tender.tenderId },
              body: lotId === null ? {} : { lotId },
            });
            setReportOverride(null);
            onUpdated(next);
            close();
            toast.show(t('evaluation.results.validatedToast'), 'success');
          } catch {
            // The dialog shows the error (RESULTS_SIGNED_OFF…).
          }
        }}
      />

      <ConfirmActionDialog
        open={dialog === 'submit'}
        title={t('evaluation.results.submitTitle')}
        scope={scope}
        consequence={t('evaluation.results.submitConsequence')}
        confirmLabel={t('evaluation.results.submit')}
        reason={{
          label: t('evaluation.results.summary'),
          required: true,
          hint: t('evaluation.results.summaryHint'),
        }}
        pending={submit.pending}
        error={withEvaluationMessage(submit.error, { summary: 'reason' })}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          if (report === null) return;
          try {
            const next = await submit.mutate({
              params: { reportId: report.reportId },
              body: { summary: reason },
            });
            setReportOverride(next);
            close();
            toast.show(t('evaluation.results.submittedToast'), 'success');
          } catch {
            // The dialog shows the error (REPORT_NOT_READY lists the blocking items).
          }
        }}
      >
        {!ready && (
          <Banner tone="warning" title={t('evaluation.results.notReadyTitle')}>
            <p>{t('evaluation.results.notReady', { count: blocking })}</p>
          </Banner>
        )}
        <Readiness items={view.readiness} label={t('evaluation.results.readinessTitle')} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'signoff'}
        title={t('evaluation.results.signoffTitle')}
        scope={
          report === null
            ? scope
            : `${scope} · ${t('evaluation.results.reportVersion', { version: report.version })}`
        }
        consequence={
          decision === 'signed'
            ? t('evaluation.results.signConsequence')
            : t('evaluation.results.declineConsequence')
        }
        confirmLabel={
          decision === 'signed' ? t('evaluation.results.sign') : t('evaluation.results.decline')
        }
        tone={decision === 'declined' ? 'danger' : 'primary'}
        reason={{ label: t('evaluation.commercial.note'), required: decision === 'declined' }}
        pending={signoff.pending}
        error={withEvaluationMessage(signoff.error, { note: 'reason' })}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          if (report === null) return;
          try {
            const next = await signoff.mutate({
              params: { reportId: report.reportId },
              body: { decision, ...(reason === '' ? {} : { note: reason }) },
            });
            setReportOverride(next);
            close();
            toast.show(
              t(
                decision === 'signed'
                  ? 'evaluation.results.signedToast'
                  : 'evaluation.results.declinedToast',
              ),
              'success',
            );
          } catch {
            // The dialog shows the error.
          }
        }}
      >
        <RadioGroup
          label={t('evaluation.results.decision')}
          inline
          value={decision}
          options={[
            { value: 'signed', label: t('evaluation.results.sign') },
            { value: 'declined', label: t('evaluation.results.decline') },
          ]}
          onChange={(value) => setDecision(value === 'declined' ? 'declined' : 'signed')}
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'handoff'}
        title={t('evaluation.results.handoffTitle')}
        scope={scope}
        consequence={t('evaluation.results.handoffConsequence', {
          bid: top === null ? t('evaluation.results.kpi.noTop') : bidLabel(top.bid),
        })}
        confirmLabel={t('evaluation.results.handoff')}
        reason={{ label: t('evaluation.commercial.note'), required: false }}
        pending={handoff.pending}
        error={withEvaluationMessage(handoff.error, { note: 'reason' })}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          if (report === null) return;
          try {
            const result = await handoff.mutate({
              params: { reportId: report.reportId },
              body: reason === '' ? {} : { note: reason },
            });
            setHandedOff(result);
            close();
            toast.show(t('evaluation.results.handedOffToast'), 'success');
          } catch {
            // The dialog shows the error (REPORT_NOT_SIGNED_OFF…).
          }
        }}
      />
    </>
  );
}
