/**
 * EVA-01 — One evaluator assignment: the event, bids and criteria in scope, the due date in the official time zone,
 * the declarations and completion. The assigned evaluator accepts the assignment, which signs the confidentiality
 * undertaking and declares conflicts BEFORE any content is shown (BR-08), discloses a conflict later, requests a
 * reassignment and begins the permitted work. The chair reviews a declared conflict (DD-25) and records a recusal or
 * reassignment; prior work is preserved (PRD §20).
 */
import { useState } from 'react';

import { CONFLICT_DECLARATIONS_NATURE } from '@contracts/enums';
import {
  acceptAssignment,
  declareConflict,
  getAssignment,
  getReassignmentCandidates,
  reassignAssignment,
  requestReassignment,
  reviewConflict,
} from '@contracts/evaluation';
import type {
  AssignmentDetail,
  ConflictDeclaration,
  ReassignResult,
  ReassignmentRequestResult,
} from '@contracts/evaluation';

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
  OfficialDeadline,
  OverdueChip,
  PageHeader,
  RadioGroup,
  Reference,
  RestrictedState,
  Select,
  SkeletonBlock,
  StatusChip,
  TextArea,
  Timeline,
  UnsavedChangesGuard,
  formErrors,
  useToast,
} from '../../../components/ui';
import { formatDateTime, formatDecimalString } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { ProgressMeter } from '../components/ProgressMeter';
import { evaluationErrorMessage, withEvaluationMessage } from '../lib/errors';
import { useIdParam } from '../lib/hooks';
import { bidLabel, lotLabel } from '../lib/labels';
import { evaluationPaths } from '../lib/paths';
import { ASSIGNMENT_ACT_PERMISSIONS } from '../lib/permissions';

type Dialog = 'accept' | 'declare' | 'request' | 'reassign' | 'review' | null;

const CLOSED_STATUSES = new Set(['finalized', 'recused', 'reassigned']);

interface AcceptDraft {
  readonly accepted: boolean;
  readonly hasConflict: '' | 'yes' | 'no';
  readonly nature: string;
  readonly details: string;
}

const EMPTY_ACCEPT: AcceptDraft = { accepted: false, hasConflict: '', nature: '', details: '' };

function natureOptions() {
  return CONFLICT_DECLARATIONS_NATURE.map((value) => ({
    value,
    label: tEnum('conflict_declarations.nature', value),
  }));
}

function DeclarationDetails({
  declaration,
  timeZone,
}: {
  readonly declaration: ConflictDeclaration | null;
  readonly timeZone: string;
}) {
  if (declaration === null) {
    return <p className="tiq-text-muted">{t('evaluation.assignment.noDeclaration')}</p>;
  }
  return (
    <DetailList
      items={[
        {
          key: 'answer',
          label: t('evaluation.assignment.conflictAnswer'),
          value: declaration.hasConflict
            ? t('evaluation.assignment.conflictDeclared')
            : t('evaluation.assignments.noConflict'),
        },
        {
          key: 'nature',
          label: t('evaluation.assignment.nature'),
          value:
            declaration.nature === null
              ? null
              : tEnum('conflict_declarations.nature', declaration.nature),
        },
        {
          key: 'supplier',
          label: t('evaluation.assignment.supplier'),
          value: declaration.supplierName,
        },
        { key: 'details', label: t('evaluation.assignment.details'), value: declaration.details },
        {
          key: 'declaredAt',
          label: t('evaluation.assignment.declaredAt'),
          value: formatDateTime(declaration.declaredAt, timeZone),
        },
        {
          key: 'disposition',
          label: t('evaluation.assignment.disposition'),
          value: (
            <StatusChip enum="conflict_declarations.disposition" value={declaration.disposition} />
          ),
        },
        {
          key: 'reviewedBy',
          label: t('evaluation.assignment.reviewedBy'),
          value:
            declaration.reviewedBy === null
              ? null
              : `${declaration.reviewedBy.fullName} · ${formatDateTime(declaration.reviewedAt, timeZone)}`,
        },
        {
          key: 'reviewNote',
          label: t('evaluation.assignment.reviewNote'),
          value: declaration.reviewNote,
        },
      ]}
    />
  );
}

export default function AssignmentPage() {
  const assignmentId = useIdParam('assignmentId');
  const query = useApiQuery(
    getAssignment,
    assignmentId === null ? null : { params: { assignmentId } },
  );
  const [latest, setLatest] = useState<AssignmentDetail | null>(null);
  const detail =
    latest !== null && latest.assignmentId === assignmentId ? latest : (query.data ?? null);

  if (assignmentId === null) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('evaluation.assignment.title')} />
        <EmptyState title={t('evaluation.assignment.notFound')} />
      </div>
    );
  }
  if (detail === null) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('evaluation.assignment.title')}
          back={{ to: evaluationPaths.assignments, label: t('evaluation.assignments.title') }}
        />
        {query.error !== null ? (
          query.error.kind === 'not_found' ? (
            <EmptyState title={t('evaluation.assignment.notFound')} icon="search" />
          ) : (
            <ErrorState error={query.error} onRetry={query.reload} />
          )
        ) : (
          <SkeletonBlock lines={6} />
        )}
      </div>
    );
  }
  return <AssignmentView detail={detail} onUpdated={setLatest} />;
}

function AssignmentView({
  detail,
  onUpdated,
}: {
  readonly detail: AssignmentDetail;
  readonly onUpdated: (detail: AssignmentDetail) => void;
}) {
  const tenant = useActiveTenant();
  const timeZone = detail.tender.officialTimeZone;
  const toast = useToast();
  const canAct = usePermission(ASSIGNMENT_ACT_PERMISSIONS);
  const isChair = usePermission('evaluation.chair');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [acceptDraft, setAcceptDraft] = useState<AcceptDraft>(EMPTY_ACCEPT);
  const [declareNature, setDeclareNature] = useState('');
  const [reviewDisposition, setReviewDisposition] = useState('');
  const [newEvaluator, setNewEvaluator] = useState('');
  const [outcome, setOutcome] = useState<'recused' | 'reassigned'>('reassigned');
  const [reviewed, setReviewed] = useState<ConflictDeclaration | null>(null);
  const [requested, setRequested] = useState<ReassignmentRequestResult | null>(null);
  const [reassigned, setReassigned] = useState<ReassignResult | null>(null);

  const accept = useApiMutation(acceptAssignment);
  const declare = useApiMutation(declareConflict);
  const request = useApiMutation(requestReassignment);
  const reassign = useApiMutation(reassignAssignment);
  const review = useApiMutation(reviewConflict);
  const candidates = useApiQuery(
    getReassignmentCandidates,
    dialog === 'reassign' ? { params: { assignmentId: detail.assignmentId } } : null,
  );

  const declaration = reviewed ?? detail.conflictDeclaration;
  const closed = CLOSED_STATUSES.has(detail.status);
  const own = detail.isOwn && canAct;
  const canAccept = own && !detail.declarations.undertakingAccepted && !closed;
  const accepted = detail.declarations.undertakingAccepted;
  const canDeclare = own && accepted && !closed && declaration?.hasConflict !== true;
  const canRequest =
    own && accepted && !closed && detail.reassignmentRequestedAt === null && requested === null;
  const canReassign = isChair && !closed;
  const canReview =
    isChair &&
    declaration !== null &&
    declaration.hasConflict &&
    declaration.disposition === 'pending_review';
  const scope = [
    `${detail.tender.reference} ${detail.tender.title}`,
    lotLabel(detail.lot),
    detail.evaluator.fullName,
  ]
    .filter((part) => part !== null)
    .join(' · ');
  const acceptErrors = formErrors(accept.error, [
    'confidentialityAccepted',
    'undertakingTextVersion',
    'conflictDeclaration.hasConflict',
    'conflictDeclaration.nature',
    'conflictDeclaration.details',
  ]);
  const acceptDirty =
    acceptDraft.accepted || acceptDraft.hasConflict !== '' || acceptDraft.details !== '';
  const acceptReady =
    acceptDraft.accepted &&
    (acceptDraft.hasConflict === 'no' ||
      (acceptDraft.hasConflict === 'yes' &&
        acceptDraft.nature !== '' &&
        acceptDraft.details.trim() !== ''));

  const close = (): void => setDialog(null);
  const open = (next: Dialog): void => {
    accept.reset();
    declare.reset();
    request.reset();
    reassign.reset();
    review.reset();
    setDialog(next);
  };

  const workLink =
    detail.contentAccess.allowed && !closed ? (
      detail.isCommercial ? (
        <ButtonLink
          to={evaluationPaths.commercial(detail.tender.tenderId, detail.lot?.lotId)}
          variant="primary"
          icon="coins"
        >
          {t('evaluation.assignment.openCommercial')}
        </ButtonLink>
      ) : (
        <ButtonLink
          to={evaluationPaths.assessment(detail.assignmentId)}
          variant="primary"
          icon="edit"
        >
          {detail.status === 'not_started'
            ? t('evaluation.assignment.begin')
            : t('evaluation.assignment.openAssessment')}
        </ButtonLink>
      )
    ) : undefined;

  return (
    <div className="tiq-page">
      <UnsavedChangesGuard when={canAccept && acceptDirty && !accepted} />
      <PageHeader
        title={t('evaluation.assignment.title')}
        subtitle={`${detail.tender.title}${detail.lot === null ? '' : ` · ${lotLabel(detail.lot) ?? ''}`}`}
        back={{ to: evaluationPaths.assignments, label: t('evaluation.assignments.title') }}
        primaryAction={workLink}
        actions={
          canDeclare || canRequest || canReassign || canReview ? (
            <>
              {canDeclare && (
                <Button icon="alertTriangle" onClick={() => open('declare')}>
                  {t('evaluation.assignment.declare')}
                </Button>
              )}
              {canRequest && (
                <Button icon="repeat" onClick={() => open('request')}>
                  {t('evaluation.assignment.requestReassignment')}
                </Button>
              )}
              {canReview && (
                <Button icon="shieldCheck" onClick={() => open('review')}>
                  {t('evaluation.assignment.reviewConflict')}
                </Button>
              )}
              {canReassign && (
                <Button icon="userCheck" onClick={() => open('reassign')}>
                  {t('evaluation.assignment.reassign')}
                </Button>
              )}
            </>
          ) : undefined
        }
        meta={
          <>
            <Reference
              value={detail.tender.reference}
              to={evaluationPaths.tender(detail.tender.tenderId)}
            />
            {tenant !== null && <span className="tiq-text-muted">{tenant.name}</span>}
            <StatusChip enum="evaluation_assignments.status" value={detail.status} />
            <OfficialDeadline deadline={detail.dueAt} label={t('evaluation.common.due')} />
            {detail.isOverdue && <OverdueChip />}
            <span>
              <strong>{t('evaluation.common.nextAction')}</strong>{' '}
              {t(`evaluation.nextAction.${detail.nextAction}`)}
            </span>
          </>
        }
      />

      {!detail.contentAccess.allowed && detail.contentAccess.blockedReason !== null && (
        <Banner tone="warning" title={t('evaluation.assignment.blockedTitle')}>
          <p>{t(`evaluation.blocked.${detail.contentAccess.blockedReason}`)}</p>
        </Banner>
      )}
      {!detail.isOwn && (
        <Banner tone="info" title={t('evaluation.assignment.oversightTitle')}>
          <p>{t('evaluation.assignment.oversight', { name: detail.evaluator.fullName })}</p>
        </Banner>
      )}
      {detail.returnReason !== null && (
        <Banner tone="warning" title={t('evaluation.assignment.returnedTitle')}>
          <p>{detail.returnReason}</p>
        </Banner>
      )}
      {requested !== null && (
        <Banner tone="success" title={t('evaluation.assignment.requestedTitle')}>
          <p>
            {t('evaluation.assignment.requested', {
              name: requested.routedTo.fullName,
              task: requested.taskId,
              at: formatDateTime(requested.requestedAt, timeZone),
            })}
          </p>
        </Banner>
      )}
      {reassigned !== null && (
        <Banner tone="success" title={t('evaluation.assignment.reassignedTitle')}>
          <p>
            {t('evaluation.assignment.reassignedTo', {
              name: reassigned.replacement.evaluator.fullName,
              status: tEnum('evaluation_assignments.status', reassigned.original.status),
            })}
          </p>
        </Banner>
      )}
      {detail.reassignedTo !== null && (
        <Banner tone="info" title={t('evaluation.assignment.reassignedTitle')}>
          <p>
            {t('evaluation.assignment.reassignedTo', {
              name: detail.reassignedTo.fullName,
              status: tEnum('evaluation_assignments.status', detail.status),
            })}
          </p>
          {detail.reassignmentReason !== null && <p>{detail.reassignmentReason}</p>}
        </Banner>
      )}

      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack">
          {canAccept && (
            <Card
              title={t('evaluation.assignment.acceptTitle')}
              subtitle={t('evaluation.assignment.acceptIntro')}
              footer={
                <div className="tiq-row-actions">
                  <Button
                    variant="primary"
                    icon="check"
                    disabled={!acceptReady}
                    onClick={() => open('accept')}
                  >
                    {t('evaluation.assignment.accept')}
                  </Button>
                </div>
              }
            >
              <div className="tiq-form-stack">
                <h3 className="tiq-form-section-title">
                  {detail.undertakingText.title}{' '}
                  <span className="tiq-text-muted">
                    {t('evaluation.assignment.version', {
                      version: detail.undertakingText.textVersion,
                    })}
                  </span>
                </h3>
                <p>{detail.undertakingText.text}</p>
                <Checkbox
                  label={t('evaluation.assignment.undertakingAccept')}
                  checked={acceptDraft.accepted}
                  onChange={(checked) => setAcceptDraft({ ...acceptDraft, accepted: checked })}
                  error={acceptErrors.forField('confidentialityAccepted')}
                />
                <RadioGroup
                  label={t('evaluation.assignment.conflictQuestion')}
                  required
                  inline
                  value={acceptDraft.hasConflict}
                  options={[
                    { value: 'no', label: t('evaluation.assignment.conflictNo') },
                    { value: 'yes', label: t('evaluation.assignment.conflictYes') },
                  ]}
                  onChange={(value) =>
                    setAcceptDraft({ ...acceptDraft, hasConflict: value === 'yes' ? 'yes' : 'no' })
                  }
                  error={acceptErrors.forField('conflictDeclaration.hasConflict')}
                />
                {acceptDraft.hasConflict === 'yes' && (
                  <>
                    <Select
                      label={t('evaluation.assignment.nature')}
                      required
                      placeholder={t('evaluation.common.select')}
                      value={acceptDraft.nature}
                      options={natureOptions()}
                      onChange={(nature) => setAcceptDraft({ ...acceptDraft, nature })}
                      error={acceptErrors.forField('conflictDeclaration.nature')}
                    />
                    <TextArea
                      label={t('evaluation.assignment.details')}
                      required
                      rows={3}
                      value={acceptDraft.details}
                      onChange={(details) => setAcceptDraft({ ...acceptDraft, details })}
                      error={acceptErrors.forField('conflictDeclaration.details')}
                    />
                    <Banner tone="info">
                      <p>{t('evaluation.assignment.conflictPause')}</p>
                    </Banner>
                  </>
                )}
                {acceptErrors.other.length > 0 && (
                  <FormErrorSummary
                    title={t('evaluation.common.fixErrors')}
                    errors={acceptErrors.other}
                  />
                )}
              </div>
            </Card>
          )}

          <Card title={t('evaluation.assignment.scopeTitle')}>
            <DetailList
              items={[
                {
                  key: 'event',
                  label: t('evaluation.assignment.event'),
                  value: `${detail.tender.reference} ${detail.tender.title}`,
                },
                { key: 'lot', label: t('evaluation.assignment.lot'), value: lotLabel(detail.lot) },
                {
                  key: 'evaluator',
                  label: t('evaluation.assignment.evaluator'),
                  value: `${detail.evaluator.fullName}${detail.evaluator.capacity === null ? '' : ` · ${detail.evaluator.capacity}`}`,
                },
                {
                  key: 'chair',
                  label: t('evaluation.assignment.chair'),
                  value: detail.chair.fullName,
                },
                {
                  key: 'kind',
                  label: t('evaluation.assignment.kind'),
                  value: detail.isCommercial
                    ? t('evaluation.assignments.kind.commercial')
                    : t('evaluation.assignments.kind.technical'),
                },
                {
                  key: 'bids',
                  label: t('evaluation.assignment.bids'),
                  value:
                    detail.bidId === null
                      ? t('evaluation.assignments.allBids', { count: detail.bidCount })
                      : t('evaluation.assignments.oneBid'),
                },
                {
                  key: 'independent',
                  label: t('evaluation.assignment.independent'),
                  value: detail.tender.independentEvaluation
                    ? t('evaluation.assignment.independentYes')
                    : t('evaluation.common.no'),
                },
                {
                  key: 'anonymized',
                  label: t('evaluation.assignment.anonymized'),
                  value: detail.tender.anonymizedEvaluation
                    ? (detail.tender.anonymizationLimitations ?? t('evaluation.common.yes'))
                    : t('evaluation.common.no'),
                },
              ]}
            />
          </Card>

          <Card title={t('evaluation.assignment.criteriaTitle')} flush>
            <DataTable
              caption={t('evaluation.assignment.criteriaTitle')}
              columns={[
                {
                  id: 'criterion',
                  header: t('evaluation.common.criterion'),
                  cell: (criterion) => (
                    <>
                      <span>
                        {criterion.code} {criterion.name}
                      </span>
                      {criterion.description !== null && (
                        <span className="tiq-cell-sub">{criterion.description}</span>
                      )}
                    </>
                  ),
                },
                {
                  id: 'maxPoints',
                  header: t('evaluation.common.maxPoints'),
                  numeric: true,
                  cell: (criterion) => formatDecimalString(criterion.maxPoints, 2),
                },
                {
                  id: 'envelope',
                  header: t('evaluation.common.envelope'),
                  cell: (criterion) => (
                    <StatusChip
                      enum="evaluation_criteria.envelope"
                      value={criterion.envelope}
                      size="sm"
                    />
                  ),
                },
                {
                  id: 'guidance',
                  header: t('evaluation.common.guidance'),
                  cell: (criterion) =>
                    criterion.scoringGuidance ?? t('evaluation.common.priceFormula'),
                },
              ]}
              rows={detail.criteria}
              rowKey={(criterion) => String(criterion.criterionId)}
              empty={<EmptyState compact title={t('evaluation.assignment.noCriteria')} />}
            />
          </Card>

          <Card title={t('evaluation.assignment.bidsTitle')} flush>
            {detail.contentAccess.allowed ? (
              <DataTable
                caption={t('evaluation.assignment.bidsTitle')}
                columns={[
                  { id: 'bid', header: t('evaluation.common.bid'), cell: (bid) => bidLabel(bid) },
                  {
                    id: 'receipt',
                    header: t('evaluation.common.receipt'),
                    cell: (bid) => (
                      <>
                        <span className="tiq-mono">{bid.receiptNo}</span>
                        <span className="tiq-cell-sub">
                          {formatDateTime(bid.receivedAt, timeZone)}
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
                ]}
                rows={detail.bids}
                rowKey={(bid) => String(bid.bidId)}
                empty={<EmptyState compact title={t('evaluation.assignment.noBids')} />}
              />
            ) : (
              <RestrictedState compact description={t('evaluation.assignment.bidsHidden')} />
            )}
          </Card>
        </div>

        <div className="tiq-stack">
          <Card title={t('evaluation.assignment.statusTitle')}>
            <DetailList
              stacked
              items={[
                {
                  key: 'status',
                  label: t('evaluation.common.status'),
                  value: <StatusChip enum="evaluation_assignments.status" value={detail.status} />,
                },
                {
                  key: 'due',
                  label: t('evaluation.common.due'),
                  value: <OfficialDeadline deadline={detail.dueAt} variant="block" showRemaining />,
                },
                {
                  key: 'completion',
                  label: t('evaluation.assignment.completion'),
                  value: detail.isCommercial ? (
                    t('evaluation.assignments.commercialCompletion')
                  ) : (
                    <>
                      <ProgressMeter
                        done={detail.completion.scored}
                        total={detail.completion.total}
                        label={t('evaluation.assignment.completion')}
                      />
                      {detail.completion.notScored > 0 && (
                        <span className="tiq-text-warning">
                          {t('evaluation.assignments.notScored', {
                            count: detail.completion.notScored,
                          })}
                        </span>
                      )}
                    </>
                  ),
                },
                {
                  key: 'accepted',
                  label: t('evaluation.assignment.acceptedAt'),
                  value:
                    detail.acceptedAt === null ? null : formatDateTime(detail.acceptedAt, timeZone),
                },
                {
                  key: 'submitted',
                  label: t('evaluation.assignment.submittedAt'),
                  value:
                    detail.submittedAt === null
                      ? null
                      : formatDateTime(detail.submittedAt, timeZone),
                },
                {
                  key: 'reassignment',
                  label: t('evaluation.assignment.reassignmentRequested'),
                  value:
                    detail.reassignmentRequestedAt === null
                      ? null
                      : formatDateTime(detail.reassignmentRequestedAt, timeZone),
                },
              ]}
            />
          </Card>
          <Card title={t('evaluation.assignment.declarationsTitle')}>
            <div className="tiq-stack">
              <DetailList
                items={[
                  {
                    key: 'undertaking',
                    label: t('evaluation.assignment.undertaking'),
                    value:
                      detail.confidentialityUndertaking === null ? (
                        <Chip tone="warning" size="sm" icon="alertTriangle">
                          {t('evaluation.assignments.undertakingMissing')}
                        </Chip>
                      ) : (
                        t('evaluation.assignment.undertakingSignedAt', {
                          at: formatDateTime(
                            detail.confidentialityUndertaking.acceptedAt,
                            timeZone,
                          ),
                          version: detail.confidentialityUndertaking.textVersion,
                        })
                      ),
                  },
                ]}
              />
              <DeclarationDetails declaration={declaration} timeZone={timeZone} />
            </div>
          </Card>
          <Card title={t('evaluation.assignment.historyTitle')}>
            {detail.history.length === 0 ? (
              <EmptyState compact title={t('evaluation.assignment.noHistory')} />
            ) : (
              <Timeline
                label={t('evaluation.assignment.historyTitle')}
                items={detail.history.map((entry, index) => ({
                  id: index,
                  title: entry.event,
                  meta: `${formatDateTime(entry.at, timeZone)}${entry.actor === null ? '' : ` · ${entry.actor.fullName}`}`,
                  detail: entry.note ?? undefined,
                }))}
              />
            )}
          </Card>
        </div>
      </div>

      <ConfirmActionDialog
        open={dialog === 'accept'}
        title={t('evaluation.assignment.acceptConfirmTitle')}
        scope={scope}
        consequence={
          acceptDraft.hasConflict === 'yes'
            ? t('evaluation.assignment.acceptConsequenceConflict')
            : t('evaluation.assignment.acceptConsequence')
        }
        confirmLabel={t('evaluation.assignment.accept')}
        pending={accept.pending}
        error={withEvaluationMessage(accept.error)}
        onCancel={close}
        onConfirm={async () => {
          try {
            const next = await accept.mutate({
              params: { assignmentId: detail.assignmentId },
              body: {
                confidentialityAccepted: true,
                undertakingTextVersion: detail.undertakingText.textVersion,
                conflictDeclaration:
                  acceptDraft.hasConflict === 'yes'
                    ? {
                        hasConflict: true,
                        nature: acceptDraft.nature as (typeof CONFLICT_DECLARATIONS_NATURE)[number],
                        details: acceptDraft.details.trim(),
                      }
                    : { hasConflict: false },
              },
            });
            setAcceptDraft(EMPTY_ACCEPT);
            onUpdated(next);
            close();
            toast.show(t('evaluation.assignment.acceptedToast'), 'success');
          } catch {
            // The dialog and the form show the error.
          }
        }}
      />

      <ConfirmActionDialog
        open={dialog === 'declare'}
        title={t('evaluation.assignment.declareTitle')}
        scope={scope}
        consequence={t('evaluation.assignment.declareConsequence')}
        confirmLabel={t('evaluation.assignment.declare')}
        tone="danger"
        reason={{ label: t('evaluation.assignment.details'), required: true }}
        pending={declare.pending}
        error={withEvaluationMessage(declare.error, { details: 'reason' })}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          if (declareNature === '') return;
          try {
            const next = await declare.mutate({
              params: { assignmentId: detail.assignmentId },
              body: {
                nature: declareNature as (typeof CONFLICT_DECLARATIONS_NATURE)[number],
                details: reason,
              },
            });
            onUpdated(next);
            close();
            toast.show(t('evaluation.assignment.declaredToast'), 'success');
          } catch {
            // The dialog shows the error.
          }
        }}
      >
        <Select
          label={t('evaluation.assignment.nature')}
          required
          placeholder={t('evaluation.common.select')}
          value={declareNature}
          options={natureOptions()}
          onChange={setDeclareNature}
          error={declareNature === '' ? t('evaluation.assignment.natureRequired') : undefined}
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'request'}
        title={t('evaluation.assignment.requestTitle')}
        scope={scope}
        consequence={t('evaluation.assignment.requestConsequence', { name: detail.chair.fullName })}
        confirmLabel={t('evaluation.assignment.requestReassignment')}
        reason={{ label: t('evaluation.common.reason'), required: true }}
        pending={request.pending}
        error={withEvaluationMessage(request.error)}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          try {
            const result = await request.mutate({
              params: { assignmentId: detail.assignmentId },
              body: { reason },
            });
            setRequested(result);
            close();
          } catch {
            // The dialog shows the error.
          }
        }}
      />

      <ConfirmActionDialog
        open={dialog === 'review'}
        title={t('evaluation.assignment.reviewTitle')}
        scope={scope}
        consequence={t('evaluation.assignment.reviewConsequence')}
        confirmLabel={t('evaluation.assignment.reviewConfirm')}
        reason={{ label: t('evaluation.assignment.reviewNote'), required: true }}
        pending={review.pending}
        error={withEvaluationMessage(review.error, { reviewNote: 'reason' })}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          if (declaration === null || reviewDisposition === '') return;
          try {
            const next = await review.mutate({
              params: { declarationId: declaration.declarationId },
              body: {
                disposition: reviewDisposition as
                  'cleared' | 'mitigated' | 'recused' | 'reassigned',
                reviewNote: reason,
              },
            });
            setReviewed(next);
            close();
            toast.show(t('evaluation.assignment.reviewedToast'), 'success');
          } catch {
            // The dialog shows the error.
          }
        }}
      >
        {declaration !== null && (
          <DeclarationDetails declaration={declaration} timeZone={timeZone} />
        )}
        <Select
          label={t('evaluation.assignment.disposition')}
          required
          placeholder={t('evaluation.common.select')}
          value={reviewDisposition}
          options={(['cleared', 'mitigated', 'recused', 'reassigned'] as const).map((value) => ({
            value,
            label: tEnum('conflict_declarations.disposition', value),
          }))}
          onChange={setReviewDisposition}
          error={
            reviewDisposition === '' ? t('evaluation.assignment.dispositionRequired') : undefined
          }
        />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'reassign'}
        title={t('evaluation.assignment.reassignTitle')}
        scope={scope}
        consequence={t('evaluation.assignment.reassignConsequence')}
        confirmLabel={t('evaluation.assignment.reassign')}
        reason={{ label: t('evaluation.common.reason'), required: true }}
        pending={reassign.pending}
        error={withEvaluationMessage(reassign.error)}
        onCancel={close}
        onConfirm={async ({ reason }) => {
          const userId = Number(newEvaluator);
          if (!Number.isInteger(userId) || userId <= 0) return;
          try {
            const result = await reassign.mutate({
              params: { assignmentId: detail.assignmentId },
              body: { newEvaluatorUserId: userId, reason, outcome },
            });
            setReassigned(result);
            close();
            toast.show(t('evaluation.assignment.reassignedToast'), 'success');
          } catch {
            // The dialog shows the error.
          }
        }}
      >
        {candidates.error !== null ? (
          <Banner tone="error">
            <p>{evaluationErrorMessage(candidates.error)}</p>
          </Banner>
        ) : (
          <Select
            label={t('evaluation.assignment.newEvaluator')}
            required
            placeholder={
              candidates.data === undefined
                ? t('evaluation.common.loading')
                : t('evaluation.common.select')
            }
            value={newEvaluator}
            options={(candidates.data?.items ?? []).map((candidate) => ({
              value: String(candidate.userId),
              label: candidate.eligible
                ? t('evaluation.assignment.candidate', {
                    name: candidate.fullName,
                    capacity: candidate.capacity ?? '',
                    count: candidate.openAssignments,
                  })
                : t('evaluation.assignment.candidateIneligible', {
                    name: candidate.fullName,
                    reason: candidate.ineligibleReason ?? '',
                  }),
              disabled: !candidate.eligible,
            }))}
            onChange={setNewEvaluator}
            error={
              newEvaluator === '' ? t('evaluation.assignment.newEvaluatorRequired') : undefined
            }
          />
        )}
        <RadioGroup
          label={t('evaluation.assignment.outcome')}
          inline
          value={outcome}
          options={[
            { value: 'reassigned', label: tEnum('evaluation_assignments.status', 'reassigned') },
            { value: 'recused', label: tEnum('evaluation_assignments.status', 'recused') },
          ]}
          onChange={(value) => setOutcome(value === 'recused' ? 'recused' : 'reassigned')}
        />
      </ConfirmActionDialog>
    </div>
  );
}
