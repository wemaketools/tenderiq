/**
 * BUY-17 Addenda and date changes, one addendum: the proposed change, affected requirements (before and after) and
 * lots, materiality, response-time assessment, revised dates, the action required of existing submissions, approval,
 * issue, recipients and acknowledgments (BR-13, BR-14, BR-16, BR-41; AC-10: prior receipts stay intact).
 */
import { useState } from 'react';
import { useLocation, useParams } from 'react-router';

import {
  ADDENDUM_BLOCKING_ISSUES,
  BuyerAddendumDetail,
  clarificationsEndpoints,
} from '@contracts/clarifications';
import type {
  AddendumBlockingIssue,
  AddendumRecipient,
  BuyerTenderContext,
} from '@contracts/clarifications';

import { useApiMutation, useApiQuery } from '../../../../api/hooks';
import { usePermission } from '../../../../auth/permissions';
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
  PageHeader,
  QueryView,
  ReadinessChecklist,
  Reference,
  StatusChip,
  useToast,
} from '../../../../components/ui';
import type { ReadinessItem } from '../../../../components/ui';
import { EMPTY_VALUE, formatDateTime } from '../../../../lib/format';
import { t } from '../../../../lib/i18n';
import {
  ChangeAreaChips,
  ClarificationHistory,
  RequirementChangesTable,
} from '../../components/shared';
import {
  QUESTION_PERMISSION,
  addendumNextAction,
  buyerPaths,
  explainError,
  lotsLabel,
} from '../../lib';

type DialogKind = 'submit' | 'issue' | 'withdraw' | 'remind';

const SUBMIT_BLOCKERS: readonly string[] = [
  'RESPONSE_TIME_ASSESSMENT_REQUIRED',
  'CHANGE_AREA_REQUIRED',
  'AFFECTED_LOTS_REQUIRED',
  'NEW_DEADLINE_IN_PAST',
];

export default function AddendumPage() {
  const { addendumId } = useParams();
  const id = Number(addendumId);
  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="tiq-page">
        <PageHeader title={t('clarifications.addendumPage.notFound')} />
        <EmptyState title={t('clarifications.addendumPage.notFound')} />
      </div>
    );
  }
  return <AddendumLoader key={id} addendumId={id} />;
}

function AddendumLoader({ addendumId }: { readonly addendumId: number }) {
  const location = useLocation();
  // A draft just saved by the form arrives in the navigation state (the prototype does not persist it).
  const carried = BuyerAddendumDetail.safeParse(
    (location.state as { addendum?: unknown } | null)?.addendum,
  );
  const initial = carried.success && carried.data.id === addendumId ? carried.data : null;
  const query = useApiQuery(
    clarificationsEndpoints.addendaGet,
    initial === null ? { params: { addendumId } } : null,
  );
  const [result, setResult] = useState<BuyerAddendumDetail | null>(null);
  const current = result ?? initial;
  return (
    <div className="tiq-page">
      {current !== null ? (
        <AddendumWorkspace addendum={current} onChanged={setResult} />
      ) : (
        <>
          {query.data === undefined && (
            <PageHeader
              title={t('clarifications.addenda.title')}
              back={{ to: buyerPaths.addenda, label: t('clarifications.addendumPage.back') }}
            />
          )}
          <QueryView query={query}>
            {(data) => <AddendumWorkspace addendum={data} onChanged={setResult} />}
          </QueryView>
        </>
      )}
    </div>
  );
}

/** The truthful "passed" wording of a check that does not block (BUY-17 readiness). */
function passedDetail(code: AddendumBlockingIssue, addendum: BuyerAddendumDetail): string {
  const anyArea =
    addendum.changesScope ||
    addendum.changesTerms ||
    addendum.changesSubmission ||
    addendum.changesEvaluation;
  switch (code) {
    case 'RESPONSE_TIME_ASSESSMENT_REQUIRED':
      return addendum.responseTimeAssessment !== null
        ? t('clarifications.readiness.RESPONSE_TIME_ASSESSMENT_REQUIRED.passed')
        : t('clarifications.readiness.RESPONSE_TIME_ASSESSMENT_REQUIRED.notRequired');
    case 'CHANGE_AREA_REQUIRED':
      return anyArea
        ? t('clarifications.readiness.CHANGE_AREA_REQUIRED.passed')
        : t('clarifications.readiness.CHANGE_AREA_REQUIRED.notRequired');
    case 'AFFECTED_LOTS_REQUIRED':
      return addendum.affectedLots.length > 0
        ? t('clarifications.readiness.AFFECTED_LOTS_REQUIRED.passed')
        : t('clarifications.readiness.AFFECTED_LOTS_REQUIRED.wholeTender');
    case 'NEW_DEADLINE_IN_PAST':
      return addendum.newSubmissionDeadline !== null
        ? t('clarifications.readiness.NEW_DEADLINE_IN_PAST.passed')
        : t('clarifications.readiness.NEW_DEADLINE_IN_PAST.noChange');
    default:
      return t(`clarifications.readiness.${code}.passed`);
  }
}

/** One approval row: pending, required or given (never two contradicting rows). */
function approvalReadiness(addendum: BuyerAddendumDetail): ReadinessItem {
  const label = t('clarifications.readiness.approval.label');
  if (addendum.blockingIssues.includes('APPROVAL_PENDING')) {
    return {
      id: 'approval',
      label,
      detail: t('clarifications.readiness.APPROVAL_PENDING.blocking'),
      status: 'blocking',
    };
  }
  if (addendum.blockingIssues.includes('APPROVAL_REQUIRED')) {
    return {
      id: 'approval',
      label,
      detail: t('clarifications.readiness.APPROVAL_REQUIRED.blocking'),
      status: 'blocking',
    };
  }
  return {
    id: 'approval',
    label,
    detail:
      addendum.status === 'withdrawn'
        ? t('clarifications.readiness.approval.withdrawn')
        : t('clarifications.readiness.approval.approved'),
    status: 'passed',
  };
}

function readinessOf(
  addendum: BuyerAddendumDetail,
  context: BuyerTenderContext | undefined,
): ReadinessItem[] {
  const items: ReadinessItem[] = ADDENDUM_BLOCKING_ISSUES.filter(
    (code) => code !== 'APPROVAL_PENDING' && code !== 'APPROVAL_REQUIRED',
  ).map((code) => ({
    id: code,
    label: t(`clarifications.readiness.${code}.label`),
    detail: addendum.blockingIssues.includes(code)
      ? t(`clarifications.readiness.${code}.blocking`)
      : passedDetail(code, addendum),
    status: addendum.blockingIssues.includes(code) ? 'blocking' : 'passed',
  }));
  items.push(approvalReadiness(addendum));
  const withSubmissions =
    context?.participants.filter((participant) => participant.hasEffectiveSubmission).length ?? 0;
  if (
    addendum.materiality === 'material' &&
    addendum.existingSubmissionAction === 'none' &&
    withSubmissions > 0
  ) {
    items.push({
      id: 'existing',
      label: t('clarifications.readiness.existing.label'),
      detail: t('clarifications.readiness.existing.warning', { count: withSubmissions }),
      status: 'warning',
    });
  }
  if (addendum.materiality === 'material' && addendum.newSubmissionDeadline === null) {
    items.push({
      id: 'deadline',
      label: t('clarifications.readiness.deadline.label'),
      detail: t('clarifications.readiness.deadline.warning'),
      status: 'warning',
    });
  }
  return items;
}

function AddendumWorkspace({
  addendum,
  onChanged,
}: {
  readonly addendum: BuyerAddendumDetail;
  readonly onChanged: (next: BuyerAddendumDetail) => void;
}) {
  const toast = useToast();
  const e = clarificationsEndpoints;
  const canManage = usePermission(QUESTION_PERMISSION);
  const canIssue = usePermission('tender.publish');
  const canApprove = usePermission('tender.addenda.approve');
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const context = useApiQuery(e.buyerTenderContext, {
    params: { tenderId: addendum.tender.tenderId },
  });
  const submit = useApiMutation(e.addendaSubmit);
  const issue = useApiMutation(e.addendaIssue);
  const withdraw = useApiMutation(e.addendaWithdraw);
  const remind = useApiMutation(e.addendaRemind);

  const tz =
    context.data?.officialTimeZone ?? addendum.currentSubmissionDeadline?.timeZone ?? 'UTC';
  const readiness = readinessOf(addendum, context.data);
  const submitBlocked = addendum.blockingIssues.some((code) => SUBMIT_BLOCKERS.includes(code));
  const lotLabel = (lotId: number | null): string => {
    if (lotId === null) return t('clarifications.common.allLots');
    const lot = context.data?.lots.find((item) => item.lotId === lotId);
    return lot === undefined
      ? t('clarifications.common.lotShort', { no: lotId })
      : t('clarifications.common.lotLabel', { no: lot.lotNo, title: lot.title });
  };
  const scope = t('clarifications.addendumPage.scope', {
    no: addendum.number,
    reference: addendum.tender.reference,
    title: addendum.title,
  });
  const outstanding = addendum.acknowledgments?.actionOutstanding ?? 0;
  const eligibleRecipients = context.data?.participants ?? [];

  const done = (next: BuyerAddendumDetail, message: string): void => {
    onChanged(next);
    setDialog(null);
    toast.show(message, 'success');
  };
  const close = (reset: () => void) => () => {
    reset();
    setDialog(null);
  };
  const attempt = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } catch {
      // The mutation keeps the error; the dialog shows it.
    }
  };

  const editable = addendum.status === 'draft';
  const withdrawable = addendum.status !== 'issued' && addendum.status !== 'withdrawn';

  return (
    <>
      <PageHeader
        title={t('clarifications.addendumPage.title', {
          no: addendum.number,
          reference: addendum.tender.reference,
        })}
        subtitle={addendum.title}
        back={{ to: buyerPaths.addenda, label: t('clarifications.addendumPage.back') }}
        meta={
          <>
            <Reference value={addendum.tender.reference} />
            <StatusChip enum="addenda.status" value={addendum.status} />
            <StatusChip enum="addenda.materiality" value={addendum.materiality} />
            {addendum.newSubmissionDeadline !== null && (
              <OfficialDeadline
                variant="block"
                label={t('clarifications.addendumPage.newDeadline')}
                deadline={addendum.newSubmissionDeadline}
              />
            )}
            <span>
              <strong>{t('clarifications.common.nextAction')}:</strong>{' '}
              {addendumNextAction(addendum)}
            </span>
          </>
        }
        primaryAction={
          addendum.status === 'approved' && canIssue ? (
            <Button variant="primary" icon="send" onClick={() => setDialog('issue')}>
              {t('clarifications.addendumPage.action.issue')}
            </Button>
          ) : editable && canManage ? (
            <Button
              variant="primary"
              icon="send"
              disabled={submitBlocked}
              onClick={() => setDialog('submit')}
            >
              {t('clarifications.addendumPage.action.submit')}
            </Button>
          ) : undefined
        }
        actions={
          <>
            {editable && canManage && (
              <ButtonLink icon="edit" to={buyerPaths.editAddendum(addendum.id)}>
                {t('clarifications.addendumPage.action.edit')}
              </ButtonLink>
            )}
            {addendum.approvalRequestId !== null && canApprove && (
              <ButtonLink icon="checkSquare" to={`/me/approvals/${addendum.approvalRequestId}`}>
                {t('clarifications.addendumPage.action.openApproval')}
              </ButtonLink>
            )}
            {addendum.status === 'issued' && canManage && outstanding > 0 && (
              <Button icon="bell" onClick={() => setDialog('remind')}>
                {t('clarifications.addendumPage.action.remind')}
              </Button>
            )}
            {withdrawable && canManage && (
              <Button variant="danger-soft" icon="ban" onClick={() => setDialog('withdraw')}>
                {t('clarifications.addendumPage.action.withdraw')}
              </Button>
            )}
          </>
        }
      />

      {addendum.status === 'issued' && (
        <Banner tone="success" title={t('clarifications.addendumPage.issuedBanner')}>
          <p>
            {t('clarifications.addendumPage.issuedDetail', {
              at: formatDateTime(addendum.issuedAt, tz),
              version: addendum.resultingVersionNo ?? EMPTY_VALUE,
            })}
          </p>
        </Banner>
      )}
      {addendum.status === 'withdrawn' && (
        <Banner tone="warning" title={t('clarifications.addendumPage.withdrawnBanner')}>
          <p>{addendum.withdrawnReason}</p>
        </Banner>
      )}
      {addendum.status === 'awaiting_approval' && (
        <Banner tone="info" title={t('clarifications.addendumPage.awaitingBanner')}>
          <p>{t('clarifications.addendumPage.awaitingDetail')}</p>
        </Banner>
      )}

      <div className="tiq-grid tiq-grid--sidebar">
        <div className="tiq-stack tiq-stack--spaced">
          <Card title={t('clarifications.addendumPage.changeCard')}>
            <div className="tiq-stack">
              <p>{addendum.changeDescription}</p>
              <DetailList
                items={[
                  {
                    key: 'reason',
                    label: t('clarifications.addendumPage.reason'),
                    value: addendum.reason,
                  },
                  {
                    key: 'areas',
                    label: t('clarifications.addendumPage.changeAreas'),
                    value: <ChangeAreaChips areas={addendum} />,
                  },
                  {
                    key: 'lots',
                    label: t('clarifications.addendumPage.affectedLots'),
                    value: lotsLabel(addendum.affectedLots),
                  },
                  {
                    key: 'materiality',
                    label: t('clarifications.addendumPage.materiality'),
                    value: (
                      <StatusChip
                        enum="addenda.materiality"
                        value={addendum.materiality}
                        size="sm"
                      />
                    ),
                  },
                ]}
              />
            </div>
          </Card>

          <Card flush title={t('clarifications.addendumPage.requirementChanges')}>
            <RequirementChangesTable changes={addendum.requirementChanges} lotLabel={lotLabel} />
          </Card>

          <Card title={t('clarifications.addendumPage.datesCard')}>
            <DetailList
              items={[
                {
                  key: 'current',
                  // Once issued, the addendum's new deadline is in force and the old one is history.
                  label:
                    addendum.status === 'issued'
                      ? t('clarifications.addendumPage.previousDeadline')
                      : t('clarifications.addendumPage.currentDeadline'),
                  value:
                    addendum.currentSubmissionDeadline === null ? null : (
                      <OfficialDeadline deadline={addendum.currentSubmissionDeadline} />
                    ),
                },
                {
                  key: 'new',
                  label: t('clarifications.addendumPage.newDeadline'),
                  value:
                    addendum.newSubmissionDeadline === null ? (
                      t('clarifications.addenda.noDateChange')
                    ) : (
                      <OfficialDeadline deadline={addendum.newSubmissionDeadline} />
                    ),
                },
                {
                  key: 'assessment',
                  label: t('clarifications.addendumPage.responseTime'),
                  value: addendum.responseTimeAssessment,
                },
                {
                  key: 'existing',
                  label: t('clarifications.addendumPage.existingAction'),
                  value: (
                    <div className="tiq-stack">
                      <StatusChip
                        enum="addenda.existing_submission_action"
                        value={addendum.existingSubmissionAction}
                        size="sm"
                      />
                      <span>
                        {t(`clarifications.existingAction.${addendum.existingSubmissionAction}`)}
                      </span>
                      <span className="tiq-text-muted">
                        {t('clarifications.addendumPage.receiptsIntact')}
                      </span>
                    </div>
                  ),
                },
              ]}
            />
          </Card>

          <Card
            flush
            title={t('clarifications.addendumPage.recipients')}
            subtitle={
              addendum.acknowledgments === null
                ? t('clarifications.addendumPage.recipientsPending', {
                    count: eligibleRecipients.length,
                  })
                : t('clarifications.addendumPage.tally', {
                    recipients: addendum.acknowledgments.recipients,
                    delivered: addendum.acknowledgments.delivered,
                    failed: addendum.acknowledgments.failed,
                    acknowledged: addendum.acknowledgments.acknowledged,
                    outstanding: addendum.acknowledgments.actionOutstanding,
                  })
            }
          >
            <RecipientsTable recipients={addendum.recipients} timeZone={tz} />
          </Card>

          {addendum.sourceQuestions.length > 0 && (
            <Card title={t('clarifications.addendumPage.sourceQuestions')}>
              <ul className="tiq-stack">
                {addendum.sourceQuestions.map((source) => (
                  <li key={source.questionId}>
                    <Reference
                      value={`Q-${source.questionId}`}
                      to={buyerPaths.question(source.questionId)}
                    />{' '}
                    {source.questionText}
                    <div className="tiq-cell-sub">{source.supplier.name}</div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="tiq-stack tiq-stack--spaced">
          <Card title={t('clarifications.addendumPage.readiness')}>
            <ReadinessChecklist
              label={t('clarifications.addendumPage.readiness')}
              items={readiness}
            />
          </Card>
          <Card title={t('clarifications.addendumPage.approval')}>
            <DetailList
              stacked
              items={[
                {
                  key: 'status',
                  label: t('clarifications.addenda.col.approval'),
                  value:
                    addendum.approvalStatus === null ? (
                      t('clarifications.addenda.notRequested')
                    ) : (
                      <StatusChip enum="approval_requests.status" value={addendum.approvalStatus} />
                    ),
                },
                {
                  key: 'created',
                  label: t('clarifications.addendumPage.createdBy'),
                  value: `${addendum.createdBy.fullName} · ${formatDateTime(addendum.createdAt, tz)}`,
                },
                {
                  key: 'notice',
                  label: t('clarifications.addendumPage.notice'),
                  value:
                    addendum.notice === null ? null : (
                      <span className="tiq-inline">
                        {addendum.notice.title}
                        {addendum.notice.requiresAcknowledgment && (
                          <Chip tone="warning" size="sm">
                            {t('clarifications.addendumPage.ackRequired')}
                          </Chip>
                        )}
                      </span>
                    ),
                },
              ]}
            />
          </Card>
          <Card title={t('clarifications.history.title')}>
            <ClarificationHistory entries={addendum.history} timeZone={tz} />
          </Card>
        </div>
      </div>

      <ConfirmActionDialog
        open={dialog === 'submit'}
        title={t('clarifications.addendumPage.submitDialog.title')}
        scope={scope}
        consequence={t('clarifications.addendumPage.submitDialog.consequence')}
        confirmLabel={t('clarifications.addendumPage.action.submit')}
        pending={submit.pending}
        error={explainError(submit.error)}
        reason={{ label: t('clarifications.common.note'), required: false }}
        onCancel={close(submit.reset)}
        onConfirm={({ reason }) =>
          attempt(async () => {
            const next = await submit.mutate({
              params: { addendumId: addendum.id },
              body: reason === '' ? {} : { note: reason },
            });
            done(next, t('clarifications.addendumPage.toast.submitted'));
          })
        }
      >
        <ReadinessChecklist label={t('clarifications.addendumPage.readiness')} items={readiness} />
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'issue'}
        title={t('clarifications.addendumPage.issueDialog.title')}
        scope={scope}
        consequence={t('clarifications.addendumPage.issueDialog.consequence', {
          count: eligibleRecipients.length,
        })}
        confirmLabel={t('clarifications.addendumPage.action.issue')}
        pending={issue.pending}
        error={explainError(issue.error)}
        acknowledgement={t('clarifications.addendumPage.issueDialog.acknowledge')}
        onCancel={close(issue.reset)}
        onConfirm={() =>
          attempt(async () => {
            const next = await issue.mutate({
              params: { addendumId: addendum.id },
              body: { confirmed: true },
            });
            done(next, t('clarifications.addendumPage.toast.issued'));
          })
        }
      >
        <div className="tiq-stack">
          {addendum.newSubmissionDeadline !== null && (
            <OfficialDeadline
              variant="block"
              label={t('clarifications.addendumPage.newDeadline')}
              deadline={addendum.newSubmissionDeadline}
            />
          )}
          <p>{t(`clarifications.existingAction.${addendum.existingSubmissionAction}`)}</p>
          <ul aria-label={t('clarifications.addendumPage.recipients')}>
            {eligibleRecipients.map((participant) => (
              <li key={participant.supplier.tenantId}>
                {participant.supplier.name}
                {participant.hasEffectiveSubmission &&
                  ` · ${t('clarifications.addendumPage.priorReceipt', {
                    receipt: participant.effectiveReceiptNo ?? EMPTY_VALUE,
                  })}`}
              </li>
            ))}
          </ul>
        </div>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        open={dialog === 'withdraw'}
        tone="danger"
        title={t('clarifications.addendumPage.withdrawDialog.title')}
        scope={scope}
        consequence={t('clarifications.addendumPage.withdrawDialog.consequence')}
        confirmLabel={t('clarifications.addendumPage.action.withdraw')}
        pending={withdraw.pending}
        error={explainError(withdraw.error)}
        reason={{ label: t('clarifications.common.reason'), required: true }}
        onCancel={close(withdraw.reset)}
        onConfirm={({ reason }) =>
          attempt(async () => {
            const next = await withdraw.mutate({
              params: { addendumId: addendum.id },
              body: { reason },
            });
            done(next, t('clarifications.addendumPage.toast.withdrawn'));
          })
        }
      />

      <ConfirmActionDialog
        open={dialog === 'remind'}
        title={t('clarifications.addendumPage.remindDialog.title')}
        scope={scope}
        consequence={t('clarifications.addendumPage.remindDialog.consequence', {
          count: outstanding,
        })}
        confirmLabel={t('clarifications.addendumPage.action.remind')}
        pending={remind.pending}
        error={explainError(remind.error)}
        onCancel={close(remind.reset)}
        onConfirm={() =>
          attempt(async () => {
            const result = await remind.mutate({
              params: { addendumId: addendum.id },
              body: {},
            });
            setDialog(null);
            toast.show(
              t('clarifications.addendumPage.toast.reminded', {
                count: result.reminded.length,
              }),
              'success',
            );
          })
        }
      />
    </>
  );
}

function RecipientsTable({
  recipients,
  timeZone,
}: {
  readonly recipients: readonly AddendumRecipient[];
  readonly timeZone: string;
}) {
  return (
    <DataTable<AddendumRecipient>
      caption={t('clarifications.addendumPage.recipients')}
      rows={recipients}
      rowKey={(row) => String(row.supplier.tenantId)}
      empty={
        <EmptyState
          compact
          icon="send"
          title={t('clarifications.addendumPage.noRecipients')}
          description={t('clarifications.addendumPage.noRecipientsHint')}
        />
      }
      columns={[
        {
          id: 'supplier',
          header: t('clarifications.addendumPage.col.supplier'),
          cell: (row) => row.supplier.name,
        },
        {
          id: 'delivery',
          header: t('clarifications.addendumPage.col.delivery'),
          cell: (row) => (
            <div className="tiq-stack">
              <StatusChip
                enum="notice_recipients.delivery_status"
                value={row.deliveryStatus}
                size="sm"
              />
              {row.failureReason !== null && (
                <span className="tiq-cell-sub tiq-text-danger">{row.failureReason}</span>
              )}
              {row.deliveredAt !== null && (
                <span className="tiq-cell-sub">{formatDateTime(row.deliveredAt, timeZone)}</span>
              )}
            </div>
          ),
        },
        {
          id: 'opened',
          header: t('clarifications.addendumPage.col.opened'),
          cell: (row) => formatDateTime(row.openedAt, timeZone),
        },
        {
          id: 'acknowledged',
          header: t('clarifications.addendumPage.col.acknowledged'),
          cell: (row) =>
            row.acknowledgedAt === null ? (
              <span className="tiq-text-warning">
                {t('clarifications.addendumPage.notAcknowledged')}
              </span>
            ) : (
              <>
                {formatDateTime(row.acknowledgedAt, timeZone)}
                <div className="tiq-cell-sub">{row.acknowledgedBy?.fullName ?? EMPTY_VALUE}</div>
              </>
            ),
        },
        {
          id: 'receipt',
          header: t('clarifications.addendumPage.col.priorReceipt'),
          cell: (row) =>
            row.priorReceiptNo === null ? (
              <span className="tiq-text-muted">
                {t('clarifications.addendumPage.noSubmission')}
              </span>
            ) : (
              <>
                <span className="tiq-mono">{row.priorReceiptNo}</span>
                <div className="tiq-cell-sub">
                  {row.priorReceiptStillEffective
                    ? t('clarifications.addendumPage.receiptValid')
                    : t('clarifications.addendumPage.receiptSuperseded')}
                </div>
              </>
            ),
        },
        {
          id: 'action',
          header: t('clarifications.addendumPage.col.requiredAction'),
          cell: (row) => (
            <div className="tiq-stack">
              <StatusChip
                enum="addenda.existing_submission_action"
                value={row.requiredAction}
                size="sm"
              />
              {row.requiredAction !== 'none' && (
                <span
                  className={
                    row.requiredActionCompleted
                      ? 'tiq-cell-sub tiq-text-success'
                      : 'tiq-cell-sub tiq-text-warning'
                  }
                >
                  {row.requiredActionCompleted
                    ? t('clarifications.addendumPage.actionDone')
                    : t('clarifications.addendumPage.actionOutstanding')}
                </span>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}
