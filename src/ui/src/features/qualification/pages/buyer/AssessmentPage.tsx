/**
 * BUY-34 — Qualification assessment (FR-06, BR-24, BR-48; AC-07, AC-08): criteria by assessment area with the
 * supplier's answers, evidence snapshots and reporting periods, findings, the restricted financial review, the
 * approved scope (capacity) and conditions, screenings and the proposed outcome. Assessors assess, clarify, verify
 * and recommend within their authority; deciders continue to the decision (BUY-35).
 */
import { useState } from 'react';
import type { ReactNode } from 'react';

import { qualificationEndpoints as api } from '@contracts/qualification';
import type {
  AssessmentItem,
  BuyerApplicationDetail,
  Finding,
  InfoRequest,
  Recommendation,
  Screening,
} from '@contracts/qualification';
import type {
  QualificationApplicationsStatus,
  VQualificationStatusEffectiveStatus,
} from '@contracts/enums';

import { invalidateApiQueries, useApiMutation, useApiQuery } from '../../../../api/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  ConfirmActionDialog,
  DataTable,
  DetailList,
  EmptyState,
  OfficialDeadline,
  OrDash,
  OverdueChip,
  PageHeader,
  QueryView,
  ReadinessChecklist,
  RestrictedState,
  StatusChip,
  Tabs,
  useToast,
} from '../../../../components/ui';
import type { DataTableColumn, ReadinessItem } from '../../../../components/ui';
import { formatDateTime } from '../../../../lib/format';
import { t, tEnum } from '../../../../lib/i18n';
import { CustomFieldsSection } from '../../../admin-policy/components/CustomFieldsSection';
import { FinancialReviewSection } from '../../components/FinancialReviewPanel';
import { FindingDialog } from '../../components/FindingDialog';
import { RecommendDialog } from '../../components/RecommendDialog';
import { RequestInfoDialog } from '../../components/RequestInfoDialog';
import { ScreeningReviewDialog } from '../../components/ScreeningReviewDialog';
import {
  EffectiveStatusChip,
  EvidenceChips,
  EvidenceTable,
  InfoRequestList,
} from '../../components/shared';
import { withQualificationMessage } from '../../lib/errors';
import { categoryLabel, gateText, scopeText, cellStack } from '../../lib/text';
import { runCommand, useIdParam, useOfficialTimeZone } from '../../lib/hooks';
import { buyerQualificationPaths } from '../../lib/paths';

export default function AssessmentPage() {
  const applicationId = useIdParam('applicationId');
  if (applicationId === null) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('qualification.assessment.notFound')}
          back={{ to: buyerQualificationPaths.queue, label: t('qualification.assessment.back') }}
        />
        <EmptyState title={t('qualification.assessment.notFound')} />
      </div>
    );
  }
  return <AssessmentLoader key={applicationId} applicationId={applicationId} />;
}

function AssessmentLoader({ applicationId }: { readonly applicationId: number }) {
  const query = useApiQuery(api.getApplication, { params: { applicationId } });
  return (
    <div className="tiq-page">
      {query.data === undefined && (
        <PageHeader
          title={t('qualification.assessment.loadingTitle')}
          back={{ to: buyerQualificationPaths.queue, label: t('qualification.assessment.back') }}
        />
      )}
      {query.error?.kind === 'not_found' ? (
        <EmptyState
          title={t('qualification.assessment.notFound')}
          description={t('qualification.assessment.notFoundHint')}
        />
      ) : query.error?.kind === 'forbidden' ? (
        <RestrictedState description={t('qualification.assessment.restricted')} />
      ) : (
        <QueryView query={query}>{(data) => <Workspace application={data} />}</QueryView>
      )}
    </div>
  );
}

/** Current statuses under which the supplier is registered but may not take part in the category (AC-07). */
const NOT_QUALIFIED: readonly VQualificationStatusEffectiveStatus[] = [
  'not_assessed',
  'not_qualified',
  'suspended',
  'expired',
  'withdrawn',
];

type TabId = 'criteria' | 'evidence' | 'requests' | 'financial' | 'screenings' | 'outcome';
type DialogState =
  | { readonly kind: 'finding'; readonly item: AssessmentItem }
  | { readonly kind: 'info'; readonly criterionId: number | null }
  | { readonly kind: 'close'; readonly request: InfoRequest }
  | { readonly kind: 'screening'; readonly screening: Screening }
  | { readonly kind: 'recommend' };

function Workspace({ application }: { readonly application: BuyerApplicationDetail }) {
  const toast = useToast();
  const officialTimeZone = useOfficialTimeZone();
  const timeZone = application.dueAt?.timeZone ?? officialTimeZone;
  const options = useApiQuery(api.getQualificationOptions, {});
  const closeRequest = useApiMutation(api.closeInfoRequest);
  const [tab, setTab] = useState<TabId>('criteria');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [findings, setFindings] = useState<ReadonlyMap<number, Finding>>(new Map());
  const [requests, setRequests] = useState<readonly InfoRequest[]>(application.infoRequests);
  const [screenings, setScreenings] = useState<readonly Screening[]>(application.screenings);
  const [status, setStatus] = useState<QualificationApplicationsStatus>(application.status);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(
    application.recommendation,
  );

  const items = application.items.map((item) => {
    const recorded = findings.get(item.criterion.id);
    return recorded === undefined ? item : { ...item, finding: recorded };
  });
  const actions = application.actions;
  const underReview = status === 'under_review' || status === 'more_info_required';
  const openRequests = requests.filter((request) => request.status === 'open');
  const unreviewedFlags = screenings.filter(
    (screening) => screening.result !== 'no_match' && screening.reviewedAt === null,
  );
  const withoutFinding = items.filter((item) => item.finding === null);
  const failing = items.filter(
    (item) => item.finding !== null && item.finding.finding === 'does_not_meet',
  );
  const hasFinancialCriteria = items.some((item) => item.criterion.area === 'financial');

  const readiness: ReadinessItem[] = [
    {
      id: 'findings',
      label: t('qualification.assessment.ready.findings'),
      detail:
        withoutFinding.length === 0
          ? t('qualification.assessment.ready.findingsDone')
          : t('qualification.assessment.ready.findingsOpen', { count: withoutFinding.length }),
      status: withoutFinding.length === 0 ? 'passed' : 'blocking',
    },
    {
      id: 'requests',
      label: t('qualification.assessment.ready.requests'),
      detail:
        openRequests.length === 0
          ? t('qualification.assessment.ready.requestsDone')
          : t('qualification.assessment.ready.requestsOpen', { count: openRequests.length }),
      status: openRequests.length === 0 ? 'passed' : 'blocking',
    },
    {
      id: 'financial',
      label: t('qualification.assessment.ready.financial'),
      detail: !hasFinancialCriteria
        ? t('qualification.assessment.ready.financialNotNeeded')
        : application.financialReviewRecorded
          ? t('qualification.assessment.ready.financialDone')
          : t('qualification.assessment.ready.financialOpen'),
      status: !hasFinancialCriteria || application.financialReviewRecorded ? 'passed' : 'blocking',
    },
    {
      id: 'screenings',
      label: t('qualification.assessment.ready.screenings'),
      detail:
        unreviewedFlags.length === 0
          ? t('qualification.assessment.ready.screeningsDone')
          : t('qualification.assessment.ready.screeningsOpen', { count: unreviewedFlags.length }),
      status: unreviewedFlags.length === 0 ? 'passed' : 'blocking',
    },
    {
      id: 'evidence',
      label: t('qualification.assessment.ready.evidence'),
      detail:
        application.completeness.mandatoryEvidenceMissing +
          application.completeness.expiredEvidence ===
        0
          ? t('qualification.assessment.ready.evidenceDone')
          : t('qualification.assessment.ready.evidenceGaps', {
              missing: application.completeness.mandatoryEvidenceMissing,
              expired: application.completeness.expiredEvidence,
            }),
      status:
        application.completeness.mandatoryEvidenceMissing +
          application.completeness.expiredEvidence ===
        0
          ? 'passed'
          : 'warning',
    },
  ];

  const nextAction = nextActionText(
    status,
    application,
    openRequests.length,
    withoutFinding.length,
  );
  const addRequest = (request: InfoRequest): void => {
    setRequests((previous) => [request, ...previous.filter((item) => item.id !== request.id)]);
  };

  const primary =
    actions.canDecide && status === 'decision_pending' ? (
      <ButtonLink
        to={buyerQualificationPaths.decide(application.id)}
        variant="primary"
        icon="gavel"
      >
        {t('qualification.assessment.decide')}
      </ButtonLink>
    ) : actions.canRecommend && underReview ? (
      <Button variant="primary" icon="send" onClick={() => setDialog({ kind: 'recommend' })}>
        {t('qualification.assessment.recommend')}
      </Button>
    ) : application.decisionId !== null ? (
      <ButtonLink
        to={buyerQualificationPaths.decision(application.decisionId)}
        variant="primary"
        icon="gavel"
      >
        {t('qualification.assessment.openDecision')}
      </ButtonLink>
    ) : undefined;

  const screeningColumns: DataTableColumn<Screening>[] = [
    {
      id: 'check',
      header: t('qualification.screening.check'),
      cell: (row) => (
        <>
          <span>{tEnum('integrity_screenings.check_type', row.checkType)}</span>
          <span className="tiq-cell-sub">{row.source}</span>
        </>
      ),
    },
    {
      id: 'result',
      header: t('qualification.screening.result'),
      cell: (row) => (
        <>
          <StatusChip enum="integrity_screenings.result" value={row.result} size="sm" />
          {row.matchDetail !== null && <span className="tiq-cell-sub">{row.matchDetail}</span>}
        </>
      ),
    },
    {
      id: 'checkedAt',
      header: t('qualification.screening.checkedAt'),
      cell: (row) => formatDateTime(row.checkedAt, timeZone),
    },
    {
      id: 'review',
      header: t('qualification.screening.review'),
      cell: (row) =>
        row.reviewedAt === null ? (
          row.result === 'no_match' ? (
            <span className="tiq-text-muted">{t('qualification.screening.noReviewNeeded')}</span>
          ) : (
            <Chip tone="warning" size="sm" icon="flag">
              {t('qualification.screening.awaitingReview')}
            </Chip>
          )
        ) : (
          <>
            <span>{row.disposition}</span>
            <span className="tiq-cell-sub">
              {t('qualification.screening.reviewedBy', {
                name: row.reviewedBy?.fullName ?? '',
                at: formatDateTime(row.reviewedAt, timeZone),
              })}
            </span>
            {row.effect !== null && <span className="tiq-cell-sub">{row.effect}</span>}
          </>
        ),
    },
    {
      id: 'actions',
      header: t('qualification.common.actions'),
      cell: (row) =>
        actions.canRecordFindings && row.reviewedAt === null && row.result !== 'no_match' ? (
          <Button
            size="sm"
            icon="shieldCheck"
            onClick={() => setDialog({ kind: 'screening', screening: row })}
          >
            {t('qualification.screening.reviewAction')}
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title={t('qualification.assessment.title', {
          reference: application.reference,
          supplier: application.supplier.name,
        })}
        subtitle={t('qualification.common.programVersion', {
          name: application.program.programName,
          no: application.program.versionNo,
        })}
        back={{ to: buyerQualificationPaths.queue, label: t('qualification.assessment.back') }}
        meta={
          <>
            <StatusChip enum="qualification_applications.status" value={status} />
            {application.dueAt !== null && (
              <OfficialDeadline
                deadline={application.dueAt}
                label={t('qualification.assessment.due')}
              />
            )}
            {application.overdue && <OverdueChip />}
            <span>{t('qualification.common.nextAction', { action: nextAction })}</span>
          </>
        }
        primaryAction={primary}
        actions={
          actions.canRequestInfo && underReview ? (
            <Button
              icon="messageQuestion"
              onClick={() => setDialog({ kind: 'info', criterionId: null })}
            >
              {t('qualification.assessment.requestInfo')}
            </Button>
          ) : undefined
        }
      />
      {NOT_QUALIFIED.includes(application.currentStatus) && (
        <Banner tone="warning" title={t('qualification.assessment.registeredNotQualifiedTitle')}>
          {t('qualification.assessment.registeredNotQualified', {
            supplier: application.supplier.name,
            category: application.scopeCategory.code,
            status: tEnum('v_qualification_status.effective_status', application.currentStatus),
          })}
        </Banner>
      )}
      <div className="tiq-grid tiq-grid--sidebar">
        <Card title={t('qualification.assessment.overview')}>
          <DetailList
            items={[
              {
                label: t('qualification.assessment.supplier'),
                value: application.supplier.legalName,
              },
              {
                label: t('qualification.assessment.scope'),
                value: scopeText(
                  application.scopeCategory,
                  application.scopeMaxValue,
                  application.scopeGeography,
                ),
              },
              {
                label: t('qualification.assessment.currentStatus'),
                value: <EffectiveStatusChip status={application.currentStatus} size="sm" />,
              },
              {
                label: t('qualification.assessment.risk'),
                value:
                  application.riskLevel === null ? null : (
                    <StatusChip
                      enum="qualification_applications.risk_level"
                      value={application.riskLevel}
                      size="sm"
                    />
                  ),
              },
              {
                label: t('qualification.assessment.priority'),
                value: tEnum('tasks.priority', application.priority),
              },
              {
                label: t('qualification.assessment.assessor'),
                value: application.assessor?.fullName ?? null,
              },
              {
                label: t('qualification.assessment.financialReviewer'),
                value: application.financialReviewer?.fullName ?? null,
              },
              {
                label: t('qualification.assessment.submitted'),
                value: t('qualification.assessment.submittedBy', {
                  name: application.submittedBy.fullName,
                  at: formatDateTime(application.submittedAt, timeZone),
                }),
              },
              {
                label: t('qualification.assessment.renewal'),
                value:
                  application.renewalOfDecisionId === null
                    ? t('qualification.queue.newApplication')
                    : t('qualification.assessment.renewalOf', {
                        id: application.renewalOfDecisionId,
                      }),
              },
              {
                label: t('qualification.assessment.approval'),
                value: application.requiresIndependentApproval
                  ? t('qualification.assessment.independentApproval')
                  : t('qualification.assessment.noIndependentApproval'),
              },
            ]}
          />
        </Card>
        {application.customFields !== undefined &&
          Object.keys(application.customFields).length > 0 && (
            <Card title={t('qualification.application.customFields')}>
              <CustomFieldsSection
                entityType="qualification_application"
                values={application.customFields}
                readOnly
              />
            </Card>
          )}
        <Card title={t('qualification.assessment.readiness')}>
          <ReadinessChecklist label={t('qualification.assessment.readiness')} items={readiness} />
          {failing.length > 0 && (
            <p className="tiq-text-danger">
              {t('qualification.assessment.failing', { count: failing.length })}
            </p>
          )}
        </Card>
      </div>
      <Tabs
        label={t('qualification.assessment.tabsLabel')}
        selected={tab}
        onSelect={(id) => setTab(id as TabId)}
        tabs={[
          {
            id: 'criteria',
            label: t('qualification.assessment.tab.criteria'),
            count: items.length,
          },
          { id: 'evidence', label: t('qualification.assessment.tab.evidence') },
          {
            id: 'requests',
            label: t('qualification.assessment.tab.requests'),
            count: openRequests.length,
          },
          { id: 'financial', label: t('qualification.assessment.tab.financial') },
          {
            id: 'screenings',
            label: t('qualification.assessment.tab.screenings'),
            count: unreviewedFlags.length,
          },
          { id: 'outcome', label: t('qualification.assessment.tab.outcome') },
        ]}
      >
        {tab === 'criteria' && (
          <CriteriaView
            items={items}
            generalFindings={application.generalFindings}
            timeZone={timeZone}
            canRecord={actions.canRecordFindings && underReview}
            canAsk={actions.canRequestInfo && underReview}
            onRecord={(item) => setDialog({ kind: 'finding', item })}
            onAsk={(criterionId) => setDialog({ kind: 'info', criterionId })}
          />
        )}
        {tab === 'evidence' && (
          <Card flush title={t('qualification.assessment.evidenceTitle')}>
            <EvidenceTable
              evidence={items.flatMap((item) => item.evidence)}
              timeZone={timeZone}
              caption={t('qualification.assessment.evidenceTitle')}
            />
          </Card>
        )}
        {tab === 'requests' && (
          <Card title={t('qualification.assessment.requestsTitle')}>
            <InfoRequestList
              requests={requests}
              timeZone={timeZone}
              renderActions={(request) =>
                actions.canRequestInfo && request.status !== 'closed' ? (
                  <Button
                    size="sm"
                    icon="checkCircle"
                    onClick={() => setDialog({ kind: 'close', request })}
                  >
                    {t('qualification.assessment.closeRequest')}
                  </Button>
                ) : null
              }
            />
          </Card>
        )}
        {tab === 'financial' && (
          <FinancialReviewSection
            applicationId={application.id}
            reference={application.reference}
            supplierName={application.supplier.name}
            timeZone={timeZone}
            canView={actions.canViewFinancialReview}
            currencies={options.data?.currencies ?? []}
            onInfoRequested={(request) => {
              addRequest(request);
              setStatus('more_info_required');
            }}
          />
        )}
        {tab === 'screenings' && (
          <Card flush title={t('qualification.assessment.screeningsTitle')}>
            <Banner tone="info">{t('qualification.screening.flagOnly')}</Banner>
            <DataTable
              caption={t('qualification.assessment.screeningsTitle')}
              columns={screeningColumns}
              rows={screenings}
              rowKey={(row) => String(row.id)}
              empty={<EmptyState compact title={t('qualification.screening.none')} />}
            />
          </Card>
        )}
        {tab === 'outcome' && (
          <OutcomeView recommendation={recommendation} status={status} timeZone={timeZone} />
        )}
      </Tabs>

      {dialog?.kind === 'finding' && (
        <FindingDialog
          applicationId={application.id}
          item={dialog.item}
          onClose={() => setDialog(null)}
          onRecorded={(finding) => {
            setFindings((previous) => new Map(previous).set(dialog.item.criterion.id, finding));
            setDialog(null);
            toast.show(
              t('qualification.finding.done', {
                finding: tEnum('qualification_findings.finding', finding.finding),
              }),
              'success',
            );
          }}
        />
      )}
      {dialog?.kind === 'info' && (
        <RequestInfoDialog
          applicationId={application.id}
          reference={application.reference}
          supplierName={application.supplier.name}
          timeZone={timeZone}
          criteria={items.map((item) => item.criterion)}
          initialCriterionId={dialog.criterionId}
          onClose={() => setDialog(null)}
          onRequested={(result) => {
            addRequest(result.infoRequest);
            setStatus(result.applicationStatus);
            setDialog(null);
            invalidateApiQueries('buyer.qualification.summary');
            toast.show(
              t('qualification.requestInfo.done', {
                reference: application.reference,
                status: tEnum('qualification_applications.status', result.applicationStatus),
              }),
              'success',
            );
          }}
        />
      )}
      {dialog?.kind === 'close' && (
        <ConfirmActionDialog
          open
          title={t('qualification.assessment.closeTitle')}
          scope={dialog.request.question}
          consequence={t('qualification.assessment.closeConsequence')}
          confirmLabel={t('qualification.assessment.closeRequest')}
          reason={{ label: t('qualification.assessment.closeNote'), required: false }}
          pending={closeRequest.pending}
          error={withQualificationMessage(closeRequest.error)}
          onCancel={() => {
            closeRequest.reset();
            setDialog(null);
          }}
          onConfirm={({ reason }) =>
            runCommand(
              () =>
                closeRequest.mutate({
                  params: { applicationId: application.id, infoRequestId: dialog.request.id },
                  body: { note: reason.trim() === '' ? null : reason.trim() },
                }),
              (result) => {
                addRequest(result.infoRequest);
                setStatus(result.applicationStatus);
                setDialog(null);
                toast.show(t('qualification.assessment.closed'), 'success');
              },
            )
          }
        />
      )}
      {dialog?.kind === 'screening' && (
        <ScreeningReviewDialog
          screening={dialog.screening}
          timeZone={timeZone}
          onClose={() => setDialog(null)}
          onReviewed={(screening) => {
            setScreenings((previous) =>
              previous.map((item) => (item.id === screening.id ? screening : item)),
            );
            setDialog(null);
            toast.show(t('qualification.screening.reviewed'), 'success');
          }}
        />
      )}
      {dialog?.kind === 'recommend' && (
        <RecommendDialog
          application={application}
          options={options.data}
          onClose={() => setDialog(null)}
          onRecommended={(result) => {
            setRecommendation(result.recommendation);
            setStatus(result.status);
            setDialog(null);
            setTab('outcome');
            invalidateApiQueries('buyer.qualification.summary');
            toast.show(
              t('qualification.recommend.done', {
                status: tEnum('qualification_applications.status', result.status),
              }),
              'success',
            );
          }}
        />
      )}
    </>
  );
}

function nextActionText(
  status: QualificationApplicationsStatus,
  application: BuyerApplicationDetail,
  openRequests: number,
  withoutFinding: number,
): string {
  switch (status) {
    case 'submitted':
      return application.assessor === null
        ? t('qualification.next.assign')
        : t('qualification.next.startReview');
    case 'under_review':
      return withoutFinding > 0
        ? t('qualification.next.findings', { count: withoutFinding })
        : t('qualification.next.recommend');
    case 'more_info_required':
      return t('qualification.next.awaitSupplier', { count: openRequests });
    case 'decision_pending':
      return t('qualification.next.decide');
    case 'decided':
      return t('qualification.next.decided');
    case 'withdrawn':
      return t('qualification.next.withdrawn');
    case 'draft':
      return t('qualification.next.draft');
  }
}

function CriteriaView({
  items,
  generalFindings,
  timeZone,
  canRecord,
  canAsk,
  onRecord,
  onAsk,
}: {
  readonly items: readonly AssessmentItem[];
  readonly generalFindings: readonly Finding[];
  readonly timeZone: string;
  readonly canRecord: boolean;
  readonly canAsk: boolean;
  readonly onRecord: (item: AssessmentItem) => void;
  readonly onAsk: (criterionId: number) => void;
}) {
  const areas = [...new Set(items.map((item) => item.criterion.area))];
  return (
    <div className="tiq-stack">
      {generalFindings.length > 0 && (
        <Card title={t('qualification.assessment.generalFindings')}>
          <div className="tiq-stack">
            {generalFindings.map((finding) => (
              <FindingView key={finding.id} finding={finding} timeZone={timeZone} />
            ))}
          </div>
        </Card>
      )}
      {areas.map((area) => (
        <Card key={area} title={tEnum('qualification_criteria.area', area)}>
          <div className="tiq-stack">
            {items
              .filter((item) => item.criterion.area === area)
              .map((item) => (
                <section
                  key={item.criterion.id}
                  className="tiq-stack"
                  aria-label={item.criterion.question}
                >
                  <div className="tiq-inline">
                    <strong>{item.criterion.question}</strong>
                    {item.criterion.mandatory && (
                      <Chip tone="neutral" size="sm">
                        {t('qualification.common.mandatory')}
                      </Chip>
                    )}
                    {item.evidenceMissing && (
                      <Chip tone="danger" size="sm" icon="alertCircle">
                        {t('qualification.assessment.evidenceMissing')}
                      </Chip>
                    )}
                    {item.openInfoRequestIds.length > 0 && (
                      <Chip tone="warning" size="sm" icon="messageQuestion">
                        {t('qualification.assessment.openRequestChip', {
                          count: item.openInfoRequestIds.length,
                        })}
                      </Chip>
                    )}
                  </div>
                  {item.criterion.thresholdDescription !== null && (
                    <p className="tiq-text-muted">
                      {t('qualification.assessment.threshold', {
                        text: item.criterion.thresholdDescription,
                      })}
                    </p>
                  )}
                  <DetailList
                    stacked
                    items={[
                      { label: t('qualification.assessment.answer'), value: answerText(item) },
                      {
                        label: t('qualification.assessment.finding'),
                        value:
                          item.finding === null ? (
                            <span className="tiq-text-warning">
                              {t('qualification.assessment.noFinding')}
                            </span>
                          ) : (
                            <FindingView finding={item.finding} timeZone={timeZone} />
                          ),
                      },
                    ]}
                  />
                  <EvidenceChips evidence={item.evidence} />
                  {(canRecord || canAsk) && (
                    <div className="tiq-inline">
                      {canRecord && (
                        <Button size="sm" icon="clipboardCheck" onClick={() => onRecord(item)}>
                          {item.finding === null
                            ? t('qualification.assessment.recordFinding')
                            : t('qualification.assessment.changeFinding')}
                        </Button>
                      )}
                      {canAsk && (
                        <Button
                          size="sm"
                          icon="messageQuestion"
                          onClick={() => onAsk(item.criterion.id)}
                        >
                          {t('qualification.assessment.ask')}
                        </Button>
                      )}
                    </div>
                  )}
                </section>
              ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function answerText(item: AssessmentItem): ReactNode {
  const answer = item.answer;
  if (answer === null) {
    return <span className="tiq-text-danger">{t('qualification.assessment.unanswered')}</span>;
  }
  if (answer.applicability === 'not_applicable') {
    return t('qualification.assessment.notApplicable', {
      reason: answer.naReason ?? t('qualification.assessment.noReason'),
    });
  }
  if (answer.answerBool !== null)
    return answer.answerBool ? t('qualification.common.yes') : t('qualification.common.no');
  if (answer.answerNumber !== null) return answer.answerNumber;
  if (answer.answerDate !== null) return answer.answerDate;
  return <OrDash>{answer.answerText}</OrDash>;
}

function FindingView({
  finding,
  timeZone,
}: {
  readonly finding: Finding;
  readonly timeZone: string;
}) {
  return (
    <span className="tiq-stack" style={cellStack}>
      <span className="tiq-inline">
        <StatusChip enum="qualification_findings.finding" value={finding.finding} size="sm" />
        {finding.flagOnly && (
          <Chip tone="warning" size="sm" icon="flag">
            {t('qualification.assessment.flagOnly')}
          </Chip>
        )}
      </span>
      <span>{finding.rationale}</span>
      <span className="tiq-cell-sub">
        {t('qualification.assessment.recordedBy', {
          name: finding.assessor.fullName,
          at: formatDateTime(finding.recordedAt, timeZone),
        })}
      </span>
    </span>
  );
}

function OutcomeView({
  recommendation,
  status,
  timeZone,
}: {
  readonly recommendation: Recommendation | null;
  readonly status: QualificationApplicationsStatus;
  readonly timeZone: string;
}) {
  if (recommendation === null) {
    return (
      <Card title={t('qualification.assessment.proposedOutcome')}>
        <EmptyState
          compact
          title={t('qualification.assessment.noRecommendation')}
          description={
            status === 'under_review' || status === 'more_info_required'
              ? t('qualification.assessment.noRecommendationHint')
              : undefined
          }
        />
      </Card>
    );
  }
  return (
    <Card title={t('qualification.assessment.proposedOutcome')}>
      <DetailList
        items={[
          {
            label: t('qualification.terms.outcome'),
            value: (
              <StatusChip
                enum="qualification_decisions.outcome"
                value={recommendation.proposedOutcome}
              />
            ),
          },
          {
            label: t('qualification.terms.scope'),
            value: scopeText(
              recommendation.scopeCategory,
              recommendation.scopeMaxValue,
              recommendation.scopeGeography,
            ),
          },
          {
            label: t('qualification.terms.category'),
            value: categoryLabel(recommendation.scopeCategory),
          },
          { label: t('qualification.terms.conditions'), value: recommendation.conditions },
          {
            label: t('qualification.terms.allowedActivities'),
            value: recommendation.allowedActivities,
          },
          {
            label: t('qualification.terms.blockedGate'),
            value: gateText(recommendation.blockedGate),
          },
          { label: t('qualification.recommend.rationale'), value: recommendation.rationale },
          {
            label: t('qualification.assessment.recommendedBy'),
            value: `${recommendation.recommendedBy.fullName} · ${formatDateTime(recommendation.recommendedAt, timeZone)}`,
          },
          {
            label: t('qualification.assessment.approvalStatus'),
            value:
              recommendation.approvalStatus === null ? (
                t('qualification.assessment.noApprovalNeeded')
              ) : (
                <StatusChip
                  enum="approval_requests.status"
                  value={recommendation.approvalStatus}
                  size="sm"
                />
              ),
          },
        ]}
      />
    </Card>
  );
}
