/**
 * BUY-04 Request and funding decision. Required information: requested authority, funding confirmation, review
 * comments, conditions and the approved version. Principal actions: approve, reject, return, or route to an
 * existing contract within delegation limits (FR-04, BR-06, BR-07, BR-10). Above the caller's authority the page
 * names the higher route and offers escalation instead of approval (AC-05).
 */
import { useState } from 'react';
import { useParams } from 'react-router';

import { requestEndpoints } from '@contracts/requests';
import type { RequestAction, RequestDecisionView, RequestDetail } from '@contracts/requests';
import type { ApprovalDecision, AuthorityCheck } from '@contracts/approvals';

import { useApiMutation, useApiQuery } from '../../../api/hooks';
import { useActiveTenant } from '../../../app/hooks';
import {
  Banner,
  Button,
  ButtonLink,
  Card,
  Chip,
  ConfirmActionDialog,
  DetailList,
  EmptyState,
  MoneyInput,
  OfficialDeadline,
  PageHeader,
  QueryView,
  RadioGroup,
  Reference,
  Select,
  StatusChip,
  TextArea,
  TextField,
  Timeline,
  formErrors,
  useToast,
} from '../../../components/ui';
import { formatDateTime, formatMoney } from '../../../lib/format';
import { t, tEnum } from '../../../lib/i18n';
import { RequestActionDialog } from '../components/RequestActionDialog';
import type { RequestDialogKind } from '../components/RequestActionDialog';
import { currencyFallback, decisionNextAction, explainError, requestPaths, rowOf } from '../lib';

type LocalDialog = 'decide' | 'escalate' | 'funding';

const SECONDARY_ACTIONS: readonly RequestAction[] = [
  'request_info',
  'assign',
  'split',
  'defer',
  'route_to_contract',
  'rescind',
  'reconsider',
  'close',
];

export default function RequestDecisionPage() {
  const { requestId } = useParams();
  const id = Number(requestId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader
          title={t('requests.detail.notFound')}
          back={{ to: requestPaths.register, label: t('requests.detail.back') }}
        />
        <EmptyState title={t('requests.detail.notFound')} />
      </div>
    );
  }
  return <DecisionLoader key={id} requestId={id} />;
}

function DecisionLoader({ requestId }: { readonly requestId: number }) {
  const query = useApiQuery(requestEndpoints.getRequestDecision, { params: { requestId } });
  const [result, setResult] = useState<RequestDecisionView | null>(null);
  return (
    <div className="tiq-page">
      {query.data === undefined && (
        <PageHeader
          title={t('requests.decision.title')}
          back={{ to: requestPaths.register, label: t('requests.detail.back') }}
        />
      )}
      <QueryView query={query}>
        {(data) => <DecisionWorkspace view={result ?? data} onChanged={setResult} />}
      </QueryView>
    </div>
  );
}

function authorityText(check: AuthorityCheck): string {
  if (check.basis === 'unlimited') {
    return t('requests.decision.authority.unlimited');
  }
  if (check.limit === null) {
    return t('requests.decision.authority.none');
  }
  return t('requests.decision.authority.limit', { limit: formatMoney(check.limit) });
}

function DecisionWorkspace({
  view,
  onChanged,
}: {
  readonly view: RequestDecisionView;
  readonly onChanged: (next: RequestDecisionView) => void;
}) {
  const toast = useToast();
  const tenant = useActiveTenant();
  const timeZone = tenant?.officialTimeZone ?? 'UTC';
  const [dialog, setDialog] = useState<LocalDialog | null>(null);
  const [requestDialog, setRequestDialog] = useState<RequestDialogKind | null>(null);
  const [comment, setComment] = useState('');
  const commentMutation = useApiMutation(requestEndpoints.commentOnRequest);
  const commentErrors = formErrors(commentMutation.error, ['text']);
  const request = view.request;
  const allowed = view.allowedActions;
  const authority = view.callerAuthority;
  const insufficient = authority !== null && !authority.sufficient;
  const blocked = view.segregation.blocked;

  const applyDetail = (message: string, detail: RequestDetail | null): void => {
    setRequestDialog(null);
    toast.show(message, 'success');
    if (detail !== null) {
      onChanged({ ...view, request: rowOf(detail), allowedActions: detail.allowedActions });
    }
  };
  const applyView = (message: string, next: RequestDecisionView): void => {
    setDialog(null);
    toast.show(message, 'success');
    onChanged(next);
  };

  const onComment = async (): Promise<void> => {
    if (comment.trim() === '') return;
    try {
      const created = await commentMutation.mutate({
        params: { requestId: request.id },
        body: { text: comment.trim() },
      });
      onChanged({ ...view, comments: [...view.comments, created] });
      setComment('');
      toast.show(t('requests.decision.comments.added'), 'success');
    } catch {
      // The mutation keeps the error; the field shows it.
    }
  };

  return (
    <>
      <PageHeader
        title={t('requests.decision.titleFor', { reference: request.reference })}
        subtitle={request.title}
        back={{ to: requestPaths.request(request.id), label: t('requests.decision.backToRequest') }}
        meta={
          <>
            <Reference value={request.reference} to={requestPaths.request(request.id)} />
            <StatusChip enum="procurement_requests.status" value={request.status} />
            <span>{t('requests.detail.revision', { revision: view.subjectRevision })}</span>
            <span>
              {t('requests.decision.requested')}: {formatMoney(view.requestedAuthority.amount)}
            </span>
            <span>
              {t('requests.common.nextAction')}: {decisionNextAction(view)}
            </span>
          </>
        }
        primaryAction={
          allowed.includes('decide') ? (
            <Button variant="primary" icon="gavel" onClick={() => setDialog('decide')}>
              {t('requests.decision.decide')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {allowed.includes('escalate') && insufficient && (
              <Button icon="arrowUp" onClick={() => setDialog('escalate')}>
                {t('requests.actions.escalate')}
              </Button>
            )}
            {allowed.includes('confirm_funding') && (
              <Button icon="wallet" onClick={() => setDialog('funding')}>
                {t('requests.actions.confirm_funding')}
              </Button>
            )}
            {SECONDARY_ACTIONS.filter((action) => allowed.includes(action)).map((action) => (
              <Button
                key={action}
                variant={action === 'rescind' || action === 'close' ? 'danger-soft' : 'secondary'}
                onClick={() => setRequestDialog(action as RequestDialogKind)}
              >
                {t(`requests.actions.${action}`)}
              </Button>
            ))}
          </>
        }
      />

      {insufficient && (
        <Banner tone="warning" title={t('requests.decision.exceededTitle')}>
          <p>
            {t('requests.decision.exceeded', {
              amount: formatMoney(view.requestedAuthority.amount),
              limit: authority.limit === null ? '' : formatMoney(authority.limit),
            })}
          </p>
          {view.eligibleApprovers.length > 0 && (
            <p>
              {t('requests.decision.higherRoute', {
                names: view.eligibleApprovers
                  .map((person) =>
                    person.capacity === null
                      ? person.fullName
                      : `${person.fullName} (${person.capacity})`,
                  )
                  .join(', '),
              })}
            </p>
          )}
        </Banner>
      )}
      {blocked && (
        <Banner tone="error" title={t('requests.decision.selfApprovalTitle')}>
          <p>{t('requests.decision.selfApproval')}</p>
        </Banner>
      )}
      {view.reapprovalRequired && view.materialChange !== null && (
        <Banner tone="warning" title={t('requests.detail.materialChangeTitle')}>
          <p>
            {t('requests.detail.materialChange', {
              approved: view.materialChange.approvedRevision,
              current: view.materialChange.currentRevision,
              fields: view.materialChange.changedFields
                .map((field) => t(`requests.fields.${field}`))
                .join(', '),
            })}
          </p>
        </Banner>
      )}
      {!view.funding.sufficientForApproval && allowed.includes('decide') && (
        <Banner tone="warning" title={t('requests.decision.fundingInsufficientTitle')}>
          <p>{t('requests.decision.fundingInsufficient')}</p>
        </Banner>
      )}

      <div className="tiq-grid tiq-grid--2">
        <Card
          title={t('requests.decision.sections.authority')}
          subtitle={view.requestedAuthority.explanation}
        >
          <DetailList
            items={[
              {
                label: t('requests.decision.decisionType'),
                value: tEnum(
                  'authority_limits.decision_type',
                  view.requestedAuthority.decisionType,
                ),
              },
              {
                label: t('requests.decision.requestedAmount'),
                value: formatMoney(view.requestedAuthority.amount),
              },
              {
                label: t('requests.decision.basis'),
                value: t(`requests.decision.basisValue.${view.requestedAuthority.basis}`),
              },
              {
                label: t('requests.decision.yourAuthority'),
                value:
                  authority === null ? (
                    t('requests.decision.authority.notDecider')
                  ) : (
                    <div className="tiq-stack">
                      <span>{authorityText(authority)}</span>
                      <div>
                        <Chip tone={authority.sufficient ? 'success' : 'danger'} size="sm">
                          {authority.sufficient
                            ? t('requests.decision.authority.sufficient')
                            : t('requests.decision.authority.insufficient')}
                        </Chip>
                      </div>
                      {authority.delegatedFrom !== null && (
                        <span className="tiq-cell-sub">
                          {t('requests.decision.authority.delegated', {
                            name: authority.delegatedFrom.fullName,
                          })}
                        </span>
                      )}
                    </div>
                  ),
              },
            ]}
          />
        </Card>

        <Card title={t('requests.decision.sections.route')}>
          <DetailList
            items={[
              {
                label: t('requests.decision.route.status'),
                value:
                  view.route.status === null ? (
                    t('requests.decision.route.notRequested')
                  ) : (
                    <StatusChip enum="approval_requests.status" value={view.route.status} />
                  ),
              },
              {
                label: t('requests.decision.route.currentApprover'),
                value: view.route.currentApprover?.fullName,
              },
              {
                label: t('requests.decision.route.requestedAt'),
                value:
                  view.route.requestedAt === null
                    ? null
                    : formatDateTime(view.route.requestedAt, timeZone),
              },
              {
                label: t('requests.decision.route.dueAt'),
                value:
                  view.route.dueAt === null ? null : (
                    <OfficialDeadline
                      deadline={{ at: view.route.dueAt, timeZone }}
                      variant="inline"
                    />
                  ),
              },
            ]}
          />
          {view.routedToNextLevel && view.skippedLevel !== null && (
            <p className="tiq-text-warning">
              {t('requests.decision.route.skipped', {
                name: view.skippedLevel.fullName,
                limit: authorityText(view.skippedLevel.check),
              })}
            </p>
          )}
          <ul className="tiq-stack" aria-label={t('requests.decision.route.eligible')}>
            {view.eligibleApprovers.map((person) => (
              <li key={person.userId}>
                <strong>{person.fullName}</strong>
                {person.capacity !== null && ` · ${person.capacity}`}
                <div className="tiq-cell-sub">{authorityText(person.check)}</div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t('requests.decision.sections.funding')}>
          <DetailList
            items={[
              {
                label: t('requests.fields.fundingStatus'),
                value: (
                  <div className="tiq-stack">
                    <StatusChip
                      enum="procurement_requests.funding_status"
                      value={view.funding.status}
                    />
                    <span className="tiq-cell-sub">
                      {t(`requests.funding.explain.${view.funding.status}`)}
                    </span>
                  </div>
                ),
              },
              {
                label: t('requests.fields.fundingSourceId'),
                value:
                  view.funding.fundingSource === null
                    ? null
                    : `${view.funding.fundingSource.code} ${view.funding.fundingSource.name}`,
              },
              {
                label: t('requests.fields.budgetOwnerUserId'),
                value: view.funding.budgetOwner?.fullName,
              },
              {
                label: t('requests.decision.funding.amount'),
                value: formatMoney(view.funding.confirmedAmount),
              },
              {
                label: t('requests.decision.funding.confirmedBy'),
                value:
                  view.funding.confirmedBy === null
                    ? null
                    : `${view.funding.confirmedBy.fullName}${
                        view.funding.confirmedAt === null
                          ? ''
                          : ` · ${formatDateTime(view.funding.confirmedAt, timeZone)}`
                      }`,
              },
              {
                label: t('requests.fields.accountingReference'),
                value: view.funding.accountingReference,
              },
              { label: t('requests.decision.funding.note'), value: view.funding.note },
              {
                label: t('requests.decision.funding.sufficient'),
                value: (
                  <Chip tone={view.funding.sufficientForApproval ? 'success' : 'warning'} size="sm">
                    {view.funding.sufficientForApproval
                      ? t('requests.decision.funding.yes')
                      : t('requests.decision.funding.no')}
                  </Chip>
                ),
              },
            ]}
          />
        </Card>

        <Card title={t('requests.decision.sections.approved')}>
          {view.approvedVersion === null ? (
            <EmptyState compact title={t('requests.decision.approved.none')} />
          ) : (
            <DetailList
              items={[
                {
                  label: t('requests.decision.approved.revision'),
                  value: t('requests.detail.revision', { revision: view.approvedVersion.revision }),
                },
                {
                  label: t('requests.decision.approved.by'),
                  value: `${view.approvedVersion.approvedBy.fullName} · ${formatDateTime(view.approvedVersion.approvedAt, timeZone)}`,
                },
                {
                  label: t('requests.decision.approved.value'),
                  value: formatMoney(view.approvedVersion.approvedValue),
                },
                {
                  label: t('requests.decision.conditions'),
                  value: view.approvedVersion.conditions,
                },
                {
                  label: t('requests.decision.approved.hash'),
                  value: (
                    <span className="tiq-mono">
                      {view.approvedVersion.contentHash.slice(0, 16)}
                    </span>
                  ),
                },
              ]}
            />
          )}
          {view.conditions !== null && view.approvedVersion === null && (
            <p>
              {t('requests.decision.conditions')}: {view.conditions}
            </p>
          )}
        </Card>

        <Card title={t('requests.decision.sections.comments')}>
          {view.comments.length === 0 ? (
            <EmptyState compact title={t('requests.decision.comments.none')} />
          ) : (
            <Timeline
              label={t('requests.decision.sections.comments')}
              items={view.comments.map((item) => ({
                id: item.id,
                title: item.text,
                icon: 'messageSquare',
                meta: `${item.author.fullName}${item.author.capacity === null || item.author.capacity === undefined ? '' : ` (${item.author.capacity})`} · ${t(`requests.decision.comments.kind.${item.kind}`)} · ${formatDateTime(item.createdAt, timeZone)}`,
              }))}
            />
          )}
          {allowed.includes('comment') && (
            <div className="tiq-stack">
              <TextArea
                label={t('requests.decision.comments.add')}
                rows={3}
                value={comment}
                onChange={setComment}
                error={
                  commentErrors.forField('text') ??
                  explainError(commentMutation.error)?.detail ??
                  undefined
                }
              />
              <div className="tiq-inline">
                <Button
                  icon="send"
                  loading={commentMutation.pending}
                  disabled={comment.trim() === ''}
                  onClick={() => void onComment()}
                >
                  {t('requests.decision.comments.post')}
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card title={t('requests.decision.sections.history')}>
          {view.history.length === 0 ? (
            <EmptyState compact title={t('requests.decision.history.none')} />
          ) : (
            <Timeline
              label={t('requests.decision.sections.history')}
              items={view.history.map((entry) => ({
                id: entry.id,
                title: t(`requests.decision.history.${entry.decision}`),
                tone:
                  entry.decision === 'approve' || entry.decision === 'approve_with_conditions'
                    ? 'success'
                    : entry.decision === 'reject' || entry.decision === 'rescind'
                      ? 'danger'
                      : 'info',
                meta: `${entry.decidedBy.fullName} · ${formatDateTime(entry.decidedAt, timeZone)} · ${t('requests.detail.revision', { revision: entry.revision })}`,
                detail: entry.reason,
              }))}
            />
          )}
        </Card>
      </div>

      <div className="tiq-inline">
        <ButtonLink to={requestPaths.request(request.id)} icon="fileText">
          {t('requests.decision.viewBusinessCase')}
        </ButtonLink>
      </div>

      {dialog === 'decide' && (
        <DecideDialog
          view={view}
          onClose={() => setDialog(null)}
          onDone={(next, decision) =>
            applyView(
              t(`requests.decision.done.${decision}`, { reference: request.reference }),
              next,
            )
          }
        />
      )}
      {dialog === 'escalate' && (
        <EscalateDialog
          view={view}
          onClose={() => setDialog(null)}
          onDone={(next) =>
            applyView(t('requests.decision.escalated', { reference: request.reference }), next)
          }
        />
      )}
      {dialog === 'funding' && (
        <FundingDialog
          view={view}
          onClose={() => setDialog(null)}
          onDone={(next) =>
            applyView(t('requests.decision.funding.done', { reference: request.reference }), next)
          }
        />
      )}
      {requestDialog !== null && (
        <RequestActionDialog
          kind={requestDialog}
          request={{ ...request, revision: view.subjectRevision }}
          onClose={() => setRequestDialog(null)}
          onDone={applyDetail}
        />
      )}
    </>
  );
}

function DecideDialog({
  view,
  onClose,
  onDone,
}: {
  readonly view: RequestDecisionView;
  readonly onClose: () => void;
  readonly onDone: (next: RequestDecisionView, decision: ApprovalDecision) => void;
}) {
  const decide = useApiMutation(requestEndpoints.decideRequest);
  const insufficient = view.callerAuthority !== null && !view.callerAuthority.sufficient;
  const approveBlocked =
    insufficient || view.segregation.blocked || !view.funding.sufficientForApproval;
  const [decision, setDecision] = useState<ApprovalDecision>(approveBlocked ? 'return' : 'approve');
  const [conditions, setConditions] = useState('');
  const [tried, setTried] = useState(false);
  const errors = formErrors(decide.error, ['decision', 'conditions', 'reason', 'subjectRevision']);
  const conditionsMissing = decision === 'approve_with_conditions' && conditions.trim() === '';
  const approving = decision === 'approve' || decision === 'approve_with_conditions';
  return (
    <ConfirmActionDialog
      open
      tone={decision === 'reject' ? 'danger' : 'primary'}
      title={t('requests.decision.dialog.title', { reference: view.request.reference })}
      scope={t('requests.decision.dialog.scope', {
        reference: view.request.reference,
        revision: view.subjectRevision,
        amount: formatMoney(view.requestedAuthority.amount),
      })}
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
            params: { requestId: view.request.id },
            body: {
              decision,
              reason,
              conditions: decision === 'approve_with_conditions' ? conditions.trim() : null,
              subjectRevision: view.subjectRevision,
            },
          });
          onDone(next, decision);
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
        options={DECISIONS.map((value) => {
          const isApproval = value === 'approve' || value === 'approve_with_conditions';
          return {
            value,
            label: t(`requests.decision.dialog.option.${value}`),
            disabled: isApproval && approveBlocked,
            hint: isApproval && approveBlocked ? approveBlockReason(view) : undefined,
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
      {approving && approveBlocked && (
        <Banner tone="error" title={t('requests.decision.dialog.cannotApprove')} />
      )}
    </ConfirmActionDialog>
  );
}

const DECISIONS: readonly ApprovalDecision[] = [
  'approve',
  'approve_with_conditions',
  'return',
  'reject',
];

/** Why approval is not offered (AC-05 authority, BR-07 segregation, FR-04 funding). */
function approveBlockReason(view: RequestDecisionView): string {
  if (view.segregation.blocked) {
    return t('requests.decision.selfApproval');
  }
  if (view.callerAuthority !== null && !view.callerAuthority.sufficient) {
    return t('requests.errors.AUTHORITY_EXCEEDED');
  }
  return t('requests.errors.FUNDING_NOT_CONFIRMED');
}

function EscalateDialog({
  view,
  onClose,
  onDone,
}: {
  readonly view: RequestDecisionView;
  readonly onClose: () => void;
  readonly onDone: (next: RequestDecisionView) => void;
}) {
  const escalate = useApiMutation(requestEndpoints.escalateRequest);
  const target = view.eligibleApprovers[0];
  return (
    <ConfirmActionDialog
      open
      title={t('requests.decision.escalateTitle', { reference: view.request.reference })}
      scope={t('requests.decision.dialog.scope', {
        reference: view.request.reference,
        revision: view.subjectRevision,
        amount: formatMoney(view.requestedAuthority.amount),
      })}
      consequence={
        target === undefined
          ? t('requests.decision.escalateConsequenceNone')
          : t('requests.decision.escalateConsequence', {
              name: target.fullName,
              limit: authorityText(target.check),
            })
      }
      confirmLabel={t('requests.actions.escalate')}
      reason={{ label: t('requests.dialogs.reason'), required: true }}
      pending={escalate.pending}
      error={explainError(escalate.error)}
      onCancel={onClose}
      onConfirm={async ({ reason }) => {
        try {
          onDone(
            await escalate.mutate({ params: { requestId: view.request.id }, body: { reason } }),
          );
        } catch {
          // The dialog shows the error.
        }
      }}
    />
  );
}

type FundingLevel = 'indicative' | 'approved_budget' | 'firm_commitment';

function FundingDialog({
  view,
  onClose,
  onDone,
}: {
  readonly view: RequestDecisionView;
  readonly onClose: () => void;
  readonly onDone: (next: RequestDecisionView) => void;
}) {
  const options = useApiQuery(requestEndpoints.getRequestOptions, {});
  const confirm = useApiMutation(requestEndpoints.confirmFunding);
  const tenant = useActiveTenant();
  const estimate = view.request.estimatedValue;
  const currency = currencyFallback(
    estimate?.currency,
    view.requestedAuthority.amount?.currency,
    tenant?.defaultCurrency,
    options.data?.currencies[0],
  );
  const [level, setLevel] = useState<FundingLevel>(
    view.funding.status === 'firm_commitment' ? 'firm_commitment' : 'approved_budget',
  );
  const [source, setSource] = useState(
    view.funding.fundingSource === null ? '' : String(view.funding.fundingSource.id),
  );
  const [amount, setAmount] = useState(
    view.funding.confirmedAmount?.amount ?? estimate?.amount ?? '',
  );
  const [reference, setReference] = useState(view.funding.accountingReference ?? '');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const errors = formErrors(confirm.error, [
    'fundingStatus',
    'fundingSourceId',
    'confirmedAmount',
    'accountingReference',
    'note',
  ]);
  const sourceMissing = source === '';
  const amountMissing = amount === '';
  return (
    <ConfirmActionDialog
      open
      title={t('requests.decision.funding.title', { reference: view.request.reference })}
      scope={t('requests.decision.dialog.scope', {
        reference: view.request.reference,
        revision: view.subjectRevision,
        amount: formatMoney(estimate),
      })}
      consequence={t(`requests.decision.funding.consequence.${level}`)}
      confirmLabel={t('requests.decision.funding.confirm')}
      pending={confirm.pending}
      error={explainError(confirm.error)}
      onCancel={onClose}
      onConfirm={async () => {
        setTried(true);
        if (sourceMissing || amountMissing) return;
        try {
          onDone(
            await confirm.mutate({
              params: { requestId: view.request.id },
              body: {
                fundingStatus: level,
                fundingSourceId: Number(source),
                confirmedAmount: { amount, currency },
                accountingReference: reference.trim() === '' ? null : reference.trim(),
                note: note.trim() === '' ? null : note.trim(),
                subjectRevision: view.subjectRevision,
              },
            }),
          );
        } catch {
          // The dialog shows the error.
        }
      }}
    >
      <RadioGroup
        label={t('requests.fields.fundingStatus')}
        required
        value={level}
        onChange={(value) => setLevel(value as FundingLevel)}
        error={errors.forField('fundingStatus')}
        options={(['indicative', 'approved_budget', 'firm_commitment'] as const).map((value) => ({
          value,
          label: tEnum('procurement_requests.funding_status', value),
          hint: t(`requests.funding.explain.${value}`),
        }))}
      />
      <Select
        label={t('requests.fields.fundingSourceId')}
        required
        value={source}
        onChange={setSource}
        placeholder={t('requests.common.select')}
        options={(options.data?.fundingSources ?? []).map((item) => ({
          value: String(item.id),
          label: `${item.code} ${item.name}`,
        }))}
        error={
          errors.forField('fundingSourceId') ??
          (tried && sourceMissing ? t('requests.decision.funding.sourceRequired') : undefined)
        }
      />
      <MoneyInput
        label={t('requests.decision.funding.amount')}
        required
        currencies={[currency]}
        value={{ amount, currency }}
        onChange={(value) => setAmount(value.amount)}
        error={
          errors.forField('confirmedAmount') ??
          (tried && amountMissing ? t('requests.decision.funding.amountRequired') : undefined)
        }
      />
      <TextField
        label={t('requests.fields.accountingReference')}
        value={reference}
        onChange={setReference}
        error={errors.forField('accountingReference')}
      />
      <TextArea
        label={t('requests.decision.funding.note')}
        rows={2}
        value={note}
        onChange={setNote}
        error={errors.forField('note')}
      />
    </ConfirmActionDialog>
  );
}
